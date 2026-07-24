import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, ExternalLink, GripVertical, LayoutDashboard, Loader2, Lock, Mail, MessageCircle, Network, Phone, Plus, RefreshCw, Save, Trash2, Unlock, Users } from 'lucide-react'
import { getAllSedeContactos, getContactos, getGrupos, getSedes } from '../lib/queries'
import { useAuth } from '../lib/auth'
import OrganigramaDesigner from '../components/OrganigramaDesigner'

const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const hasAny = (value, terms) => terms.some(term => norm(value).includes(term))
const displayGroupName = value => norm(value) === 'otros' ? 'Planta de Producción Córdoba' : value
const isAirportSite = sede => norm(sede?.tipo).includes('aeropuerto') || norm(sede?.nombre).includes('aeropuerto')
const isHospitalSite = sede => hasAny(`${sede?.tipo} ${sede?.nombre}`, ['hospital','hospitalario'])
const isDiningSite = sede => hasAny(`${sede?.tipo} ${sede?.nombre}`, ['comedor']) && !isHospitalSite(sede)
const isProductionSite = sede => hasAny(`${sede?.tipo} ${sede?.nombre}`, ['planta de produccion','produccion cordoba'])
const isEducationSite = sede => hasAny(`${sede?.tipo} ${sede?.nombre}`, ['educacion','educativo','escuela','colegio','universidad'])
const isRestaurantSite = sede => hasAny(`${sede?.tipo} ${sede?.nombre}`, ['restaurante','restaurant'])
const isCciSite = sede => hasAny(`${sede?.tipo} ${sede?.nombre}`, ['cci'])
const isAirportGroupName = value => hasAny(value, ['aeropuerto', 'aeropuertos', 'escala', 'escalas'])
const phoneDigits = value => String(value || '').replace(/\D/g, '').replace(/^0+/, '')
const callHref = phone => phoneDigits(phone) ? `tel:${phoneDigits(phone)}` : ''
const whatsappHref = phone => {
  const digits = phoneDigits(phone)
  if (!digits) return ''
  if (digits.startsWith('549')) return `https://wa.me/${digits}`
  if (digits.startsWith('54')) return `https://wa.me/549${digits.slice(2).replace(/^9/, '')}`
  return `https://wa.me/549${digits.replace(/^9/, '')}`
}

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

const CORDOBA_PRODUCTION_REFERENCE = {
  plant: { nombre:'Vanesa Ledezma', cargo:'Jefatura de Planta' },
}

function ContactActions({ contact, tone = 'primary' }) {
  const phone = contact?.telefono
  const emails = contact?.emails || (contact?.email ? [contact.email] : [])
  const email = emails[0]
  const phoneLink = callHref(phone)
  const waLink = whatsappHref(phone)
  const border = tone === 'support' ? 'rgba(245,158,11,.28)' : 'rgba(57,255,20,.22)'
  const color = tone === 'support' ? '#f59e0b' : 'var(--phosphor)'
  if (!phoneLink && !email && !waLink) return null
  const actionStyle = {
    width:28, height:26, border:`1px solid ${border}`, borderRadius:4,
    display:'inline-flex', alignItems:'center', justifyContent:'center',
    color, background:'rgba(255,255,255,0.03)', textDecoration:'none',
  }
  return (
    <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:8 }}>
      {phoneLink && <a href={phoneLink} title="Llamar" aria-label="Llamar" style={actionStyle}><Phone size={12}/></a>}
      {email && <a href={`mailto:${email}`} title="Enviar correo" aria-label="Enviar correo" style={actionStyle}><Mail size={12}/></a>}
      {waLink && <a href={waLink} target="_blank" rel="noreferrer" title="WhatsApp" aria-label="WhatsApp" style={actionStyle}><MessageCircle size={12}/></a>}
    </div>
  )
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
      <ContactActions contact={contact} tone={tone}/>
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
        <ContactActions contact={contact} tone="support"/>
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

const NODE_WIDTH = 250
const PERSON_HEIGHT = 132
const SEDE_HEIGHT = 190

function layoutKey(groupId) {
  return `flygestion:organigrama-layout:${groupId || 'general'}`
}

