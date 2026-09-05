import { useStore, LAYERS } from '../store/useStore.js'

/**
 * 手机端底部四层导航。
 * 桌面端隐藏（由 index.css 的 media query 控制），顶部 Tab 接管。
 */
export default function BottomNav() {
  const layer = useStore((s) => s.layer)
  const goLayer = useStore((s) => s.goLayer)

  return (
    <nav className="bottom-nav" aria-label="四层导航">
      {LAYERS.map((l, i) => (
        <button
          key={l.id}
          className={'bottom-tab' + (layer === l.id ? ' on' : '')}
          onClick={() => goLayer(l.id)}
          aria-current={layer === l.id ? 'page' : undefined}
        >
          <em>{i + 1}</em>
          <span>{l.short}</span>
        </button>
      ))}
    </nav>
  )
}
