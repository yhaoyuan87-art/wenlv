import { useMemo } from 'react'
import City2DMap from '../components/City2DMap.jsx'
import ThemePicker from '../components/ThemePicker.jsx'
import { useStore } from '../store/useStore.js'
import { themePois } from '../data/themes.js'

const TOGGLES = [
  { key: 'districts', label: '分区' },
  { key: 'lines', label: '地铁线路' },
  { key: 'stations', label: '站点' },
  { key: 'pois', label: '景点' },
  { key: 'labels', label: '文字标签' }
]

export default function MapLayer() {
  const visibility = useStore((s) => s.mapVisibility)
  const toggle = useStore((s) => s.toggleMapVisibility)
  const districtId = useStore((s) => s.districtId)
  const lineId = useStore((s) => s.lineId)
  const stationId = useStore((s) => s.stationId)
  const poiId = useStore((s) => s.poiId)
  const themeId = useStore((s) => s.themeId)
  const openDrawer = useStore((s) => s.openDrawer)
  const goLayer = useStore((s) => s.goLayer)
  const selectDistrict = useStore((s) => s.selectDistrict)
  const selectStation = useStore((s) => s.selectStation)

  const onSelect = (type, id) => {
    if (type === 'poi') openDrawer(id)
    else if (type === 'district') selectDistrict(id, { goMetro: false })
    else if (type === 'station') selectStation(id)
    else if (type === 'line') goLayer('metro', { lineId: id, stationId: null })
  }

  const stats = useMemo(() => {
    return { hint: '点击分区、线路、站点或景点，跳转到对应层级继续探索' }
  }, [])

  const routeIds = useMemo(() => (themeId ? themePois(themeId).map((p) => p.poiId) : null), [themeId])

  return (
    <div className="map-layer">
      <div className="map-toolbar">
        <span className="map-toolbar-title">图层控制</span>
        {TOGGLES.map((t) => (
          <button
            key={t.key}
            className={'chip' + (visibility[t.key] ? ' on' : '')}
            onClick={() => toggle(t.key)}
          >
            {t.label}
          </button>
        ))}
        <span className="map-hint">{stats.hint}</span>
      </div>
      <ThemePicker />
      <div className="map2d-host">
        <City2DMap
          show={visibility}
          highlight={{ districtId, lineId, stationId, poiId }}
          routePoiIds={themeId ? routeIds : null}
          onSelect={onSelect}
          showPoiNames={visibility.labels ? 'hot' : 'none'}
          poiSize={6}
        />
      </div>
    </div>
  )
}
