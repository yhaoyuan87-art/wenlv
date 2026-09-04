import { getPoi } from './pois.js'

export const themes = [
  {
    themeId: 'theme-d1',
    name: 'D1 · 老城历史一日线',
    color: '#d4a556',
    summary: '从伪满皇宫出发，沿人民大街读懂长春近代史，傍晚到南湖收尾。',
    route: '4号线 → 1号线 → 2号线 → 3号线',
    poiIds: ['poi-001', 'poi-016', 'poi-008', 'poi-009', 'poi-005'],
    tip: '伪满皇宫需提前预约，周一闭馆；新民大街与南湖公园免费。'
  },
  {
    themeId: 'theme-d2',
    name: 'D2 · 艺术博物一日线',
    color: '#c084fc',
    summary: '长影旧址看新中国电影摇篮，雕塑园赏罗丹真品，傍晚走进省博物院。',
    route: '3号线 → 1号线 → 6号线',
    poiIds: ['poi-011', 'poi-004', 'poi-013'],
    tip: '长影旧址与省博物院周一闭馆；省博物院需在公众号预约。'
  },
  {
    themeId: 'theme-d3',
    name: 'D3 · 净月生态一日线',
    color: '#4ade80',
    summary: '一条轻轨3号线玩转净月：民俗馆、净月潭与长影世纪城一次集齐。',
    route: '轻轨3号线全程',
    poiIds: ['poi-021', 'poi-002', 'poi-003'],
    tip: '净月潭建议安排半天以上；冬季可在滑雪场站直达雪场。'
  }
]

export function getTheme(id) {
  return themes.find((t) => t.themeId === id) || null
}

export function themePois(themeId) {
  const t = getTheme(themeId)
  if (!t) return []
  return t.poiIds.map(getPoi).filter(Boolean)
}
