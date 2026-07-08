import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtFecha } from '../../lib/dateUtils'
import { useAuth } from '../../lib/auth'
import { notifyHighPriority } from '../../lib/pushNotifications'
import { isQualityOnlyProfile } from '../../lib/access'
import { AlertTriangle, User, Filter, RefreshCw, Plus, X, Car, Gauge, Clock, History, LayoutGrid, List } from 'lucide-react'
import PageHeader from '../../components/PageHeader'

const COLS = [
  { id:'abierto',     label:'Nuevo',       color:'#50b4ff' },
  { id:'en progreso', label:'En Progreso',  color:'#ffb400' },
  { id:'aprobado',    label:'Bloqueado',    color:'#ff5050' },
  { id:'resuelto',    label:'Resuelto',     color:'#39ff14' },
]
const PC = { critica:'#FF2A2A', alta:'#ff5050', media:'#ffb400', baja:'#50b4ff' }
const SLA_HS = { critica:4, alta:24, media:120, baja:240 }

function slaStatus(t) {
  if (!t.created_at || t.estado === 'resuelto' || t.estado === 'rechazado') return null
  const h = (Date.now() - new Date(t.created_at).getTime()) / 3600000
  const lim = SLA_HS[t.prioridad] || 120
  const pct = h / lim
  return pct >= 1 ? 'vencido' : pct >= 0.7 ? 'alerta' : 'ok'
}

