import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtFecha } from '../../lib/dateUtils'
import { updateTicket, getAuditoriaTicket, getActivos, getProveedores, getSedes, getTickets } from '../../lib/queries'
import { AlertTriangle, User, Filter, RefreshCw, X, Clock, Tag, MapPin, Wrench, ChevronDown, MessageSquare, History } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { TicketModal as FullTicketModal } from './MntTickets'

const COLS = [
  { id:'abierto',     label:'Nuevo',       color:'#50b4ff' },
  { id:'en_progreso', label:'En Progreso',  color:'#ffb400' },
  { id:'aprobado',    label:'Bloqueado',    color:'#ff5050' },
  { id:'resuelto',    label:'Resuelto',     color:'#39ff14' },
]
const PRIORIDAD_COLOR = { critica:'#FF2A2A', alta:'#ff5050', media:'#ffb400', baja:'#50b4ff' }
const SLA_HS          = { critica:2, alta:4, media:48, baja:168 }

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
  }, [editing])

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
    } catch(e) { alert('Error al guardar: ' + e.message) }
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
    <div style={MODAL_BG} onClick={e => { if(e.target===e.currentTarget) onClose() }}>
      <div style={MODAL_BOX}>

        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(57,255,20,0.06)', display:'flex', gap:12, alignItems:'flex-start', flexShrink:0 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
              <span style={{ fontSize:'0.52rem', padding:'2px 8px', borderRadius:4, fontWeight:700, background:`${pc}22`, color:pc, border:`1px solid ${pc}44` }}>
                {form.prioridad?.toUpperCase()}
              </span>
              <span style={{ fontSize:'0.55rem', padding:'2px 8px', borderRadius:4, background:'#1a1a22', color:'rgba(255,255,255,0.5)', border:'1px solid rgba(57,255,20,0.08)' }}>
                {ticket.tipo || 'Sin tipo'}
              </span>
              {ticket.categoria && (
                <span style={{ fontSize:'0.55rem', padding:'2px 8px', borderRadius:4, background:'rgba(80,180,255,0.08)', color:'#50b4ff', border:'1px solid rgba(80,180,255,0.2)' }}>
                  {ticket.categoria}
                </span>
              )}
              {sla === 'vencido' && (
                <span style={{ fontSize:'0.55rem', padding:'2px 8px', borderRadius:4, background:'rgba(255,80,80,0.1)', color:'#ff5050', border:'1px solid rgba(255,80,80,0.3)', display:'flex', alignItems:'center', gap:4 }}>
                  <AlertTriangle size={9}/> SLA VENCIDO
                </span>
              )}
              {sla === 'alerta' && (
                <span style={{ fontSize:'0.55rem', padding:'2px 8px', borderRadius:4, background:'rgba(255,180,0,0.1)', color:'#ffb400', border:'1px solid rgba(255,180,0,0.3)', display:'flex', alignItems:'center', gap:4 }}>
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
          {[['detalle','Detalle'],['historial','Trazabilidad']].map(([id,label]) => (
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
                <label style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>DESCRIPCIÓN</label>
                {editing
                  ? <textarea style={{ ...INP, minHeight:80, resize:'vertical' }} value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} placeholder="Ej: Pierde aceite en compresor principal"/>
                  : <p style={{ fontSize:'0.75rem', color:'var(--text)', lineHeight:1.5 }}>{ticket.descripcion || '(sin descripción)'}</p>
                }
              </div>

              {/* Info grid */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {/* Estado */}
                <div>
                  <label style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:5 }}>ESTADO</label>
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
                  <label style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:5 }}>PRIORIDAD</label>
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
                  <label style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:5 }}>RESPONSABLE</label>
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
                  <label style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:5 }}>ACTIVO</label>
                  {editing
                    ? <select style={SEL} value={form.activo_id} onChange={e=>setForm(f=>({...f,activo_id:e.target.value}))}>
                        <option value="">Sin asignar</option>
                        {activos.map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
                      </select>
                    : <span style={{ fontSize:'0.7rem', color:'rgba(57,255,20,0.7)' }}>{ticket.activo_nombre || '—'}</span>
                  }
                  {editing && loadingActivos && <span style={{ fontSize:'0.55rem', color:'rgba(255,255,255,0.3)', display:'block', marginTop:3 }}>Cargando activos...</span>}
                </div>

                {/* Proveedor */}
                <div>
                  <label style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:5 }}>PROVEEDOR</label>
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
                  <label style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:5 }}>SEDE</label>
                  <span style={{ fontSize:'0.7rem', color:'var(--text)' }}>{ticket.sede || '—'}</span>
                </div>

                {/* Tipo */}
                <div>
                  <label style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:5 }}>TIPO</label>
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
                  <label style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:5 }}>APERTURA</label>
                  <span style={{ fontSize:'0.7rem', color:'var(--text)' }}>{ticket.created_at ? fmtFecha(ticket.created_at) : '—'}</span>
                </div>

                {/* Fecha cierre */}
                {ticket.fecha_cierre && (
                  <div>
                    <label style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:5 }}>CIERRE</label>
                    <span style={{ fontSize:'0.7rem', color:'#39ff14' }}>{fmtFecha(ticket.fecha_cierre)}</span>
                  </div>
                )}
              </div>

              {/* Solución */}
              <div>
                <label style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>SOLUCIÓN / OBSERVACIONES</label>
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
                            <span style={{ fontSize:'0.55rem', padding:'1px 7px', borderRadius:3, background:`${color}18`, color, border:`1px solid ${color}33`, fontWeight:700, fontFamily:'monospace' }}>
                              {row.accion}
                            </span>
                            <span style={{ fontSize:'0.62rem', color:'var(--text)', fontWeight:600 }}>
                              {row.usuario_nombre || row.usuario_email || 'Sistema'}
                            </span>
                            <span style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.25)', marginLeft:'auto' }}>
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
function TicketCard({ ticket, responsables, onClick }) {
  const [dragging, setDragging] = useState(false)
  const resp = responsables.find(r => r.id === ticket.responsable_id)
  const sla  = slaStatus(ticket)
  const pc   = PRIORIDAD_COLOR[ticket.prioridad] || '#aaa'

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('ticketId', ticket.id); setDragging(true) }}
      onDragEnd={() => setDragging(false)}
      onClick={() => onClick(ticket)}
      style={{
        background:'var(--surface)', border:'1px solid rgba(57,255,20,0.06)',
        borderLeft:`3px solid ${pc}`, borderRadius:2, padding:'9px 11px',
        cursor:'pointer', marginBottom:7, opacity:dragging?0.5:1, transition:'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background='rgba(57,255,20,0.06)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.14)' }}
      onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor='rgba(57,255,20,0.06)' }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
        <span style={{ fontSize:'0.52rem', padding:'1px 6px', borderRadius:4, fontWeight:700, background:`${pc}22`, color:pc, border:`1px solid ${pc}44` }}>
          {ticket.prioridad}
        </span>
        {sla === 'vencido' && <span style={{ width:7,height:7,borderRadius:'50%',background:'#ff5050',display:'inline-block',boxShadow:'0 0 5px #ff5050' }} title="SLA vencido"/>}
        {sla === 'alerta'  && <span style={{ width:7,height:7,borderRadius:'50%',background:'#ffb400',display:'inline-block',boxShadow:'0 0 5px #ffb400' }} title="SLA por vencer"/>}
        <span style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.3)', marginLeft:'auto' }}>
          {ticket.created_at ? fmtFecha(ticket.created_at) : ''}
        </span>
      </div>

      <p style={{ fontSize:'0.68rem', color:'var(--text)', lineHeight:1.35, marginBottom:5 }}>
        {ticket.descripcion?.substring(0,90)}{ticket.descripcion?.length>90?'…':''}
      </p>

      {ticket.activo_nombre && (
        <p style={{ fontSize:'0.6rem', color:'rgba(57,255,20,0.6)', marginBottom:5 }}>{ticket.activo_nombre}</p>
      )}

      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        <User size={9} style={{ color:'rgba(255,255,255,0.3)', flexShrink:0 }}/>
        <span style={{ fontSize:'0.6rem', color: resp?'rgba(255,255,255,0.5)':'rgba(255,80,80,0.55)' }}>
          {resp ? resp.nombre : 'Sin asignar'}
        </span>
        {ticket.tipo && (
          <span style={{ fontSize:'0.55rem', color:'rgba(255,255,255,0.2)', marginLeft:'auto' }}>{ticket.tipo}</span>
        )}
      </div>
    </div>
  )
}

