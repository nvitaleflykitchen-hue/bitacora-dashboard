import { useEffect, useState } from 'react'
import { BriefcaseBusiness, CalendarDays, ChevronLeft, FileCheck2, LockKeyhole, MessageCircle, MessageSquarePlus, Phone, ShieldCheck, Star, UserRound } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getInternalCredential, registerCredentialHistoryObservation } from '../lib/credenciales'
import { PersonaAvatar } from './PersonaAvatar'

const scopeLabels = {
  propio: 'Tu propia información',
  supervision: 'Persona bajo tu supervisión',
  sede: 'Información básica de tu sede',
  global: 'Acceso global autorizado',
}

const fmtDate = value => value ? format(new Date(`${value}T12:00:00`), 'dd/MM/yyyy', { locale: es }) : '—'
const phoneDigits = value => String(value || '').replace(/\D/g, '').replace(/^0+/, '')
const phoneHref = value => phoneDigits(value) ? `tel:+${phoneDigits(value)}` : null
const whatsappHref = value => {
  const digits = phoneDigits(value)
  if (!digits) return null
  const international = digits.startsWith('549') ? digits : digits.startsWith('54') ? `549${digits.slice(2).replace(/^9/, '')}` : `549${digits.replace(/^9/, '')}`
  return `https://wa.me/${international}`
}

function Panel({ title, icon: Icon, children }) {
  return <section style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,.1)', borderRadius:10, padding:'1rem' }}>
    <h2 style={{ display:'flex', alignItems:'center', gap:7, color:'var(--phosphor)', fontSize:'.72rem', letterSpacing:'.07em', textTransform:'uppercase', marginBottom:12 }}>
      <Icon size={15}/> {title}
    </h2>
    {children}
  </section>
}

