import { create } from 'zustand'
import { getDistrict } from '../data/districts.js'
import { getLine, getStation } from '../data/metroLines.js'
import { getPoi } from '../data/pois.js'

export const LAYERS = [
  { id: 'city', label: '城市 3D' },
  { id: 'metro', label: '地铁空间' },
  { id: 'poi', label: '景点内容' },
  { id: 'map2d', label: '2D 总览' }
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
  window.history.replaceState(null, '', `?${q.toString()}`)
}

const initial = parseQuery()

export const useStore = create((set, get) => ({
  layer: initial.layer,
  districtId: initial.districtId,
  lineId: initial.lineId,
  stationId: initial.stationId,
  poiId: initial.poiId,
  drawerPoiId: initial.drawerPoiId,
  reduceMotion: false,
  legendOpen: false,
  resetViewToken: 0,
  poiScope: 'station',
  categoryFilter: null,
  themeId: initial.themeId,
  mapVisibility: { districts: true, lines: true, stations: true, pois: true, labels: true },

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
