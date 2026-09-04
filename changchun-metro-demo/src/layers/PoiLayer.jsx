import { useMemo } from 'react'
import City2DMap from '../components/City2DMap.jsx'
import ThemePicker from '../components/ThemePicker.jsx'
import { useStore } from '../store/useStore.js'
import { poisByStation, poisByLine, poisByDistrict, pois, poiCategories, getCategory, getPoi } from '../data/pois.js'
import { getStation, getLine } from '../data/metroLines.js'
import { getDistrict } from '../data/districts.js'
import { themePois } from '../data/themes.js'

const SCOPES = [
  { id: 'station', label: '本站周边' },
  { id: 'line', label: '本线路' },
  { id: 'district', label: '本区域' },
  { id: 'all', label: '全城' }
]

export default function PoiLayer() {
  const layer = useStore((s) => s.layer)
  const stationId = useStore((s) => s.stationId)
  const lineId = useStore((s) => s.lineId)
  const districtId = useStore((s) => s.districtId)
  const poiId = useStore((s) => s.poiId)
  const poiScope = useStore((s) => s.poiScope)
  const categoryFilter = useStore((s) => s.categoryFilter)
  const themeId = useStore((s) => s.themeId)
  const setPoiScope = useStore((s) => s.setPoiScope)
  const setCategoryFilter = useStore((s) => s.setCategoryFilter)
  const openDrawer = useStore((s) => s.openDrawer)
  const selectStation = useStore((s) => s.selectStation)

  const scoped = useMemo(() => {
    if (themeId) return themePois(themeId)
    let list =
      poiScope === 'station' && stationId
        ? poisByStation(stationId)
        : poiScope === 'line' && lineId
          ? poisByLine(lineId)
          : poiScope === 'district' && districtId
            ? poisByDistrict(districtId)
            : pois
    return list
  }, [poiScope, stationId, lineId, districtId, themeId])

  const filtered = useMemo(
    () => (categoryFilter ? scoped.filter((p) => p.category === categoryFilter) : scoped),
    [scoped, categoryFilter]
  )

  const station = stationId ? getStation(stationId) : null
  const district = districtId ? getDistrict(districtId) : null

  const scopeHint = (() => {
    if (themeId) {
      const t = themePois(themeId)
      return t.length ? `主题路线 · ${t.length}站打卡` : null
    }
    if (poiScope === 'station' && station) return `${station.name}站周边`
    if (poiScope === 'line' && lineId) {
      const l = getLine(lineId)
      return l ? `${l.name}沿线` : null
    }
    if (poiScope === 'district' && district) return district.name
    return '全城景点'
  })()

  const onSelect = (type, id) => {
    if (type === 'poi') openDrawer(id)
    else if (type === 'station') selectStation(id)
  }

  return (
    <div className="poi-layer">
      <div className="poi-toolbar">
        <ThemePicker />
        <div className="scope-tabs">
          {SCOPES.map((sc) => {
            const disabled =
              (sc.id === 'station' && !stationId) || (sc.id === 'line' && !lineId) || (sc.id === 'district' && !districtId)
            return (
              <button
                key={sc.id}
                className={'chip' + (poiScope === sc.id && !themeId ? ' on' : '')}
                disabled={themeId ? true : disabled}
                onClick={() => setPoiScope(sc.id)}
              >
                {sc.label}
              </button>
            )
          })}
        </div>
        <div className="cat-tabs">
          <button className={'chip cat' + (!categoryFilter ? ' on' : '')} onClick={() => setCategoryFilter(null)}>
            全部类别
          </button>
          {poiCategories.map((c) => (
            <button
              key={c.id}
              className={'chip cat' + (categoryFilter === c.id ? ' on' : '')}
              onClick={() => setCategoryFilter(categoryFilter === c.id ? null : c.id)}
              style={{ borderColor: categoryFilter === c.id ? c.color : undefined }}
            >
              <i className="cat-dot" style={{ background: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
        <div className="poi-count">
          {filtered.length} 个景点{scopeHint ? ` · ${scopeHint}` : ''}
        </div>
      </div>

      <div className="poi-map-host">
        <City2DMap
          show={{ districts: true, lines: true, stations: true, pois: true, labels: true }}
          filterPoiIds={filtered.map((p) => p.poiId)}
          routePoiIds={themeId ? themePois(themeId).map((p) => p.poiId) : null}
          highlight={{ stationId, poiId, districtId }}
          onSelect={onSelect}
          showPoiNames={filtered.length <= 12 ? 'all' : 'hot'}
        />
      </div>

      <div className="poi-strip">
        {filtered.length === 0 && <div className="poi-strip-empty">当前筛选没有景点，换个范围或类别试试</div>}
        {filtered.map((p) => {
          const cat = getCategory(p.category)
          return (
            <button key={p.poiId} className={'poi-card' + (poiId === p.poiId ? ' sel' : '')} onClick={() => openDrawer(p.poiId)}>
              <span className="poi-card-color" style={{ background: cat.color }} />
              <span className="poi-card-body">
                <b>{p.name}</b>
                <span>{cat.name} · {p.duration} · {getDistrict(p.districtId)?.name}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
