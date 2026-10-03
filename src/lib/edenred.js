export const normalizeStationText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const radians = degrees => degrees * Math.PI / 180
export const hasCoordinates = point => Number.isFinite(point?.lat) && Number.isFinite(point?.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180

export function distanceKm(a, b) {
  const h = Math.sin(radians(b.lat - a.lat) / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(radians(b.lng - a.lng) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))
}

export function bearing(a, b) {
  const delta = radians(b.lng - a.lng)
  const angle = Math.atan2(Math.sin(delta) * Math.cos(radians(b.lat)), Math.cos(radians(a.lat)) * Math.sin(radians(b.lat)) - Math.sin(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.cos(delta))
  return (angle * 180 / Math.PI + 360) % 360
}

export function movementHeading(previous, current) {
  if (Number.isFinite(current.heading) && current.heading >= 0 && current.heading < 360 && current.speed >= 1.5) return current.heading
  if (!previous || current.timestamp <= previous.timestamp || current.timestamp - previous.timestamp > 60000) return null
  const moved = distanceKm(previous, current) * 1000
  if (moved < Math.max(35, previous.accuracy + current.accuracy)) return null
  return bearing(previous, current)
}

export function findStations(stations, { query = '', position = null, heading = null, radius = 100 } = {}) {
  const terms = normalizeStationText(query).split(' ').filter(Boolean)
  const matches = stations.filter(station => {
    const text = normalizeStationText(`${station.nombre} ${station.localidad} ${station.provincia} ${station.direccion}`)
    return terms.every(term => text.includes(term))
  })
  if (!hasCoordinates(position)) return matches.map(station => ({ ...station, distance: null, ahead: false })).sort((a,b) => a.localidad.localeCompare(b.localidad, 'es') || a.nombre.localeCompare(b.nombre, 'es'))
  const headingKnown = Number.isFinite(heading) && heading >= 0 && heading < 360
  return matches.map(station => {
    if (!hasCoordinates(station)) return { ...station, distance:null, ahead:false }
    const distance = distanceKm(position, station)
    const angle = Math.abs(((bearing(position, station) - heading + 540) % 360) - 180)
    return { ...station, distance, ahead:headingKnown && angle <= 70 && distance > Math.max(0.1, (position.accuracy || 0) / 1000) }
  }).filter(station => terms.length || (station.distance != null && station.distance <= radius))
    .sort((a,b) => Number(b.ahead) - Number(a.ahead) || (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.nombre.localeCompare(b.nombre, 'es'))
}

export function stationMapsUrl(station) {
  const destination = hasCoordinates(station) ? `${station.lat},${station.lng}` : `${station.nombre}, ${station.direccion}, ${station.localidad}, ${station.provincia}, Argentina`
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api:'1', destination, travelmode:'driving', dir_action:'navigate' })}`
}
