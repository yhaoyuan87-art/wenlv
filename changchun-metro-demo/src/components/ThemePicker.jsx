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
      {active && <span className="theme-tip" style={{ borderColor: active.color }}>{active.summary}</span>}
    </div>
  )
}
