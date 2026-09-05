import { getPoi } from './pois.js'
import themes from './themes.json'

export { themes }

export function getTheme(id) {
  return themes.find((t) => t.themeId === id) || null
}

export function themePois(themeId) {
  const t = getTheme(themeId)
  if (!t) return []
  return t.poiIds.map(getPoi).filter(Boolean)
}