// ─── COLUMNA ─────────────────────────────────────────────────────────────────
function Column({ col, tickets, responsables, onDrop, onCardClick }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={e=>{ e.preventDefault(); setOver(true) }}
      onDragLeave={()=>setOver(false)}
      onDrop={e=>{ e.preventDefault(); setOver(false); const id=e.dataTransfer.getData('ticketId'); if(id) onDrop(id,col.id) }}
      style={{
        flex:1, minWidth:0, display:'flex', flexDirection:'column',
        background: over ? `${col.color}0a` : 'transparent',
        border: `1px solid ${over ? col.color+'55' : 'transparent'}`,
        borderRadius:3, padding:'0 6px', transition:'all 0.15s'
      }}>

      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, padding:'0 2px' }}>
        <div style={{ width:8,height:8,borderRadius:'50%',background:col.color,boxShadow:`0 0 6px ${col.color}99` }}/>
        <span style={{ fontSize:'0.68rem', color:col.color, fontFamily:'monospace', letterSpacing:'0.08em', fontWeight:600 }}>{col.label}</span>
        <span style={{ marginLeft:'auto', fontSize:'0.62rem', background:`${col.color}22`, color:col.color, border:`1px solid ${col.color}33`, borderRadius:3, padding:'1px 8px', fontWeight:700 }}>{tickets.length}</span>
      </div>

      <div style={{ flex:1, overflowY:'auto', minHeight:100 }}>
        {tickets.map(t=><TicketCard key={t.id} ticket={t} responsables={responsables} onClick={onCardClick}/>)}
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
  const { allowedSedeIds } = useAuth()
  const [tickets, setTickets]           = useState([])
  const [responsables, setResponsables] = useState([])
  const [activos, setActivos]           = useState([])
  const [proveedores, setProveedores]   = useState([])
  const [sedesCatalogo, setSedesCatalogo] = useState([])
  const [loading, setLoading]           = useState(true)
  const [filterResp, setFilterResp]     = useState('')
  const [filterPrior, setFilterPrior]   = useState('')
  const [filterSede, setFilterSede]     = useState('')
  const [filterSLA, setFilterSLA]       = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)

  const load = async () => {
    setLoading(true)
    const [t,r,a,p,s] = await Promise.all([
      getTickets({ sedeIds: allowedSedeIds || undefined }),
      supabase.from('mnt_responsables').select('id,nombre,rol,nivel_escalacion').eq('activo',true).order('nombre'),
      getActivos({ sedeIds: allowedSedeIds || undefined }),
      getProveedores(),
      getSedes(allowedSedeIds),
    ])
    setTickets(t); setResponsables(r.data||[]); setActivos(a); setProveedores(p); setSedesCatalogo(s); setLoading(false)
  }
  useEffect(()=>{ load() },[])

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
          onClose={()=>setSelectedTicket(null)}
          onSaved={()=>{ setSelectedTicket(null); load() }}
        />
      )}

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <div>
          <h1 className='font-title' style={{ color:'var(--text)', fontWeight:800, fontSize:'1.4rem' }}>Tablero de Gestión</h1>
          <p style={{ fontSize:'0.62rem', color:'rgba(57,255,20,0.5)', letterSpacing:'0.1em', fontFamily:'monospace' }}>KANBAN · MANTENIMIENTO · ISO 9001 CL. 9.1</p>
        </div>
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
      </div>

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
        <button onClick={load} style={{ ...SEL, marginLeft:'auto', display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}>
          <RefreshCw size={11}/>Actualizar
        </button>
      </div>

      {/* Board */}
      {loading ? (
        <p style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>Cargando tickets...</p>
      ) : (
        <div style={{ flex:1, display:'flex', gap:12, overflowX:'auto', minHeight:0 }}>
          {COLS.map(col=>(
            <Column key={col.id} col={col}
              tickets={filtered.filter(t=>t.estado===col.id)}
              responsables={responsables}
              onDrop={moveTicket}
              onCardClick={setSelectedTicket}
            />
          ))}
        </div>
      )}
    </div>
  )
}
