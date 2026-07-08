import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, ExternalLink, Loader2, Network, RefreshCw, Users } from 'lucide-react'
import { getAllSedeContactos, getContactos, getGrupos, getSedes } from '../lib/queries'
import { useAuth } from '../lib/auth'

const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const hasAny = (value, terms) => terms.some(term => norm(value).includes(term))

const ESCALAS_REFERENCE = {
  executive: { nombre:'Benjamín García', cargo:'Gerente General' },
  plant: { nombre:'Nicolás Vitale', cargo:'Jefatura de Planta' },
  supervisor: { nombre:'Miguel Riviere', cargo:'Supervisor de Operaciones – Escalas' },
  commercial: {
    nombre:'Santiago Testoni',
    cargo:'Comercial y Facturación',
    emails:['santiagotestoni@gmail.com', 'comercial@flykitchen.com.ar'],
    telefono:'351 5059582',
  },
  quality: {
    nombre:'Débora Rodríguez',
    cargo:'Dirección Técnica de Calidad',
    email:'tecnica@flykitchen.com.ar',
    telefono:'351 4025335',
  },
  siteOwners: [
    { match:'cordoba', nombre:'Raúl Solorza' },
    { match:'rosario', nombre:'Gastón Gracia' },
    { match:'mendoza', nombre:'Mariana Moyano' },
    { match:'tucuman', nombre:'Exequiel Lobo' },
    { match:'salta', nombre:'Leonardo Flores' },
  ],
}

function PersonNode({ title, contact, tone = 'primary' }) {
  const color = tone === 'support' ? '#f59e0b' : 'var(--phosphor)'
  const emails = contact?.emails || (contact?.email ? [contact.email] : [])
  return (
    <article className="glass" style={{ minWidth:210, maxWidth:280, padding:'0.8rem 1rem', border:`1px solid ${tone === 'support' ? 'rgba(245,158,11,.35)' : 'rgba(57,255,20,.28)'}`, borderRadius:5, textAlign:'center' }}>
      <p className="font-metric" style={{ fontSize:'0.6rem', color, letterSpacing:'.09em' }}>{title}</p>
      <p style={{ color:'var(--text)', fontWeight:700, fontSize:'0.8rem', marginTop:5 }}>{contact?.nombre || 'Sin asignar'}</p>
      {contact?.cargo && <p style={{ color:'var(--text-dim)', fontSize:'0.62rem', marginTop:2 }}>{contact.cargo}</p>}
      {emails.map((email, index) => <a key={email} href={`mailto:${email}`} style={{ color:'var(--text-dim)', fontSize:'0.6rem', display:'block', marginTop:index === 0 ? 5 : 2 }}>{email}</a>)}
      {contact?.telefono && <p style={{ color:'var(--text-dim)', fontSize:'0.6rem', marginTop:2 }}>{contact.telefono}</p>}
    </article>
  )
}

