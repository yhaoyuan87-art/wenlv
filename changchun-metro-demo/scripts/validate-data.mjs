// 数据一致性校验：任何 JSON 数据修改后运行 `npm run check:data`
// 校验规则见 VALIDATORS，新增数据约束时在此补充
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data')
const load = (f) => JSON.parse(readFileSync(join(root, f), 'utf8'))

const metroLines = load('metro-lines.json')
const { pois } = load('pois.json')
const { districts, landmarks } = load('districts.json')
const themes = load('themes.json')

const errors = []
const warn = (msg) => errors.push(msg)

// 1. 换乘站两线坐标必须完全一致
const coordByKey = new Map()
for (const line of metroLines) {
  for (const s of line.stations) {
    coordByKey.set(s.stationId, { ...s, lineId: line.lineId })
  }
}
for (const line of metroLines) {
  for (const s of line.stations) {
    for (const tid of s.transfer || []) {
      const other = metroLines.find((l) => l.lineId === tid)
      if (!other) {
        warn(`${line.lineId} ${s.name}: transfer 引用不存在的线路 ${tid}`)
        continue
      }
      const twin = other.stations.find((o) => o.name === s.name)
      if (!twin) {
        warn(`${line.lineId} ${s.name}: 声明与 ${tid} 换乘，但 ${tid} 上没有同名站`)
      } else if (twin.x !== s.x || twin.y !== s.y) {
        warn(`${line.lineId}/${tid} 换乘站 ${s.name} 坐标不一致: (${s.x},${s.y}) vs (${twin.x},${twin.y})`)
      }
      if (!twin?.transfer?.includes(line.lineId)) {
        warn(`${line.lineId} ${s.name}: transfer 不对称（${tid} 未回指本线）`)
      }
    }
  }
}

// 2. stationId 唯一
const seen = new Set()
for (const line of metroLines) {
  for (const s of line.stations) {
    if (seen.has(s.stationId)) warn(`stationId 重复: ${s.stationId} (${s.name})`)
    seen.add(s.stationId)
  }
}

// 3. POI 引用有效
const districtIds = new Set(districts.map((d) => d.districtId))
for (const p of pois) {
  if (!districtIds.has(p.districtId)) warn(`${p.poiId} ${p.name}: districtId 无效 ${p.districtId}`)
  for (const sid of p.stationIds || []) {
    if (!coordByKey.has(sid)) warn(`${p.poiId} ${p.name}: stationId 无效 ${sid}`)
  }
  const g = p.stationGuide?.station
  if (g && !coordByKey.has(g)) warn(`${p.poiId} ${p.name}: stationGuide.station 无效 ${g}`)
}

// 4. 地标落在某个分区内（龙嘉机场除外，允许 null）
for (const lm of landmarks) {
  if (lm.districtId && !districtIds.has(lm.districtId)) warn(`地标 ${lm.name}: districtId 无效`)
}

// 5. 主题路线 POI 有效
for (const t of themes) {
  for (const pid of t.poiIds) {
    if (!pois.some((p) => p.poiId === pid)) warn(`主题 ${t.themeId}: poiId 无效 ${pid}`)
  }
}

if (errors.length) {
  console.error(`\n✗ 数据校验失败（${errors.length} 处）:\n`)
  errors.forEach((e) => console.error('  - ' + e))
  process.exit(1)
} else {
  console.log(`✓ 数据校验通过：${metroLines.length} 条线路 / ${seen.size} 站 / ${pois.length} 个景点 / ${themes.length} 条主题`)
}
