import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, MapPin, ScanLine } from 'lucide-react'
import { listAssetScans, locationSummary, mapsUrl, registerAssetScan, requestScanLocation } from '../lib/assetScans'

const fmtDateTime = value => value
  ? new Intl.DateTimeFormat('es-AR', { dateStyle:'short', timeStyle:'short' }).format(new Date(value))
  : '—'

export default function AssetScanHistory({ assetId, scanEventId = null, contexto = 'qr_interno' }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [captureStatus, setCaptureStatus] = useState(scanEventId ? 'Solicitando ubicación del dispositivo…' : '')
  const capturedRef = useRef(false)

  const load = useCallback(async () => {
    try {
      setItems(await listAssetScans(assetId, 10))
    } finally {
      setLoading(false)
    }
  }, [assetId])

  useEffect(() => {
    let disposed = false
    const run = async () => {
      if (scanEventId && !capturedRef.current) {
        capturedRef.current = true
        try {
          const location = await requestScanLocation()
          await registerAssetScan({ activoId:assetId, eventId:scanEventId, contexto, location })
          if (!disposed) setCaptureStatus(locationSummary({
            estado_ubicacion:location.estado,
            precision_metros:location.precision,
          }))
        } catch {
          if (!disposed) setCaptureStatus('No se pudo guardar la trazabilidad del escaneo.')
        }
      }
      if (!disposed) await load().catch(() => setLoading(false))
    }
    run()
    return () => { disposed = true }
  }, [assetId, contexto, load, scanEventId])

  return (
    <section style={{ marginTop:'0.9rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:7 }}>
        <ScanLine size={15} style={{ color:'var(--phosphor)' }}/>
        <h3 style={{ color:'var(--phosphor)', fontSize:'.65rem', textTransform:'uppercase', fontWeight:700, margin:0 }}>Historial de escaneos</h3>
      </div>
      {captureStatus && <p role="status" style={{ color:'var(--text-dim)', fontSize:'.68rem', margin:'0 0 8px' }}>{captureStatus}</p>}
      {loading ? <p style={{ color:'var(--text-dim)', fontSize:'.75rem' }}>Cargando escaneos…</p>
        : items.length === 0 ? <p style={{ color:'var(--text-dim)', fontSize:'.75rem' }}>Todavía no hay escaneos internos registrados.</p>
        : items.map(scan => {
          const url = mapsUrl(scan)
          return (
            <div key={scan.id} style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:8, padding:'.7rem .8rem', marginBottom:6 }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:10 }}>
                <strong style={{ color:'var(--text)', fontSize:'.76rem' }}>{scan.usuario_nombre}</strong>
                <span style={{ color:'var(--text-dim)', fontSize:'.62rem', whiteSpace:'nowrap' }}>{fmtDateTime(scan.fecha)}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:5 }}>
                <MapPin size={13} style={{ color:url ? '#60A5FA' : 'var(--text-dim)' }}/>
                <span style={{ color:'var(--text-dim)', fontSize:'.66rem' }}>{locationSummary(scan)}</span>
                {url && <a href={url} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:3, color:'#60A5FA', fontSize:'.65rem', marginLeft:'auto' }}>Ver mapa <ExternalLink size={11}/></a>}
              </div>
            </div>
          )
        })}
    </section>
  )
}
