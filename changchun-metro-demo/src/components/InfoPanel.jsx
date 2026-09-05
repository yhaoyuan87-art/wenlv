import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { getDistrict, findDistrictByPoint, cityInfo } from '../data/districts.js'
import { metroLines, getLine, getStation, getNeighbors } from '../data/metroLines.js'
import { poisByDistrict, poisByStation, poisByLine, getCategory, getPoi } from '../data/pois.js'

function districtStats(districtId) {
  const lines = metroLines.filter((line) =>
    line.stations.some((s) => findDistrictByPoint(s.x, s.y)?.districtId === districtId)
  )
  const stations = lines.flatMap((line) =>
    line.stations.filter((s) => findDistrictByPoint(s.x, s.y)?.districtId === districtId)
  )
  const pois = poisByDistrict(districtId)
  return { lines, stations, pois }
}

/**
 * 桌面端是右上角浮层，手机端是底部抽屉（带抓手柄，可折叠收起）。
 * 手柄本身由 CSS 在非手机断点隐藏，所以桌面端永远不会进入折叠态。
 */
function Panel({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const layer = useStore((s) => s.layer)
  const districtId = useStore((s) => s.districtId)
  const lineId = useStore((s) => s.lineId)
  const stationId = useStore((s) => s.stationId)

  // 用 key 重置：选中对象变化时重新挂载组件 → collapsed 自动回到展开态，
  // 避免用户收起后误以为面板没更新。比直接在 effect 里 setState 更干净。
  return (
    <aside
      key={`${layer}-${districtId || ''}-${lineId || ''}-${stationId || ''}`}
      className={'info-panel' + (collapsed ? ' collapsed' : '')}
    >
      <button
        className="panel-handle"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? '展开详情' : '收起详情'}
      >
        <i />
        <span>{collapsed ? '展开详情' : '收起'}</span>
      </button>
      <div className="panel-scroll">{children}</div>
    </aside>
  )
}

