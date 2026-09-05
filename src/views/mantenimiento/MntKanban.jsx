import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtFecha } from '../../lib/dateUtils'
import { updateTicket, getAuditoriaTicket, getActivos, getProveedores, getSedes, getTickets } from '../../lib/queries'
import { AlertTriangle, User, Filter, RefreshCw, X, Clock, Tag, MapPin, Wrench, ChevronDown, MessageSquare, History, CalendarDays, Paperclip, CheckCircle2, Circle, MoreVertical, ExternalLink } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import PageHeader from '../../components/PageHeader'
import AdjuntosPanel from '../../components/AdjuntosPanel'
import { TicketModal as FullTicketModal } from './MntTickets'
import { toast } from '../../lib/feedback'
import { mensajeError } from '../../lib/errores'
import usePersistedState from '../../hooks/usePersistedState'
import { filterMaintenanceAssets, filterMaintenanceTickets } from '../../lib/maintenanceTickets'

const COLS = [
  { id:'abierto',     label:'Nuevo',       color:'#50b4ff' },
  { id:'en_progreso', label:'En Progreso',  color:'#ffb400' },
  { id:'aprobado',    label:'Bloqueado',    color:'#ff5050' },
  { id:'resuelto',    label:'Resuelto',     color:'#39ff14' },
]
import { PRIORIDAD_COLOR, SLA_HS } from '../../lib/estados'

function slaStatus(ticket) {
  if (!ticket.created_at || ticket.estado === 'resuelto') return null
  const horas = (Date.now() - new Date(ticket.created_at).getTime()) / 3600000
  const limite = SLA_HS[ticket.prioridad] || 48
  const pct = horas / limite
  return pct >= 1 ? 'vencido' : pct >= 0.7 ? 'alerta' : 'ok'
}

function tiempoTranscurrido(fecha) {
  if (!fecha) return '—'
  const ms = Date.now() - new Date(fecha).getTime()
  const h = Math.floor(ms / 3600000)
  if (h < 1)   return 'Hace menos de 1h'
  if (h < 24)  return `Hace ${h}h`
  const d = Math.floor(h / 24)
  if (d < 30)  return `Hace ${d}d`
  return `Hace ${Math.floor(d/30)}m`
}