function makeDefaultLayout(nodeIds, sedeIds) {
  const width = Math.max(1120, sedeIds.length * 270 + 120)
  const center = Math.round(width / 2 - NODE_WIDTH / 2)
  const positions = {
    executive: { x:center, y:30 },
    operations: { x:center, y:205 },
    supervisor: { x:center, y:380 },
    commercial: { x:center + 350, y:30 },
    quality: { x:center + 350, y:205 },
  }
  sedeIds.forEach((id, index) => {
    const rowWidth = sedeIds.length * 270
    positions[id] = { x:Math.round((width - rowWidth) / 2 + index * 270 + 10), y:570 }
  })
  nodeIds.filter(id => !positions[id]).forEach((id, index) => {
    positions[id] = { x:40 + (index % 4) * 270, y:790 + Math.floor(index / 4) * 180 }
  })
  return {
    width,
    height: Math.max(900, 980 + Math.ceil(Math.max(0, nodeIds.length - sedeIds.length - 5) / 4) * 180),
    positions: Object.fromEntries(nodeIds.filter(id => positions[id]).map(id => [id, positions[id]])),
  }
}

function connectionPath(from, to) {
  const startX = from.x + NODE_WIDTH / 2
  const startY = from.y + from.height
  const endX = to.x + NODE_WIDTH / 2
  const endY = to.y
  const middleY = startY + Math.max(24, (endY - startY) / 2)
  return `M ${startX} ${startY} V ${middleY} H ${endX} V ${endY}`
}

