import { metroLines } from './metroLines.js'

/**
 * 站到站路径规划。
 *
 * 建图规则（数据来自 metro-lines.json，已由 check:data 校验换乘共点）：
 * - 节点：stationId（跨线同名站是不同 stationId，坐标相同）
 * - 线内相邻站：边权 = 站间运行时间 STOP_MINUTES
 * - 跨线同名站：边权 = 换乘惩罚 TRANSFER_MINUTES（同名站两两互连）
 *
 * 求解：Dijkstra（140 站规模，数组扫描足够）。
 */

const STOP_MINUTES = 2.2
const TRANSFER_MINUTES = 4

/**
 * 三种规划策略的边权（分钟）：
 * - fast：真实时间感（默认）
 * - transfer：换乘重罚 → 最少换乘
 * - stops：站数均权 → 最少站点
 */
const STRATEGIES = {
  fast: { stop: STOP_MINUTES, transfer: TRANSFER_MINUTES },
  transfer: { stop: 1, transfer: 12 },
  stops: { stop: 1, transfer: 1 }
}

const nodes = new Map()

function ensureNode(line, station) {
  let node = nodes.get(station.stationId)
  if (!node) {
    node = {
      stationId: station.stationId,
      name: station.name,
      lineId: line.lineId,
      lineName: line.name,
      shortName: line.shortName,
      color: line.color,
      x: station.x,
      y: station.y,
      index: -1,
      edges: []
    }
    nodes.set(station.stationId, node)
  }
  return node
}

const lineNodes = []
for (const line of metroLines) {
  const list = line.stations.map((s) => ensureNode(line, s))
  list.forEach((n, i) => {
    n.index = i
  })
  lineNodes.push({ line, list })
  for (let i = 1; i < list.length; i += 1) {
    list[i - 1].edges.push({ to: list[i], minutes: STOP_MINUTES, kind: 'stop' })
    list[i].edges.push({ to: list[i - 1], minutes: STOP_MINUTES, kind: 'stop' })
  }
}

// 跨线同名站互连为换乘边（同名站自身坐标一致，即物理换乘站）
const byName = new Map()
for (const { list } of lineNodes) {
  for (const n of list) {
    if (!byName.has(n.name)) byName.set(n.name, [])
    byName.get(n.name).push(n)
  }
}
for (const group of byName.values()) {
  for (let i = 0; i < group.length; i += 1) {
    for (let j = i + 1; j < group.length; j += 1) {
      if (group[i].lineId === group[j].lineId) continue
      group[i].edges.push({ to: group[j], minutes: TRANSFER_MINUTES, kind: 'transfer' })
      group[j].edges.push({ to: group[i], minutes: TRANSFER_MINUTES, kind: 'transfer' })
    }
  }
}

function dijkstra(originId, destId, w) {
  const origin = nodes.get(originId)
  const dest = nodes.get(destId)
  if (!origin || !dest) return null
  const dist = new Map()
  const prev = new Map()
  const visited = new Set()
  dist.set(origin.stationId, 0)
  while (true) {
    let best = null
    let bestDist = Infinity
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < bestDist) {
        best = id
        bestDist = d
      }
    }
    if (best == null) break
    if (best === destId) break
    visited.add(best)
    const node = nodes.get(best)
    for (const edge of node.edges) {
      const nd = bestDist + (edge.kind === 'transfer' ? w.transfer : w.stop)
      if (nd < (dist.get(edge.to.stationId) ?? Infinity)) {
        dist.set(edge.to.stationId, nd)
        prev.set(edge.to.stationId, { node, kind: edge.kind })
      }
    }
  }
  if (!dist.has(destId)) return null
  // 回溯路径（节点序列 + 每一步进入该节点的边类型）
  const chain = []
  let cur = dest
  while (cur) {
    const p = prev.get(cur.stationId)
    chain.unshift({ node: cur, kind: p ? p.kind : null })
    cur = p ? p.node : null
  }
  if (chain[0].node.stationId !== originId) return null
  return chain
}

/**
 * 计算站到站路径。
 * @param strategy 'fast'（最快，默认）| 'transfer'（最少换乘）| 'stops'（最少站点）
 * @returns {null|{
 *   originId: string, destId: string, strategy: string,
 *   stations: Array<{stationId,name,lineId,shortName,color,x,y,transferIn:boolean}>,
 *   segments: Array<{lineId,shortName,name,color,stationIds:string[],stops:number,toward,boardName,alightName}>,
 *   stops: number, transfers: number, minutes: number
 * }} 不可达 / 起终点相同 / 参数无效时返回 null
 */