// ─── MODAL DETALLE TICKET ─────────────────────────────────────────────────────
function TicketModal({ ticket, responsables, onClose, onUpdate }) {
  const { user } = useAuth()
  const [tab, setTab]         = useState('detalle')   // detalle | historial
  const [auditoria, setAuditoria] = useState([])
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [nota, setNota]       = useState('')
  const [activos, setActivos] = useState([])
  const [loadingActivos, setLoadingActivos] = useState(false)
  const [proveedores, setProveedores] = useState([])
  const [loadingProveedores, setLoadingProveedores] = useState(false)
  const [form, setForm]       = useState({
    estado:        ticket.estado,
    prioridad:     ticket.prioridad,
    responsable_id:ticket.responsable_id || '',
    activo_id:     ticket.activo_id      || '',
    proveedor_id:  ticket.proveedor_id   || '',
    descripcion:   ticket.descripcion    || '',
    solucion:      ticket.diagnostico    || '',
    tipo:          ticket.tipo           || '',
  })

  useEffect(() => {
    if (!editing || activos.length || loadingActivos) return
    setLoadingActivos(true)
    getActivos(ticket.sede_id ? { sede_id: ticket.sede_id } : {})
      .then(setActivos)
      .catch(() => {})
      .finally(() => setLoadingActivos(false))
  }, [editing, activos.length, loadingActivos, ticket.sede_id])

  // Proveedores se cargan siempre (no solo en edición) para poder mostrar el nombre en modo lectura
  useEffect(() => {
    setLoadingProveedores(true)
    getProveedores()
      .then(setProveedores)
      .catch(() => {})
      .finally(() => setLoadingProveedores(false))
  }, [])

  const loadAudit = useCallback(async () => {
    setLoadingAudit(true)
    try {
      const rows = await getAuditoriaTicket(ticket.id)
      setAuditoria(rows)
    } catch(e) { console.error(e) }
    finally { setLoadingAudit(false) }
  }, [ticket.id])

  useEffect(() => { if (tab === 'historial') loadAudit() }, [tab, loadAudit])

  const save = async () => {
    setSaving(true)
    try {
      const { solucion, ...rest } = form
      const activoSel = activos.find(a => a.id === form.activo_id)
      const payload = {
        ...rest,
        diagnostico: solucion,
        responsable_id: form.responsable_id || null,
        activo_id: form.activo_id || null,
        activo_nombre: form.activo_id ? (activoSel?.nombre || ticket.activo_nombre || null) : null,
      }
      if (form.estado === 'resuelto' && ticket.estado !== 'resuelto') {
        payload.fecha_cierre = new Date().toISOString().split('T')[0]
      }
      const updated = await updateTicket(ticket.id, payload)
      onUpdate(updated)
      setEditing(false)
    } catch(e) { toast.error('Error al guardar: ' + mensajeError(e)) }
    finally { setSaving(false) }
  }

  const pc   = PRIORIDAD_COLOR[ticket.prioridad] || '#aaa'
  const resp = responsables.find(r => r.id === ticket.responsable_id)
  const prov = proveedores.find(p => p.id === ticket.proveedor_id)
  const sla  = slaStatus(ticket)

  const MODAL_BG = {
    position:'fixed', inset:0, zIndex:1000,
    background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)',
    display:'flex', alignItems:'center', justifyContent:'center', padding:20,
  }
  const MODAL_BOX = {
    background:'var(--surface)', border:'1px solid rgba(57,255,20,0.1)',
    borderRadius:3, width:'100%', maxWidth:680, maxHeight:'88vh',
    display:'flex', flexDirection:'column', overflow:'hidden',
    boxShadow:'0 24px 80px rgba(0,0,0,0.6)',
  }
  const INP = {
    background:'var(--surface)', border:'1px solid rgba(57,255,20,0.08)',
    color:'var(--text)', borderRadius:2, padding:'7px 10px', fontSize:'0.72rem',
    fontFamily:'inherit', width:'100%', boxSizing:'border-box',
  }
  const SEL = { ...INP, cursor:'pointer' }

  const ACCION_COLOR = {
    INSERT:'#39ff14', UPDATE:'#50b4ff', EDIT:'#50b4ff',
    DELETE:'#ff5050', ASSIGN:'#ffb400', RESOLVE:'#39ff14',
  }

  return (
    <div style={MODAL_BG}>
      <div style={MODAL_BOX}>

        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(57,255,20,0.06)', display:'flex', gap:12, alignItems:'flex-start', flexShrink:0 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
              <span style={{ fontSize:'0.6rem', padding:'2px 8px', borderRadius:4, fontWeight:700, background:`${pc}22`, color:pc, border:`1px solid ${pc}44` }}>
                {form.prioridad?.toUpperCase()}
              </span>
              <span style={{ fontSize:'0.6rem', padding:'2px 8px', borderRadius:4, background:'#1a1a22', color:'rgba(255,255,255,0.5)', border:'1px solid rgba(57,255,20,0.08)' }}>
                {ticket.tipo || 'Sin tipo'}
              </span>
              {ticket.categoria && (
                <span style={{ fontSize:'0.6rem', padding:'2px 8px', borderRadius:4, background:'rgba(80,180,255,0.08)', color:'#50b4ff', border:'1px solid rgba(80,180,255,0.2)' }}>
                  {ticket.categoria}
                </span>
              )}
              {sla === 'vencido' && (
                <span style={{ fontSize:'0.6rem', padding:'2px 8px', borderRadius:4, background:'rgba(255,80,80,0.1)', color:'#ff5050', border:'1px solid rgba(255,80,80,0.3)', display:'flex', alignItems:'center', gap:4 }}>
                  <AlertTriangle size={9}/> SLA VENCIDO
                </span>
              )}
              {sla === 'alerta' && (
                <span style={{ fontSize:'0.6rem', padding:'2px 8px', borderRadius:4, background:'rgba(255,180,0,0.1)', color:'#ffb400', border:'1px solid rgba(255,180,0,0.3)', display:'flex', alignItems:'center', gap:4 }}>
                  <AlertTriangle size={9}/> SLA EN RIESGO
                </span>
              )}
            </div>
            <p style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace' }}>
              ID {typeof ticket.id === 'string' ? ticket.id.substring(0,8).toUpperCase() : ticket.id}... · {tiempoTranscurrido(ticket.created_at)}
            </p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', padding:4, flexShrink:0 }}>
            <X size={18}/>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:0, borderBottom:'1px solid rgba(57,255,20,0.06)', flexShrink:0 }}>
          {[['detalle','Detalle'],['adjuntos','Adjuntos'],['historial','Trazabilidad']].map(([id,label]) => (
            <button key={id} onClick={()=>setTab(id)} style={{
              background:'none', border:'none', borderBottom: tab===id ? '2px solid var(--phosphor)' : '2px solid transparent',
              color: tab===id ? 'var(--phosphor)' : 'rgba(255,255,255,0.4)',
              padding:'10px 20px', fontSize:'0.65rem', fontFamily:'monospace', letterSpacing:'0.08em',
              cursor:'pointer', fontWeight: tab===id ? 700 : 400,
            }}>{label.toUpperCase()}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>

          {tab === 'detalle' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

              {/* Descripción */}
              <div>
                <label style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>DESCRIPCIÓN</label>
                {editing
                  ? <textarea style={{ ...INP, minHeight:80, resize:'vertical' }} value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} placeholder="Ej: Pierde aceite en compresor principal"/>
                  : <p style={{ fontSize:'0.75rem', color:'var(--text)', lineHeight:1.5 }}>{ticket.descripcion || '(sin descripción)'}</p>
                }
              </div>

              {/* Info grid */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {/* Estado */}
                <div>
                  <label style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:5 }}>ESTADO</label>
                  {editing
                    ? <select style={SEL} value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}>
                        <option value="abierto">Abierto</option>
                        <option value="en_progreso">En Progreso</option>
                        <option value="aprobado">Bloqueado</option>
                        <option value="resuelto">Resuelto</option>
                      </select>
                    : <span style={{ fontSize:'0.68rem', padding:'3px 10px', borderRadius:4, fontWeight:600,
                        background: COLS.find(c=>c.id===ticket.estado)?.color+'22' || 'rgba(255,255,255,0.05)',
                        color: COLS.find(c=>c.id===ticket.estado)?.color || '#aaa',
                        border: `1px solid ${COLS.find(c=>c.id===ticket.estado)?.color || '#aaa'}44`,
                      }}>{COLS.find(c=>c.id===ticket.estado)?.label || ticket.estado}</span>
                  }
                </div>

                {/* Prioridad */}
                <div>
                  <label style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:5 }}>PRIORIDAD</label>
                  {editing
                    ? <select style={SEL} value={form.prioridad} onChange={e=>setForm(f=>({...f,prioridad:e.target.value}))}>
                        <option value="baja">Baja</option>
                        <option value="media">Media</option>
                        <option value="alta">Alta</option>
                        <option value="critica">Crítica</option>
                      </select>
                    : <span style={{ fontSize:'0.68rem', padding:'3px 10px', borderRadius:4, fontWeight:600, background:`${pc}22`, color:pc, border:`1px solid ${pc}44` }}>{ticket.prioridad}</span>
                  }
                </div>

                {/* Responsable */}
                <div>
                  <label style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:5 }}>RESPONSABLE</label>
                  {editing
                    ? <select style={SEL} value={form.responsable_id} onChange={e=>setForm(f=>({...f,responsable_id:e.target.value}))}>
                        <option value="">Sin asignar</option>
                        {responsables.map(r=><option key={r.id} value={r.id}>{r.nombre}</option>)}
                      </select>
                    : <span style={{ fontSize:'0.7rem', color: resp ? 'var(--text)' : 'rgba(255,80,80,0.6)' }}>
                        {resp ? resp.nombre : 'Sin asignar'}
                      </span>
                  }
                </div>

                {/* Activo */}
                <div>
                  <label style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:5 }}>ACTIVO</label>
                  {editing
                    ? <select style={SEL} value={form.activo_id} onChange={e=>setForm(f=>({...f,activo_id:e.target.value}))}>
                        <option value="">Sin asignar</option>
                        {activos.map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
                      </select>
                    : <span style={{ fontSize:'0.7rem', color:'rgba(57,255,20,0.7)' }}>{ticket.activo_nombre || '—'}</span>
                  }
                  {editing && loadingActivos && <span style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', display:'block', marginTop:3 }}>Cargando activos...</span>}
                </div>

                {/* Proveedor */}
                <div>
                  <label style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:5 }}>PROVEEDOR</label>
                  {editing
                    ? <select style={SEL} value={form.proveedor_id} onChange={e=>setForm(f=>({...f,proveedor_id:e.target.value}))}>
                        <option value="">Sin asignar</option>
                        {proveedores.filter(p=>p.estado==='activo' || p.id===form.proveedor_id).map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    : <span style={{ fontSize:'0.7rem', color: prov ? 'var(--text)' : 'rgba(255,255,255,0.2)' }}>
                        {loadingProveedores && !prov && ticket.proveedor_id ? 'Cargando...' : (prov ? prov.nombre : 'Sin asignar')}
                      </span>
                  }
                </div>

                {/* Sede */}
                <div>
                  <label style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:5 }}>SEDE</label>
                  <span style={{ fontSize:'0.7rem', color:'var(--text)' }}>{ticket.sede || '—'}</span>
                </div>

                {/* Tipo */}
                <div>
                  <label style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:5 }}>TIPO</label>
                  {editing
                    ? <select style={SEL} value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>
                        <option value="correctivo">Correctivo</option>
                        <option value="preventivo">Preventivo</option>
                      </select>
                    : <span style={{ fontSize:'0.7rem', color:'var(--text)' }}>{ticket.tipo || '—'}</span>
                  }
                </div>

                {/* Fecha apertura */}
                <div>
                  <label style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:5 }}>APERTURA</label>
                  <span style={{ fontSize:'0.7rem', color:'var(--text)' }}>{ticket.created_at ? fmtFecha(ticket.created_at) : '—'}</span>
                </div>

                {/* Fecha cierre */}
                {ticket.fecha_cierre && (
                  <div>
                    <label style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:5 }}>CIERRE</label>
                    <span style={{ fontSize:'0.7rem', color:'#39ff14' }}>{fmtFecha(ticket.fecha_cierre)}</span>
                  </div>
                )}
              </div>

              {/* Solución */}
              <div>
                <label style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>SOLUCIÓN / OBSERVACIONES</label>
                {editing
                  ? <textarea style={{ ...INP, minHeight:70, resize:'vertical' }} value={form.solucion} onChange={e=>setForm(f=>({...f,solucion:e.target.value}))} placeholder="Qué se hizo, cómo se resolvió..."/>
                  : <p style={{ fontSize:'0.72rem', color: ticket.diagnostico ? 'var(--text)' : 'rgba(255,255,255,0.2)', lineHeight:1.5, fontStyle: ticket.diagnostico ? 'normal' : 'italic' }}>
                      {ticket.diagnostico || 'Sin observaciones'}
                    </p>
                }
              </div>

              {/* Acciones */}
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8, borderTop:'1px solid rgba(57,255,20,0.05)' }}>
                {editing ? (
                  <>
                    <button onClick={()=>setEditing(false)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(57,255,20,0.08)', color:'rgba(255,255,255,0.6)', borderRadius:2, padding:'7px 16px', fontSize:'0.65rem', cursor:'pointer' }}>
                      Cancelar
                    </button>
                    <button onClick={save} disabled={saving} style={{ background:'rgba(57,255,20,0.12)', border:'1px solid rgba(57,255,20,0.3)', color:'#39ff14', borderRadius:2, padding:'7px 20px', fontSize:'0.65rem', fontWeight:700, cursor:'pointer' }}>
                      {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </>
                ) : (
                  <button onClick={()=>setEditing(true)} style={{ background:'rgba(80,180,255,0.08)', border:'1px solid rgba(80,180,255,0.25)', color:'#50b4ff', borderRadius:2, padding:'7px 18px', fontSize:'0.65rem', fontWeight:600, cursor:'pointer' }}>
                    ✏ Editar ticket
                  </button>
                )}
              </div>
            </div>
          )}

          {tab === 'adjuntos' && (
            <AdjuntosPanel entityType="ticket" entityId={ticket.id} />
          )}

          {tab === 'historial' && (
            <div>
              {loadingAudit ? (
                <p style={{ color:'var(--text-dim)', fontSize:'0.72rem', textAlign:'center', padding:32 }}>Cargando trazabilidad...</p>
              ) : auditoria.length === 0 ? (
                <div style={{ textAlign:'center', padding:40, color:'rgba(255,255,255,0.2)' }}>
                  <History size={32} style={{ marginBottom:12, opacity:0.3 }}/>
                  <p style={{ fontSize:'0.7rem' }}>Sin registros de auditoría para este ticket.</p>
                  <p style={{ fontSize:'0.62rem', marginTop:6, opacity:0.6 }}>Los cambios futuros aparecerán aquí automáticamente.</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                  {auditoria.map((row, i) => {
                    const color = ACCION_COLOR[row.accion] || '#aaa'
                    return (
                      <div key={row.id} style={{ display:'flex', gap:12, paddingBottom:16, position:'relative' }}>
                        {/* línea vertical */}
                        {i < auditoria.length - 1 && (
                          <div style={{ position:'absolute', left:10, top:22, bottom:0, width:1, background:'#1a1a22' }}/>
                        )}
                        {/* dot */}
                        <div style={{ width:20, height:20, borderRadius:'50%', background:`${color}22`, border:`2px solid ${color}55`, flexShrink:0, marginTop:2, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <div style={{ width:6, height:6, borderRadius:'50%', background:color }}/>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:3, flexWrap:'wrap' }}>
                            <span style={{ fontSize:'0.6rem', padding:'1px 7px', borderRadius:3, background:`${color}18`, color, border:`1px solid ${color}33`, fontWeight:700, fontFamily:'monospace' }}>
                              {row.accion}
                            </span>
                            <span style={{ fontSize:'0.62rem', color:'var(--text)', fontWeight:600 }}>
                              {row.usuario_nombre || row.usuario_email || 'Sistema'}
                            </span>
                            <span style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.25)', marginLeft:'auto' }}>
                              {row.created_at ? fmtFecha(row.created_at) : ''}
                            </span>
                          </div>
                          <p style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.6)', lineHeight:1.4 }}>{row.descripcion}</p>
                          {row.campo && (
                            <p style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', marginTop:3 }}>
                              <span style={{ color:'rgba(255,255,255,0.4)' }}>{row.campo}:</span>{' '}
                              <span style={{ textDecoration:'line-through', color:'rgba(255,80,80,0.5)' }}>{row.valor_antes || '—'}</span>
                              {' → '}
                              <span style={{ color:'rgba(57,255,20,0.7)' }}>{row.valor_nuevo || '—'}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── CARD ────────────────────────────────────────────────────────────────────
function TicketCard({ ticket, responsables, activos, columnColor, expanded, onSelect, onOpen }) {
  const [dragging, setDragging] = useState(false)
  const resp = responsables.find(r => r.id === ticket.responsable_id)
  const activo = activos.find(a => String(a.id) === String(ticket.activo_id))
  const sla  = slaStatus(ticket)
  const pc   = PRIORIDAD_COLOR[ticket.prioridad] || '#aaa'
  const subtareas = Array.isArray(ticket.subtareas) ? ticket.subtareas : []
  const completadas = subtareas.filter(item => item?.completada).length
  const avance = subtareas.length ? Math.round(completadas * 100 / subtareas.length) : 0
  const resuelto = ticket.estado === 'resuelto'
  const bloqueado = ticket.estado === 'aprobado'
  const slaHoras = SLA_HS[ticket.prioridad] || 48
  const ticketNumero = ticket.numero ? `#MT-${String(ticket.numero).padStart(4, '0')}` : `#${String(ticket.id).slice(0, 8).toUpperCase()}`
  const abrir = (event, tab = 'datos') => { event.stopPropagation(); onOpen(ticket, tab) }

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('ticketId', ticket.id); setDragging(true) }}
      onDragEnd={() => setDragging(false)}
      onClick={() => onSelect(ticket.id)}
      style={{
        background:resuelto?'linear-gradient(145deg, rgba(57,255,20,.08), rgba(18,19,24,.98) 55%)':'linear-gradient(145deg, rgba(255,255,255,.035), rgba(18,19,24,.98))',
        border:`1px solid ${resuelto?'rgba(57,255,20,.35)':bloqueado?'rgba(255,80,80,.35)':'rgba(255,255,255,.1)'}`,
        borderLeft:`3px solid ${columnColor || pc}`, borderRadius:5, padding:'14px 15px',
        cursor:'pointer', marginBottom:10, opacity:dragging?0.5:1, transition:'all 0.15s',
        boxShadow:expanded?`0 0 0 1px ${columnColor}66, 0 12px 30px rgba(0,0,0,.35)`:resuelto?'inset 0 0 24px rgba(57,255,20,.025)':'0 8px 24px rgba(0,0,0,.12)',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.borderColor=columnColor || pc }}
      onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.borderColor=resuelto?'rgba(57,255,20,.35)':bloqueado?'rgba(255,80,80,.35)':'rgba(255,255,255,.1)' }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
        <span style={{fontSize:'.56rem',fontFamily:'monospace',color:'rgba(255,255,255,.42)',border:'1px solid rgba(255,255,255,.1)',borderRadius:3,padding:'2px 5px'}}>{ticketNumero}</span>
        <span style={{ fontSize:'0.6rem', padding:'1px 6px', borderRadius:4, fontWeight:700, background:`${pc}22`, color:pc, border:`1px solid ${pc}44` }}>
          {ticket.prioridad}
        </span>
        {!resuelto && <span style={{fontSize:'.56rem',fontWeight:700,color:sla==='vencido'?'#ff5050':sla==='alerta'?'#ffb400':'#50b4ff',marginLeft:'auto'}}>SLA {sla==='vencido'?'VENCIDO':`${slaHoras}h`}</span>}
      </div>

      <p style={{ fontSize:expanded?'.88rem':'.78rem', fontWeight:700, color:'var(--text)', lineHeight:1.3, marginBottom:7, display:'-webkit-box', WebkitBoxOrient:'vertical', WebkitLineClamp:expanded?3:2, overflow:'hidden' }}>
        {ticket.descripcion || 'Ticket de mantenimiento sin descripción'}
      </p>

      {ticket.activo_nombre && (
        <div style={{marginBottom:8}}>
          <p style={{fontSize:'.64rem',color:'rgba(57,255,20,.78)',fontWeight:650,display:'flex',gap:5,alignItems:'center'}}><Wrench size={10}/>{ticket.activo_nombre}</p>
          {activo?.codigo && <p style={{fontSize:'.54rem',color:'rgba(255,255,255,.3)',margin:'2px 0 0 15px'}}>{activo.codigo}</p>}
        </div>
      )}

      {ticket.sede && <p style={{display:'flex',alignItems:'center',gap:5,fontSize:'.59rem',color:'rgba(255,255,255,.55)',marginBottom:8}}><MapPin size={10}/>{ticket.sede}</p>}

      <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:10 }}>
        {ticket.subarea && <span style={{fontSize:'.57rem',color:'#50b4ff',border:'1px solid rgba(80,180,255,.25)',padding:'2px 6px',borderRadius:3}}>{ticket.subarea}</span>}
        {ticket.categoria && <span style={{fontSize:'.57rem',color:'var(--text-dim)',border:'1px solid rgba(255,255,255,.1)',padding:'2px 6px',borderRadius:3}}>{ticket.categoria}</span>}
      </div>

      {bloqueado && (ticket.impacto_operativo || ticket.causa_raiz) && <div style={{background:'rgba(255,80,80,.075)',border:'1px solid rgba(255,80,80,.22)',borderRadius:4,padding:'8px 9px',marginBottom:10}}>
        <p style={{fontSize:'.54rem',color:'#ff5050',fontWeight:800,marginBottom:3}}>MOTIVO DEL BLOQUEO</p>
        <p style={{fontSize:'.59rem',color:'rgba(255,255,255,.58)',lineHeight:1.35}}>{ticket.impacto_operativo || ticket.causa_raiz}</p>
      </div>}

      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:10}}>
        <div style={{width:22,height:22,borderRadius:'50%',display:'grid',placeItems:'center',background:resp?'rgba(57,255,20,.12)':'rgba(255,255,255,.06)',color:resp?'var(--phosphor)':'var(--text-dim)',fontSize:'.58rem',fontWeight:800}}>{resp?.nombre?.trim()?.charAt(0)?.toUpperCase() || '?'}</div>
        <span style={{fontSize:'.6rem',color:resp?'rgba(255,255,255,.66)':'rgba(255,80,80,.65)'}}>{resp?.nombre || 'Sin asignar'}</span>
        {ticket.fecha_limite && <span style={{display:'flex',alignItems:'center',gap:4,fontSize:'.56rem',color:sla==='vencido'?'#ff5050':'rgba(255,255,255,.46)',marginLeft:'auto'}}><CalendarDays size={10}/>Vence {fmtFecha(ticket.fecha_limite)}</span>}
      </div>

      {expanded && ticket.descripcion && <p style={{fontSize:'.62rem',lineHeight:1.5,color:'rgba(255,255,255,.62)',padding:'9px 0',margin:'0 0 9px',borderTop:'1px solid rgba(255,255,255,.07)',borderBottom:'1px solid rgba(255,255,255,.07)'}}>{ticket.descripcion}</p>}

      {subtareas.length > 0 && <div style={{marginBottom:9}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:'.56rem',color:'var(--text-dim)',marginBottom:5}}><span>SUBTAREAS</span><span>{completadas} de {subtareas.length}</span></div>
        <div style={{height:4,background:'rgba(255,255,255,.08)',borderRadius:4,overflow:'hidden',marginBottom:7}}><div style={{height:'100%',width:`${avance}%`,background:avance===100?'#39ff14':columnColor || '#50b4ff'}}/></div>
        {subtareas.slice(0,3).map(item=><div key={item.id} style={{display:'flex',alignItems:'center',gap:6,color:item.completada?'rgba(255,255,255,.38)':'rgba(255,255,255,.7)',fontSize:'.59rem',marginBottom:5,textDecoration:item.completada?'line-through':'none'}}>{item.completada?<CheckCircle2 size={11} color="#39ff14"/>:<Circle size={11}/>}<span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.texto}</span></div>)}
      </div>}

      {expanded && subtareas.length === 0 && <button type="button" onClick={event=>abrir(event,'plan')} style={{width:'100%',background:'rgba(255,180,0,.06)',border:'1px dashed rgba(255,180,0,.32)',borderRadius:4,color:'#ffb400',padding:'9px',fontSize:'.59rem',cursor:'pointer',marginBottom:9}}>+ Crear plan y subtareas</button>}

      {expanded && (ticket.impacto_operativo || ticket.trabajo_realizado) && <div style={{display:'grid',gap:7,marginBottom:10}}>
        {ticket.impacto_operativo && <div><span style={{fontSize:'.52rem',color:'var(--text-dim)'}}>IMPACTO OPERATIVO</span><p style={{fontSize:'.59rem',color:'rgba(255,255,255,.65)',marginTop:2}}>{ticket.impacto_operativo}</p></div>}
        {ticket.trabajo_realizado && <div><span style={{fontSize:'.52rem',color:'var(--text-dim)'}}>TRABAJO REALIZADO</span><p style={{fontSize:'.59rem',color:'rgba(255,255,255,.65)',marginTop:2}}>{ticket.trabajo_realizado}</p></div>}
      </div>}

      {resuelto && <div style={{display:'flex',alignItems:'center',gap:6,background:'rgba(57,255,20,.09)',border:'1px solid rgba(57,255,20,.2)',borderRadius:4,padding:'7px 8px',fontSize:'.58rem',color:'rgba(57,255,20,.8)',marginBottom:9}}><CheckCircle2 size={13}/>Resuelto {ticket.fecha_cierre ? `el ${fmtFecha(ticket.fecha_cierre)}` : ''}</div>}

      <div style={{display:'flex',alignItems:'center',gap:13,color:'rgba(255,255,255,.36)',fontSize:'.57rem',marginTop:7}}>
        <span style={{display:'flex',alignItems:'center',gap:4}}><MessageSquare size={11}/>Comentarios</span>
        {(ticket.evidencia_url || ticket.trabajo_realizado) && <span style={{display:'flex',alignItems:'center',gap:4}}><Paperclip size={11}/>Evidencia</span>}
        {ticket.tipo && <span style={{marginLeft:'auto',textTransform:'capitalize'}}>{ticket.tipo}</span>}
      </div>
      <div style={{borderTop:'1px solid rgba(255,255,255,.08)',marginTop:10,paddingTop:9,display:'flex',alignItems:'center',gap:8}}>
        <button type="button" onClick={abrir} style={{background:'none',border:0,color:'var(--text)',fontSize:'.6rem',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:4}}>Abrir ficha <ExternalLink size={10}/></button>
        <button type="button" onClick={event=>abrir(event,'comentarios')} style={{background:'none',border:0,borderLeft:'1px solid rgba(255,255,255,.1)',color:'rgba(255,255,255,.6)',fontSize:'.6rem',cursor:'pointer',padding:'0 0 0 10px'}}>Comentar</button>
        <button type="button" aria-label="Más información" onClick={abrir} style={{marginLeft:'auto',background:'none',border:0,color:'rgba(255,255,255,.4)',padding:0,cursor:'pointer'}}><MoreVertical size={13}/></button>
      </div>
    </div>
  )
}