// ─── MODAL NUEVO / EDITAR TICKET ─────────────────────────────────────────────
function TicketModal({ ticket, patentes, onClose, onSaved }) {
  const isNew = !ticket?.id
  const [form, setForm] = useState({
    activo_nombre: ticket?.activo_nombre || '',
    descripcion:   ticket?.descripcion   || '',
    diagnostico:   ticket?.diagnostico   || '',
    estado:        ticket?.estado        || 'abierto',
    prioridad:     ticket?.prioridad     || 'media',
    tipo:          ticket?.tipo          || 'correctivo',
    lectura_km:    ticket?.lectura_km    ?? '',
    responsable:   ticket?.responsable   || '',
    sede:          ticket?.sede          || '',
    costo_real:    ticket?.costo_real    ?? '',
    fecha_limite:  ticket?.fecha_limite ? ticket.fecha_limite.split('T')[0] : '',
    notas_costos:  ticket?.notas_costos  || '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState(null)
  const [tab, setTab]       = useState('detalle')
  const [historial, setHistorial] = useState([])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (tab === 'historial' && ticket?.id) {
      supabase.schema('mantenimiento').from('tickets')
        .select('id,created_at,descripcion')
        .eq('activo_nombre', ticket.activo_nombre)
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data }) => setHistorial(data || []))
    }
  }, [tab, ticket])

  async function save() {
    if (!form.activo_nombre.trim()) { setErr('La patente es obligatoria'); return }
    if (!form.descripcion.trim())   { setErr('La descripción es obligatoria'); return }
    setSaving(true); setErr(null)
    const payload = {
      ...form,
      categoria: 'Vehiculos',
      lectura_km: form.lectura_km !== '' ? parseInt(form.lectura_km) : null,
      costo_real: form.costo_real !== '' ? parseFloat(form.costo_real) : null,
      fecha_limite: form.fecha_limite || null,
    }
    let error, saved
    if (isNew) {
      ;({ data:saved, error } = await supabase.schema('mantenimiento').from('tickets').insert(payload).select().single())
    } else {
      ;({ data:saved, error } = await supabase.schema('mantenimiento').from('tickets').update(payload).eq('id', ticket.id).select().single())
    }
    setSaving(false)
    if (error) { setErr(error.message); return }
    if (saved?.id && ['alta','critica'].includes(String(saved.prioridad).toLowerCase())) {
      notifyHighPriority({ module:'mantenimiento', entity_id:saved.id, priority:saved.prioridad })
    }
    onSaved()
  }

  const INP = { background:'var(--surface)', border:'1px solid rgba(57,255,20,0.08)', color:'var(--text)', borderRadius:2, padding:'7px 10px', fontSize:'0.72rem', fontFamily:'monospace', width:'100%', boxSizing:'border-box', outline:'none' }
  const LBL = { fontSize:'0.58rem', color:'rgba(255,255,255,0.3)', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:4, display:'block' }
  const TAB = (active) => ({ padding:'5px 14px', borderRadius:4, fontSize:'0.65rem', cursor:'pointer', fontFamily:'monospace', fontWeight:active?700:400, background: active ? 'rgba(57,255,20,0.1)' : 'transparent', border: active ? '1px solid rgba(57,255,20,0.3)' : '1px solid transparent', color: active ? '#39FF14' : 'rgba(255,255,255,0.35)' })

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.1)', borderRadius:3, width:'100%', maxWidth:620, maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,0.6)' }}>

        {/* Header modal */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(57,255,20,0.06)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <Car size={14} style={{ color:'rgba(57,255,20,0.5)' }}/>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'0.58rem', color:'rgba(57,255,20,0.5)', letterSpacing:'.1em', textTransform:'uppercase' }}>{isNew ? 'Nuevo ticket · Flota' : 'Editar ticket · Flota'}</div>
            <div style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text)', marginTop:1 }}>{isNew ? 'Nuevo incidente vehicular' : form.activo_nombre}</div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.3)', cursor:'pointer', padding:4 }}><X size={16}/></button>
        </div>

        {/* Tabs */}
        <div style={{ padding:'8px 20px 0', borderBottom:'1px solid rgba(57,255,20,0.05)', display:'flex', gap:6, flexShrink:0 }}>
          <button style={TAB(tab==='detalle')} onClick={()=>setTab('detalle')}>Detalle</button>
          {!isNew && <button style={TAB(tab==='historial')} onClick={()=>setTab('historial')}><History size={10} style={{display:'inline',marginRight:4}}/>Historial del vehículo</button>}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
          {tab === 'detalle' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={LBL}>Patente / Vehículo *</label>
                  {isNew ? (
                    <input list="patentes-list" style={INP} value={form.activo_nombre} onChange={e=>set('activo_nombre',e.target.value.toUpperCase())} placeholder="AA239RK"/>
                  ) : (
                    <input style={INP} value={form.activo_nombre} onChange={e=>set('activo_nombre',e.target.value.toUpperCase())}/>
                  )}
                  <datalist id="patentes-list">
                    {(patentes||[]).map(p=><option key={p} value={p}/>)}
                  </datalist>
                </div>
                <div>
                  <label style={LBL}><Gauge size={9} style={{display:'inline',marginRight:3}}/>Lectura KM</label>
                  <input style={INP} type="number" value={form.lectura_km} onChange={e=>set('lectura_km',e.target.value)} placeholder="152000"/>
                </div>
              </div>

              <div style={{ marginBottom:10 }}>
                <label style={LBL}>Descripción del problema *</label>
                <textarea style={{ ...INP, minHeight:60, resize:'vertical' }} value={form.descripcion} onChange={e=>set('descripcion',e.target.value)} placeholder="Describir el problema o trabajo..."/>
              </div>

              <div style={{ marginBottom:10 }}>
                <label style={LBL}>Diagnóstico / Solución</label>
                <textarea style={{ ...INP, minHeight:44, resize:'vertical' }} value={form.diagnostico} onChange={e=>set('diagnostico',e.target.value)} placeholder="Ej: Se cambió batería, falla eléctrica resuelta"/>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={LBL}>Estado</label>
                  <select style={INP} value={form.estado} onChange={e=>set('estado',e.target.value)}>
                    <option value="abierto">Nuevo</option>
                    <option value="en progreso">En Progreso</option>
                    <option value="aprobado">Bloqueado</option>
                    <option value="resuelto">Resuelto</option>
                    <option value="rechazado">Rechazado</option>
                  </select>
                </div>
                <div>
                  <label style={LBL}>Prioridad</label>
                  <select style={INP} value={form.prioridad} onChange={e=>set('prioridad',e.target.value)}>
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>
                <div>
                  <label style={LBL}>Tipo</label>
                  <select style={INP} value={form.tipo} onChange={e=>set('tipo',e.target.value)}>
                    <option value="correctivo">Correctivo</option>
                    <option value="preventivo">Preventivo</option>
                  </select>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={LBL}>Responsable / Taller</label>
                  <input style={INP} value={form.responsable} onChange={e=>set('responsable',e.target.value)} placeholder="Técnico o taller"/>
                </div>
                <div>
                  <label style={LBL}>Sede / Ubicación</label>
                  <input style={INP} value={form.sede} onChange={e=>set('sede',e.target.value)} placeholder="Sede de origen"/>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={LBL}>Costo real ($)</label>
                  <input style={INP} type="number" step="0.01" value={form.costo_real} onChange={e=>set('costo_real',e.target.value)} placeholder="0.00"/>
                </div>
                <div>
                  <label style={LBL}>Fecha límite</label>
                  <input style={INP} type="date" value={form.fecha_limite} onChange={e=>set('fecha_limite',e.target.value)}/>
                </div>
              </div>

              <div style={{ marginBottom:4 }}>
                <label style={LBL}>Notas / OC / Presupuesto</label>
                <textarea style={{ ...INP, minHeight:36, resize:'vertical' }} value={form.notas_costos} onChange={e=>set('notas_costos',e.target.value)} placeholder="Notas adicionales..."/>
              </div>
            </>
          )}

          {tab === 'historial' && (
            <div>
              <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.3)', marginBottom:10 }}>Todos los tickets registrados para <strong style={{ color:'#39FF14' }}>{ticket.activo_nombre}</strong></div>
              {historial.length === 0 ? (
                <p style={{ color:'rgba(255,255,255,0.2)', fontSize:'0.7rem', textAlign:'center', padding:'2rem 0' }}>Sin historial</p>
              ) : historial.map(h => (
                <div key={h.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', paddingBottom:8, marginBottom:8 }}>
                  <div style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.25)', marginBottom:3 }}>{h.created_at ? fmtFecha(h.created_at) : ''} · #{h.id}</div>
                  <div style={{ fontSize:'0.72rem', color:'var(--text)' }}>{h.descripcion}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding:'12px 20px', borderTop:'1px solid rgba(57,255,20,0.06)', display:'flex', gap:8, justifyContent:'flex-end', flexShrink:0 }}>
          {err && <span style={{ fontSize:'0.65rem', color:'#ff5050', flex:1, alignSelf:'center' }}>{err}</span>}
          <button onClick={onClose} style={{ background:'transparent', border:'1px solid rgba(57,255,20,0.08)', color:'rgba(255,255,255,0.4)', fontFamily:'monospace', fontSize:'0.65rem', padding:'6px 16px', borderRadius:5, cursor:'pointer' }}>Cancelar</button>
          {tab === 'detalle' && (
            <button onClick={save} disabled={saving} style={{ background:'rgba(57,255,20,0.15)', border:'1px solid rgba(57,255,20,0.4)', color:'#39FF14', fontFamily:'monospace', fontSize:'0.65rem', padding:'6px 18px', borderRadius:5, cursor:'pointer', fontWeight:700 }}>
              {saving ? 'Guardando...' : isNew ? 'Crear ticket' : 'Guardar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── CARD ─────────────────────────────────────────────────────────────────────
function VehCard({ ticket, onClick }) {
  const [dragging, setDragging] = useState(false)
  const sla = slaStatus(ticket)
  const pc  = PC[ticket.prioridad] || '#aaa'

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('ticketId', String(ticket.id)); setDragging(true) }}
      onDragEnd={() => setDragging(false)}
      onClick={() => onClick(ticket)}
      style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.06)', borderLeft:`3px solid ${pc}`, borderRadius:2, padding:'9px 11px', cursor:'pointer', marginBottom:7, opacity:dragging?0.5:1, transition:'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.background='rgba(57,255,20,0.06)' }}
      onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.03)' }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
        <span style={{ fontSize:'0.52rem', padding:'1px 6px', borderRadius:4, fontWeight:700, background:`${pc}22`, color:pc, border:`1px solid ${pc}44` }}>{ticket.prioridad}</span>
        {sla === 'vencido' && <span style={{ width:6,height:6,borderRadius:'50%',background:'#ff5050',display:'inline-block',boxShadow:'0 0 5px #ff5050' }} title="SLA vencido"/>}
        {sla === 'alerta'  && <span style={{ width:6,height:6,borderRadius:'50%',background:'#ffb400',display:'inline-block',boxShadow:'0 0 5px #ffb400' }} title="SLA por vencer"/>}
        <span style={{ marginLeft:'auto', fontSize:'0.55rem', color:'rgba(255,255,255,0.25)' }}>{ticket.created_at ? fmtFecha(ticket.created_at) : ''}</span>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
        <Car size={10} style={{ color:'rgba(57,255,20,0.5)', flexShrink:0 }}/>
        <span style={{ fontSize:'0.72rem', color:'#39FF14', fontWeight:700, fontFamily:'monospace' }}>{ticket.activo_nombre}</span>
        {ticket.lectura_km && (
          <span style={{ marginLeft:'auto', fontSize:'0.58rem', color:'rgba(255,255,255,0.3)' }}>{ticket.lectura_km.toLocaleString()} km</span>
        )}
      </div>

      <p style={{ fontSize:'0.68rem', color:'var(--text)', lineHeight:1.35, marginBottom:5 }}>
        {ticket.descripcion?.substring(0,85)}{ticket.descripcion?.length>85?'…':''}
      </p>

      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        <User size={9} style={{ color:'rgba(255,255,255,0.3)', flexShrink:0 }}/>
        <span style={{ fontSize:'0.6rem', color: ticket.responsable?'rgba(255,255,255,0.45)':'rgba(255,80,80,0.55)' }}>
          {ticket.responsable || 'Sin asignar'}
        </span>
        {ticket.tipo && <span style={{ fontSize:'0.55rem', color:'rgba(255,255,255,0.2)', marginLeft:'auto' }}>{ticket.tipo}</span>}
      </div>
    </div>
  )
}

