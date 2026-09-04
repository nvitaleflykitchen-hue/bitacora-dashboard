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
  const [siteId, setSiteId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const next = await getMyAttendance()
      setData(next)
      setSiteId(current => {
        if (next?.sites?.some(site => String(site.id) === String(current))) return current
        if (next?.sites?.length === 1) return String(next.sites[0].id)
        return next?.lastEvent?.eventType === 'CLOCK_IN' && next?.lastEvent?.siteId
          ? String(next.lastEvent.siteId)
          : ''
      })
    }
    catch (error) { toast.error(`No se pudo cargar Marcación: ${mensajeError(error)}`) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const mark = async () => {
    const type = data?.nextEventType || 'CLOCK_IN'
    setMarking(true)
    try {
      const result = await markMyAttendance(type, siteId)
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
            <div style={{ display:'flex', gap:9, alignItems:'flex-start' }}><LocateFixed size={17} color="var(--phosphor)" style={{ marginTop:14 }}/><div style={{ flex:1 }}><label htmlFor="attendance-site" style={{ color:'var(--text-dim)', fontSize:'.62rem', letterSpacing:'.07em' }}>LUGAR DE TRABAJO DE ESTA MARCACIÓN</label><select id="attendance-site" className="input-dark" value={siteId} onChange={event=>setSiteId(event.target.value)} style={{ width:'100%', marginTop:5 }}><option value="">Seleccionar sede…</option>{(data.sites || []).map(site=><option key={site.id} value={site.id}>{site.name}{site.geofenceConfigured ? '' : ' · geocerca pendiente'}</option>)}</select>{data.multiSite && <p style={{ color:'var(--text-dim)', fontSize:'.66rem', marginTop:5 }}>Perfil multisede: podés elegir una sede diferente en el ingreso y en el egreso.</p>}{data.lastEvent?.eventType === 'CLOCK_IN' && <p style={{ color:'#60A5FA', fontSize:'.68rem', marginTop:5 }}>Jornada iniciada en {data.lastEvent.siteName || 'otra sede'}.</p>}</div></div>
            <div style={{ display:'flex', gap:9, alignItems:'center' }}><Clock3 size={17} color="var(--phosphor)"/><div><p style={{ color:'var(--text)', fontSize:'.85rem' }}>Hora oficial del servidor</p><p style={{ color:'var(--text-dim)', fontSize:'.68rem' }}>El teléfono no define la hora registrada</p></div></div>
          </div>
        </section>

        <button type="button" disabled={marking || !siteId} onClick={mark} style={{ width:'100%', minHeight:68, border:0, borderRadius:10, cursor:marking || !siteId ? 'not-allowed' : 'pointer', background:isOut ? '#F97316' : 'var(--phosphor)', color:'#0A0A0E', fontWeight:850, fontSize:'1.05rem', display:'flex', alignItems:'center', justifyContent:'center', gap:10, opacity:marking || !siteId ? .55 : 1 }}>
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

