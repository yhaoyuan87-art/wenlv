import { useMemo, useState } from 'react'
import { districts, yitongRiver } from '../data/districts.js'
import { metroLines } from '../data/metroLines.js'
import { pois, getPoi, getCategory } from '../data/pois.js'
import { useMediaQuery } from '../hooks/useMediaQuery.js'

/** 触屏或窄屏：需要放大点击热区 */
const COARSE_QUERY = '(pointer: coarse), (max-width: 720px)'

function riverPath() {
  return yitongRiver.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ')
}

// 业务坐标最初以 1000 × 760 画布录入，现已按 2026 官方线网图（1440 × 1340）逐站校准；
// 这里统一投影到校准时的参考坐标系，tooltip 的百分比定位也基于同一套视窗。
const MAP_OFFSET_X = 40
const MAP_OFFSET_Y = 230
const MAP_SCALE_X = 1
const MAP_SCALE_Y = 1.12
// 视窗收紧到线网实际范围（含东侧机场标记），地图在卡片里更大更饱满
const VIEW = { x: 100, y: 80, w: 1240, h: 1100 }
const toReferencePoint = (x, y) => ({
  x: MAP_OFFSET_X + x * MAP_SCALE_X,
  y: MAP_OFFSET_Y + y * MAP_SCALE_Y
})

