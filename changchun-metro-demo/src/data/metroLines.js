import metroLines from './metro-lines.json'

// 线路图来源于 2026 年长春轨道交通网络图：当前项目展示的是已运营线路。
// 规划中的 5、9 号线在参考图中以灰色标注，暂不并入运营网络数据。
const lineMeta = {
  'line-01': { operational: true, mileageKm: 18.1 },
  'line-02': { operational: true, mileageKm: 35.5 },
  'line-03': { operational: true, mileageKm: 34.1 },
  'line-04': { operational: true, mileageKm: 20.8 },
  'line-06': { operational: true, mileageKm: 29.6 },
  'line-07': { operational: true, mileageKm: 13.3 },
  'line-08': { operational: true, mileageKm: 13.3 }
}

const enrichLine = (line) => ({ ...line, ...(lineMeta[line.lineId] || { operational: false }) })
const enrichedLines = metroLines.map(enrichLine)
export const operationalLines = enrichedLines.filter((line) => line.operational)
export { enrichedLines as metroLines }

export function getLine(id) {
  const line = metroLines.find((l) => l.lineId === id)
  return line ? enrichLine(line) : null
}

export function getStation(stationId) {
  for (const line of metroLines) {
    const s = line.stations.find((s) => s.stationId === stationId)
    if (s) return { ...s, line, index: line.stations.indexOf(s) }
  }
  return null
}

export function getNeighbors(stationId) {
  const found = getStation(stationId)
  if (!found) return null
  const list = found.line.stations
  return {
    prev: found.index > 0 ? list[found.index - 1] : null,
    next: found.index < list.length - 1 ? list[found.index + 1] : null
  }
}

export function allStations() {
  const out = []
  for (const line of metroLines) {
    for (const s of line.stations) {
      out.push({ ...s, line, stationId: s.stationId })
    }
  }
  return out
}
