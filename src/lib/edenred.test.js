import { describe, expect, it } from 'vitest'
import { bearing, distanceKm, findStations, hasCoordinates, movementHeading, stationMapsUrl } from './edenred'

const origin = { lat:-32.5, lng:-63, accuracy:10 }
const station = (id, lat, lng, other = {}) => ({ id, nombre:`Estación ${id}`, localidad:'Villa María', provincia:'Córdoba', direccion:'Ruta 9 km 100', lat, lng, ...other })
const north = station('north',-32.4,-63)
const south = station('south',-32.51,-63)

describe('Estaciones Edenred', () => {
  it('prioriza adelante aunque atrás haya una más cercana, sin inventar una ruta', () => {
    const result = findStations([south,north], { position:origin, heading:0 })
    expect(result.map(s=>s.id)).toEqual(['north','south'])
    expect(result[0].ahead).toBe(true)
    expect(result[1].ahead).toBe(false)
    expect(result[0].distance).toBeCloseTo(11.119,2)
  })
  it('ordena solo por distancia cuando no hay rumbo', () => {
    expect(findStations([north,south], { position:origin }).map(s=>s.id)).toEqual(['south','north'])
  })
  it('respeta el radio e ignora coordenadas ausentes para proximidad', () => {
    const missing = station('missing',null,null)
    expect(hasCoordinates(missing)).toBe(false)
    expect(findStations([north,south,missing], { position:origin,radius:5 }).map(s=>s.id)).toEqual(['south'])
    expect(findStations([missing],{ query:'villa maria cordoba' })).toHaveLength(1)
    expect(findStations([missing],{ query:'villa maria',position:origin })[0].distance).toBeNull()
  })
  it('no confunde 359° y 1° como sentidos opuestos', () => {
    expect(findStations([north],{ position:origin,heading:359 })[0].ahead).toBe(true)
    expect(bearing(origin,north)).toBeCloseTo(0)
    expect(distanceKm(origin,origin)).toBe(0)
  })
  it('no deduce rumbo por ruido GPS, coordenadas viejas o estando detenido', () => {
    const a = { ...origin, timestamp:1000, accuracy:30 }
    expect(movementHeading(a,{ ...a,lat:a.lat+0.00001,timestamp:2000,heading:null,speed:0 })).toBeNull()
    expect(movementHeading(a,{ ...north,timestamp:90000,accuracy:10 })).toBeNull()
    expect(movementHeading(a,{ ...north,timestamp:2000,accuracy:10 })).toBeCloseTo(0)
    expect(movementHeading(null,{ ...a,heading:0,speed:2 })).toBe(0)
    expect(movementHeading(null,{ ...a,heading:180,speed:0 })).toBeNull()
  })
  it('abre navegación con coordenadas o dirección y sin transmitir origen', () => {
    const url = new URL(stationMapsUrl(north))
    expect(url.origin).toBe('https://www.google.com')
    expect(url.searchParams.get('destination')).toBe('-32.4,-63')
    expect(url.searchParams.get('dir_action')).toBe('navigate')
    expect(url.searchParams.has('origin')).toBe(false)
    expect(new URL(stationMapsUrl(station('missing',null,null))).searchParams.get('destination')).toContain('Ruta 9 km 100')
  })
})