export default function City2DMap({
  show = { districts: true, lines: true, stations: true, pois: true, labels: true },
  filterPoiIds = null,
  highlight = {},
  routePoiIds = null,
  districtPoiCounts = null,
  onSelect,
  showPoiNames = 'all',
  poiSize = 7
}) {
  // 不再使用官方网络图作为底图（俊博要求移除）；恢复矢量线路渲染，
  // 站点坐标已按官方图逐站校准，矢量走线与真实分布一致。
  const referenceMap = false
  const [hover, setHover] = useState(null)
  const coarse = useMediaQuery(COARSE_QUERY)

  const poiList = useMemo(
    () => (filterPoiIds ? pois.filter((p) => filterPoiIds.includes(p.poiId)) : pois),
    [filterPoiIds]
  )

  const routeLine = useMemo(() => {
    if (!routePoiIds || routePoiIds.length < 2) return null
    const pts = routePoiIds.map((id) => getPoi(id)).filter(Boolean)
    return pts
  }, [routePoiIds])

  const labelVisible = useMemo(() => {
    const cands = []
    if (show.districts && show.labels) {
      districts.forEach((d) => {
        cands.push({ key: 'dl-' + d.districtId, x: d.label[0], y: d.label[1], w: d.name.length * 15 + 12, h: 18, prio: 2.5 })
      })
    }
    if (show.stations && show.labels) {
      metroLines.forEach((line) =>
        line.stations.forEach((s) => {
          const isTransfer = (s.transfer || []).length > 0
          const isSel = highlight.stationId === s.stationId
          if (!isTransfer && !isSel) return
          cands.push({ key: 'sl-' + s.stationId, x: s.x, y: s.y - 11, w: s.name.length * 12 + 22, h: 16, prio: isSel ? 3 : 2 })
        })
      )
    }
    if (show.pois) {
      poiList.forEach((p) => {
        const isHL = highlight.poiId === p.poiId
        const wantName = showPoiNames === 'all' || (showPoiNames === 'hot' && p.hot) || isHL
        if (!wantName) return
        cands.push({ key: 'pl-' + p.poiId, x: p.x, y: p.y - poiSize - 6, w: p.name.length * 11 + 10, h: 14, prio: isHL ? 3 : p.hot ? 1.5 : 1 })
      })
    }
    cands.sort((a, b) => b.prio - a.prio)
    const placed = []
    const visible = new Set()
    for (const c of cands) {
      const box = { x1: c.x - c.w / 2, x2: c.x + c.w / 2, y1: c.y - c.h, y2: c.y }
      if (placed.some((b) => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1)) continue
      placed.push(box)
      visible.add(c.key)
    }
    return visible
  }, [poiList, showPoiNames, show, highlight.stationId, highlight.poiId, poiSize])

  return (
    <div className="map2d-wrap">
      <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="map2d-svg" role="img" aria-label="长春城市轨道交通示意图">
        <defs>
          <radialGradient id="map-bg" cx="50%" cy="42%" r="75%">
            <stop offset="0%" stopColor="#101a30" />
            <stop offset="100%" stopColor="#0a0f1c" />
          </radialGradient>
          <pattern id="map-grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(90,130,200,0.08)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} fill="url(#map-bg)" />
        <rect x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} fill="url(#map-grid)" />

        <g transform={`translate(${MAP_OFFSET_X} ${MAP_OFFSET_Y}) scale(${MAP_SCALE_X} ${MAP_SCALE_Y})`}>

        <path d={riverPath()} fill="none" stroke="#2e6f8f" strokeWidth="12" strokeOpacity="0.55" strokeLinecap="round" strokeLinejoin="round" />
        <path d={riverPath()} fill="none" stroke="#57c4e5" strokeWidth="4.5" strokeOpacity="0.5" strokeLinecap="round" strokeLinejoin="round" />
        <text x="662" y="430" className="map-river-label" transform="rotate(80 662 430)">伊通河</text>

        {show.districts &&
          districts.map((d) => {
            const pts = d.polygon.map(([x, y]) => `${x},${y}`).join(' ')
            const isHL = highlight.districtId === d.districtId
            const dim = highlight.districtId && !isHL
            return (
              <polygon
                key={d.districtId}
                points={pts}
                fill={d.color}
                fillOpacity={referenceMap ? (isHL ? 0.18 : 0) : isHL ? 0.32 : dim ? 0.06 : 0.14}
                stroke={isHL ? '#38e1ff' : 'rgba(140,180,255,0.35)'}
                strokeOpacity={referenceMap ? (isHL ? 0.9 : 0) : 1}
                strokeWidth={isHL ? 2.5 : 1.2}
                className="map-clickable"
                onClick={() => onSelect && onSelect('district', d.districtId)}
              />
            )
          })}

        {routeLine && (
          <polyline
            points={routeLine.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#38e1ff"
            strokeWidth="2.5"
            strokeDasharray="8 6"
            strokeOpacity={referenceMap ? 0 : 0.9}
            strokeLinejoin="round"
          />
        )}

        {show.lines &&
          metroLines.map((line) => {
            const pts = line.stations.map((s) => `${s.x},${s.y}`).join(' ')
            const isHL = highlight.lineId === line.lineId
            const dim = highlight.lineId && !isHL
            return (
          <polyline
                key={line.lineId}
                points={pts}
                fill="none"
                stroke={line.color}
                strokeWidth={isHL ? 7 : dim ? 2.5 : 4.5}
                strokeOpacity={isHL ? 0.95 : referenceMap ? 0 : dim ? 0.25 : 0.8}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="map-clickable"
                onClick={() => onSelect && onSelect('line', line.lineId)}
              />
            )
          })}

        {routeLine &&
          routeLine.map((p, i) => (
            <g key={'rt-' + p.poiId} className="map-clickable" opacity={referenceMap ? 0 : 1} onClick={() => onSelect && onSelect('poi', p.poiId)}>
              <circle cx={p.x} cy={p.y} r="10" fill="#0a0f1c" stroke="#38e1ff" strokeWidth="2" />
              <text x={p.x} y={p.y + 4} textAnchor="middle" className="map-route-index">
                {i + 1}
              </text>
            </g>
          ))}

        {show.stations &&
          metroLines.map((line) =>
            line.stations.map((s) => {
              const isTransfer = (s.transfer || []).length > 0
              const isHL = highlight.stationId === s.stationId
              const dim = highlight.lineId && highlight.lineId !== line.lineId
              return (
                <circle
                  key={s.stationId}
                  cx={s.x}
                  cy={s.y}
                  r={isHL ? 8 : isTransfer ? 6 : 4.5}
                  fill={isTransfer ? '#ffffff' : line.color}
                  stroke={isHL ? '#38e1ff' : '#0a0f1c'}
                  strokeOpacity={referenceMap ? (isHL ? 1 : 0) : 1}
                  strokeWidth={isHL ? 3 : isTransfer ? 2 : 1.5}
                  fillOpacity={referenceMap ? (isHL ? 1 : 0) : dim ? 0.25 : 1}
                  className="map-clickable"
                  onClick={() => onSelect && onSelect('station', s.stationId)}
                  onMouseEnter={() => setHover({ type: 'station', data: s, line })}
                  onMouseLeave={() => setHover(null)}
                />
              )
            })
          )}

        {show.districts &&
          show.labels &&
          districts.map((d) =>
            labelVisible.has('dl-' + d.districtId) ? (
              <text
                key={'dl-' + d.districtId}
                x={d.label[0]}
                y={d.label[1]}
                className="map-district-label"
                textAnchor="middle"
              >
                {d.name}
              </text>
            ) : null
          )}

        {/* 区划景点聚合气泡：中观视图用数字代替逐点散布，点击等同点区划 */}
        {show.districts &&
          districtPoiCounts &&
          districtPoiCounts.map(({ id, count }) => {
            const d = districts.find((x) => x.districtId === id)
            if (!d || !count) return null
            const cx = d.label[0]
            const cy = d.label[1] + 26
            const isHL = highlight.districtId === id
            return (
              <g
                key={'agg-' + id}
                className="map-agg map-clickable"
                onClick={() => onSelect && onSelect('district', id)}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHL ? 15 : 13}
                  fill="#0a0f1c"
                  fillOpacity="0.85"
                  stroke={d.color}
                  strokeWidth={isHL ? 2.5 : 1.5}
                  strokeOpacity="0.95"
                />
                <text x={cx} y={cy + 4} textAnchor="middle" className="map-agg-num">
                  {count}
                </text>
                <title>
                  {d.name} · {count} 个景点
                </title>
              </g>
            )
          })}

        {show.stations &&
          show.labels &&
          metroLines.map((line) =>
            line.stations.map((s) => {
              const isTransfer = (s.transfer || []).length > 0
              const isSel = highlight.stationId === s.stationId
              if ((!isTransfer && !isSel) || !labelVisible.has('sl-' + s.stationId)) return null
              if (referenceMap) return null
              return (
                <text
                  key={'sl-' + s.stationId}
                  x={s.x}
                  y={s.y - 11}
                  className={'map-station-label' + (isSel ? ' sel' : '')}
                  textAnchor="middle"
                >
                  {s.name}
                </text>
              )
            })
          )}

        {show.pois &&
          poiList.map((p) => {
            const cat = getCategory(p.category)
            const isHL = highlight.poiId === p.poiId
            const inRoute = routePoiIds && routePoiIds.includes(p.poiId)
            return (
              <g
                key={p.poiId}
                className="map-clickable"
                opacity={referenceMap ? 0 : 1}
                onClick={() => onSelect && onSelect('poi', p.poiId)}
                onMouseEnter={() => setHover({ type: 'poi', data: p })}
                onMouseLeave={() => setHover(null)}
              >
                {isHL && <circle cx={p.x} cy={p.y} r={poiSize + 5} fill="none" stroke="#38e1ff" strokeWidth="2" className="poi-pulse" />}
                <circle cx={p.x} cy={p.y} r={isHL ? poiSize + 2 : poiSize} fill={cat.color} stroke="#0a0f1c" strokeWidth="1.5" />
                {inRoute ? (
                  <text x={p.x} y={p.y + 3.5} textAnchor="middle" className="map-route-index small">
                    {routePoiIds.indexOf(p.poiId) + 1}
                  </text>
                ) : (
                  <circle cx={p.x} cy={p.y} r="2.2" fill="#0a0f1c" />
                )}
                {(showPoiNames === 'all' || (showPoiNames === 'hot' && p.hot) || isHL) &&
                  !inRoute &&
                  labelVisible.has('pl-' + p.poiId) && (
                    <text x={p.x} y={p.y - poiSize - 6} className="map-poi-label" textAnchor="middle">
                      {p.name}
                    </text>
                  )}
              </g>
            )
          })}

        {/* 触摸热区：SVG 里的站点/景点圆点在手机上只有几像素，手指点不中。
            叠一层透明的更大判定圈（fill=transparent 可被命中，fill=none 不行），
            仅在触屏或窄屏渲染；景点画在站点之后，因此优先级更高。 */}
        {coarse && (
            <g className="map-hit-layer">
            {show.stations &&
              metroLines.map((line) =>
                line.stations.map((s) => (
                  <circle
                    key={'hs-' + s.stationId}
                    cx={s.x}
                    cy={s.y}
                    r="18"
                    fill="transparent"
                    onClick={() => onSelect && onSelect('station', s.stationId)}
                  />
                ))
              )}
            {show.pois &&
              poiList.map((p) => (
                <circle
                  key={'hp-' + p.poiId}
                  cx={p.x}
                  cy={p.y}
                  r={poiSize + 14}
                  fill="transparent"
                  onClick={() => onSelect && onSelect('poi', p.poiId)}
                />
              ))}
          </g>
        )}

        <g className="map-airport">
          <circle cx="1260" cy="300" r="5" fill="none" stroke="#ffb457" strokeWidth="2" />
          <text x="1260" y="284" textAnchor="middle" className="map-airport-label">龙嘉机场</text>
        </g>
        </g>
      </svg>

      {hover && (
        <div
          className="map-tooltip"
          style={{
            left: `${((toReferencePoint(hover.data.x, hover.data.y).x - VIEW.x) / VIEW.w) * 100}%`,
            top: `${((toReferencePoint(hover.data.x, hover.data.y).y - VIEW.y) / VIEW.h) * 100}%`
          }}
        >
          {hover.type === 'poi' ? (
            <>
              <b>{hover.data.name}</b>
              <span>{getCategory(hover.data.category).name} · {hover.data.duration}</span>
            </>
          ) : (
            <>
              <b>{hover.data.name}站</b>
              <span>{hover.line.shortName}{(hover.data.transfer || []).length ? ' · 换乘站' : ''}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