// ─── COLUMNA ─────────────────────────────────────────────────────────────────
function Column({ col, tickets, responsables, activos, expandedTicketId, onSelectCard, onDrop, onCardClick }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={e=>{ e.preventDefault(); setOver(true) }}
      onDragLeave={()=>setOver(false)}
      onDrop={e=>{ e.preventDefault(); setOver(false); const id=e.dataTransfer.getData('ticketId'); if(id) onDrop(id,col.id) }}
      style={{
        flex:1, minWidth:0, display:'flex', flexDirection:'column',
        background: over ? `${col.color}0a` : 'rgba(255,255,255,.012)',
        border: `1px solid ${over ? col.color+'55' : 'transparent'}`,
        borderRadius:5, padding:'10px 9px 0', transition:'all 0.15s'
      }}>

      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, padding:'0 2px' }}>
        <div style={{ width:8,height:8,borderRadius:'50%',background:col.color,boxShadow:`0 0 6px ${col.color}99` }}/>
        <span style={{ fontSize:'0.68rem', color:col.color, fontFamily:'monospace', letterSpacing:'0.08em', fontWeight:600 }}>{col.label}</span>
        <span style={{ marginLeft:'auto', fontSize:'0.62rem', background:`${col.color}22`, color:col.color, border:`1px solid ${col.color}33`, borderRadius:3, padding:'1px 8px', fontWeight:700 }}>{tickets.length}</span>
      </div>

      <div style={{ flex:1, overflowY:'auto', minHeight:100 }}>
        {tickets.map(t=><TicketCard key={t.id} ticket={t} responsables={responsables} activos={activos} columnColor={col.color} expanded={expandedTicketId===t.id} onSelect={onSelectCard} onOpen={onCardClick}/>)}
        {!tickets.length && (
          <div style={{ textAlign:'center', padding:'24px 8px', color:'rgba(57,255,20,0.08)', fontSize:'0.62rem' }}>
            Arrastrá tickets aquí
          </div>
        )}
      </div>
    </div>
  )
}