// ─── COLUMNA ──────────────────────────────────────────────────────────────────
function Column({ col, tickets, onDrop, onCardClick }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={e=>{ e.preventDefault(); setOver(true) }}
      onDragLeave={()=>setOver(false)}
      onDrop={e=>{ e.preventDefault(); setOver(false); const id=e.dataTransfer.getData('ticketId'); if(id) onDrop(id, col.id) }}
      style={{ flex:1, minWidth:200, display:'flex', flexDirection:'column', background:over?`${col.color}08`:'transparent', border:`1px solid ${over?col.color+'44':'transparent'}`, borderRadius:3, padding:'0 6px', transition:'all 0.15s' }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, padding:'0 2px' }}>
        <div style={{ width:8,height:8,borderRadius:'50%',background:col.color,boxShadow:`0 0 6px ${col.color}99` }}/>
        <span style={{ fontSize:'0.68rem', color:col.color, fontFamily:'monospace', letterSpacing:'0.08em', fontWeight:600 }}>{col.label}</span>
        <span style={{ marginLeft:'auto', fontSize:'0.62rem', background:`${col.color}22`, color:col.color, border:`1px solid ${col.color}33`, borderRadius:3, padding:'1px 8px', fontWeight:700 }}>{tickets.length}</span>
      </div>
      <div style={{ flex:1, overflowY:'auto', minHeight:80 }}>
        {tickets.map(t=><VehCard key={t.id} ticket={t} onClick={onCardClick}/>)}
        {!tickets.length && (
          <div style={{ textAlign:'center', padding:'24px 8px', color:'rgba(57,255,20,0.08)', fontSize:'0.62rem' }}>Arrastrá aquí</div>
        )}
      </div>
    </div>
  )
}


