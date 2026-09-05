import { useStore } from '../store/useStore.js'
import { themes } from '../data/themes.js'

export default function ThemePicker() {
  const themeId = useStore((s) => s.themeId)
  const setTheme = useStore((s) => s.setTheme)
  const active = themes.find((t) => t.themeId === themeId)

  return (
    <div className="theme-picker">
      <span className="theme-picker-label">路线</span>
      <button className={'chip' + (!themeId ? ' on' : '')} onClick={() => setTheme(null)}>
        自由浏览
      </button>
      {themes.map((t) => (
        <button
          key={t.themeId}
          className={'chip' + (themeId === t.themeId ? ' on' : '')}
          onClick={() => setTheme(themeId === t.themeId ? null : t.themeId)}
          style={{ borderColor: themeId === t.themeId ? t.color : undefined, color: themeId === t.themeId ? t.color : undefined }}
        >
          {t.name}
        </button>
      ))}
      {active && (
        <div className="theme-card" style={{ borderColor: active.color }}>
          <b style={{ color: active.color }}>{active.name}</b>
          <span className="theme-card-route">{active.route}</span>
          <p>{active.summary}</p>
          <span className="theme-card-tip">💡 {active.tip}</span>
        </div>
      )}
    </div>
  )
}