// ─── KANBAN MAIN ─────────────────────────────────────────────────────────────
export default function MntKanban() {
  const { mantenimientoSedeIds:allowedSedeIds } = useAuth()
  const [tickets, setTickets]           = useState([])
  const [responsables, setResponsables] = useState([])
  const [activos, setActivos]           = useState([])
  const [proveedores, setProveedores]   = useState([])
  const [sedesCatalogo, setSedesCatalogo] = useState([])
  const [loading, setLoading]           = useState(true)
  const [filterResp, setFilterResp]     = usePersistedState('mntKanban.responsable', '')
  const [filterPrior, setFilterPrior]   = usePersistedState('mntKanban.prioridad', '')
  const [filterSede, setFilterSede]     = usePersistedState('mntKanban.sede', '')
  const [filterSLA, setFilterSLA]       = usePersistedState('mntKanban.sla', false)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [selectedTicketTab, setSelectedTicketTab] = useState('datos')
  const [expandedTicketId, setExpandedTicketId] = useState(null)
  const openTicket = (ticket, tab = 'datos') => { setSelectedTicketTab(tab); setSelectedTicket(ticket) }
  const selectCard = id => setExpandedTicketId(current => current === id ? null : id)

  const load = useCallback(async () => {
    setLoading(true)
    const [t,r,a,p,s] = await Promise.all([
      getTickets({ sedeIds: allowedSedeIds || undefined }),
      supabase.from('mnt_responsables').select('id,nombre,rol,nivel_escalacion,telefono,email').eq('activo',true).order('nombre'),
      getActivos({ sedeIds: allowedSedeIds || undefined }),
      getProveedores(),
      getSedes(allowedSedeIds),
    ])
    const nextTickets = filterMaintenanceTickets(t, a)
    setTickets(nextTickets)
    setExpandedTicketId(current => current || nextTickets.find(ticket => ticket.estado === 'en_progreso')?.id || null)
    setResponsables(r.data||[])
    setActivos(filterMaintenanceAssets(a))
    setProveedores(p)
    setSedesCatalogo(s)
    setLoading(false)
  }, [allowedSedeIds])
  useEffect(()=>{ load() },[load])

  // Si el usuario tiene una sola sede asignada (ej: encargado), queda preseleccionada
  useEffect(() => { if (sedesCatalogo.length === 1) setFilterSede(sedesCatalogo[0].nombre) }, [sedesCatalogo, setFilterSede])

  const moveTicket = async (ticketId, newEstado) => {
    setTickets(prev => prev.map(t => t.id===ticketId ? {...t,estado:newEstado} : t))
    const upd = { estado:newEstado }
    if (newEstado==='resuelto') upd.fecha_cierre = new Date().toISOString().split('T')[0]
    await supabase.from('mnt_tickets').update(upd).eq('id',ticketId)
    // Actualizar el modal si está abierto con este ticket
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => ({ ...prev, estado:newEstado, ...(newEstado==='resuelto' ? { fecha_cierre: upd.fecha_cierre } : {}) }))
    }
  }

  const sedes = [...new Set(tickets.map(t => t.sede).filter(Boolean))].sort()

  let filtered = tickets
  if (filterResp)  filtered = filtered.filter(t=>t.responsable_id===filterResp)
  if (filterPrior) filtered = filtered.filter(t=>t.prioridad===filterPrior)
  if (filterSede)  filtered = filtered.filter(t=>t.sede===filterSede)
  if (filterSLA)   filtered = filtered.filter(t=>slaStatus(t)==='vencido')

  const vencidos   = tickets.filter(t=>slaStatus(t)==='vencido').length
  const sinAsignar = tickets.filter(t=>!t.responsable_id&&t.estado!=='resuelto').length
  const activeFilters = [filterResp, filterPrior, filterSede, filterSLA].filter(Boolean).length
  const clearFilters = () => { setFilterResp(''); setFilterPrior(''); setFilterSede(''); setFilterSLA(false) }

  const SEL = { background:'#1a1a22', border:'1px solid rgba(57,255,20,0.08)', color:'var(--text)', borderRadius:2, padding:'5px 10px', fontSize:'0.65rem', fontFamily:'inherit' }

  return (
    <div style={{ padding:'1.5rem 2rem', height:'100%', display:'flex', flexDirection:'column', gap:16 }}>

      {selectedTicket && (
        <FullTicketModal
          ticket={selectedTicket}
          activos={activos}
          proveedores={proveedores}
          responsables={responsables}
          sedes={sedesCatalogo}
          initialTab={selectedTicketTab}
          onClose={()=>setSelectedTicket(null)}
          onSaved={()=>{ setSelectedTicket(null); load() }}
        />
      )}

      {/* Header */}
      <PageHeader title="Tablero de Gestión" subtitle="Kanban · mantenimiento · ISO 9001 cl. 9.1">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {vencidos>0 && (
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,80,80,0.1)', border:'1px solid rgba(255,80,80,0.3)', borderRadius:2, padding:'5px 12px' }}>
              <AlertTriangle size={12} style={{ color:'#ff5050' }}/>
              <span style={{ fontSize:'0.65rem', color:'#ff5050', fontWeight:600 }}>{vencidos} SLA vencido{vencidos!==1?'s':''}</span>
            </div>
          )}
          {sinAsignar>0 && (
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,180,0,0.08)', border:'1px solid rgba(255,180,0,0.3)', borderRadius:2, padding:'5px 12px' }}>
              <User size={12} style={{ color:'#ffb400' }}/>
              <span style={{ fontSize:'0.65rem', color:'#ffb400', fontWeight:600 }}>{sinAsignar} sin asignar</span>
            </div>
          )}
        </div>
      </PageHeader>

      {/* Filtros */}
      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0, flexWrap:'wrap' }}>
        <Filter size={13} style={{ color:'rgba(255,255,255,0.3)' }}/>
        <select style={SEL} value={filterResp} onChange={e=>setFilterResp(e.target.value)}>
          <option value="">Todos los responsables</option>
          {responsables.map(r=><option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
        <select style={SEL} value={filterPrior} onChange={e=>setFilterPrior(e.target.value)}>
          <option value="">Toda prioridad</option>
          <option value="critica">Crítica</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
        <select style={SEL} value={filterSede} onChange={e=>setFilterSede(e.target.value)}>
          <option value="">Todas las sedes</option>
          {sedes.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.65rem', color:'var(--text-dim)', cursor:'pointer' }}>
          <input type="checkbox" checked={filterSLA} onChange={e=>setFilterSLA(e.target.checked)} style={{ accentColor:'#ff5050' }}/>
          Solo SLA vencido
        </label>
        {activeFilters > 0 && <button type="button" onClick={clearFilters} className="btn-ghost" style={{ fontSize:'0.62rem' }}>Limpiar filtros ({activeFilters})</button>}
        <button onClick={load} style={{ ...SEL, marginLeft:'auto', display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}>
          <RefreshCw size={11}/>Actualizar
        </button>
      </div>

      {/* Board */}
      {loading ? (
        <p style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>Cargando tickets...</p>
      ) : (
        <div style={{ flex:1, display:'flex', gap:14, overflowX:'auto', minHeight:0 }}>
          {COLS.map(col=>(
            <Column key={col.id} col={col}
              tickets={filtered.filter(t=>t.estado===col.id)}
              responsables={responsables}
              activos={activos}
              expandedTicketId={expandedTicketId}
              onSelectCard={selectCard}
              onDrop={moveTicket}
              onCardClick={openTicket}
            />
          ))}
        </div>
      )}
    </div>
  )
}