function SedeNode({ sede, assignments, fallbackOwner, excludedContactIds = new Set(), onOpen }) {
  const siteAssignments = assignments.filter(a => !excludedContactIds.has(String(a.contacto_id || a.contactos?.id)))
  const primary = siteAssignments.find(a => hasAny(a.rol, ['responsable','jefe','encargado'])) || siteAssignments[0]
  const assignedContact = primary?.contactos
  const assignmentIsGroupSupervisor = hasAny(primary?.rol, ['supervisor']) || norm(assignedContact?.nombre).includes('miguel riviere')
  const contact = fallbackOwner && assignmentIsGroupSupervisor ? fallbackOwner : assignedContact || fallbackOwner
  const roleLabel = contact === fallbackOwner
    ? 'RESPONSABLE DE ESCALA'
    : primary?.rol || 'SIN ASIGNACIÓN'
  return (
    <article className="glass" style={{ width:230, minHeight:180, border:'1px solid rgba(57,255,20,.16)', borderRadius:5, overflow:'hidden', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'0.75rem', textAlign:'center', borderBottom:'1px solid rgba(57,255,20,.1)', background:'rgba(57,255,20,.035)' }}>
        <div style={{ width:32, height:32, borderRadius:'50%', border:'1px solid rgba(245,158,11,.55)', display:'grid', placeItems:'center', margin:'0 auto 7px', color:'#f59e0b' }}><Users size={16}/></div>
        <p style={{ color:'var(--text)', fontWeight:750, fontSize:'0.8rem' }}>{contact?.nombre || 'Responsable pendiente'}</p>
        <p className="font-metric" style={{ color:'#f59e0b', fontSize:'0.6rem', marginTop:2 }}>{roleLabel}</p>
        {contact?.email && <p style={{ color:'var(--text-dim)', fontSize:'0.6rem', marginTop:4, overflowWrap:'anywhere' }}>{contact.email}</p>}
        {contact?.telefono && <p style={{ color:'var(--text-dim)', fontSize:'0.6rem', marginTop:2 }}>{contact.telefono}</p>}
      </div>
      <button type="button" onClick={() => onOpen(sede)} style={{ flex:1, padding:'0.75rem', textAlign:'left', background:'transparent', border:0, cursor:'pointer', color:'inherit' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Building2 size={12} style={{ color:'var(--phosphor)' }}/>
          <p className="font-metric" style={{ color:'var(--phosphor)', fontSize:'0.6rem' }}>{sede.tipo || 'SEDE'}</p>
          <ExternalLink size={10} style={{ marginLeft:'auto', color:'var(--text-dim)' }}/>
        </div>
        <p style={{ color:'var(--text)', fontWeight:700, fontSize:'0.75rem', marginTop:6 }}>{sede.nombre}</p>
        <p style={{ color:'var(--text-dim)', fontSize:'0.6rem', marginTop:4, lineHeight:1.45 }}>{sede.direccion || 'Dirección no cargada'}</p>
      </button>
    </article>
  )
}

export default function OrganigramaView({ onNavigate }) {
  const { allowedSedeIds, rol } = useAuth()
  const [data, setData] = useState({ grupos:[], sedes:[], assignments:[], contactos:[] })
  const [groupId, setGroupId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(''); setWarning('')
    try {
      const canSeeDirectory = rol === 'admin' || rol === 'editor'
      const [groupResult, siteResult, assignmentResult, contactResult] = await Promise.allSettled([
        getGrupos(), getSedes(allowedSedeIds), getAllSedeContactos(allowedSedeIds), canSeeDirectory ? getContactos() : Promise.resolve([]),
      ])
      if (siteResult.status === 'rejected') throw siteResult.reason
      const grupos = groupResult.status === 'fulfilled' ? groupResult.value : []
      const sedes = siteResult.value || []
      const assignments = assignmentResult.status === 'fulfilled' ? assignmentResult.value : []
      const contactos = contactResult.status === 'fulfilled' ? contactResult.value : []
      const displayGroups = grupos.length ? grupos : [{ id:'__escalas__', nombre:'ESCALAS' }]
      const unavailable = [
        groupResult.status === 'rejected' && 'grupos',
        assignmentResult.status === 'rejected' && 'responsables',
        contactResult.status === 'rejected' && canSeeDirectory && 'directorio',
      ].filter(Boolean)
      if (unavailable.length) setWarning(`Vista parcial: Supabase no permite consultar ${unavailable.join(', ')}.`)
      setData({ grupos:displayGroups, sedes, assignments, contactos })
      setGroupId(current => {
        if (current && displayGroups.some(g => String(g.id) === String(current))) return current
        return String(displayGroups.find(g => norm(g.nombre).includes('escala'))?.id || displayGroups[0]?.id || '')
      })
    } catch (e) {
      setError(e.message || 'No se pudo cargar el organigrama.')
    } finally {
      setLoading(false)
    }
  }, [allowedSedeIds, rol])

  useEffect(() => { load() }, [load])

  const selectedGroup = data.grupos.find(g => String(g.id) === String(groupId))
  const groupSedes = useMemo(() => data.sedes.filter(s => {
    if (groupId === '__escalas__') return norm(s.tipo).includes('aeropuerto') || norm(s.nombre).includes('aeropuerto')
    return !groupId || String(s.grupo_id) === String(groupId)
  }), [data.sedes, groupId])
  const isAirportGroup = groupSedes.length >= 3 && groupSedes.every(s => norm(s.tipo).includes('aeropuerto') || norm(s.nombre).includes('aeropuerto'))
  const isDiningGroup = groupSedes.length >= 2 && groupSedes.every(s => norm(s.tipo).includes('comedor') || norm(s.nombre).includes('comedor'))
  const isEscalas = norm(selectedGroup?.nombre).includes('escala') || groupId === '__escalas__' || isAirportGroup
  const sedes = groupSedes
  const sedeIds = useMemo(() => new Set(sedes.map(s => String(s.id))), [sedes])
  const assignments = useMemo(() => data.assignments.filter(a => a.activo !== false && sedeIds.has(String(a.sede_id))), [data.assignments, sedeIds])
  const assignedContactIds = useMemo(() => new Set(assignments.map(a => String(a.contacto_id || a.contactos?.id))), [assignments])
  const unassigned = data.contactos.filter(c => !assignedContactIds.has(String(c.id)))
  const findPerson = (fallback, terms) => {
    const found = unassigned.find(c => hasAny(`${c.cargo} ${c.nombre}`, terms) || norm(c.nombre) === norm(fallback?.nombre))
    if (!found) return fallback
    if (!fallback) return found
    return {
      ...fallback,
      ...found,
      emails: found.emails || fallback.emails,
      email: found.email || fallback.email,
      telefono: found.telefono || fallback.telefono,
    }
  }
  const executive = findPerson(isEscalas ? ESCALAS_REFERENCE.executive : null, ['gerente general','direccion general','presidencia'])
  const operations = findPerson(isEscalas ? ESCALAS_REFERENCE.plant : null, ['jefatura de planta','jefe de planta'])
  const diningSupervisorAssignment = isDiningGroup
    ? assignments.find(a => hasAny(`${a.rol} ${a.contactos?.cargo} ${a.contactos?.nombre}`, ['gestion de comedores','supervisor de comedores','supervision de comedores']))
    : null
  const supervisor = isEscalas
    ? findPerson(ESCALAS_REFERENCE.supervisor, ['supervisor de operaciones','supervisor de escalas','miguel riviere'])
    : diningSupervisorAssignment?.contactos || unassigned.find(c => hasAny(`${c.cargo} ${c.nombre}`, ['supervisor','coordinador operativo']))
  const supervisorContactIds = useMemo(() => new Set(
    supervisor?.id ? [String(supervisor.id)] : []
  ), [supervisor?.id])
  const commercial = findPerson(isEscalas ? ESCALAS_REFERENCE.commercial : null, ['comercial','facturacion','santiago testoni'])
  const quality = findPerson(isEscalas ? ESCALAS_REFERENCE.quality : null, ['calidad','direccion tecnica','tecnica de calidad','debora rodriguez'])

  const openSede = sede => {
    sessionStorage.setItem('bitacora:openSedeId', String(sede.id))
    sessionStorage.setItem('bitacora:sedesTab', 'ficha')
    onNavigate?.('sedesHub')
  }

  if (loading) return <div className="flex-1 grid place-items-center"><Loader2 size={22} className="animate-spin" style={{ color:'var(--phosphor)' }}/></div>

  return (
    <div className="flex-1 min-h-0 overflow-auto px-4 md:px-6 py-4">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <div className="flex items-center gap-2"><Network size={16} style={{ color:'var(--phosphor)' }}/><h2 className="font-title font-bold" style={{ color:'var(--text)' }}>Organigrama operativo</h2></div>
          <p style={{ color:'var(--text-dim)', fontSize:'0.66rem', marginTop:4 }}>Se genera desde grupos, sedes y responsables. Tocá una sede para abrir su ficha.</p>
        </div>
        <div className="flex gap-2">
          <select className="input-dark" value={groupId} onChange={e => setGroupId(e.target.value)} style={{ minWidth:190, fontSize:'0.72rem' }}>
            {data.grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
          <button type="button" onClick={load} className="btn-ghost" aria-label="Actualizar organigrama"><RefreshCw size={13}/></button>
        </div>
      </div>

      {error && <div style={{ color:'#ff6060', border:'1px solid rgba(255,80,80,.25)', background:'rgba(255,80,80,.08)', padding:'0.7rem', fontSize:'0.72rem' }}>{error}</div>}
      {warning && <div style={{ color:'#f59e0b', border:'1px solid rgba(245,158,11,.25)', background:'rgba(245,158,11,.07)', padding:'0.65rem', fontSize:'0.68rem', marginBottom:'1rem' }}>{warning}</div>}

      {!error && data.grupos.length > 0 && (
        <div style={{ minWidth:Math.max(900, sedes.length * 250), paddingBottom:'2rem' }}>
          <div style={{ display:'grid', gridTemplateColumns:'280px 280px 280px', justifyContent:'center', alignItems:'center', columnGap:28 }}>
            <div/>
            <PersonNode title="DIRECCIÓN GENERAL" contact={executive}/>
            {commercial && <div style={{ borderLeft:'2px dashed rgba(245,158,11,.45)', paddingLeft:24 }}>
              <PersonNode title="COMERCIAL Y FACTURACIÓN" contact={commercial} tone="support"/>
            </div>}
          </div>
          <div style={{ width:1, height:28, background:'rgba(57,255,20,.35)', margin:'0 auto' }}/>
          <div className="flex justify-center">
            <PersonNode title="JEFATURA DE PLANTA" contact={operations}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'280px 280px 280px', justifyContent:'center', alignItems:'start', columnGap:28 }}>
            <div/>
            <div style={{ width:1, height:'100%', minHeight:120, background:'rgba(57,255,20,.35)', margin:'0 auto' }}/>
            {quality && <div style={{ borderTop:'2px dashed rgba(245,158,11,.45)', paddingTop:12, marginTop:18 }}>
              <PersonNode title="DIRECCIÓN TÉCNICA DE CALIDAD" contact={quality} tone="support"/>
            </div>}
          </div>
          {supervisor && <>
            <div className="flex justify-center"><PersonNode title={isEscalas ? 'SUPERVISIÓN DE OPERACIONES – ESCALAS' : isDiningGroup ? 'SUPERVISIÓN DE COMEDORES' : 'SUPERVISIÓN OPERATIVA'} contact={supervisor}/></div>
            <div style={{ width:1, height:28, background:'rgba(57,255,20,.35)', margin:'0 auto' }}/>
          </>}
          {sedes.length > 0 && <div style={{ height:1, background:'rgba(57,255,20,.28)', margin:`0 ${Math.max(115, 125)}px` }}/>} 
          <div style={{ display:'flex', gap:20, justifyContent:'center', alignItems:'flex-start' }}>
            {sedes.map(sede => (
              <div key={sede.id} style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                <div style={{ width:1, height:24, background:'rgba(57,255,20,.28)' }}/>
                <SedeNode
                  sede={sede}
                  assignments={assignments.filter(a => String(a.sede_id) === String(sede.id))}
                  fallbackOwner={isEscalas ? ESCALAS_REFERENCE.siteOwners.find(owner => norm(sede.nombre).includes(owner.match)) : null}
                  excludedContactIds={supervisorContactIds}
                  onOpen={openSede}
                />
              </div>
            ))}
          </div>
          {sedes.length === 0 && <div className="glass" style={{ textAlign:'center', padding:'2rem', color:'var(--text-dim)', fontSize:'0.75rem' }}>Este grupo todavía no tiene sedes asignadas.</div>}
        </div>
      )}
    </div>
  )
}
