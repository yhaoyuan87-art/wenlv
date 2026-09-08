import { create } from 'zustand'
import { getDistrict } from '../data/districts.js'
import { getLine, getStation } from '../data/metroLines.js'
import { getPoi } from '../data/pois.js'
import { resolveTheme, applyTheme, persistTheme, THEMES } from '../theme/theme.js'

// short：手机底部导航用的短标签；label：桌面顶部 Tab 用的完整标签
export const LAYERS = [
  { id: 'city', label: '城市 3D', short: '城市' },
  { id: 'metro', label: '地铁空间', short: '地铁' },
  { id: 'poi', label: '景点内容', short: '景点' },
  { id: 'map2d', label: '2D 总览', short: '总览' }
]

function parseQuery() {
  const q = new URLSearchParams(window.location.search)
  const layer = q.get('layer')
  return {
    layer: LAYERS.some((l) => l.id === layer) ? layer : 'city',
    districtId: q.get('district'),
    lineId: q.get('line'),
    stationId: q.get('station'),
    poiId: q.get('poi'),
    drawerPoiId: q.get('poi'),
    themeId: q.get('theme')
  }
}

function syncQuery(state) {
  const q = new URLSearchParams()
  q.set('layer', state.layer)
  if (state.districtId) q.set('district', state.districtId)
  if (state.lineId) q.set('line', state.lineId)
  if (state.stationId) q.set('station', state.stationId)
  if (state.poiId) q.set('poi', state.poiId)
  if (state.themeId) q.set('theme', state.themeId)
  // 原样保留 ?nowebgl=1（强制 WebGL 降级态的演示/自测开关，见 three/webgl.js），
  // 否则切一次层就会把它从 URL 里抹掉。
  const nowebgl = new URLSearchParams(window.location.search).get('nowebgl')
  if (nowebgl) q.set('nowebgl', nowebgl)
  window.history.replaceState(null, '', `?${q.toString()}`)
}

const initial = parseQuery()
// 首次进入即应用主题（避免闪屏幕：先同步 class，再挂载 React）
const initialTheme = resolveTheme()
applyTheme(initialTheme)

export const useStore = create((set, get) => ({
  layer: initial.layer,
  districtId: initial.districtId,
  lineId: initial.lineId,
  stationId: initial.stationId,
  poiId: initial.poiId,
  drawerPoiId: initial.drawerPoiId,
  theme: initialTheme,
  reduceMotion: false,
  legendOpen: false,
  resetViewToken: 0,
  poiScope: 'station',
  categoryFilter: null,
  themeId: initial.themeId,
  mapVisibility: { districts: true, lines: true, stations: true, pois: true, labels: true },
  // 详情面板对 3D 视野的遮挡量（px）。3D 相机据此把视觉中心移到「未被挡住的区域」中心
  panelInsets: { right: 0, bottom: 0 },
  // 3D 层处于 WebGL 降级态：详情面板据此让位，避免遮挡兜底卡片
  webglUnsupported: false,

  setAppTheme(theme) {
    const t = theme === THEMES.light ? THEMES.light : THEMES.dark
    // 顺序不能颠倒：必须先切 <html> class 让 CSS 变量立即生效，再 set() 通知订阅者。
    // 若先 set()，zustand 会同步触发订阅者读取 --scene-bg，此时 class 尚未切换，
    // 3D 场景会取到「上一次」的主题色（表现为切换后背景仍是旧的、且一直反着）。
    applyTheme(t)
    persistTheme(t)
    set({ theme: t })
    // 同步到 URL ?mode=，方便分享时保留主题状态（?theme= 已被路线主题占用）
    const q = new URLSearchParams(window.location.search)
    q.set('mode', t)
    window.history.replaceState(null, '', `?${q.toString()}`)
  },

  toggleTheme() {
    get().setAppTheme(get().theme === THEMES.light ? THEMES.dark : THEMES.light)
  },

  goLayer(layer, patch = {}) {
    set({ layer, ...patch })
    syncQuery(get())
  },

  selectDistrict(districtId, opts = {}) {
    set({ districtId })
    if (opts.goMetro) get().goLayer('metro')
    else syncQuery(get())
  },

  selectLine(lineId, opts = {}) {
    set({ lineId, stationId: null })
    if (opts.goPoi) get().goLayer('poi', { poiId: null, drawerPoiId: null })
    else syncQuery(get())
  },

  selectStation(stationId, opts = {}) {
    const st = getStation(stationId)
    set({ stationId, lineId: st ? st.line.lineId : get().lineId })
    if (opts.goPoi) {
      set({ poiScope: 'station', poiId: null, drawerPoiId: null })
      get().goLayer('poi')
    } else syncQuery(get())
  },

  selectPoi(poiId, opts = {}) {
    set({ poiId })
    if (opts.openDrawer) set({ drawerPoiId: poiId })
    syncQuery(get())
  },

  openDrawer(poiId) {
    set({ drawerPoiId: poiId, poiId })
    syncQuery(get())
  },

  closeDrawer() {
    set({ drawerPoiId: null })
    syncQuery(get())
  },

  backToParent() {
    const s = get()
    if (s.layer === 'poi') get().goLayer('metro')
    else if (s.layer === 'metro') get().goLayer('city')
    else if (s.layer === 'map2d') get().goLayer('poi')
    else get().goLayer('city')
  },

  jumpToPoiHome() {
    const s = get()
    set({ poiScope: s.stationId ? 'station' : s.lineId ? 'line' : s.districtId ? 'district' : 'all' })
    get().goLayer('poi')
  },

  setPoiScope(scope) {
    set({ poiScope: scope })
  },

  // 详情面板上报遮挡尺寸；值未变化时直接返回，避免重挂载造成的无谓抖动
  setPanelInsets(next) {
    const cur = get().panelInsets
    if (cur.right === next.right && cur.bottom === next.bottom) return
    set({ panelInsets: next })
  },

  /**
   * 标记 3D 层是否处于 WebGL 降级态。
   * 降级时详情面板不再渲染（它会盖住兜底卡片），同时停止上报遮挡补偿。
   * @param {boolean} v
   */
  setWebglUnsupported(v) {
    if (get().webglUnsupported === v) return
    set({ webglUnsupported: v })
  },

  setCategoryFilter(cat) {
    set({ categoryFilter: cat })
  },

  setTheme(themeId) {
    set({ themeId })
  },

  toggleMapVisibility(key) {
    const v = { ...get().mapVisibility, [key]: !get().mapVisibility[key] }
    set({ mapVisibility: v })
  },

  toggleLegend() {
    set({ legendOpen: !get().legendOpen })
  },

  toggleReduceMotion() {
    set({ reduceMotion: !get().reduceMotion })
  }
}))

export function breadcrumb(s) {
  const items = [{ label: '长春', layer: 'city' }]
  if (s.districtId) {
    const d = getDistrict(s.districtId)
    if (d) items.push({ label: d.name, layer: 'city' })
  }
  if (s.lineId) {
    const l = getLine(s.lineId)
    if (l) items.push({ label: l.shortName, layer: 'metro' })
  }
  if (s.stationId) {
    const st = getStation(s.stationId)
    if (st) items.push({ label: st.name + '站', layer: 'metro' })
  }
  if (s.poiId) {
    const p = getPoi(s.poiId)
    if (p) items.push({ label: p.name, layer: 'poi' })
  }
  return items
}
