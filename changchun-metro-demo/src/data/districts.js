import data from './districts.json'

export const CANVAS = data.canvas
export const cityInfo = data.cityInfo
export const yitongRiver = data.yitongRiver
export const districts = data.districts
export const landmarks = data.landmarks

export function getDistrict(id) {
  return districts.find((d) => d.districtId === id)
}

export function countByDistrict(districtId, pois) {
  return pois.filter((p) => p.districtId === districtId).length
}

function pointInPolygon(px, py, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function findDistrictByPoint(x, y) {
  return districts.find((d) => pointInPolygon(x, y, d.polygon)) || null
}
