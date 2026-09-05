/** 主题常量与工具函数 */

export const THEMES = {
  dark: 'dark',
  light: 'light'
}

const STORAGE_KEY = 'wenlv-theme'

/** 无需 meta 色切换的采样：读取 CSS 变量，供 3D 场景等 JS 使用 */
export function cssVar(name) {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** 把 hex 转成 three.js 可用的 number，失败回退默认 */
export function hexToNumber(hex, fallback = 0x0a0f1c) {
  if (!hex) return fallback
  const clean = hex.trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return fallback
  return parseInt(clean, 16)
}

/**
 * 从 URL 参数、localStorage、系统偏好依次解析主题。
 * URL > localStorage > 系统。
 * 注意：外观主题用 ?mode= 参数（?theme= 已被「路线主题」占用）。
 */
export function resolveTheme() {
  if (typeof window === 'undefined') return THEMES.dark
  const q = new URLSearchParams(window.location.search)
  const fromUrl = q.get('mode')
  if (fromUrl === THEMES.light || fromUrl === THEMES.dark) return fromUrl
  const fromStore = localStorage.getItem(STORAGE_KEY)
  if (fromStore === THEMES.light || fromStore === THEMES.dark) return fromStore
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return THEMES.light
  return THEMES.dark
}

/** 应用主题：切换 <html> 的 class 与 meta theme-color */
export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('theme-light', theme === THEMES.light)
  root.classList.toggle('theme-dark', theme === THEMES.dark)
  root.setAttribute('data-theme', theme)
  try {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === THEMES.light ? '#f3f6fb' : '#0a0f1c')
  } catch {
    /* ignore */
  }
}

/** 持久化用户选择 */
export function persistTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}

export function isSystemLight() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: light)').matches
}

/** 判断当前是否白天主题 */
export function isLightTheme(root) {
  const el = root || document.documentElement
  return (el && el.classList.contains('theme-light')) || (el && el.getAttribute('data-theme') === 'light')
}
