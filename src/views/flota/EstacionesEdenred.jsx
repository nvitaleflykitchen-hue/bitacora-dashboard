import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Navigation, Search } from 'lucide-react'
import catalog from '../../data/edenred.json'
import { findStations, hasCoordinates, movementHeading, stationMapsUrl } from '../../lib/edenred'

const DIRECTIONS = [[0,'Norte'],[45,'Noreste'],[90,'Este'],[135,'Sudeste'],[180,'Sur'],[225,'Sudoeste'],[270,'Oeste'],[315,'Noroeste']]
const dim = { color:'var(--text-dim)', fontSize:'.8rem' }
const usableCount = catalog.stations.filter(hasCoordinates).length

export default function EstacionesEdenred() {
  const [query, setQuery] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden')
  const [position, setPosition] = useState(null)
  const [status, setStatus] = useState('')
  const [manualHeading, setManualHeading] = useState('')
  const [limit, setLimit] = useState(8)
  const [radius, setRadius] = useState(100)
  const previous = useRef(null)

  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  useEffect(() => {
    setPosition(null)
    previous.current = null
    if (!enabled || !visible) return
    if (!navigator.geolocation?.watchPosition) {
      setStatus('Este dispositivo no ofrece ubicación. Buscá por localidad o zona.')
      setEnabled(false)
      return
    }
    let active = true
    let expiry
    setStatus('Buscando tu ubicación…')
    const watch = navigator.geolocation.watchPosition(value => {
      if (!active) return
      const next = { lat:value.coords.latitude, lng:value.coords.longitude, accuracy:value.coords.accuracy,
        heading:value.coords.heading, speed:value.coords.speed, timestamp:value.timestamp }
      if (!hasCoordinates(next) || !Number.isFinite(next.accuracy) || next.accuracy > 1000 || !Number.isFinite(next.timestamp) || Date.now() - next.timestamp > 60000) {
        setPosition(null)
        previous.current = null
        setStatus('La ubicación todavía no es precisa. Esperá una nueva lectura o buscá por localidad.')
        return
      }
      const heading = movementHeading(previous.current, next)
      if (!previous.current || heading != null || next.timestamp - previous.current.timestamp > 60000) previous.current = next
      setPosition({ ...next, heading })
      setStatus('')
      clearTimeout(expiry)
      expiry = setTimeout(() => {
        setPosition(null)
        previous.current = null
        setStatus('Esperando una ubicación actualizada. También podés buscar por localidad.')
      }, Math.max(0, 60000 - (Date.now() - next.timestamp)))
    }, error => {
      if (!active) return
      clearTimeout(expiry)
      previous.current = null
      setPosition(null)
      setStatus(error.code === 1 ? 'Ubicación no autorizada. Buscá por localidad o zona.' : 'No se pudo obtener tu ubicación. Podés reintentar o buscar por localidad.')
      setEnabled(false)
    }, { enableHighAccuracy:true, maximumAge:0, timeout:15000 })
    return () => { active = false; navigator.geolocation.clearWatch(watch); clearTimeout(expiry); previous.current = null }
  }, [enabled, visible])

  const heading = manualHeading === '' ? position?.heading : Number(manualHeading)
  const stations = useMemo(() => findStations(catalog.stations, { query, position, heading, radius }), [query, position, heading, radius])
  const searching = Boolean(query.trim())
  const showResults = Boolean(position || searching)
  const forward = Boolean(position && Number.isFinite(heading))

  return <section aria-label="Estaciones Edenred" className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6" style={{ color:'var(--text)' }}>
    <div style={{ maxWidth:760, margin:'0 auto' }}>
      <h2 className="font-title font-bold text-lg">Estaciones Edenred</h2>
      <div className="flex gap-2 flex-wrap items-center mt-4">
        <button type="button" className="btn-primary" style={{ minHeight:44, display:'inline-flex', alignItems:'center', gap:6 }} onClick={() => { setEnabled(true); setLimit(8) }} disabled={enabled}>
          <MapPin size={16} /> {enabled ? 'Ubicación activa' : 'Mi ubicación'}
        </button>
        {enabled && <button type="button" className="btn-ghost" style={{ minHeight:44 }} onClick={() => { setEnabled(false); setStatus(''); setManualHeading('') }}>Dejar de usar ubicación</button>}
      </div>
      {status && <p role="status" style={{ ...dim, marginBottom:12 }}>{status}</p>}
      <label className="block mt-4"><span className="flex gap-2 items-center"><Search size={15} /> Buscar por localidad o zona</span>
        <input type="search" className="input-dark w-full mt-2" style={{ minHeight:44 }} value={query} placeholder="Localidad, provincia o ruta" onChange={event => { setQuery(event.target.value); setLimit(8) }} />
      </label>
      {position && <details className="mt-3"><summary className="cursor-pointer" style={dim}>Sentido de marcha {forward ? '· priorizando hacia adelante' : '· sin detectar'}</summary>
        <label className="block mt-2" style={dim}>Si estás detenido, podés indicar hacia dónde vas.
          <select aria-label="Sentido de marcha" className="input-dark w-full mt-2" value={manualHeading} onChange={event => { setManualHeading(event.target.value); setLimit(8) }} style={{ minHeight:44 }}>
            <option value="">Detectar con el movimiento</option>
            {DIRECTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </details>}
      <h3 className="font-title font-bold mt-6 mb-2">{searching ? 'Estaciones encontradas' : 'Próximas estaciones'}</h3>
      {position && <p style={{ ...dim, marginBottom:12 }}>{forward ? 'Primero hacia tu sentido de marcha; pueden requerir desvíos.' : 'Por cercanía; sentido de marcha aún no detectado.'} Distancias aproximadas en línea recta.</p>}
      {!showResults && <p style={dim}>Usá «Mi ubicación» o escribí una localidad para ver las alternativas.</p>}
      {showResults && !stations.length && <p role="status" style={dim}>{searching ? 'No hay estaciones que coincidan. Probá con otra localidad o provincia.' : `No hay estaciones con coordenadas disponibles a menos de ${radius} km. Podés ampliar la búsqueda o buscar por localidad.`}</p>}
      {showResults && <ol className="space-y-3" aria-label="Alternativas de estaciones">
        {stations.slice(0,limit).map(station => <li key={station.id} className="glass rounded p-4">
          <div className="flex justify-between gap-3 flex-wrap"><strong>{station.nombre}</strong>
            {station.distance != null && <span style={{ color:'var(--phosphor)', whiteSpace:'nowrap' }}>≈ {station.distance.toLocaleString('es-AR', { maximumFractionDigits:1 })} km</span>}
          </div>
          <p className="mt-1" style={dim}>{station.localidad} · {station.provincia}</p>
          <p className="mt-2" style={{ fontSize:'.85rem', overflowWrap:'anywhere' }}>{station.direccion}</p>
          {station.ahead && <p className="mt-2" style={{ color:'var(--phosphor)', fontSize:'.75rem' }}>Hacia tu sentido de marcha</p>}
          {!hasCoordinates(station) && <p className="mt-2" style={dim}>Sin coordenadas confirmadas. Google Maps buscará la dirección.</p>}
          <a className="btn-primary mt-3" style={{ minHeight:44, display:'inline-flex' }} href={stationMapsUrl(station)} target="_blank" rel="noopener noreferrer" aria-label={`Navegar a ${station.nombre}, ${station.direccion}`}><Navigation size={15} /> NAVEGAR</a>
        </li>)}
      </ol>}
      {showResults && stations.length > limit && <button className="btn-ghost mt-4" style={{ minHeight:44 }} onClick={() => setLimit(value => value + 8)}>Ver más alternativas</button>}
      {position && !searching && radius === 100 && <button className="btn-ghost mt-4" style={{ minHeight:44 }} onClick={() => setRadius(200)}>Ampliar a 200 km</button>}
      <p className="mt-6" style={dim}>Catálogo: {catalog.sourceDate.split(' ')[0]} · {catalog.stations.length.toLocaleString('es-AR')} estaciones. {usableCount.toLocaleString('es-AR')} con coordenadas para calcular cercanía; las restantes se consultan por localidad.</p>
      <p className="mt-2" style={dim}>Tu ubicación no se guarda y se usa solo con esta pantalla visible. Google Maps calcula el recorrido al navegar.</p>
    </div>
  </section>
}
