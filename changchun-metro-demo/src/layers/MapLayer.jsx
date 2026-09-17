import { useMemo, useState } from 'react'
import City2DMap from '../components/City2DMap.jsx'
import { useStore } from '../store/useStore.js'
import { themePois, getTheme } from '../data/themes.js'
import { poisByDistrict, poisByLine, poisByStation, getCategory } from '../data/pois.js'
import { districts } from '../data/districts.js'
import { metroLines, getLine, getStation } from '../data/metroLines.js'

const TOGGLES = [
  { key: 'districts', label: '分区' },
  { key: 'lines', label: '地铁线路' },
  { key: 'stations', label: '站点' },
  { key: 'pois', label: '景点' },
  { key: 'labels', label: '文字标签' }
]

function inPoly(px, py, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const topPois = (list) => [...list].sort((a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0)).slice(0, 3)

export default function MapLayer() {
  const visibility = useStore((s) => s.mapVisibility)
  const toggle = useStore((s) => s.toggleMapVisibility)
  const districtId = useStore((s) => s.districtId)
  const lineId = useStore((s) => s.lineId)
  const stationId = useStore((s) => s.stationId)
  const themeId = useStore((s) => s.themeId)
  const openDrawer = useStore((s) => s.openDrawer)
  const goLayer = useStore((s) => s.goLayer)
  const selectDistrict = useStore((s) => s.selectDistrict)
  const selectStation = useStore((s) => s.selectStation)
  const selectLine = useStore((s) => s.selectLine)
  const setPoiScope = useStore((s) => s.setPoiScope)
  const setTheme = useStore((s) => s.setTheme)

  // 摘要卡：点区划/线路/站点先给「关系摘要 + 跨层跳转」，不直接跳层
  const [focus, setFocus] = useState(null)

  const agg = useMemo(
    () => districts.map((d) => ({ id: d.districtId, count: poisByDistrict(d.districtId).length })),
    []
  )
  const theme = themeId ? getTheme(themeId) : null
  const routeIds = useMemo(() => (themeId ? themePois(themeId).map((p) => p.poiId) : null), [themeId])

  const onSelect = (type, id) => {
    if (type === 'poi') {
      openDrawer(id)
      return
    }
    setFocus({ type, id })
    if (type === 'district') selectDistrict(id, { goMetro: false })
    else if (type === 'station') selectStation(id)
    else if (type === 'line') selectLine(id)
  }

  const brief = useMemo(() => {
    if (!focus) return null
    if (focus.type === 'district') {
      const d = districts.find((x) => x.districtId === focus.id)
      if (!d) return null
      const list = poisByDistrict(focus.id)
      const stCount = metroLines.reduce(
        (n, l) => n + l.stations.filter((s) => inPoly(s.x, s.y, d.polygon)).length,
        0
      )
      return {
        key: 'district-' + focus.id,
        title: d.name,
        color: d.color,
        sub: d.intro,
        rows: [
          ['地铁站', `${stCount} 站`],
          ['景点', `${list.length} 个`]
        ],
        top: topPois(list),
        actions: [
          { label: '看本区景点', run: () => { setPoiScope('district'); goLayer('poi') } },
          { label: '地铁层查看', run: () => selectDistrict(focus.id, { goMetro: true }) }
        ]
      }
    }
    if (focus.type === 'line') {
      const l = getLine(focus.id)
      if (!l) return null
      const list = poisByLine(focus.id)
      return {
        key: 'line-' + focus.id,
        title: l.name,
        color: l.color,
        sub: `方向：${l.direction}`,
        rows: [
          ['站点', `${l.stations.length} 站`],
          ['换乘站', `${l.stations.filter((s) => (s.transfer || []).length).length} 个`],
          ['沿线景点', `${list.length} 个`]
        ],
        top: topPois(list),
        actions: [
          { label: '地铁层看走向', run: () => goLayer('metro', { lineId: focus.id, stationId: null }) },
          { label: '看沿线景点', run: () => { setPoiScope('line'); goLayer('poi') } }
        ]
      }
    }
    const st = getStation(focus.id)
    if (!st) return null
    const list = poisByStation(focus.id)
    const transferN = (st.station.transfer || []).length + 1
    return {
      key: 'station-' + focus.id,
      title: `${st.name}站`,
      color: st.line.color,
      sub: `${st.line.shortName}${transferN > 1 ? ` · 可换乘 ${transferN} 条线` : ''}`,
      rows: [['周边景点', `${list.length} 个`]],
      top: topPois(list),
      actions: [
        { label: '看周边景点', run: () => selectStation(focus.id, { goPoi: true }) },
        { label: '地铁层查看', run: () => goLayer('metro', { lineId: st.line.lineId, stationId: focus.id }) }
      ]
    }
    // zustand 的 action 引用稳定，仅 focus 变化需要重算（显式列出以通过 hooks 规则）
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 见上
  }, [focus, setPoiScope, goLayer, selectDistrict, selectStation])

  return (
    <div className="map-layer">
      <div className="map-toolbar">
        <span className="map-toolbar-title">图层控制</span>
        {TOGGLES.map((t) => (
          <button key={t.key} className={'chip' + (visibility[t.key] ? ' on' : '')} onClick={() => toggle(t.key)}>
            {t.label}
          </button>
        ))}
        <span className="map-hint">点区划 / 线路 / 站点查看摘要并跳转对应层级</span>
      </div>

      {theme && (
        <div className="map-theme-legend">
          <i style={{ background: theme.color }} />
          <b>{theme.name}</b>
          <span>{theme.route}</span>
          <button onClick={() => setTheme(null)}>退出主题</button>
        </div>
      )}

      <div className="map2d-host">
        <City2DMap
          show={visibility}
          districtPoiCounts={visibility.districts ? agg : null}
          highlight={{ districtId, lineId, stationId, poiId: null }}
          routePoiIds={themeId ? routeIds : null}
          onSelect={onSelect}
          showPoiNames={visibility.labels ? 'hot' : 'none'}
          poiSize={6}
        />

        {brief && (
          <div className="map-brief" key={brief.key}>
            <div className="map-brief-head">
              <i style={{ background: brief.color }} />
              <b>{brief.title}</b>
              <button className="map-brief-close" onClick={() => setFocus(null)} aria-label="关闭摘要">
                ×
              </button>
            </div>
            {brief.sub && <p className="map-brief-sub">{brief.sub}</p>}
            <div className="map-brief-rows">
              {brief.rows.map(([k, v]) => (
                <span key={k}>
                  <em>{k}</em>
                  {v}
                </span>
              ))}
            </div>
            {brief.top && brief.top.length > 0 && (
              <div className="map-brief-top">
                <em>代表景点</em>
                {brief.top.map((p) => (
                  <button key={p.poiId} onClick={() => openDrawer(p.poiId)}>
                    <i className="cat-dot" style={{ background: getCategory(p.category).color }} />
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <div className="map-brief-actions">
              {brief.actions.map((a) => (
                <button key={a.label} onClick={a.run}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