// ─── HISTORIAL POR UNIDAD ─────────────────────────────────────────────────────
function HistorialPorUnidad({ tickets }) {
  const [selected, setSelected] = useState(null)

  // Group by patente (activo_nombre)
  const byPatente = {}
  tickets.forEach(t => {
    const key = t.activo_nombre || 'Sin asignar'
    if (!byPatente[key]) byPatente[key] = []
    byPatente[key].push(t)
  })
  const patentes = Object.keys(byPatente).sort()

  const hist = selected ? byPatente[selected] : []
  const costoTotal = hist.reduce((s,t) => s+(t.costo_real||0), 0)
  const lastKm = hist.reduce((m,t) => Math.max(m, t.lectura_km||0), 0)

  const PC = { critica:'#FF2A2A', alta:'#F59E0B', media:'#50b4ff', baja:'var(--text-dim)' }
  const EC = { resuelto:'chip-green', 'en progreso':'chip-yellow', abierto:'chip-blue', rechazado:'chip-gray' }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:0, minHeight:400, border:'1px solid rgba(57,255,20,0.08)', borderRadius:3 }}>
      {/* Left: vehicle list */}
      <div style={{ borderRight:'1px solid rgba(57,255,20,0.08)', overflowY:'auto' }}>
        <p style={{ padding:'0.6rem 0.75rem', fontSize:'0.6rem', color:'var(--phosphor)', textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:"'Roboto Mono',monospace", borderBottom:'1px solid rgba(57,255,20,0.08)', margin:0 }}>
          Unidades · {patentes.length}
        </p>
        {patentes.length === 0 && (
          <p style={{ color:'var(--text-dim)', fontSize:'0.75rem', padding:'1rem', textAlign:'center' }}>Sin datos</p>
        )}
        {patentes.map(pat => {
          const tks = byPatente[pat]
          const open = tks.filter(t => t.estado !== 'resuelto').length
          const isActive = selected === pat
          return (
            <button key={pat} onClick={() => setSelected(pat)}
              style={{ width:'100%', textAlign:'left', padding:'0.6rem 0.75rem', background: isActive ? 'rgba(57,255,20,0.08)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--phosphor)' : '2px solid transparent',
                borderBottom:'1px solid rgba(57,255,20,0.05)', cursor:'pointer', display:'block' }}>
              <p style={{ fontSize:'0.75rem', color: isActive ? 'var(--phosphor)' : 'var(--text)', margin:0, fontFamily:"'Roboto Mono',monospace", fontWeight:600 }}>{pat}</p>
              <div style={{ display:'flex', gap:4, marginTop:3 }}>
                <span className='chip chip-gray' style={{ borderRadius:2 }}>{tks.length} tickets</span>
                {open > 0 && <span className='chip chip-yellow' style={{ borderRadius:2 }}>{open} abiertos</span>}
              </div>
            </button>
          )
        })}
      </div>

      {/* Right: history panel */}
      <div style={{ padding:'1rem', overflowY:'auto' }}>
        {!selected ? (
          <p style={{ color:'var(--text-dim)', fontSize:'0.75rem', textAlign:'center', paddingTop:'3rem' }}>Seleccioná una unidad</p>
        ) : (
          <>
            <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
              <div className='kpi-card' style={{ minWidth:90 }}>
                <p className='kpi-label'>Tickets</p>
                <p className='kpi-value' style={{ fontSize:'1.5rem' }}>{hist.length}</p>
              </div>
              {costoTotal > 0 && (
                <div className='kpi-card' style={{ minWidth:90 }}>
                  <p className='kpi-label'>Costo total</p>
                  <p className='kpi-value' style={{ fontSize:'1.2rem' }}>${costoTotal.toLocaleString('es-AR')}</p>
                </div>
              )}
              {lastKm > 0 && (
                <div className='kpi-card' style={{ minWidth:90 }}>
                  <p className='kpi-label'>Último KM</p>
                  <p className='kpi-value' style={{ fontSize:'1.2rem' }}>{lastKm.toLocaleString('es-AR')}</p>
                </div>
              )}
            </div>
            <div className='glass rounded overflow-hidden' style={{ borderRadius:3 }}>
              <table className='table-dark w-full'>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>KM</th>
                    <th>Costo</th>
                    <th>Estado</th>
                    <th>Taller</th>
                  </tr>
                </thead>
                <tbody>
                  {hist.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontFamily:"'Roboto Mono',monospace", fontSize:'0.72rem', whiteSpace:'nowrap' }}>{t.created_at ? fmtFecha(t.created_at) : '—'}</td>
                      <td>
                        <span className={`chip ${t.tipo==='correctivo' ? 'chip-red' : 'chip-blue'}`} style={{ borderRadius:2 }}>{t.tipo||'—'}</span>
                      </td>
                      <td>
                        <p style={{ margin:0, fontSize:'0.75rem' }}>{t.descripcion}</p>
                        {t.diagnostico && <p style={{ margin:'2px 0 0', fontSize:'0.65rem', color:'var(--text-dim)' }}>{t.diagnostico}</p>}
                      </td>
                      <td style={{ fontFamily:"'Roboto Mono',monospace", fontSize:'0.72rem' }}>{t.lectura_km ? t.lectura_km.toLocaleString() : '—'}</td>
                      <td style={{ fontFamily:"'Roboto Mono',monospace", fontSize:'0.72rem', color:'var(--phosphor)' }}>{t.costo_real ? `$${t.costo_real.toLocaleString('es-AR')}` : '—'}</td>
                      <td><span className={`chip ${EC[t.estado]||'chip-gray'}`} style={{ borderRadius:2 }}>{t.estado}</span></td>
                      <td style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>{t.taller||'—'}</td>
                    </tr>
                  ))}
                  {hist.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--text-dim)', padding:'2rem' }}>Sin registros</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function MntVehiculos({ focusId }) {
  const { rol, perfil } = useAuth()
  const canWrite = (rol === 'admin' || rol === 'editor' || rol === 'encargado' || rol === 'flota') && !isQualityOnlyProfile(perfil)

  const [tickets, setTickets]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [filterPat, setFilterPat]   = useState('')
  const [filterPrior, setFilterPrior] = useState('')
  const [filterTipo, setFilterTipo]   = useState('')
  const [filterSLA, setFilterSLA]     = useState(false)
  const [modalTicket, setModalTicket] = useState(null) // null | ticket obj | 'new'
  useEffect(() => {
    if (!focusId || loading) return
    const target = tickets.find(item => String(item.id) === String(focusId))
    if (target) setModalTicket(target)
  }, [focusId, loading, tickets])
  const [viewMode, setViewMode]   = useState('kanban')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.schema('mantenimiento').from('tickets')
      .select('id,numero,activo_nombre,descripcion,diagnostico,estado,prioridad,tipo,lectura_km,responsable,sede,costo_real,fecha_limite,created_at,notas_costos')
      .eq('categoria', 'Vehiculos')
      .order('created_at', { ascending: false })
    setTickets(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const patentes = [...new Set(tickets.map(t=>t.activo_nombre).filter(Boolean))].sort()

  const moveTicket = async (ticketId, newEstado) => {
    setTickets(prev => prev.map(t => t.id === parseInt(ticketId) ? { ...t, estado: newEstado } : t))
    await supabase.schema('mantenimiento').from('tickets').update({ estado: newEstado }).eq('id', ticketId)
  }

  let filtered = tickets
  if (filterPat)   filtered = filtered.filter(t => t.activo_nombre === filterPat)
  if (filterPrior) filtered = filtered.filter(t => t.prioridad === filterPrior)
  if (filterTipo)  filtered = filtered.filter(t => t.tipo === filterTipo)
  if (filterSLA)   filtered = filtered.filter(t => slaStatus(t) === 'vencido')

  const vencidos   = tickets.filter(t => slaStatus(t) === 'vencido').length
  const abiertos   = tickets.filter(t => t.estado !== 'resuelto' && t.estado !== 'rechazado').length
  const sinAsignar = tickets.filter(t => !t.responsable && t.estado !== 'resuelto' && t.estado !== 'rechazado').length

  const SEL = { background:'#1a1a22', border:'1px solid rgba(57,255,20,0.08)', color:'var(--text)', borderRadius:2, padding:'5px 10px', fontSize:'0.65rem', fontFamily:'monospace', cursor:'pointer' }

  return (
    <div style={{ padding:'1.5rem 2rem', height:'100%', display:'flex', flexDirection:'column', gap:16 }}>

      {modalTicket && (
        <TicketModal
          ticket={modalTicket === 'new' ? null : modalTicket}
          patentes={patentes}
          onClose={() => setModalTicket(null)}
          onSaved={() => { setModalTicket(null); load() }}
        />
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <PageHeader title="Mantenimiento de Vehículos" subtitle={`Flota · ${patentes.length} vehículos · ${abiertos} tickets activos`}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {vencidos > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,80,80,0.1)', border:'1px solid rgba(255,80,80,0.3)', borderRadius:2, padding:'5px 12px' }}>
              <AlertTriangle size={12} style={{ color:'#ff5050' }}/>
              <span style={{ fontSize:'0.65rem', color:'#ff5050', fontWeight:600 }}>{vencidos} SLA vencido{vencidos!==1?'s':''}</span>
            </div>
          )}
          {sinAsignar > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,180,0,0.08)', border:'1px solid rgba(255,180,0,0.3)', borderRadius:2, padding:'5px 12px' }}>
              <User size={12} style={{ color:'#ffb400' }}/>
              <span style={{ fontSize:'0.65rem', color:'#ffb400', fontWeight:600 }}>{sinAsignar} sin taller</span>
            </div>
          )}
          {/* Toggle kanban / por unidad */}
          <div style={{ display:'flex', borderRadius:2, overflow:'hidden', border:'1px solid rgba(57,255,20,0.08)' }}>
            {[
              { id:'kanban', label:'Kanban', icon: LayoutGrid },
              { id:'historial', label:'Por unidad', icon: History },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setViewMode(id)}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', background: viewMode===id ? 'rgba(57,255,20,0.12)' : 'transparent', color: viewMode===id ? '#39FF14' : 'rgba(255,255,255,0.35)', border:'none', cursor:'pointer', fontSize:'0.62rem', fontFamily:'monospace', borderRight: id==='kanban' ? '1px solid rgba(57,255,20,0.07)' : 'none' }}>
                <Icon size={11}/>{label}
              </button>
            ))}
          </div>
          {canWrite && (
            <button onClick={() => setModalTicket('new')} className='btn-primary'>
              <Plus size={13}/> Nuevo ticket
            </button>
          )}
        </div>
      </PageHeader>

      {/* ── FILTROS ─────────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0, flexWrap:'wrap' }}>
        <Filter size={13} style={{ color:'rgba(255,255,255,0.3)' }}/>
        <select style={SEL} value={filterPat} onChange={e=>setFilterPat(e.target.value)}>
          <option value="">Todos los vehículos</option>
          {patentes.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select style={SEL} value={filterPrior} onChange={e=>setFilterPrior(e.target.value)}>
          <option value="">Toda prioridad</option>
          <option value="critica">Crítica</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
        <select style={SEL} value={filterTipo} onChange={e=>setFilterTipo(e.target.value)}>
          <option value="">Correctivo + Preventivo</option>
          <option value="correctivo">Correctivo</option>
          <option value="preventivo">Preventivo</option>
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.65rem', color:'rgba(255,255,255,0.4)', cursor:'pointer' }}>
          <input type="checkbox" checked={filterSLA} onChange={e=>setFilterSLA(e.target.checked)} style={{ accentColor:'#ff5050' }}/>
          Solo SLA vencido
        </label>
        <button onClick={load} style={{ ...SEL, marginLeft:'auto', display:'flex', alignItems:'center', gap:5 }}>
          <RefreshCw size={11}/> Actualizar
        </button>
      </div>

      {/* ── CONTENIDO ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'0.75rem' }}>Cargando flota...</p>
      ) : viewMode === 'kanban' ? (
        <div style={{ flex:1, display:'flex', gap:12, overflowX:'auto', minHeight:0 }}>
          {COLS.map(col => (
            <Column
              key={col.id}
              col={col}
              tickets={filtered.filter(t => t.estado === col.id)}
              onDrop={moveTicket}
              onCardClick={canWrite ? setModalTicket : ()=>{}}
            />
          ))}
        </div>
      ) : (
        <HistorialPorUnidad tickets={tickets} />
      )}
    </div>
  )
}