function OrgCanvas({ nodes, edges, groupId, editable, availableContacts = [] }) {
  const usedContactIds = useMemo(() => new Set(nodes.map(node => String(node.contactId || '')).filter(Boolean)), [nodes])
  const contactNodes = useMemo(() => availableContacts
    .filter(contact => contact?.id && !usedContactIds.has(String(contact.id)))
    .map(contact => ({
      id:`contact:${contact.id}`,
      contactId:contact.id,
      kind:'person',
      label:contact.nombre,
      content:<PersonNode title={contact.cargo || 'RESPONSABLE'} contact={contact}/>,
    })), [availableContacts, usedContactIds])
  const allNodes = useMemo(() => [...nodes, ...contactNodes], [contactNodes, nodes])
  const nodeIds = useMemo(() => allNodes.map(node => node.id), [allNodes])
  const sedeIds = useMemo(() => allNodes.filter(node => node.kind === 'sede').map(node => node.id), [allNodes])
  const defaults = useMemo(() => makeDefaultLayout(nodeIds, sedeIds), [nodeIds, sedeIds])
  const [editing, setEditing] = useState(false)
  const [positions, setPositions] = useState(defaults.positions)
  const [activeNodeIds, setActiveNodeIds] = useState(nodes.map(node => node.id))
  const [parents, setParents] = useState({})
  const [contactToAdd, setContactToAdd] = useState('')
  const [saved, setSaved] = useState(true)

  useEffect(() => {
    let next = defaults.positions
    let nextActive = nodes.map(node => node.id)
    let nextParents = {}
    try {
      const stored = JSON.parse(localStorage.getItem(layoutKey(groupId)) || 'null')
      if (stored?.positions) next = { ...defaults.positions, ...stored.positions }
      if (Array.isArray(stored?.activeNodeIds)) nextActive = stored.activeNodeIds.filter(id => nodeIds.includes(id))
      if (stored?.parents) nextParents = stored.parents
    } catch {
      // Si el layout local se corrompe, se vuelve al orden automático.
    }
    setPositions(next)
    setActiveNodeIds(nextActive)
    setParents(nextParents)
    setContactToAdd('')
    setSaved(true)
    setEditing(false)
  }, [defaults.positions, groupId, nodeIds, nodes])

  const save = () => {
    localStorage.setItem(layoutKey(groupId), JSON.stringify({ positions, activeNodeIds, parents, updatedAt:new Date().toISOString() }))
    setSaved(true)
  }

  const autoArrange = () => {
    setPositions(defaults.positions)
    setSaved(false)
  }

  const addContact = () => {
    if (!contactToAdd || activeNodeIds.includes(contactToAdd)) return
    setActiveNodeIds(current => [...current, contactToAdd])
    const suggestedParent = activeNodeIds.includes('supervisor') ? 'supervisor' : activeNodeIds.includes('operations') ? 'operations' : 'executive'
    setParents(current => ({ ...current, [contactToAdd]:suggestedParent }))
    setContactToAdd('')
    setSaved(false)
  }

  const removeNode = nodeId => {
    setActiveNodeIds(current => current.filter(id => id !== nodeId))
    setParents(current => {
      const next = { ...current }
      delete next[nodeId]
      const fallbackParent = nodeId !== 'operations' && activeNodeIds.includes('operations')
        ? 'operations'
        : nodeId !== 'executive' && activeNodeIds.includes('executive') ? 'executive' : ''
      activeNodeIds.forEach(id => {
        if (id !== nodeId && (next[id] || baseParents[id]) === nodeId) {
          if (fallbackParent && fallbackParent !== id) next[id] = fallbackParent
          else delete next[id]
        }
      })
      return next
    })
    setSaved(false)
  }

  const changeParent = (nodeId, parentId) => {
    setParents(current => ({ ...current, [nodeId]:parentId }))
    setSaved(false)
  }

  const beginDrag = (event, nodeId) => {
    if (!editing || event.button !== 0 || event.target.closest('a,button,input,select')) return
    event.preventDefault()
    const origin = positions[nodeId] || { x:0, y:0 }
    const startX = event.clientX
    const startY = event.clientY
    const move = moveEvent => {
      setPositions(current => ({
        ...current,
        [nodeId]: {
          x:Math.max(8, origin.x + moveEvent.clientX - startX),
          y:Math.max(8, origin.y + moveEvent.clientY - startY),
        },
      }))
      setSaved(false)
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }

  const visibleNodes = allNodes.filter(node => activeNodeIds.includes(node.id) && positions[node.id])
  const positioned = Object.fromEntries(visibleNodes.map(node => [
    node.id,
    { ...positions[node.id], height:node.kind === 'sede' ? SEDE_HEIGHT : PERSON_HEIGHT },
  ]))
  const baseParents = Object.fromEntries(edges.map(edge => [edge.to, edge.from]))
  const effectiveEdges = visibleNodes
    .filter(node => node.id !== 'executive')
    .map(node => {
      const parent = parents[node.id] || baseParents[node.id]
      if (!parent || !positioned[parent] || parent === node.id) return null
      const original = edges.find(edge => edge.to === node.id)
      return { from:parent, to:node.id, support:original?.support && !parents[node.id] }
    })
    .filter(Boolean)
  const addableNodes = allNodes.filter(node => node.kind === 'person' && !activeNodeIds.includes(node.id))

  return (
    <section>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <p style={{ color:'var(--text-dim)', fontSize:'0.64rem' }}>
          {editing ? 'Arrastrá cualquier tarjeta. Las conexiones acompañan el movimiento.' : 'Vista interactiva: desplazate horizontalmente para recorrer toda la estructura.'}
        </p>
        {editable && (
          <div className="flex gap-2">
            {editing && <>
              <select className="input-dark" value={contactToAdd} onChange={event => setContactToAdd(event.target.value)} style={{ minWidth:220, fontSize:'0.65rem' }}>
                <option value="">Agregar persona…</option>
                {addableNodes.map(node => <option key={node.id} value={node.id}>{node.label || node.content?.props?.contact?.nombre || node.id}</option>)}
              </select>
              <button type="button" className="btn-ghost" onClick={addContact} disabled={!contactToAdd}><Plus size={13}/> AGREGAR</button>
            </>}
            {editing && <button type="button" className="btn-ghost" onClick={autoArrange}><LayoutDashboard size={13}/> ORDENAR</button>}
            {editing && <button type="button" className="btn-ghost" onClick={save} disabled={saved}><Save size={13}/> {saved ? 'GUARDADO' : 'GUARDAR'}</button>}
            <button type="button" className={editing ? 'btn-primary' : 'btn-ghost'} onClick={() => setEditing(value => !value)}>
              {editing ? <Unlock size={13}/> : <Lock size={13}/>} {editing ? 'TERMINAR EDICIÓN' : 'EDITAR ORGANIGRAMA'}
            </button>
          </div>
        )}
      </div>
      <div className="glass" style={{ overflow:'auto', border:'1px solid rgba(57,255,20,.13)', borderRadius:6, background:'radial-gradient(circle at center, rgba(57,255,20,.035), transparent 52%), #101116' }}>
        <div style={{ position:'relative', width:defaults.width, height:defaults.height, minHeight:700 }}>
          <svg width={defaults.width} height={defaults.height} style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'visible' }} aria-hidden="true">
            {effectiveEdges.map(edge => {
              const from = positioned[edge.from]
              const to = positioned[edge.to]
              if (!from || !to) return null
              return <path key={`${edge.from}-${edge.to}`} d={connectionPath(from, to)} fill="none" stroke={edge.support ? 'rgba(245,158,11,.5)' : 'rgba(57,255,20,.42)'} strokeWidth="2" strokeDasharray={edge.support ? '6 6' : undefined}/>
            })}
          </svg>
          {visibleNodes.map(node => {
            const position = positioned[node.id]
            return (
              <div
                key={node.id}
                onPointerDown={event => beginDrag(event, node.id)}
                style={{
                  position:'absolute', left:position.x, top:position.y, width:NODE_WIDTH,
                  cursor:editing ? 'grab' : 'default', userSelect:editing ? 'none' : 'auto',
                  zIndex:2, touchAction:editing ? 'none' : 'auto',
                }}
              >
                {editing && (
                  <div style={{ position:'absolute', zIndex:4, left:0, right:0, top:-34, display:'flex', alignItems:'center', gap:5 }}>
                    <span className="font-metric" style={{ display:'flex', alignItems:'center', gap:3, color:'var(--phosphor)', fontSize:'0.52rem', background:'rgba(5,8,7,.92)', padding:'5px 6px', borderRadius:4 }}><GripVertical size={11}/> MOVER</span>
                    {node.id !== 'executive' && (
                      <select value={parents[node.id] || baseParents[node.id] || ''} onChange={event => changeParent(node.id, event.target.value)} className="input-dark" title="Depende de" style={{ flex:1, minWidth:0, height:27, padding:'2px 5px', fontSize:'0.52rem' }}>
                        <option value="">Sin dependencia</option>
                        {visibleNodes.filter(parent => parent.id !== node.id && parent.kind === 'person').map(parent => <option key={parent.id} value={parent.id}>{parent.label || parent.content?.props?.contact?.nombre || parent.id}</option>)}
                      </select>
                    )}
                    {node.kind === 'person' && node.id !== 'executive' && <button type="button" onClick={() => removeNode(node.id)} title="Quitar del organigrama" className="btn-ghost" style={{ width:28, height:27, padding:0, color:'#ff6060' }}><Trash2 size={12}/></button>}
                  </div>
                )}
                {node.content}
              </div>
            )
          })}
        </div>
      </div>
    </section>
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
      const businessDefinitions = [
        { id:'__aeropuertos__', nombre:'AEROPUERTOS', terms:['aeropuerto','escala'] },
        { id:'__hospitales__', nombre:'HOSPITALES', terms:['hospital'] },
        { id:'__educacion__', nombre:'EDUCACIÓN', terms:['educacion','educativo'] },
        { id:'__comedores__', nombre:'COMEDORES', terms:['comedor'] },
        { id:'__planta__', nombre:'PLANTA DE PRODUCCIÓN', terms:['planta','produccion','otros'] },
        { id:'__cci__', nombre:'CCI', terms:['cci'] },
        { id:'__restaurantes__', nombre:'RESTAURANTES', terms:['restaurante','restaurant'] },
      ]
      const businessGroups = businessDefinitions.map(definition => {
        const existing = grupos.find(group => hasAny(group.nombre, definition.terms))
        return existing ? { ...existing, nombre:definition.nombre } : { id:definition.id, nombre:definition.nombre }
      })
      const businessIds = new Set(businessGroups.map(group => String(group.id)))
      const naturalGroups = grupos.filter(group => !businessIds.has(String(group.id)))
      const displayGroups = [
        { id:'__global__', nombre:'FLY KITCHEN · GLOBAL' },
        { id:'__central__', nombre:'EQUIPO CENTRAL' },
        ...businessGroups,
        ...naturalGroups,
      ]
      const unavailable = [
        groupResult.status === 'rejected' && 'grupos',
        assignmentResult.status === 'rejected' && 'responsables',
        contactResult.status === 'rejected' && canSeeDirectory && 'directorio',
      ].filter(Boolean)
      if (unavailable.length) setWarning(`Vista parcial: Supabase no permite consultar ${unavailable.join(', ')}.`)
      setData({ grupos:displayGroups, sedes, assignments, contactos })
      setGroupId(current => {
        if (current && displayGroups.some(g => String(g.id) === String(current))) return current
        return String(displayGroups[0]?.id || '')
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
    if (groupId === '__global__' || groupId === '__central__') return false
    if (groupId === '__aeropuertos__' || isAirportGroupName(selectedGroup?.nombre)) return isAirportSite(s)
    if (groupId === '__hospitales__' || hasAny(selectedGroup?.nombre, ['hospital'])) return isHospitalSite(s)
    if (groupId === '__educacion__' || hasAny(selectedGroup?.nombre, ['educacion'])) return isEducationSite(s)
    if (groupId === '__comedores__' || hasAny(selectedGroup?.nombre, ['comedor'])) return isDiningSite(s)
    if (groupId === '__planta__' || hasAny(selectedGroup?.nombre, ['planta','produccion'])) return isProductionSite(s)
    if (groupId === '__cci__' || norm(selectedGroup?.nombre) === 'cci') return isCciSite(s)
    if (groupId === '__restaurantes__' || hasAny(selectedGroup?.nombre, ['restaurante','restaurant'])) return isRestaurantSite(s)
    if (isAirportGroupName(selectedGroup?.nombre)) return isAirportSite(s)
    return !groupId || String(s.grupo_id) === String(groupId)
  }), [data.sedes, groupId, selectedGroup?.nombre])
  const isAirportGroup = groupSedes.length >= 3 && groupSedes.every(isAirportSite)
  const isDiningGroup = groupSedes.length >= 2 && groupSedes.every(s => norm(s.tipo).includes('comedor') || norm(s.nombre).includes('comedor'))
  const isEscalas = groupId === '__aeropuertos__' || isAirportGroupName(selectedGroup?.nombre) || isAirportGroup
  const isVanesaScope = groupId === '__planta__' || groupId === '__cci__' || hasAny(selectedGroup?.nombre, ['planta de produccion','cci'])
  const isCordobaProductionGroup = isVanesaScope || norm(selectedGroup?.nombre) === 'otros' || groupSedes.some(s => norm(s.nombre).includes('planta de produccion cordoba'))
  const isBusinessScope = !['__global__','__central__'].includes(groupId)
  const sedes = groupSedes
  const sedeIds = useMemo(() => new Set(sedes.map(s => String(s.id))), [sedes])
  const assignments = useMemo(() => data.assignments.filter(a => a.activo !== false && sedeIds.has(String(a.sede_id))), [data.assignments, sedeIds])
  const assignedContactIds = useMemo(() => new Set(assignments.map(a => String(a.contacto_id || a.contactos?.id))), [assignments])
  const unassigned = data.contactos.filter(c => !assignedContactIds.has(String(c.id)))
  const findPerson = (fallback, terms) => {
    const found = data.contactos.find(c => hasAny(`${c.cargo} ${c.nombre}`, terms) || norm(c.nombre) === norm(fallback?.nombre))
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
  const operations = isCordobaProductionGroup
    ? findPerson(CORDOBA_PRODUCTION_REFERENCE.plant, ['vanesa ledezma'])
    : findPerson(ESCALAS_REFERENCE.plant, ['nicolas vitale'])
  const operationsRole = isVanesaScope ? 'Responsable Operativa' : groupId === '__central__' ? 'Jefatura de Planta' : 'Responsable Operativo'
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
  const quality = findPerson(ESCALAS_REFERENCE.quality, ['calidad','direccion tecnica','tecnica de calidad','debora rodriguez'])

  const openSede = sede => {
    sessionStorage.setItem('bitacora:openSedeId', String(sede.id))
    sessionStorage.setItem('bitacora:sedesTab', 'ficha')
    onNavigate?.('sedesHub')
  }

  const canEditOrganigrama = rol === 'admin'
  const orgNodes = [
    executive && { id:'executive', contactId:executive.id, label:executive.nombre, kind:'person', content:<PersonNode title="DIRECCIÓN GENERAL" contact={executive}/> },
    operations && { id:'operations', contactId:operations.id, label:operations.nombre, kind:'person', content:<PersonNode title="JEFATURA DE PLANTA" contact={operations}/> },
    supervisor && { id:'supervisor', contactId:supervisor.id, label:supervisor.nombre, kind:'person', content:<PersonNode title={isEscalas ? 'SUPERVISIÓN DE OPERACIONES – ESCALAS' : isDiningGroup ? 'SUPERVISIÓN DE COMEDORES' : 'SUPERVISIÓN OPERATIVA'} contact={supervisor}/> },
    commercial && { id:'commercial', contactId:commercial.id, label:commercial.nombre, kind:'person', content:<PersonNode title="COMERCIAL Y FACTURACIÓN" contact={commercial} tone="support"/> },
    quality && { id:'quality', contactId:quality.id, label:quality.nombre, kind:'person', content:<PersonNode title="DIRECCIÓN TÉCNICA DE CALIDAD" contact={quality} tone="support"/> },
    ...sedes.map(sede => ({
      id:`sede:${sede.id}`,
      kind:'sede',
      content:<SedeNode sede={sede} assignments={assignments.filter(a => String(a.sede_id) === String(sede.id))} fallbackOwner={isEscalas ? ESCALAS_REFERENCE.siteOwners.find(owner => norm(sede.nombre).includes(owner.match)) : null} excludedContactIds={supervisorContactIds} onOpen={openSede}/>,
    })),
  ].filter(Boolean)
  const operationalParent = supervisor ? 'supervisor' : operations ? 'operations' : 'executive'
  const orgEdges = [
    executive && operations && { from:'executive', to:'operations' },
    executive && commercial && { from:'executive', to:'commercial', support:true },
    executive && quality && { from:'executive', to:'quality' },
    quality && operations && isBusinessScope && { from:'quality', to:'operations', functional:true },
    operations && supervisor && { from:'operations', to:'supervisor' },
    ...sedes.map(sede => ({ from:operationalParent, to:`sede:${sede.id}` })),
  ].filter(Boolean)
  const designerSeeds = [
    executive && { id:'executive', contactId:executive.id, label:executive.nombre, role:'Dirección General', area:'Dirección', color:'#39ff14', position:{ x:0, y:0 }, required:isBusinessScope },
    operations && { id:'operations', contactId:operations.id, label:operations.nombre, role:operationsRole, area:'Operaciones', color:'#22c55e', position:{ x:0, y:180 }, required:isBusinessScope },
    supervisor && { id:'supervisor', contactId:supervisor.id, label:supervisor.nombre, role:isEscalas ? 'Supervisión de Operaciones – Escalas' : isDiningGroup ? 'Supervisión de Comedores' : 'Supervisión Operativa', area:'Operaciones', color:'#22c55e', position:{ x:0, y:360 } },
    commercial && { id:'commercial', contactId:commercial.id, label:commercial.nombre, role:'Comercial y Facturación', area:'Administración', color:'#38bdf8', position:{ x:330, y:0 } },
    quality && { id:'quality', contactId:quality.id, label:quality.nombre, role:'Dirección Técnica de Calidad', area:'Calidad transversal', color:'#f59e0b', position:{ x:330, y:180 }, required:isBusinessScope },
    ...sedes.map((sede, index) => {
      const siteAssignments = assignments.filter(a => String(a.sede_id) === String(sede.id))
      const primary = siteAssignments.find(a => hasAny(a.rol, ['responsable','jefe','encargado'])) || siteAssignments[0]
      return {
        id:`sede:${sede.id}`,
        contactId:primary?.contactos?.id || null,
        label:primary?.contactos?.nombre || sede.nombre,
        role:primary?.rol || 'Responsable de sede',
        area:sede.nombre,
        entityType:'sede',
        color:'#a3e635',
        position:{ x:(index - (sedes.length - 1) / 2) * 290, y:560 },
      }
    }),
  ].filter(Boolean)
  const designerEdges = orgEdges.map(edge => {
    const id = `${edge.from}-${edge.to}`
    const relationType = edge.functional ? 'funcional' : edge.support ? 'apoyo' : 'jerarquica'
    const color = edge.functional ? '#38bdf8' : edge.support ? '#f59e0b' : '#39ff14'
    return {
    id,
    source:edge.from,
    target:edge.to,
    type:'smoothstep',
    animated:false,
    required:isBusinessScope && ['executive-operations','executive-quality','quality-operations'].includes(id),
    data:{ relationType, lineStyle:edge.functional || edge.support ? 'dashed' : 'solid', color, width:1.7, arrow:!edge.functional },
    markerEnd:edge.functional ? undefined : { type:'arrowclosed', color },
    style:{ stroke:color, strokeWidth:1.7, strokeDasharray:edge.functional || edge.support ? '6 5' : undefined },
  }})
  const vanesa = data.contactos.find(contact => hasAny(contact.nombre, ['vanesa ledesma']))
  const vanesaNodeId = vanesa?.id ? `contact:${vanesa.id}` : 'central:vanesa'
  const scopeId = (terms, fallback) => String(data.grupos.find(group => hasAny(group.nombre, terms))?.id || fallback)
  const centralUnitSeeds = [
    { id:vanesaNodeId, contactId:vanesa?.id || null, label:vanesa?.nombre || 'Vanesa Ledesma', role:vanesa?.cargo || 'Responsable', area:'Operaciones', color:'#22c55e', position:{ x:-520, y:360 }, required:true },
    { id:'unit:production-cordoba', label:'Planta de Producción Córdoba', role:'Unidad operativa', area:'Responsable: Vanesa Ledesma', entityType:'unidad', linkedScope:scopeId(['planta de produccion'], '__planta__'), color:'#c084fc', position:{ x:-650, y:600 }, required:true },
    { id:'unit:cci', label:'CCI', role:'Unidad operativa', area:'Responsable: Vanesa Ledesma', entityType:'unidad', linkedScope:scopeId(['cci'], '__cci__'), color:'#c084fc', position:{ x:-370, y:600 }, required:true },
    { id:'unit:airports', label:'Aeropuertos', role:'Unidad de negocio', area:'Responsable: Nicolás Vitale', entityType:'unidad', linkedScope:scopeId(['aeropuerto','escala'], '__aeropuertos__'), color:'#22c55e', position:{ x:-140, y:600 }, required:true },
    { id:'unit:hospitals', label:'Hospitales', role:'Unidad de negocio', area:'Responsable: Nicolás Vitale', entityType:'unidad', linkedScope:scopeId(['hospital'], '__hospitales__'), color:'#f59e0b', position:{ x:140, y:600 }, required:true },
    { id:'unit:education', label:'Educación', role:'Unidad de negocio', area:'Responsable: Nicolás Vitale', entityType:'unidad', linkedScope:scopeId(['educacion'], '__educacion__'), color:'#38bdf8', position:{ x:420, y:600 }, required:true },
    { id:'unit:dining', label:'Comedores', role:'Unidad de negocio', area:'Responsable: Nicolás Vitale', entityType:'unidad', linkedScope:scopeId(['comedor'], '__comedores__'), color:'#a3e635', position:{ x:700, y:600 }, required:true },
    { id:'unit:restaurants', label:'Restaurantes', role:'Unidad de negocio', area:'Responsable: Nicolás Vitale', entityType:'unidad', linkedScope:scopeId(['restaurante','restaurant'], '__restaurantes__'), color:'#fb7185', position:{ x:980, y:600 }, required:true },
  ]
  const centralUnitIds = centralUnitSeeds.filter(seed => seed.entityType === 'unidad').map(seed => seed.id)
  const centralUnitEdges = [
    ...['unit:production-cordoba','unit:cci'].map(target => ({
      id:`${vanesaNodeId}-${target}`, source:vanesaNodeId, target, type:'smoothstep', required:true,
      data:{ relationType:'jerarquica', lineStyle:'solid', color:'#39ff14', width:1.7, arrow:true },
      markerEnd:{ type:'arrowclosed', color:'#39ff14' }, style:{ stroke:'#39ff14', strokeWidth:1.7 },
    })),
    ...['unit:airports','unit:hospitals','unit:education','unit:dining','unit:restaurants'].map(target => ({
      id:`operations-${target}`, source:'operations', target, type:'smoothstep', required:true,
      data:{ relationType:'jerarquica', lineStyle:'solid', color:'#39ff14', width:1.7, arrow:true },
      markerEnd:{ type:'arrowclosed', color:'#39ff14' }, style:{ stroke:'#39ff14', strokeWidth:1.7 },
    })),
    ...centralUnitIds.map(target => ({
      id:`quality-functional-${target}`, source:'quality', target, type:'smoothstep', required:true,
      data:{ relationType:'funcional', lineStyle:'dotted', color:'#38bdf8', width:1.5, arrow:false, label:'Calidad transversal' },
      label:'Calidad transversal', style:{ stroke:'#38bdf8', strokeWidth:1.5, strokeDasharray:'2 5' },
    })),
  ]
  const globalSeeds = [
    { id:'company', label:'Fly Kitchen', role:'Organización', area:'Estructura global', entityType:'unidad', color:'#39ff14', position:{ x:0, y:0 } },
    { id:'unit:central', label:'Equipo central', role:'Dirección y áreas transversales', entityType:'unidad', linkedScope:'__central__', color:'#38bdf8', position:{ x:0, y:220 } },
  ]
  const globalEdges = globalSeeds.slice(1).map(node => ({
    id:`company-${node.id}`, source:'company', target:node.id, type:'smoothstep',
    data:{ relationType:'jerarquica' }, style:{ stroke:'#39ff14', strokeWidth:1.7 },
  }))
  const activeSeeds = groupId === '__global__'
    ? globalSeeds
    : groupId === '__central__' ? [...designerSeeds, ...centralUnitSeeds] : designerSeeds
  const activeEdges = groupId === '__global__'
    ? globalEdges
    : groupId === '__central__' ? [...designerEdges, ...centralUnitEdges] : designerEdges

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
            {data.grupos.map(g => <option key={g.id} value={g.id}>{displayGroupName(g.nombre)}</option>)}
          </select>
          <button type="button" onClick={load} className="btn-ghost" aria-label="Actualizar organigrama"><RefreshCw size={13}/></button>
        </div>
      </div>

      {error && <div style={{ color:'#ff6060', border:'1px solid rgba(255,80,80,.25)', background:'rgba(255,80,80,.08)', padding:'0.7rem', fontSize:'0.72rem' }}>{error}</div>}
      {warning && <div style={{ color:'#f59e0b', border:'1px solid rgba(245,158,11,.25)', background:'rgba(245,158,11,.07)', padding:'0.65rem', fontSize:'0.68rem', marginBottom:'1rem' }}>{warning}</div>}

      {!error && data.grupos.length > 0 && (sedes.length > 0 || String(groupId).startsWith('__')) && (
        <OrganigramaDesigner
          groupId={groupId}
          groupName={displayGroupName(selectedGroup?.nombre || 'General')}
          seeds={activeSeeds}
          seedEdges={activeEdges}
          contacts={data.contactos}
          canEdit={canEditOrganigrama}
          onOpenScope={setGroupId}
          showGlobalBreadcrumb={groupId !== '__global__'}
        />
      )}
      {!error && data.grupos.length > 0 && sedes.length === 0 && !String(groupId).startsWith('__') && (
        <div className="glass" style={{ textAlign:'center', padding:'2rem', color:'var(--text-dim)', fontSize:'0.75rem' }}>Este grupo todavía no tiene sedes asignadas.</div>
      )}

      {data.grupos.length === -1 && (
        <div style={{ minWidth:900, paddingBottom:'2rem' }}>
          <div style={{ display:'grid', gridTemplateColumns:'280px 280px 280px', justifyContent:'center', alignItems:'center', columnGap:28 }}>
            <div/>
            <PersonNode title="DIRECCIÓN GENERAL" contact={executive}/>
            {commercial && <div style={{ borderLeft:'2px dashed rgba(245,158,11,.45)', paddingLeft:24 }}>
              <PersonNode title="COMERCIAL Y FACTURACIÓN" contact={commercial} tone="support"/>
            </div>}
          </div>
          <div style={{ width:1, height:28, background:'rgba(57,255,20,.35)', margin:'0 auto' }}/>
          <div style={{ display:'grid', gridTemplateColumns:'280px 280px 280px', justifyContent:'center', alignItems:'center', columnGap:28 }}>
            <div/>
            <PersonNode title="JEFATURA DE PLANTA" contact={operations}/>
            {quality && <div style={{ borderLeft:'2px dashed rgba(245,158,11,.45)', paddingLeft:24 }}>
              <PersonNode title="DIRECCIÓN TÉCNICA DE CALIDAD" contact={quality} tone="support"/>
            </div>}
          </div>
          <div style={{ width:1, height:28, background:'rgba(57,255,20,.35)', margin:'0 auto' }}/>
          {supervisor && <>
            <div className="flex justify-center"><PersonNode title={isEscalas ? 'SUPERVISIÓN DE OPERACIONES – ESCALAS' : isDiningGroup ? 'SUPERVISIÓN DE COMEDORES' : 'SUPERVISIÓN OPERATIVA'} contact={supervisor}/></div>
            <div style={{ width:1, height:28, background:'rgba(57,255,20,.35)', margin:'0 auto' }}/>
          </>}
          {sedes.length > 0 && <div style={{ height:1, background:'rgba(57,255,20,.28)', margin:`0 ${Math.max(115, 125)}px` }}/>} 
          <div style={{ display:'flex', gap:20, justifyContent:'center', alignItems:'flex-start', flexWrap:'wrap', rowGap:22 }}>
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
