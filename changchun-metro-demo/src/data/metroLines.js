import metroLines from './metro-lines.json'

export { metroLines }

export function getLine(id) {
  return metroLines.find((l) => l.lineId === id)
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