function Field({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return <div><p style={{ color:'var(--text-dim)', fontSize:'.68rem' }}>{label}</p><p style={{ color:'var(--text)', fontSize:'.86rem', marginTop:2 }}>{value}</p></div>
}

export default function InternalCredentialView({ token, onClose, onOpenFullRecord }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showObservation, setShowObservation] = useState(false)
  const [observation, setObservation] = useState('')
  const [savingObservation, setSavingObservation] = useState(false)
  const [observationMessage, setObservationMessage] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    getInternalCredential(token)
      .then(result => { if (active) result ? setData(result) : setError('No se encontró la credencial.') })
      .catch(err => { if (active) setError(err?.message?.includes('permiso') ? err.message : 'No se pudo consultar esta credencial.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  const person = data?.person
  const valid = data?.credential?.status === 'activa' && (!data.credential.expiresAt || new Date(`${data.credential.expiresAt}T23:59:59`) >= new Date())
  const avatarPerson = person ? { nombre:person.name, foto_url:person.photoUrl } : null
  const canAddObservation = data?.scope === 'supervision' || data?.canOpenFullRecord
  const saveObservation = async () => {
    const description = observation.trim()
    if (!description) return setObservationMessage('Escribí una observación antes de guardar.')
    setSavingObservation(true); setObservationMessage('')
    try {
      await registerCredentialHistoryObservation(token, description)
      setObservation(''); setShowObservation(false)
      setObservationMessage('Observación registrada en el historial.')
    } catch (err) {
      setObservationMessage(err?.message || 'No se pudo registrar la observación.')
    } finally { setSavingObservation(false) }
  }
  return <div role="dialog" aria-modal="true" aria-label="Ficha interna de credencial" style={{ position:'fixed', inset:0, zIndex:12000, background:'rgba(3,4,7,.92)', display:'grid', placeItems:'center', padding:12 }}>
    <div className="mobile-scroll" style={{ width:'min(100%, 560px)', maxHeight:'calc(100dvh - 24px)', overflowY:'auto', background:'var(--abyss)', border:'1px solid rgba(57,255,20,.28)', borderRadius:14, boxShadow:'0 22px 80px rgba(0,0,0,.55)' }}>
      <header style={{ position:'sticky', top:0, zIndex:2, display:'flex', alignItems:'center', gap:8, padding:'12px 14px', background:'rgba(15,16,22,.96)', borderBottom:'1px solid rgba(57,255,20,.12)' }}>
        <button type="button" onClick={onClose} className="btn-ghost" style={{ minHeight:40, display:'flex', alignItems:'center', gap:4 }}><ChevronLeft size={17}/> Volver</button>
        <div><p style={{ color:'var(--text)', fontWeight:800, fontSize:'.92rem' }}>Credencial interna</p><p style={{ color:'var(--text-dim)', fontSize:'.64rem' }}>Datos filtrados según tu acceso</p></div>
      </header>
      {loading && <div style={{ minHeight:280, display:'grid', placeItems:'center', color:'var(--text-dim)' }}>Consultando permisos…</div>}
      {!loading && error && <div style={{ padding:'2rem 1rem', textAlign:'center' }}><LockKeyhole size={34} style={{ color:'#F59E0B', margin:'0 auto 12px' }}/><p style={{ color:'var(--text)', fontWeight:700 }}>{error}</p><p style={{ color:'var(--text-dim)', fontSize:'.76rem', marginTop:8 }}>El intento no habilita el acceso a la ficha completa.</p></div>}
      {!loading && data && <div style={{ padding:'1rem', display:'grid', gap:10 }}>
        <section style={{ background:'linear-gradient(145deg, rgba(57,255,20,.1), rgba(249,115,22,.06))', border:'1px solid rgba(57,255,20,.22)', borderRadius:12, padding:'1rem' }}>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}><PersonaAvatar persona={avatarPerson} size={66}/><div style={{ minWidth:0 }}><h1 style={{ color:'var(--text)', fontSize:'1.15rem', fontWeight:800 }}>{person.name}</h1><p style={{ color:'var(--text-dim)', fontSize:'.78rem', marginTop:3 }}>{person.jobTitle || 'Sin cargo informado'}</p><p style={{ color:'var(--phosphor)', fontSize:'.7rem', marginTop:3 }}>{person.area || 'Área no informada'}</p></div></div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginTop:14, paddingTop:12, borderTop:'1px solid rgba(255,255,255,.08)' }}><span style={{ display:'flex', alignItems:'center', gap:6, color:valid?'var(--phosphor)':'#F59E0B', fontWeight:800, fontSize:'.76rem' }}><ShieldCheck size={16}/>{valid?'CREDENCIAL VÁLIDA':'CREDENCIAL NO VIGENTE'}</span><span style={{ color:'var(--text-dim)', fontSize:'.68rem' }}>Vence {fmtDate(data.credential.expiresAt)}</span></div>
        </section>
        <div style={{ color:'#93C5FD', background:'rgba(59,130,246,.08)', border:'1px solid rgba(59,130,246,.18)', borderRadius:8, padding:10, fontSize:'.72rem' }}>{scopeLabels[data.scope] || 'Acceso autorizado'} · Se muestran únicamente las secciones permitidas.</div>
        <Panel title="Identificación" icon={UserRound}><div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:12 }}><Field label="Estado laboral" value={person.active?'Activo':'Inactivo'}/><Field label="Sede/s" value={person.sites?.join(' · ') || 'Sin sede'}/></div></Panel>
        {data.supervisor && <Panel title="Supervisor directo" icon={UserRound}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div><p style={{ color:'var(--text)', fontWeight:750, fontSize:'.88rem' }}>{data.supervisor.name}</p>{data.supervisor.jobTitle && <p style={{ color:'var(--text-dim)', fontSize:'.7rem', marginTop:2 }}>{data.supervisor.jobTitle}</p>}</div>
            {data.supervisor.phone && <div style={{ display:'flex', gap:7 }}>
              <a href={phoneHref(data.supervisor.phone)} className="btn-ghost" aria-label={`Llamar a ${data.supervisor.name}`} style={{ minHeight:42, display:'flex', alignItems:'center', gap:5, textDecoration:'none' }}><Phone size={15}/> Llamar</a>
              <a href={whatsappHref(data.supervisor.phone)} target="_blank" rel="noreferrer" className="btn-ghost" aria-label={`Enviar WhatsApp a ${data.supervisor.name}`} style={{ minHeight:42, display:'flex', alignItems:'center', gap:5, color:'#25D366', textDecoration:'none' }}><MessageCircle size={15}/> WhatsApp</a>
            </div>}
          </div>
        </Panel>}
        {data.employment && <Panel title="Información laboral" icon={BriefcaseBusiness}><div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:12 }}><Field label="N.º de legajo" value={data.employment.employeeNumber}/><Field label="Ingreso" value={fmtDate(data.employment.startDate)}/><Field label="Función actual" value={data.employment.realFunction}/></div></Panel>}
        {data.performance && <Panel title="Evaluación de desempeño" icon={Star}><div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:12 }}><Field label="Evaluaciones" value={data.performance.count}/><Field label="Promedio" value={data.performance.averageScore}/>{data.performance.latest && <><Field label="Último período" value={data.performance.latest.period || fmtDate(data.performance.latest.date)}/><Field label="Resultado" value={[data.performance.latest.score,data.performance.latest.result].filter(Boolean).join(' · ')}/></>}</div></Panel>}
        {data.documentation && <Panel title="Documentación" icon={FileCheck2}><Field label="Adjuntos registrados" value={data.documentation.attachmentCount}/><p style={{ color:'var(--text-dim)', fontSize:'.68rem', marginTop:8 }}>Se muestra el estado general, no el contenido de los documentos.</p></Panel>}
        <Panel title="Información protegida" icon={LockKeyhole}><p style={{ color:'var(--text-dim)', fontSize:'.76rem', lineHeight:1.5 }}>Remuneraciones, DNI/CUIL, datos médicos, domicilio y antecedentes disciplinarios no se muestran mediante el escaneo.</p></Panel>
        {canAddObservation && <section style={{ background:'rgba(249,115,22,.06)', border:'1px solid rgba(249,115,22,.22)', borderRadius:10, padding:'1rem' }}>
          {!showObservation ? <button type="button" className="btn-ghost" onClick={()=>{setShowObservation(true);setObservationMessage('')}} style={{ width:'100%', minHeight:46, display:'flex', alignItems:'center', justifyContent:'center', gap:7, color:'#FDBA74' }}><MessageSquarePlus size={17}/> Registrar observación en el historial</button> : <>
            <label style={{ color:'var(--text)', fontSize:'.76rem', fontWeight:700 }}>Observación del supervisor</label>
            <textarea className="input-dark" value={observation} maxLength={1500} onChange={e=>setObservation(e.target.value)} placeholder="Describí el hecho de manera objetiva: qué ocurrió, cuándo y qué acción se tomó." style={{ width:'100%', minHeight:110, marginTop:8, resize:'vertical' }}/>
            <p style={{ color:'var(--text-dim)', fontSize:'.65rem', marginTop:5 }}>Quedará identificada con tu nombre y la fecha actual. No genera una sanción disciplinaria.</p>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:7, marginTop:10 }}><button type="button" className="btn-ghost" onClick={()=>{setShowObservation(false);setObservation('')}} disabled={savingObservation}>Cancelar</button><button type="button" className="btn-primary" onClick={saveObservation} disabled={savingObservation}>{savingObservation?'Guardando…':'Guardar en historial'}</button></div>
          </>}
        </section>}
        {observationMessage && <p role="status" style={{ color:observationMessage.startsWith('Observación registrada')?'var(--phosphor)':'#F59E0B', background:'rgba(255,255,255,.04)', borderRadius:7, padding:9, fontSize:'.72rem' }}>{observationMessage}</p>}
        {data.canOpenFullRecord && onOpenFullRecord && <button type="button" className="btn-primary" onClick={()=>onOpenFullRecord(person.id)} style={{ minHeight:48 }}>Abrir ficha completa autorizada</button>}
        <p style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, color:'var(--text-dim)', fontSize:'.65rem', padding:'4px 0 8px' }}><CalendarDays size={13}/> Esta consulta quedó registrada por seguridad.</p>
      </div>}
    </div>
  </div>
}
