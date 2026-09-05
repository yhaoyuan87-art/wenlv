import { metroLines } from './metroLines.js'
import { poiCategories, pois } from './pois.json'

export { poiCategories, pois }

export function getCategory(id) {
  return poiCategories.find((c) => c.id === id) || poiCategories[0]
}

export function getPoi(id) {
  return pois.find((p) => p.poiId === id)
}

export function poisByStation(stationId) {
  return pois.filter((p) => p.stationIds.includes(stationId))
}

export function poisByLine(lineId) {
  return pois.filter((p) => p.stationIds.some((sid) => {
    for (const line of metroLines) {
      if (line.stations.some((s) => s.stationId === sid)) return line.lineId === lineId
    }
    return false
  }))
}

export function poisByDistrict(districtId) {
  return pois.filter((p) => p.districtId === districtId)
}

export function relatedPois(poi, count = 3) {
  return pois
    .filter((p) => p.poiId !== poi.poiId)
    .map((p) => ({
      poi: p,
      score: (p.districtId === poi.districtId ? 2 : 0) + (p.category === poi.category ? 1 : 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((x) => x.poi)
}
