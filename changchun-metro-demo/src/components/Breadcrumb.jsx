import { breadcrumb, useStore } from '../store/useStore.js'

export default function Breadcrumb() {
  const layer = useStore((s) => s.layer)
  const districtId = useStore((s) => s.districtId)
  const lineId = useStore((s) => s.lineId)
  const stationId = useStore((s) => s.stationId)
  const poiId = useStore((s) => s.poiId)
  const goLayer = useStore((s) => s.goLayer)

  const items = breadcrumb({ districtId, lineId, stationId, poiId })
  const back = () => {
    if (layer === 'poi') goLayer('metro')
    else if (layer === 'metro') goLayer('city')
    else if (layer === 'map2d') goLayer('poi')
  }

  return (
    <div className="breadcrumb-bar">
      <div className="breadcrumb">
        {items.map((it, i) => (
          <span key={i} className="crumb-wrap">
            {i > 0 && <em>/</em>}
            <button
              className={'crumb' + (i === items.length - 1 ? ' cur' : '')}
              onClick={() => goLayer(it.layer)}
            >
              {it.label}
            </button>
          </span>
        ))}
      </div>
      {layer !== 'city' && (
        <button className="back-btn" onClick={back}>
          ← 返回上一级
        </button>
      )}
      {/* 快捷键提示：桌面端常驻（CSS 里 ≤720px 隐藏），不占交互位 */}
      <p className="hotkey-hint">
        快捷键：<b>1–4</b> 切层 · <b>Esc</b> 关闭 · <b>⌘K</b> 搜索
      </p>
    </div>
  )
}
