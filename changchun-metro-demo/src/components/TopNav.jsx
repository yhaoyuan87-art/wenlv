import { useEffect, useRef, useState } from 'react'
import { useStore, LAYERS } from '../store/useStore.js'
import SearchBox from './SearchBox.jsx'

export default function TopNav() {
  const layer = useStore((s) => s.layer)
  const goLayer = useStore((s) => s.goLayer)
  const toggleLegend = useStore((s) => s.toggleLegend)
  const reduceMotion = useStore((s) => s.reduceMotion)
  const toggleReduceMotion = useStore((s) => s.toggleReduceMotion)
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)

  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  // 卸载时清掉未触发的计时器，避免在已卸载组件上 setState
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const showToast = (msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      showToast('链接已复制，分享给同行的人吧')
    } catch {
      showToast(window.location.href)
    }
  }

  return (
    <header className="topnav">
      <div className="brand">
        <span className="brand-mark" />
        <div className="brand-text">
          <b>长春地铁文旅</b>
          <span>四层联动探索平台 · Demo</span>
        </div>
      </div>

      <nav className="layer-tabs" aria-label="四层导航">
        {LAYERS.map((l, i) => (
          <button
            key={l.id}
            className={'layer-tab' + (layer === l.id ? ' on' : '')}
            onClick={() => goLayer(l.id)}
            aria-current={layer === l.id ? 'page' : undefined}
          >
            <em>{i + 1}</em>
            {l.label}
          </button>
        ))}
      </nav>

      <div className="nav-right">
        <button
          className={'icon-btn theme-toggle' + (theme === 'light' ? ' light' : '')}
          onClick={toggleTheme}
          title={theme === 'light' ? '切换到夜间主题' : '切换到白天主题'}
          aria-label={theme === 'light' ? '切换到夜间主题' : '切换到白天主题'}
          aria-pressed={theme === 'light'}
        >
          <span className="theme-glyph">{theme === 'light' ? '🌙' : '☀️'}</span>
          <span className="theme-label">{theme === 'light' ? '夜间' : '白天'}</span>
        </button>
        <SearchBox />
        <button className="icon-btn" onClick={share} title="复制当前视图链接">
          分享
        </button>
        <button className={'icon-btn motion-only' + (reduceMotion ? ' on' : '')} onClick={toggleReduceMotion} title="减少动效">
          {reduceMotion ? '动效关' : '动效开'}
        </button>
        <button className="icon-btn" onClick={toggleLegend} title="图例与帮助">
          图例
        </button>
      </div>
      {toast && <div className="nav-toast">{toast}</div>}
    </header>
  )
}
