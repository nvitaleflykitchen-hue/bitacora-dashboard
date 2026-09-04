import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Clock3, LocateFixed, LogIn, LogOut, RefreshCw } from 'lucide-react'
import { attendanceEventLabel, attendanceStatus, getMyAttendance, markMyAttendance } from '../lib/attendance'
import { mensajeError } from '../lib/errores'
import { toast } from '../lib/feedback'

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-AR', { dateStyle:'short', timeStyle:'short' }).format(new Date(value))
}

export default function MobileMarcacion({ onBack }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await getMyAttendance()) }
    catch (error) { toast.error(`No se pudo cargar Marcación: ${mensajeError(error)}`) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const mark = async () => {
    const type = data?.nextEventType || 'CLOCK_IN'
    setMarking(true)
    try {
      const result = await markMyAttendance(type)
      const status = attendanceStatus(result.validationStatus)
      toast.ok(`${attendanceEventLabel(type)} registrado · ${status.label}`)
      await load()
    } catch (error) {
      toast.error(mensajeError(error))
    } finally {
      setMarking(false)
    }
  }

  if (loading && !data) return <div className="mobile-scroll" style={{ height:'100%', display:'grid', placeItems:'center', color:'var(--text-dim)' }}>Cargando Fly Marcación…</div>
  if (!data?.enabled) return <div className="mobile-scroll" style={{ padding:'1rem', height:'100%' }}><button className="btn-ghost" onClick={onBack}><ArrowLeft size={16}/> Volver</button><p style={{ color:'var(--text-dim)', marginTop:'2rem', textAlign:'center' }}>El piloto no está habilitado para este usuario.</p></div>

  const nextType = data.nextEventType || 'CLOCK_IN'
  const isOut = nextType === 'CLOCK_OUT'

  return (
    <div className="mobile-scroll" style={{ padding:'1rem', height:'100%' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'1.2rem' }}>
        <button type="button" className="btn-ghost" onClick={onBack} aria-label="Volver"><ArrowLeft size={17}/></button>
        <div style={{ flex:1 }}>
          <p style={{ color:'var(--phosphor)', fontFamily:'var(--font-metric)', fontSize:'.65rem', letterSpacing:'.1em' }}>PILOTO PRIVADO</p>
          <h1 style={{ color:'var(--text)', fontSize:'1.25rem', fontWeight:800 }}>Fly Marcación</h1>
        </div>
        <button type="button" className="btn-ghost" onClick={load} aria-label="Actualizar"><RefreshCw size={16}/></button>
      </div>

      {!data.ready ? (
        <div className="glass p-4" style={{ borderColor:'rgba(245,158,11,.35)' }}>
          <p style={{ color:'#F59E0B', fontWeight:700 }}>Configuración pendiente</p>
          <p style={{ color:'var(--text-dim)', fontSize:'.8rem', marginTop:6 }}>{data.message}</p>
        </div>
      ) : <>
        <section className="glass p-5" style={{ marginBottom:'1rem', borderColor:'rgba(57,255,20,.22)' }}>
          <p style={{ color:'var(--text-dim)', fontSize:'.65rem', letterSpacing:'.08em' }}>COLABORADOR</p>
          <p style={{ color:'var(--text)', fontSize:'1.05rem', fontWeight:750, marginTop:3 }}>{data.persona?.name}</p>
          <div style={{ marginTop:16, display:'grid', gap:10 }}>
            <div style={{ display:'flex', gap:9, alignItems:'center' }}><LocateFixed size={17} color="var(--phosphor)"/><div><p style={{ color:'var(--text)', fontSize:'.85rem' }}>{data.site?.name}</p><p style={{ color:data.site?.geofenceConfigured ? '#39FF14' : '#F59E0B', fontSize:'.68rem' }}>{data.site?.geofenceConfigured ? 'Geocerca configurada' : 'Geocerca pendiente de configurar'}</p></div></div>
            <div style={{ display:'flex', gap:9, alignItems:'center' }}><Clock3 size={17} color="var(--phosphor)"/><div><p style={{ color:'var(--text)', fontSize:'.85rem' }}>Hora oficial del servidor</p><p style={{ color:'var(--text-dim)', fontSize:'.68rem' }}>El teléfono no define la hora registrada</p></div></div>
          </div>
        </section>

        <button type="button" disabled={marking} onClick={mark} style={{ width:'100%', minHeight:68, border:0, borderRadius:10, cursor:marking ? 'wait' : 'pointer', background:isOut ? '#F97316' : 'var(--phosphor)', color:'#0A0A0E', fontWeight:850, fontSize:'1.05rem', display:'flex', alignItems:'center', justifyContent:'center', gap:10, opacity:marking ? .65 : 1 }}>
          {isOut ? <LogOut size={22}/> : <LogIn size={22}/>} {marking ? 'Obteniendo ubicación…' : `MARCAR ${attendanceEventLabel(nextType).toUpperCase()}`}
        </button>
        <p style={{ color:'var(--text-dim)', fontSize:'.68rem', textAlign:'center', lineHeight:1.45, margin:'10px 12px 1.4rem' }}>Al marcar se solicitará tu ubicación. Durante el piloto, una geocerca o turno todavía no configurados quedarán pendientes de validación.</p>

        <section>
          <p style={{ color:'var(--text-dim)', fontFamily:'var(--font-metric)', fontSize:'.65rem', letterSpacing:'.08em', marginBottom:8 }}>MI HISTORIAL RECIENTE</p>
          {!data.events?.length ? <div className="glass p-4" style={{ textAlign:'center', color:'var(--text-dim)', fontSize:'.8rem' }}>Todavía no registraste marcaciones.</div> : data.events.map(event => {
            const status = attendanceStatus(event.validationStatus)
            return <article key={event.id} className="glass p-3" style={{ marginBottom:8, borderLeft:`3px solid ${status.color}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:10 }}><strong style={{ color:'var(--text)', fontSize:'.85rem' }}>{attendanceEventLabel(event.eventType)}</strong><span style={{ color:status.color, fontSize:'.68rem', fontWeight:700 }}>{status.label}</span></div>
              <p style={{ color:'var(--text-dim)', fontSize:'.72rem', marginTop:5 }}>{formatDate(event.serverTimestamp)} · {event.siteName}</p>
              <p style={{ color:'var(--text-dim)', fontSize:'.66rem', marginTop:3 }}>GPS ±{Math.round(event.gpsAccuracyM || 0)} m{Number.isFinite(event.distanceM) ? ` · distancia ${Math.round(event.distanceM)} m` : ''}</p>
              {event.reasons?.length > 0 && <p style={{ color:'#F59E0B', fontSize:'.66rem', marginTop:5 }}>{event.reasons.join(' · ')}</p>}
            </article>
          })}
        </section>
      </>}
    </div>
  )
}

