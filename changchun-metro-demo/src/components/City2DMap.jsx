import { useMemo, useState } from 'react'
import { districts, yitongRiver } from '../data/districts.js'
import { metroLines } from '../data/metroLines.js'
import { pois, getPoi, getCategory } from '../data/pois.js'

function riverPath() {
  return yitongRiver.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ')
}

export default function City2DMap({
  show = { districts: true, lines: true, stations: true, pois: true, labels: true },
  filterPoiIds = null,
  highlight = {},
  routePoiIds = null,
  onSelect,
  showPoiNames = 'all',
  poiSize = 7
}) {
  const [hover, setHover] = useState(null)

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
      <svg viewBox="0 0 1000 760" className="map2d-svg" role="img" aria-label="长春城市平面图">
        <defs>
          <radialGradient id="map-bg" cx="50%" cy="42%" r="75%">
            <stop offset="0%" stopColor="#101a30" />
            <stop offset="100%" stopColor="#0a0f1c" />
          </radialGradient>
          <pattern id="map-grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(90,130,200,0.08)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="1000" height="760" fill="url(#map-bg)" />
        <rect x="0" y="0" width="1000" height="760" fill="url(#map-grid)" />

        <path d={riverPath()} fill="none" stroke="#2e6f8f" strokeWidth="9" strokeOpacity="0.55" strokeLinecap="round" strokeLinejoin="round" />
        <path d={riverPath()} fill="none" stroke="#57c4e5" strokeWidth="3" strokeOpacity="0.5" strokeLinecap="round" strokeLinejoin="round" />
        <text x="592" y="380" className="map-river-label" transform="rotate(78 592 380)">伊通河</text>

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
                fillOpacity={isHL ? 0.32 : dim ? 0.06 : 0.14}
                stroke={isHL ? '#38e1ff' : 'rgba(140,180,255,0.35)'}
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
            strokeOpacity="0.9"
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
                strokeOpacity={isHL ? 1 : dim ? 0.25 : 0.8}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="map-clickable"
                onClick={() => onSelect && onSelect('line', line.lineId)}
              />
            )
          })}

        {routeLine &&
          routeLine.map((p, i) => (
            <g key={'rt-' + p.poiId} className="map-clickable" onClick={() => onSelect && onSelect('poi', p.poiId)}>
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
                  strokeWidth={isHL ? 3 : isTransfer ? 2 : 1.5}
                  fillOpacity={dim ? 0.25 : 1}
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

        {show.stations &&
          show.labels &&
          metroLines.map((line) =>
            line.stations.map((s) => {
              const isTransfer = (s.transfer || []).length > 0
              const isSel = highlight.stationId === s.stationId
              if ((!isTransfer && !isSel) || !labelVisible.has('sl-' + s.stationId)) return null
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

        <g className="map-airport">
          <circle cx="940" cy="150" r="5" fill="none" stroke="#ffb457" strokeWidth="2" />
          <text x="940" y="134" textAnchor="middle" className="map-airport-label">龙嘉机场</text>
        </g>
      </svg>

      {hover && (
        <div
          className="map-tooltip"
          style={{ left: `${(hover.data.x / 1000) * 100}%`, top: `${(hover.data.y / 760) * 100}%` }}
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