export function findRoute(originId, destId, strategy = 'fast') {
  if (!originId || !destId || originId === destId) return null
  // 同名跨线站是同一座物理车站（下拉框按名去重，3D 点选仍可能命中两个 id）
  const o = nodes.get(originId)
  const d = nodes.get(destId)
  if (!o || !d || o.name === d.name) return null
  const w = STRATEGIES[strategy] || STRATEGIES.fast
  const chain = dijkstra(originId, destId, w)
  if (!chain) return null

  const stations = chain.map((c) => ({
    stationId: c.node.stationId,
    name: c.node.name,
    lineId: c.node.lineId,
    shortName: c.node.shortName,
    color: c.node.color,
    x: c.node.x,
    y: c.node.y,
    transferIn: c.kind === 'transfer'
  }))

  // 按线路聚合乘车段；0 站的段是「上车即换乘」，无乘车意义，直接过滤
  const segments = []
  let start = 0
  for (let i = 1; i <= chain.length; i += 1) {
    const lineChanged = i === chain.length || chain[i].node.lineId !== chain[start].node.lineId
    if (!lineChanged) continue
    const first = chain[start].node
    const last = chain[i - 1].node
    if (i - 1 > start) {
      const line = lineNodes.find((ln) => ln.line.lineId === first.lineId).line
      const forward = last.index > first.index
      segments.push({
        lineId: line.lineId,
        shortName: line.shortName,
        name: line.name,
        color: line.color,
        stationIds: chain.slice(start, i).map((c) => c.node.stationId),
        stops: i - 1 - start,
        // 「开往 xx 方向」：顺行开往线路末站，逆行开往首站
        toward: forward ? line.stations[line.stations.length - 1].name : line.stations[0].name,
        boardName: first.name,
        alightName: last.name
      })
    }
    start = i
  }

  let stops = 0
  let minutes = 0
  for (let i = 1; i < chain.length; i += 1) {
    minutes += chain[i].kind === 'transfer' ? w.transfer : w.stop
    if (chain[i].kind !== 'transfer') stops += 1
  }

  return {
    originId,
    destId,
    strategy: STRATEGIES[strategy] ? strategy : 'fast',
    stations,
    segments,
    stops,
    // 换乘次数 = 乘车段边界数，与行程卡片里的换乘行一一对应；
    // 「终点即换乘点」（终点站通过换乘边到达）不产生乘车段，不计入展示
    transfers: Math.max(0, segments.length - 1),
    minutes: Math.max(1, Math.round(minutes))
  }
}

/**
 * 串联有序站点为一条完整路线（主题一日线用）：
 * 相邻景点站之间复用 findRoute，跨段同线自动合并；
 * 每个入参站点自动生成序号旗标（3D 场景渲染为 .route-num 气泡）。
 * @param stationIds 有序站点 id；相邻同名站（同一物理站）自动去重
 * @param markerColor 旗标主题色（可选）
 * @returns {null|object} 结构同 findRoute，额外带 markers；任一段不可达返回 null
 */
export function buildChainRoute(stationIds, markerColor = null) {
  const stops = []
  for (const sid of stationIds) {
    if (!sid) continue
    const node = nodes.get(sid)
    if (!node) continue
    const prev = stops[stops.length - 1]
    if (prev && (prev.stationId === sid || prev.name === node.name)) continue
    stops.push(node)
  }
  if (stops.length < 2) return null

  const stations = []
  const segments = []
  let stopCount = 0
  let minutes = 0
  for (let i = 0; i < stops.length - 1; i += 1) {
    const leg = findRoute(stops[i].stationId, stops[i + 1].stationId)
    if (!leg) return null
    leg.stations.forEach((st, k) => {
      if (k === 0 && stations.length) return // 与上一段终点是同一座站
      stations.push(st)
    })
    leg.segments.forEach((seg) => {
      const last = segments[segments.length - 1]
      // 仅「同线且同方向」的续乘才合并；原线折返（参观后坐回）必须拆成两段如实展示
      if (last && last.lineId === seg.lineId && last.toward === seg.toward) {
        last.stationIds.push(...seg.stationIds.slice(1))
        last.stops += seg.stops
        last.alightName = seg.alightName
      } else {
        segments.push({ ...seg, stationIds: [...seg.stationIds] })
      }
    })
    stopCount += leg.stops
    minutes += leg.minutes
  }

  return {
    originId: stations[0].stationId,
    destId: stations[stations.length - 1].stationId,
    stations,
    segments,
    stops: stopCount,
    // 换乘次数只数「跨线边界」：同线折返（参观后原线坐回）不是换乘
    transfers: segments.filter((s, i) => i > 0 && s.lineId !== segments[i - 1].lineId).length,
    minutes,
    markers: stops.map((node, i) => ({
      stationId: node.stationId,
      lineId: node.lineId,
      text: String(i + 1),
      color: markerColor
    }))
  }
}

/**
 * 路径规划下拉框的站点选项：按线路分组，同名跨线站只保留首个，
 * 因为同名站物理上是同一座站（换乘边互通），任一 stationId 规划结果一致。
 */
export function stationOptions() {
  const seen = new Set()
  const groups = []
  for (const { line, list } of lineNodes) {
    const stations = []
    for (const n of list) {
      if (seen.has(n.name)) continue
      seen.add(n.name)
      stations.push({ stationId: n.stationId, name: n.name })
    }
    if (stations.length) groups.push({ lineId: line.lineId, shortName: line.shortName, color: line.color, stations })
  }
  return groups
}
