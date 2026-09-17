import { useMemo } from 'react'
import City2DMap from '../components/City2DMap.jsx'
import ThemePicker from '../components/ThemePicker.jsx'
import { PlaceholderMedia } from '../components/PlaceholderMedia.jsx'
import { useStore } from '../store/useStore.js'
import { poisByStation, poisByLine, poisByDistrict, pois, poiCategories, getCategory, getPoi } from '../data/pois.js'
import { getMedia } from '../data/media.js'
import { getStation, getLine } from '../data/metroLines.js'
import { getDistrict } from '../data/districts.js'
import { themePois, getTheme } from '../data/themes.js'
import { findRoute, buildChainRoute } from '../data/routePlanner.js'

const SCOPES = [
  { id: 'station', label: '本站周边' },
  { id: 'line', label: '本线路' },
  { id: 'district', label: '本区域' },
  { id: 'all', label: '全城' },
  { id: 'fav', label: '我的收藏' }
]

export default function PoiLayer() {
  const stationId = useStore((s) => s.stationId)
  const lineId = useStore((s) => s.lineId)
  const districtId = useStore((s) => s.districtId)
  const poiId = useStore((s) => s.poiId)
  const poiScope = useStore((s) => s.poiScope)
  const categoryFilter = useStore((s) => s.categoryFilter)
  const themeId = useStore((s) => s.themeId)
  const favorites = useStore((s) => s.favorites)
  const setMyRoute = useStore((s) => s.setMyRoute)
  const goLayer = useStore((s) => s.goLayer)
  const setPoiScope = useStore((s) => s.setPoiScope)
  const setCategoryFilter = useStore((s) => s.setCategoryFilter)
  const openDrawer = useStore((s) => s.openDrawer)
  const selectStation = useStore((s) => s.selectStation)

  // 用户选择的 scope 若缺少对应上下文（如未选站点），实际回退到更宽的范围；
  // 用 effectiveScope 保证 chip 选中态与真实列表一致
  const effectiveScope =
    poiScope === 'station' && stationId
      ? 'station'
      : poiScope === 'line' && lineId
        ? 'line'
        : poiScope === 'district' && districtId
          ? 'district'
          : poiScope === 'fav'
            ? 'fav'
            : 'all'

  const scoped = useMemo(() => {
    if (themeId) return themePois(themeId)
    if (effectiveScope === 'station') return poisByStation(stationId)
    if (effectiveScope === 'line') return poisByLine(lineId)
    if (effectiveScope === 'district') return poisByDistrict(districtId)
    if (effectiveScope === 'fav') return favorites.map((id) => getPoi(id)).filter(Boolean)
    return pois
  }, [effectiveScope, stationId, lineId, districtId, themeId, favorites])

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
    if (effectiveScope === 'station' && station) return `${station.name}站周边`
    if (effectiveScope === 'line' && lineId) {
      const l = getLine(lineId)
      return l ? `${l.name}沿线` : null
    }
    if (effectiveScope === 'district' && district) return district.name
    if (effectiveScope === 'fav') return '我的收藏'
    return '全城景点'
  })()

  // 主题行程：竖排时间轴 + 相邻景点间的接驳段（复用路径规划，展示「坐几站」）
  const theme = themeId ? getTheme(themeId) : null
  const themeList = useMemo(() => (themeId ? themePois(themeId) : []), [themeId])
  const themeHops = useMemo(() => {
    if (themeList.length < 2) return []
    const hops = []
    for (let i = 0; i < themeList.length - 1; i += 1) {
      const a = themeList[i].stationIds && themeList[i].stationIds[0]
      const b = themeList[i + 1].stationIds && themeList[i + 1].stationIds[0]
      const r = a && b && a !== b ? findRoute(a, b) : null
      hops.push(r ? { label: `${r.segments[0].shortName} · 坐${r.stops}站`, minutes: r.minutes } : null)
    }
    return hops
  }, [themeList])

  const onSelect = (type, id) => {
    if (type === 'poi') openDrawer(id)
    else if (type === 'station') selectStation(id)
  }

  // 收藏 ≥2 个时：按收藏顺序串成「我的路线」，地铁层复用流光动画演示
  const genMyRoute = () => {
    const ids = filtered.map((p) => p.stationIds && p.stationIds[0]).filter(Boolean)
    const r = buildChainRoute(ids, null)
    if (!r) return
    setMyRoute(r)
    goLayer('metro')
  }

  return (
    <div className="poi-layer">
      <div className="poi-toolbar">
        <div className="filter-row">
          <div className="scope-tabs">
            {SCOPES.map((sc) => {
              const disabled =
                (sc.id === 'station' && !stationId) || (sc.id === 'line' && !lineId) || (sc.id === 'district' && !districtId)
              return (
                <button
                  key={sc.id}
                  className={'chip' + (effectiveScope === sc.id && !themeId ? ' on' : '')}
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
        </div>
        <div className="poi-count">
          {filtered.length} 个景点{scopeHint ? ` · ${scopeHint}` : ''}
        </div>
      </div>
      <ThemePicker />

      <div className="poi-body">
        <div className="poi-main">
          {effectiveScope === 'fav' &&
            (filtered.length >= 2 ? (
              <button className="my-route-btn" onClick={genMyRoute}>
                串成我的路线 · 去地铁层看流光演示
              </button>
            ) : (
              <div className="my-route-btn ghost">在景点详情里点「收藏」，凑满 2 个就能一键串成路线</div>
            ))}
          {theme ? (
            <div className="theme-timeline">
              {themeList.map((p, i) => (
                <div key={p.poiId} className="tl-wrap">
                  <div className="tl-item">
                    <span className="tl-idx" style={{ background: theme.color }}>
                      {i + 1}
                    </span>
                    <button className={'tl-card' + (poiId === p.poiId ? ' sel' : '')} onClick={() => openDrawer(p.poiId)}>
                      <PlaceholderMedia seed={p.poiId} media={getMedia(p.poiId)} ratio="4/3" />
                      <span className="tl-card-body">
                        <b>{p.name}</b>
                        <span>
                          {getCategory(p.category).name} · {p.duration}
                          {p.openTime ? ` · ${p.openTime}` : ''}
                        </span>
                      </span>
                    </button>
                  </div>
                  {i < themeList.length - 1 && (
                    <div className="tl-hop">
                      <span className="tl-hop-line" />
                      {themeHops[i] && (
                        <span className="tl-hop-tag">
                          {themeHops[i].label} · 约 {themeHops[i].minutes} 分钟
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="poi-grid">
              {filtered.length === 0 && <div className="poi-empty">当前筛选没有景点，换个范围或类别试试</div>}
              {filtered.map((p) => {
                const cat = getCategory(p.category)
                return (
                  <button
                    key={p.poiId}
                    className={'poi-tile' + (poiId === p.poiId ? ' sel' : '')}
                    onClick={() => openDrawer(p.poiId)}
                  >
                    <PlaceholderMedia seed={p.poiId} media={getMedia(p.poiId)} ratio="16/9" />
                    <span className="poi-tile-body">
                      <b>
                        {p.name}
                        {p.hot && <em className="poi-tile-hot">热门</em>}
                      </b>
                      <span>
                        <i className="cat-dot" style={{ background: cat.color }} />
                        {cat.name} · {p.duration} · {getDistrict(p.districtId)?.name}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <aside className="poi-side">
          <div className="mini-map-host">
            <span className="mini-map-cap">点位速览 · 点击定位</span>
            <City2DMap
              show={{ districts: true, lines: false, stations: false, pois: true, labels: false }}
              filterPoiIds={(theme ? themeList : filtered).map((p) => p.poiId)}
              routePoiIds={theme ? themeList.map((p) => p.poiId) : null}
              highlight={{ stationId, poiId, districtId }}
              onSelect={onSelect}
              showPoiNames="none"
              poiSize={5}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