export default function InfoPanel() {
  const layer = useStore((s) => s.layer)
  const districtId = useStore((s) => s.districtId)
  const lineId = useStore((s) => s.lineId)
  const stationId = useStore((s) => s.stationId)
  const poiId = useStore((s) => s.poiId)
  const goLayer = useStore((s) => s.goLayer)
  const openDrawer = useStore((s) => s.openDrawer)
  const selectStation = useStore((s) => s.selectStation)
  const selectLine = useStore((s) => s.selectLine)
  const resetViewToken = useStore((s) => s.resetViewToken)

  void resetViewToken

  if (layer === 'poi') return null

  const district = districtId ? getDistrict(districtId) : null

  if (layer === 'city') {
    if (!district) {
      return (
        <Panel>
          <h3>{cityInfo.name} · 城市概览</h3>
          <p className="muted">{cityInfo.subtitle}</p>
          <div className="city-stat-grid">
            {cityInfo.stats.map((s) => (
              <div key={s.label} className="city-stat">
                <b>{s.value}</b>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
          <div className="kv">
            <span>机场</span>
            <i>{cityInfo.airport.note}</i>
          </div>
          <p className="muted small-note">{cityInfo.demoScope}</p>
          <h4>选择一个分区开始探索</h4>
          <div className="district-quick">
            {[...new Set(metroLines.flatMap((l) => l.stations.map((s) => findDistrictByPoint(s.x, s.y)?.districtId)))]
              .filter(Boolean)
              .map((id) => getDistrict(id))
              .filter(Boolean)
              .map((d) => (
                <QuickDistrict key={d.districtId} d={d} />
              ))}
          </div>
          <button className="btn ghost" onClick={() => useStore.setState({ resetViewToken: (resetViewToken || 0) + 1 })}>
            重置视角
          </button>
        </Panel>
      )
    }
    const stats = districtStats(district.districtId)
    return (
      <Panel>
        <h3>{district.name}</h3>
        <p className="muted">{district.intro}</p>
        <div className="stat-row">
          <div className="stat">
            <b>{stats.lines.length}</b>
            <span>地铁线路</span>
          </div>
          <div className="stat">
            <b>{stats.stations.length}</b>
            <span>站点</span>
          </div>
          <div className="stat">
            <b>{stats.pois.length}</b>
            <span>景点</span>
          </div>
        </div>
        <div className="panel-lines">
          {stats.lines.map((l) => (
            <span key={l.lineId} className="line-badge" style={{ background: l.color }}>
              {l.shortName}
            </span>
          ))}
        </div>
        <h4>推荐探索</h4>
        <div className="mini-pois">
          {stats.pois.slice(0, 4).map((p) => (
            <button key={p.poiId} className="mini-poi" onClick={() => { openDrawer(p.poiId); goLayer('poi') }}>
              <i style={{ background: getCategory(p.category).color }} />
              {p.name}
            </button>
          ))}
          {stats.pois.length === 0 && <span className="muted">暂无收录景点</span>}
        </div>
        <button className="btn primary" onClick={() => goLayer('metro')}>
          进入地铁层 →
        </button>
      </Panel>
    )
  }

  if (layer === 'metro') {
    const station = stationId ? getStation(stationId) : null
    if (station) {
      const line = station.line
      const nb = getNeighbors(station.stationId)
      const nearPois = poisByStation(station.stationId)
      return (
        <Panel>
          <span className="panel-kicker" style={{ color: line.color }}>{line.name}</span>
          <h3>{station.name}站</h3>
          <div className="stat-row">
            <div className="stat">
              <b>{station.index + 1}</b>
              <span>站序 / 共 {line.stations.length} 站</span>
            </div>
            <div className="stat">
              <b>{(station.transfer || []).length}</b>
              <span>换乘线路</span>
            </div>
            <div className="stat">
              <b>{nearPois.length}</b>
              <span>周边景点</span>
            </div>
          </div>
          <div className="neighbor-row">
            <button className={'nb' + (nb.prev ? '' : ' none')} disabled={!nb.prev} onClick={() => nb.prev && selectStation(nb.prev.stationId)}>
              ◀ {nb.prev ? nb.prev.name : '端点'}
            </button>
            <button className={'nb' + (nb.next ? '' : ' none')} disabled={!nb.next} onClick={() => nb.next && selectStation(nb.next.stationId)}>
              {nb.next ? nb.next.name : '端点'} ▶
            </button>
          </div>
          <div className="kv">
            <span>方向</span>
            <i>{line.direction}</i>
          </div>
          {(station.transfer || []).length > 0 && (
            <div className="kv">
              <span>可换乘</span>
              <i>
                {station.transfer.map((tid) => getLine(tid)).filter(Boolean).map((l) => (
                  <span key={l.lineId} className="line-badge" style={{ background: l.color }}>
                    {l.shortName}
                  </span>
                ))}
              </i>
            </div>
          )}
          <h4>周边景点</h4>
          <div className="mini-pois">
            {nearPois.map((p) => (
              <button key={p.poiId} className="mini-poi" onClick={() => { openDrawer(p.poiId); goLayer('poi', {}) }}>
                <i style={{ background: getCategory(p.category).color }} />
                {p.name}
              </button>
            ))}
            {nearPois.length === 0 && <span className="muted">该站周边暂无收录景点</span>}
          </div>
          <button className="btn primary" onClick={() => goLayer('poi')}>
            进入沿线景点 →
          </button>
        </Panel>
      )
    }
    const line = lineId ? getLine(lineId) : null
    if (line) {
      const poisOnLine = poisByLine(line.lineId)
      const transferStations = line.stations.filter((s) => (s.transfer || []).length)
      return (
        <Panel>
          <span className="panel-kicker" style={{ color: line.color }}>
            <b className="line-dot" style={{ background: line.color }} />
            {line.name}
          </span>
          <h3>{line.direction}</h3>
          {line.status && <p className="muted small-note">{line.status}</p>}
          <div className="stat-row">
            <div className="stat">
              <b>{line.stations.length}</b>
              <span>站点</span>
            </div>
            <div className="stat">
              <b>{transferStations.length}</b>
              <span>换乘站</span>
            </div>
            <div className="stat">
              <b>{poisOnLine.length}</b>
              <span>沿线景点</span>
            </div>
          </div>
          <h4>站点顺序</h4>
          <div className="station-chain">
            {line.stations.map((s) => (
              <button
                key={s.stationId}
                className={'chain-stop' + (stationId === s.stationId ? ' sel' : '')}
                onClick={() => selectStation(s.stationId)}
              >
                <i style={{ background: (s.transfer || []).length ? '#fff' : line.color }} />
                {s.name}
              </button>
            ))}
          </div>
          <button className="btn primary" onClick={() => goLayer('poi')}>
            查看沿线景点 →
          </button>
        </Panel>
      )
    }
    return (
      <Panel>
        <h3>地铁空间层</h3>
        <p className="muted">地下线路已抬升显示，白色节点为换乘站。点击线路查看走向，点击站点查看详情与周边景点。</p>
        <div className="panel-lines">
          {metroLines.map((l) => (
            <button key={l.lineId} className="line-badge clickable" style={{ background: l.color }} onClick={() => selectLine(l.lineId)}>
              {l.shortName} · {l.stations.length}站
            </button>
          ))}
        </div>
      </Panel>
    )
  }

  if (layer === 'map2d') {
    const poi = poiId ? getPoi(poiId) : null
    return (
      <Panel>
        <h3>2D 关系总览</h3>
        <p className="muted">同时查看分区、地铁与景点。点击对象可跳回对应层级，顶部工具条可开关图层。</p>
        {district && (
          <div className="kv">
            <span>当前区域</span>
            <i>{district.name}</i>
          </div>
        )}
        {lineId && (
          <div className="kv">
            <span>当前线路</span>
            <i>{getLine(lineId)?.name}</i>
          </div>
        )}
        {stationId && (
          <div className="kv">
            <span>当前站点</span>
            <i>{getStation(stationId)?.name}站</i>
          </div>
        )}
        {poi && (
          <div className="kv">
            <span>当前景点</span>
            <i>{poi.name}</i>
          </div>
        )}
        <button className="btn ghost" onClick={() => goLayer('city')}>
          回到城市 3D
        </button>
      </Panel>
    )
  }

  return null
}

function QuickDistrict({ d }) {
  const selectDistrict = useStore((s) => s.selectDistrict)
  return (
    <button className="mini-poi" onClick={() => selectDistrict(d.districtId)}>
      <i style={{ background: d.color }} />
      {d.name}
    </button>
  )
}
