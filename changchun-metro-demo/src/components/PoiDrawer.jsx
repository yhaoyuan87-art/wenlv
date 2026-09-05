import { useStore } from '../store/useStore.js'
import { getPoi, getCategory, relatedPois } from '../data/pois.js'
import { getMedia } from '../data/media.js'
import { getStation } from '../data/metroLines.js'
import { getDistrict } from '../data/districts.js'
import { PlaceholderMedia } from './PlaceholderMedia.jsx'
import { PanoramaViewer } from './PanoramaViewer.jsx'

export default function PoiDrawer() {
  const drawerPoiId = useStore((s) => s.drawerPoiId)
  const closeDrawer = useStore((s) => s.closeDrawer)
  const openDrawer = useStore((s) => s.openDrawer)
  const goLayer = useStore((s) => s.goLayer)
  const selectDistrict = useStore((s) => s.selectDistrict)
  const selectStation = useStore((s) => s.selectStation)
  const selectLine = useStore((s) => s.selectLine)

  if (!drawerPoiId) return null
  const poi = getPoi(drawerPoiId)
  if (!poi) return null

  const cat = getCategory(poi.category)
  const district = getDistrict(poi.districtId)
  const guide = poi.stationGuide || {}
  const station = guide.station ? getStation(guide.station) : null
  const line = station ? station.line : null
  const related = relatedPois(poi)
  const media = getMedia(poi.poiId)

  return (
    <>
      <div className="drawer-mask" onClick={closeDrawer} />
      <aside className="drawer" role="dialog" aria-label={poi.name}>
        <button className="drawer-close" onClick={closeDrawer} aria-label="关闭详情">
          ×
        </button>
        <PlaceholderMedia seed={poi.poiId} title={poi.name} sub={`${cat.name} · 建议游览 ${poi.duration}`} media={media} />
        <div className="drawer-body">
          <div className="drawer-tags">
            <span className="tag" style={{ borderColor: cat.color, color: cat.color }}>
              {cat.name}
            </span>
            {poi.hot && <span className="tag hot">热门推荐</span>}
            {poi.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
          <p className="drawer-summary">{poi.summary}</p>
          <p className="drawer-detail">{poi.detail}</p>

          <div className="drawer-section">
            <h4>运营信息</h4>
            <div className="kv">
              <span>开放时间</span>
              <i>{poi.openTime}</i>
            </div>
            <div className="kv">
              <span>票务</span>
              <i>{poi.tickets}</i>
            </div>
            <div className="kv">
              <span>建议时长</span>
              <i>{poi.duration}</i>
            </div>
          </div>

          <div className="drawer-section">
            <h4>如何到达</h4>
            {station && line ? (
              <>
                <div className="kv">
                  <span>最近地铁站</span>
                  <i>
                    <b className="line-dot" style={{ background: line.color }} />
                    {line.shortName} {station.name}站
                  </i>
                </div>
                <div className="kv">
                  <span>出站路线</span>
                  <i>{guide.exit} · {guide.walk}</i>
                </div>
              </>
            ) : (
              <div className="kv">
                <span>到达方式</span>
                <i>建议打车或公交前往</i>
              </div>
            )}
          </div>

          {poi.food && poi.food.length > 0 && (
            <div className="drawer-section">
              <h4>招牌美食</h4>
              <div className="food-chips">
                {poi.food.map((f) => (
                  <span key={f} className="tag food">{f}</span>
                ))}
              </div>
            </div>
          )}

          <div className="drawer-section">
            <h4>视频介绍</h4>
            {media.status === 'ready' ? (
              <video className="media-video" src={media.video} poster={media.cover} controls preload="none" />
            ) : (
              <div className="media-video media-video-ph" title={`待接入：${media.video}`}>
                <span className="ph-play big" />
                <span>视频素材待接入</span>
              </div>
            )}
          </div>

          <div className="drawer-section">
            <h4>360° 全景</h4>
            <PanoramaViewer media={media} title={poi.name} seed={poi.poiId + '-pano'} />
          </div>

          <div className="drawer-gallery">
            {media.gallery.map((path, i) => (
              <PlaceholderMedia key={path} seed={poi.poiId + '-g' + (i + 1)} title={`实景图 ${i + 1}`} ratio="4/3" media={{ status: 'placeholder', cover: path }} />
            ))}
          </div>

          <div className="drawer-section">
            <h4>继续探索</h4>
            <div className="drawer-links">
              {district && (
                <button className="btn link" onClick={() => { closeDrawer(); selectDistrict(district.districtId); goLayer('city') }}>
                  所属区域 · {district.name}
                </button>
              )}
              {station && (
                <button className="btn link" onClick={() => { closeDrawer(); selectStation(station.stationId); goLayer('metro') }}>
                  最近地铁站 · {station.name}
                </button>
              )}
              {line && (
                <button className="btn link" onClick={() => { closeDrawer(); selectLine(line.lineId); goLayer('metro') }}>
                  推荐线路 · {line.shortName}
                </button>
              )}
              <button className="btn link" onClick={() => { closeDrawer(); goLayer('map2d') }}>
                在 2D 总览查看
              </button>
            </div>
          </div>

          <div className="drawer-section">
            <h4>相关景点</h4>
            <div className="related-grid">
              {related.map((p) => {
                const c = getCategory(p.category)
                return (
                  <button key={p.poiId} className="related-card" onClick={() => openDrawer(p.poiId)}>
                    <PlaceholderMedia seed={p.poiId} title="" ratio="16/10" />
                    <b>{p.name}</b>
                    <span style={{ color: c.color }}>{c.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="drawer-meta">数据更新：2026-09 · demo 演示数据，运营信息以官方发布为准</div>
        </div>
      </aside>
    </>
  )
}
