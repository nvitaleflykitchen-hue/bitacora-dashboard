import { useState, useEffect, useCallback } from 'react'
import { Download, MessageCircle, Mail, Wrench, FileText } from 'lucide-react'
import { getTickets, createTicket, updateTicket, getActivos, getProveedores, getSedes, TICKET_TIPOS_VALIDOS } from '../../lib/queries'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { fmtFecha, fmtFechaHora } from '../../lib/dateUtils'
import AdjuntosPanel from '../../components/AdjuntosPanel'
import PageHeader from '../../components/PageHeader'
import { uploadAdjunto } from '../../lib/adjuntos'
import ComentariosHilo from '../../components/ComentariosHilo'
import { toast } from '../../lib/feedback'
import { mensajeError } from '../../lib/errores'

import {
  PRIORIDAD_COLOR, TICKET_ESTADO_COLOR as ESTADO_COLOR,
  TICKET_ESTADOS as ESTADOS, PRIORIDADES, SLA_HS,
} from '../../lib/estados'
import SkeletonTable from '../../components/SkeletonTable'
import EmptyState from '../../components/EmptyState'
import usePersistedState from '../../hooks/usePersistedState'
import { generarReporteEficienciaMnt } from '../../lib/mntEficienciaPdf'

function exportTicketsCSV(tickets, responsables) {
  const headers = ['#','Descripción','Activo','Tipo','Prioridad','Estado','Responsable','Sede','Apertura','Fecha límite','Cierre','Días abierto','Costo real']
  const rows = tickets.map(t => {
    const resp = responsables.find(r => r.id === t.responsable_id)
    const dias = t.created_at ? Math.floor((new Date() - new Date(t.created_at)) / 86400000) : ''
    return [
      t.numero || '',
      (t.descripcion || '').replace(/,/g,';'),
      (t.activo_nombre || '').replace(/,/g,';'),
      t.tipo || '',
      t.prioridad || '',
      t.estado || '',
      (resp?.nombre || t.responsable || '').replace(/,/g,';'),
      (t.sede || '').replace(/,/g,';'),
      t.created_at ? new Date(t.created_at).toLocaleDateString('es-AR') : '',
      t.fecha_limite ? new Date(t.fecha_limite).toLocaleDateString('es-AR') : '',
      t.fecha_cierre ? new Date(t.fecha_cierre).toLocaleDateString('es-AR') : '',
      dias,
      t.costo_real || t.costo || '',
    ]
  })
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tickets_mnt_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}



// ─── SLA helpers ─────────────────────────────────────────────────────────────
function slaStatus(ticket) {
  if (!ticket.created_at || ticket.estado === 'resuelto' || ticket.estado === 'rechazado') return null
  const horas = (Date.now() - new Date(ticket.created_at).getTime()) / 3600000
  const limite = SLA_HS[ticket.prioridad] || 48
  const pct = horas / limite
  return pct >= 1 ? 'vencido' : pct >= 0.7 ? 'alerta' : 'ok'
}

function diasAbierto(ticket) {
  if (!ticket.created_at) return null
  const fin = ticket.fecha_cierre ? new Date(ticket.fecha_cierre) : new Date()
  const dias = Math.floor((fin - new Date(ticket.created_at)) / 86400000)
  return dias
}

function SlaDot({ ticket }) {
  const s = slaStatus(ticket)
  if (!s || s === 'ok') return null
  const color = s === 'vencido' ? '#ff5050' : '#ffb400'
  const title = s === 'vencido' ? 'SLA vencido' : 'SLA por vencer'
  return (
    <span title={title} style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: color, boxShadow: `0 0 5px ${color}`, flexShrink: 0, marginRight: 4,
    }} />
  )
}

function Badge({ text, color }) {
  return <span style={{ padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.6rem', fontWeight: 700, background: `${color}22`, color }}>{text}</span>
}

// ─── Historial ────────────────────────────────────────────────────────────────
const HISTORIAL_CAMPO_LABEL = {
  estado: 'Estado del ticket',
  responsable_id: 'Responsable asignado',
  prioridad: 'Prioridad',
  diagnostico: 'Diagnóstico / notas',
  costo: 'Costo',
  presupuesto_estado: 'Estado del presupuesto',
  oc_estado: 'Estado de la orden de compra',
  costo_estimado: 'Costo estimado',
  costo_real: 'Costo real',
}

const HISTORIAL_VALOR_LABEL = {
  sin_presupuesto: 'Sin presupuesto',
  pendiente_aprobacion: 'Pendiente de aprobación',
  sin_oc: 'Sin orden de compra',
  emitida: 'Emitida',
  aprobada: 'Aprobada',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  abierto: 'Abierto',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

const CAMPOS_MONEDA = new Set(['costo', 'presupuesto', 'costo_estimado', 'costo_real'])

function formatHistorialValor(campo, valor) {
  if (valor === null || valor === undefined || valor === '') return null
  if (CAMPOS_MONEDA.has(campo) && !Number.isNaN(Number(valor))) {
    return Number(valor).toLocaleString('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 })
  }
  return HISTORIAL_VALOR_LABEL[valor] || String(valor)
}

function HistorialTab({ ticketId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ticketId) { setLoading(false); return }
    supabase.from('mnt_historial')
      .select('*').eq('ticket_id', ticketId).order('created_at', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [ticketId])

  if (loading) return <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', padding: '1rem 0' }}>Cargando historial...</p>
  if (!items.length) return <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', padding: '1rem 0' }}>Sin cambios registrados aún.</p>

  return (
    <div style={{ marginTop: '0.5rem', maxHeight: 220, overflowY: 'auto' }}>
      {items.map((h, i) => {
        const anterior = formatHistorialValor(h.campo, h.valor_anterior)
        const nuevo = formatHistorialValor(h.campo, h.valor_nuevo) || 'Sin definir'
        return (
        <div key={h.id} style={{ display: 'flex', gap: 10, padding: '0.65rem 0', borderBottom: i < items.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
          <div style={{ width: 6, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(57,255,20,0.5)', flexShrink: 0 }} />
            {i < items.length-1 && <div style={{ width: 1, flex: 1, background: 'rgba(57,255,20,0.1)', marginTop: 3 }} />}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--phosphor)', fontWeight: 600, marginBottom: 4 }}>
              {HISTORIAL_CAMPO_LABEL[h.campo] || h.campo}
            </p>
            <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', marginBottom:3 }}>
              {anterior ? (
                <>
                  <span style={{ fontSize:'0.65rem', color:'var(--text-dim)' }}>Antes: <strong style={{ color:'rgba(255,255,255,0.55)', fontWeight:500 }}>{anterior}</strong></span>
                  <span style={{ color:'rgba(57,255,20,0.45)', fontSize:'0.7rem' }}>→</span>
                  <span style={{ fontSize:'0.65rem', color:'var(--text-dim)' }}>Ahora: <strong style={{ color:'var(--text)', fontWeight:600 }}>{nuevo}</strong></span>
                </>
              ) : (
                <span style={{ fontSize:'0.65rem', color:'var(--text-dim)' }}>Se definió: <strong style={{ color:'var(--text)', fontWeight:600 }}>{nuevo}</strong></span>
              )}
            </div>
            <p style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontFamily: 'var(--font-metric)' }}>
              {h.usuario_nombre || 'Sistema'} · {fmtFechaHora(h.created_at)}
            </p>
          </div>
        </div>
        )
      })}
    </div>
  )
}


// ─── CostosTab ────────────────────────────────────────────────────────────────
const TIPO_COSTO_LABEL = {
  mano_obra: 'Mano de obra', repuesto: 'Repuesto',
  servicio_externo: 'Servicio externo', traslado: 'Traslado', otros: 'Otros',
}
const PRESUP_ESTADO_LABEL = {
  sin_presupuesto: 'Sin presupuesto', pendiente_aprobacion: 'Pendiente aprobación',
  aprobado: 'Aprobado', rechazado: 'Rechazado',
}
const OC_ESTADO_LABEL = {
  sin_oc: 'Sin OC', pendiente: 'Pendiente', emitida: 'Emitida', aprobada: 'Aprobada',
}
const PRESUP_COLOR = { sin_presupuesto:'#6B7280', pendiente_aprobacion:'#f59e0b', aprobado:'#39FF14', rechazado:'#ff5050' }
const OC_COLOR     = { sin_oc:'#6B7280', pendiente:'#f59e0b', emitida:'#50b4ff', aprobada:'#39FF14' }

function CostosTab({ ticket, form, set }) {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [newItem, setNewItem] = useState({ concepto:'', tipo:'mano_obra', cantidad:1, precio_unit:0, proveedor:'' })
  const [saving, setSaving] = useState(false)

  const loadItems = () => {
    if (!ticket?.id) { setLoading(false); return }
    supabase.from('mnt_ticket_costos').select('*')
      .eq('ticket_id', ticket.id).order('created_at')
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }
  useEffect(() => { loadItems() }, [ticket?.id])

  const totalItems = items.reduce((s, i) => s + (i.subtotal || 0), 0)
  const fmt = (n) => n ? `$${Number(n).toLocaleString('es-AR', { minimumFractionDigits:2, maximumFractionDigits:2 })}` : '—'

  const addItem = async () => {
    if (!newItem.concepto) return
    setSaving(true)
    const { error } = await supabase.from('mnt_ticket_costos').insert({
      ticket_id: ticket.id, ...newItem,
      cantidad: Number(newItem.cantidad), precio_unit: Number(newItem.precio_unit),
    })
    if (!error) { setNewItem({ concepto:'', tipo:'mano_obra', cantidad:1, precio_unit:0, proveedor:'' }); loadItems() }
    setSaving(false)
  }

  const removeItem = async (id) => {
    await supabase.from('mnt_ticket_costos').delete().eq('id', id)
    loadItems()
  }

  const INPUT  = { padding:'0.4rem 0.65rem', borderRadius:5, background:'#1a1a22', border:'1px solid rgba(57,255,20,0.08)', color:'var(--text)', fontSize:'0.78rem', fontFamily:'inherit', width:'100%', colorScheme:'dark' }
  const LABEL  = { color:'var(--text-dim)', fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:'0.25rem' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

      {/* Workflow presupuesto/OC */}
      <div style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.06)', borderRadius:3, padding:'12px 14px' }}>
        <p style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', marginBottom:10 }}>WORKFLOW APROBACIÓN</p>

        {/* Toggle externo */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', userSelect:'none' }}>
            <div
              onClick={() => set('es_externo', !form.es_externo)}
              style={{
                width:36, height:20, borderRadius:3, cursor:'pointer', transition:'all 0.2s',
                background: form.es_externo ? 'var(--phosphor)' : 'rgba(57,255,20,0.1)',
                position:'relative', flexShrink:0,
              }}
            >
              <div style={{
                position:'absolute', top:3, left: form.es_externo ? 18 : 3,
                width:14, height:14, borderRadius:'50%', background:'white', transition:'left 0.2s',
              }} />
            </div>
            <span style={{ fontSize:'0.75rem', color: form.es_externo ? 'var(--phosphor)' : 'var(--text-dim)' }}>
              {form.es_externo ? 'Servicio Externo' : 'Servicio Interno'}
            </span>
          </label>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem' }}>
          {/* Presupuesto estado */}
          <div>
            <label style={LABEL}>Estado presupuesto</label>
            <select value={form.presupuesto_estado || 'sin_presupuesto'} onChange={e=>set('presupuesto_estado', e.target.value)} style={INPUT}>
              {Object.entries(PRESUP_ESTADO_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:5 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background: PRESUP_COLOR[form.presupuesto_estado] || '#6B7280', boxShadow:`0 0 4px ${PRESUP_COLOR[form.presupuesto_estado] || '#6B7280'}` }} />
              <span style={{ fontSize:'0.6rem', color: PRESUP_COLOR[form.presupuesto_estado] || '#6B7280' }}>
                {PRESUP_ESTADO_LABEL[form.presupuesto_estado] || '—'}
              </span>
            </div>
          </div>

          {/* OC */}
          <div>
            <label style={LABEL}>Estado Orden de Compra</label>
            <select value={form.oc_estado || 'sin_oc'} onChange={e=>set('oc_estado', e.target.value)} style={INPUT}>
              {Object.entries(OC_ESTADO_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:5 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background: OC_COLOR[form.oc_estado] || '#6B7280', boxShadow:`0 0 4px ${OC_COLOR[form.oc_estado] || '#6B7280'}` }} />
              <span style={{ fontSize:'0.6rem', color: OC_COLOR[form.oc_estado] || '#6B7280' }}>
                {OC_ESTADO_LABEL[form.oc_estado] || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* N° OC + Costo estimado */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem', marginTop:10 }}>
          <div>
            <label style={LABEL}>N° Orden de Compra</label>
            <input value={form.oc_numero || ''} onChange={e=>set('oc_numero', e.target.value)} style={INPUT} placeholder="OC-0001" />
          </div>
          <div>
            <label style={LABEL}>Costo estimado ($)</label>
            <input type="number" value={form.costo_estimado || ''} onChange={e=>set('costo_estimado', e.target.value ? +e.target.value : null)} style={INPUT} placeholder="0.00" />
          </div>
        </div>
      </div>

      {/* Ítems de costo */}
      {ticket?.id && (
        <div style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.06)', borderRadius:3, padding:'12px 14px' }}>
          <p style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', marginBottom:10 }}>ÍTEMS DE COSTO</p>

          {loading ? (
            <p style={{ fontSize:'0.7rem', color:'var(--text-dim)' }}>Cargando...</p>
          ) : (
            <>
              {items.length > 0 && (
                <div style={{ marginBottom:10 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px 90px 28px', gap:'0 6px', marginBottom:4 }}>
                    {['Concepto','Tipo','Cant × P.Unit','Subtotal',''].map((h,i) => (
                      <span key={i} style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.07em', textTransform:'uppercase' }}>{h}</span>
                    ))}
                  </div>
                  {items.map(item => (
                    <div key={item.id} style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px 90px 28px', gap:'0 6px', alignItems:'center', padding:'4px 0', borderTop:'1px solid rgba(255,255,255,0.03)' }}>
                      <div>
                        <p style={{ fontSize:'0.72rem', color:'var(--text)' }}>{item.concepto}</p>
                        {item.proveedor && <p style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>{item.proveedor}</p>}
                      </div>
                      <span style={{ fontSize:'0.65rem', color:'var(--text-dim)' }}>{TIPO_COSTO_LABEL[item.tipo] || item.tipo}</span>
                      <span style={{ fontSize:'0.65rem', color:'var(--text-dim)', fontFamily:'monospace' }}>{item.cantidad} × ${Number(item.precio_unit).toLocaleString('es-AR')}</span>
                      <span style={{ fontSize:'0.72rem', color:'var(--phosphor)', fontFamily:'monospace' }}>{fmt(item.subtotal)}</span>
                      <button onClick={() => removeItem(item.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ff5050', fontSize:'0.8rem', padding:0 }}>×</button>
                    </div>
                  ))}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px 90px 28px', gap:'0 6px', borderTop:'1px solid rgba(57,255,20,0.15)', paddingTop:6, marginTop:4 }}>
                    <span style={{ fontSize:'0.65rem', color:'var(--text-dim)', fontFamily:'monospace', gridColumn:'1/4' }}>TOTAL ÍTEMS</span>
                    <span style={{ fontSize:'0.8rem', fontWeight:700, color:'var(--phosphor)', fontFamily:'monospace' }}>{fmt(totalItems)}</span>
                  </div>
                </div>
              )}

              {/* Agregar ítem */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 80px 90px 80px auto', gap:'0 6px', alignItems:'flex-end' }}>
                <div>
                  <label style={LABEL}>Concepto *</label>
                  <input required value={newItem.concepto} onChange={e=>setNewItem(n=>({...n,concepto:e.target.value}))} style={INPUT} placeholder="Ej: Reparación motor" />
                </div>
                <div>
                  <label style={LABEL}>Tipo</label>
                  <select value={newItem.tipo} onChange={e=>setNewItem(n=>({...n,tipo:e.target.value}))} style={INPUT}>
                    {Object.entries(TIPO_COSTO_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LABEL}>Cantidad</label>
                  <input type="number" min="0.001" step="0.001" value={newItem.cantidad} onChange={e=>setNewItem(n=>({...n,cantidad:e.target.value}))} style={INPUT} placeholder="Ej: 1" />
                </div>
                <div>
                  <label style={LABEL}>P. Unitario</label>
                  <input type="number" min="0" step="0.01" value={newItem.precio_unit} onChange={e=>setNewItem(n=>({...n,precio_unit:e.target.value}))} style={INPUT} placeholder="0.00" />
                </div>
                <div>
                  <label style={LABEL}>Proveedor</label>
                  <input value={newItem.proveedor} onChange={e=>setNewItem(n=>({...n,proveedor:e.target.value}))} style={INPUT} placeholder="Opcional" />
                </div>
                <button onClick={addItem} disabled={!newItem.concepto || saving}
                  style={{ padding:'0.4rem 0.7rem', borderRadius:5, background:'rgba(57,255,20,0.12)', border:'1px solid var(--phosphor)', color:'var(--phosphor)', cursor: newItem.concepto ? 'pointer' : 'not-allowed', fontSize:'0.7rem', fontWeight:700, whiteSpace:'nowrap' }}>
                  + Add
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Costo real + notas */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem' }}>
        <div>
          <label style={LABEL}>Costo real ($)</label>
          <input type="number" value={form.costo_real || ''} onChange={e=>set('costo_real', e.target.value ? +e.target.value : null)} style={INPUT} placeholder="0.00" />
          {totalItems > 0 && (
            <button onClick={() => set('costo_real', totalItems)}
              style={{ marginTop:4, background:'none', border:'none', cursor:'pointer', fontSize:'0.6rem', color:'var(--phosphor)', padding:0 }}>
              ↑ Usar total ítems ({fmt(totalItems)})
            </button>
          )}
        </div>
        <div>
          <label style={LABEL}>Notas de costos</label>
          <textarea value={form.notas_costos || ''} onChange={e=>set('notas_costos', e.target.value)} rows={3} style={{...INPUT, resize:'vertical'}} placeholder="Ej: Presupuesto aprobado por gerencia el 10/06" />
        </div>
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
const TIPO_LABEL      = { correctivo:'Correctivo', preventivo:'Preventivo' }
const ACTIVO_TIPO_COLOR = { VEHICULO:'#50b4ff', EQUIPO:'#ffb400', INSTALACION:'#c084fc' }

// Comparte el ticket con el responsable asignado por WhatsApp o Email,
// igual que "Compartir requerimiento" en Compras (Requerimientos.jsx).
function shareTicket(ticket, responsable, channel) {
  const numero = ticket.numero || ticket.id || 'nuevo'
  const sede = ticket.sede || ticket.sede_nombre || 'Sin sede'
  const cuerpo = [
    `Hola ${responsable.nombre || ''},`,
    '',
    `Se te asignó el Ticket de Mantenimiento #${numero}:`,
    '',
    `Descripción: ${ticket.descripcion || '—'}`,
    ticket.activo_nombre ? `Activo: ${ticket.activo_nombre}` : null,
    `Sede: ${sede}`,
    `Tipo: ${TIPO_LABEL[ticket.tipo] || ticket.tipo || '—'}`,
    `Prioridad: ${(ticket.prioridad || '—').toUpperCase()}`,
    ticket.fecha_limite ? `Fecha límite: ${fmtFecha(ticket.fecha_limite)}` : null,
    '',
    'Fly Kitchen — Kitchen-OS',
  ].filter(Boolean).join('\n')

  if (channel === 'whatsapp') {
    if (!responsable.telefono) { toast.warn('El responsable no tiene teléfono registrado.'); return }
    const phone = responsable.telefono.replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(cuerpo)}`, '_blank', 'noopener,noreferrer')
    return
  }
  if (!responsable.email) { toast.warn('El responsable no tiene email registrado.'); return }
  const subject = encodeURIComponent(`[Ticket #${numero}] ${(ticket.descripcion || '').substring(0, 50)}`)
  window.open(`mailto:${responsable.email}?subject=${subject}&body=${encodeURIComponent(cuerpo)}`, '_blank')
}

function toDateInput(val) {
  if (!val) return ''
  return new Date(val).toISOString().split('T')[0]
}

export function TicketModal({ ticket, activos, proveedores, responsables, sedes, onClose, onSaved, readOnly = false }) {
  const { perfil } = useAuth()
  const isNew = !ticket?.id
  const [form, setForm] = useState(() => ({
    tipo: 'correctivo', estado: 'abierto', prioridad: 'media', descripcion: '',
    fecha_apertura: new Date().toISOString().split('T')[0],
    es_externo: false, presupuesto_estado: 'sin_presupuesto',
    oc_estado: 'sin_oc', oc_numero: '', costo_estimado: null, costo_real: null, notas_costos: '',
    ...ticket
  }))
  const [tab, setTab]       = useState('datos')
  const [saving, setSaving] = useState(false)
  const [archivos, setArchivos] = useState([])
  const [err, setErr]       = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Si el usuario solo tiene una sede asignada (ej: encargado), el ticket nuevo
  // queda con esa sede preseleccionada en vez de "Sin sede".
  useEffect(() => {
    if (isNew && !form.sede_id && sedes?.length === 1) {
      setForm(f => ({ ...f, sede_id: sedes[0].id, sede: sedes[0].nombre }))
    }
  }, [sedes])

  const activoObj   = activos.find(a => a.id === form.activo_id)
  const activoTipo  = activoObj?.tipo?.toUpperCase() || null
  const esVehiculo  = activoTipo === 'VEHICULO'
  const tiposDisp   = TICKET_TIPOS_VALIDOS
  const tipoValido  = tiposDisp.includes(form.tipo)
  const tipoColor   = ACTIVO_TIPO_COLOR[activoTipo] || 'rgba(255,255,255,0.3)'
  const selectedResponsable = (responsables||[]).find(r => r.id === form.responsable_id) || null

  const handleSave = async () => {
    if (readOnly) return
    if (!form.descripcion) { setErr('La descripción es obligatoria'); return }
    setSaving(true); setErr(null)
    try {
      const activo = activos.find(a => a.id === form.activo_id)
      const payload = {
        ...form,
        tipo: tipoValido ? form.tipo : tiposDisp[0],
        activo_nombre: activo?.nombre || form.activo_nombre || '',
        creado_por: perfil?.id || null,
        fecha_limite: form.fecha_limite || null,
        fecha_cierre: form.estado === 'resuelto' && !form.fecha_cierre
          ? new Date().toISOString().split('T')[0]
          : (form.fecha_cierre || null),
      }
      delete payload.fecha_apertura

      if (isNew) {
        const created = await createTicket(payload)
        if (archivos.length > 0) {
          await Promise.all(archivos.map(f => uploadAdjunto('ticket', created.id, f)))
        }
      } else {
        const cambios = []
        for (const campo of ['estado','prioridad','responsable_id','diagnostico','costo','presupuesto_estado','oc_estado','costo_real','costo_estimado']) {
          const anterior = String(ticket[campo] ?? '')
          const nuevo    = String(form[campo] ?? '')
          if (anterior !== nuevo) cambios.push({ ticket_id: form.id, campo, valor_anterior: anterior || null, valor_nuevo: nuevo, usuario_nombre: perfil?.nombre || perfil?.email || 'Usuario' })
        }
        await updateTicket(form.id, payload)
        if (cambios.length) await supabase.from('mnt_historial').insert(cambios)
      }
      onSaved()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const INPUT = { width:'100%', padding:'0.6rem 0.9rem', borderRadius:2, background:'#1a1a22', border:'1px solid rgba(57,255,20,0.1)', color:'var(--text)', fontSize:'0.82rem', fontFamily:'inherit', boxSizing:'border-box', colorScheme:'dark' }
  const LABEL = { color:'var(--text-dim)', fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }
  const ROW   = { marginBottom:'0.85rem' }
  const TAB   = (active) => ({ padding:'0.35rem 0.8rem', borderRadius:4, border:'none', cursor:'pointer', fontSize:'0.68rem', fontWeight:600, fontFamily:'inherit', background: active ? 'rgba(57,255,20,0.12)' : 'transparent', color: active ? 'var(--phosphor)' : 'var(--text-dim)' })

  const sla  = !isNew ? slaStatus(form) : null
  const dias = !isNew ? diasAbierto(ticket) : null

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
      <div style={{ background:'var(--surface)', borderRadius:3, padding:'1.5rem', width:'100%', maxWidth:600, maxHeight:'92vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <h2 style={{ color:'var(--text)', fontWeight:700, fontSize:'1.1rem' }}>
                {isNew ? 'Nuevo Ticket' : `Ticket #${ticket.numero}`}
              </h2>
              {activoTipo && (
                <span style={{ fontSize:'0.6rem', padding:'2px 8px', borderRadius:3, fontWeight:700, background:`${tipoColor}18`, color:tipoColor, border:`1px solid ${tipoColor}33`, fontFamily:'monospace' }}>
                  {activoTipo}
                </span>
              )}
            </div>
            {!isNew && (
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                {sla === 'vencido' && <span style={{ fontSize:'0.62rem', color:'#ff5050', background:'rgba(255,80,80,0.1)', border:'1px solid rgba(255,80,80,0.3)', borderRadius:4, padding:'1px 8px' }}>⚠ SLA VENCIDO</span>}
                {sla === 'alerta'  && <span style={{ fontSize:'0.62rem', color:'#ffb400', background:'rgba(255,180,0,0.1)', border:'1px solid rgba(255,180,0,0.3)', borderRadius:4, padding:'1px 8px' }}>⚠ SLA ALERTA</span>}
                {dias !== null && <span style={{ fontSize:'0.62rem', color:'var(--text-dim)', fontFamily:'monospace' }}>{dias} día{dias !== 1 ? 's' : ''} abierto</span>}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'1.2rem', lineHeight:1 }}>✕</button>
        </div>

        {/* Tabs */}
        {!isNew && (
          <div style={{ display:'flex', gap:4, marginBottom:'1.25rem', borderBottom:'1px solid rgba(57,255,20,0.05)', paddingBottom:'0.5rem' }}>
            <button style={TAB(tab==='datos')}    onClick={()=>setTab('datos')}>Datos</button>
            <button style={TAB(tab==='historial')} onClick={()=>setTab('historial')}>Historial</button>
            {!readOnly && <button style={TAB(tab==='costos')} onClick={()=>setTab('costos')}>Costos / OC</button>}
            <button style={TAB(tab==='adjuntos')} onClick={()=>setTab('adjuntos')}>Adjuntos</button>
            <button style={TAB(tab==='comentarios')} onClick={()=>setTab('comentarios')}>Comentarios</button>
          </div>
        )}

        {tab === 'datos' && (
          <fieldset disabled={readOnly} style={{ border:0, margin:0, padding:0, minWidth:0 }}>
            {/* Tipo + Prioridad */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem' }}>
              <div style={ROW}>
                <label style={LABEL}>Tipo de trabajo</label>
                <select value={tipoValido ? form.tipo : tiposDisp[0]} onChange={e=>set('tipo',e.target.value)} style={INPUT}>
                  {tiposDisp.map(t=><option key={t} value={t}>{TIPO_LABEL[t]||t}</option>)}
                </select>
              </div>
              <div style={ROW}>
                <label style={LABEL}>Prioridad</label>
                <select value={form.prioridad} onChange={e=>set('prioridad',e.target.value)} style={INPUT}>
                  {PRIORIDADES.map(p=><option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                </select>
              </div>
            </div>

            {/* Descripción */}
            <div style={ROW}>
              <label style={LABEL}>Descripción *</label>
              <textarea required value={form.descripcion} onChange={e=>set('descripcion',e.target.value)} rows={3} style={{...INPUT, resize:'vertical'}} placeholder="Ej: Pierde aceite en compresor principal" />
            </div>

            {/* Activo + Proveedor */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem' }}>
              <div style={ROW}>
                <label style={LABEL}>{esVehiculo ? 'Vehículo' : 'Activo / Equipo'}</label>
                <select value={form.activo_id||''} onChange={e=>set('activo_id',e.target.value||null)} style={INPUT}>
                  <option value="">Sin activo</option>
                  {activos.map(a=><option key={a.id} value={a.id}>{a.nombre}{a.codigo_interno?` (${a.codigo_interno})`:''}</option>)}
                </select>
              </div>
              <div style={ROW}>
                <label style={LABEL}>{esVehiculo ? 'Taller / Mecánico' : 'Proveedor / Taller'}</label>
                <select value={form.proveedor_id||''} onChange={e=>set('proveedor_id',e.target.value||null)} style={INPUT}>
                  <option value="">Sin proveedor</option>
                  {proveedores.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
            </div>

            {/* Sede + Responsable */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem' }}>
              <div style={ROW}>
                <label style={LABEL}>Sede</label>
                <select
                  value={form.sede_id||''}
                  onChange={e => {
                     const s = (sedes||[]).find(x => x.id === Number(e.target.value))
                     set('sede_id', s ? s.id : null)
                     set('sede', s ? s.nombre : '')
                   }}
                  style={INPUT}
                >
                  <option value="">Sin sede</option>
                  {(sedes||[]).map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div style={ROW}>
                <label style={LABEL}>Responsable Asignado</label>
                <select value={form.responsable_id||''} onChange={e=>set('responsable_id',e.target.value||null)} style={INPUT}>
                  <option value="">Sin asignar</option>
                  {(responsables||[]).map(r=><option key={r.id} value={r.id}>{r.nombre}{r.rol?` — ${r.rol}`:''}</option>)}
                </select>
                {selectedResponsable && (
                  <div style={{ display:'flex', gap:6, marginTop:6 }}>
                    <button type="button" title="Compartir por WhatsApp"
                      onClick={() => shareTicket({ ...ticket, ...form }, selectedResponsable, 'whatsapp')}
                      style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(37,211,102,0.12)', border:'1px solid rgba(37,211,102,0.3)', color:'#25D366', borderRadius:3, padding:'0.3rem 0.6rem', fontSize:'0.65rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                      <MessageCircle size={12} /> WhatsApp
                    </button>
                    <button type="button" title="Compartir por Email"
                      onClick={() => shareTicket({ ...ticket, ...form }, selectedResponsable, 'email')}
                      style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(99,179,237,0.1)', border:'1px solid rgba(99,179,237,0.25)', color:'#63B3ED', borderRadius:3, padding:'0.3rem 0.6rem', fontSize:'0.65rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                      <Mail size={12} /> Email
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* FECHAS */}
            <div style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.06)', borderRadius:3, padding:'10px 14px', marginBottom:'0.85rem' }}>
              <p style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', marginBottom:10 }}>FECHAS</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0 1rem' }}>
                <div>
                  <label style={LABEL}>Apertura</label>
                  <input type="date" value={isNew ? form.fecha_apertura : toDateInput(ticket.created_at)}
                    onChange={e => isNew && set('fecha_apertura', e.target.value)}
                    readOnly={!isNew} style={{...INPUT, opacity:isNew?1:0.6, cursor:isNew?'pointer':'default'}} />
                </div>
                <div>
                  <label style={LABEL}>Fecha límite</label>
                  <input type="date" value={toDateInput(form.fecha_limite)}
                    onChange={e=>set('fecha_limite', e.target.value||null)} style={INPUT} />
                </div>
                <div>
                  <label style={LABEL}>Fecha cierre</label>
                  <input type="date" value={toDateInput(form.fecha_cierre)}
                    onChange={e=>set('fecha_cierre', e.target.value||null)} style={INPUT} />
                </div>
              </div>
            </div>

            {/* Diagnóstico */}
            <div style={ROW}>
              <label style={LABEL}>Diagnóstico / Notas</label>
              <textarea value={form.diagnostico||''} onChange={e=>set('diagnostico',e.target.value)} rows={2} style={{...INPUT, resize:'vertical'}} placeholder="Ej: Se cambió rodamiento del motor, quedó operativo" />
            </div>

            {/* Costos + KM (km solo para vehículos) */}
            <div style={{ display:'grid', gridTemplateColumns: esVehiculo ? '1fr 1fr 1fr' : '1fr 1fr', gap:'0 1rem' }}>
              <div style={ROW}>
                <label style={LABEL}>Costo real ($)</label>
                <input type="number" value={form.costo||''} onChange={e=>set('costo',e.target.value?+e.target.value:null)} style={INPUT} placeholder="0" />
              </div>
              <div style={ROW}>
                <label style={LABEL}>Presupuesto ($)</label>
                <input type="number" value={form.presupuesto||''} onChange={e=>set('presupuesto',e.target.value?+e.target.value:null)} style={INPUT} placeholder="0" />
              </div>
              {esVehiculo && (
                <div style={ROW}>
                  <label style={{...LABEL, color:'#50b4ff'}}>Km lectura 🚗</label>
                  <input type="number" value={form.lectura_km||''} onChange={e=>set('lectura_km',e.target.value?+e.target.value:null)} style={{...INPUT, border:'1px solid rgba(80,180,255,0.35)'}} placeholder="Ej: 45000" />
                </div>
              )}
            </div>

            {/* Estado (solo edición) */}
            {!isNew && (
              <div style={ROW}>
                <label style={LABEL}>Estado</label>
                <select value={form.estado} onChange={e=>set('estado',e.target.value)} style={INPUT}>
                  {ESTADOS.map(s=><option key={s} value={s}>{s.replace('_',' ').charAt(0).toUpperCase()+s.replace('_',' ').slice(1)}</option>)}
                </select>
              </div>
            )}

            {/* Evidencias — solo al crear */}
            {isNew && (
              <div style={ROW}>
                <label style={LABEL}>Evidencias (Fotos/Archivos)</label>
                <input type="file" multiple className="input-dark" style={{ padding:'0.4rem' }}
                  onChange={e => setArchivos(Array.from(e.target.files || []))} />
              </div>
            )}
          </fieldset>
        )}

        {tab === 'historial' && <HistorialTab ticketId={ticket?.id} />}
        {tab === 'costos' && <CostosTab ticket={ticket} form={form} set={set} />}
        {tab === 'adjuntos' && ticket?.id && (
          <AdjuntosPanel entityType="ticket" entityId={ticket.id} readOnly={readOnly} />
        )}
        {tab === 'adjuntos' && !ticket?.id && (
          <p style={{ color:'var(--text-dim)', fontSize:'0.75rem', padding:'1rem 0' }}>Guardá el ticket primero para adjuntar archivos.</p>
        )}
        {tab === 'comentarios' && ticket?.id && (
          <ComentariosHilo entidadTipo="ticket" entidadId={ticket.id} />
        )}
        {tab === 'comentarios' && !ticket?.id && (
          <p style={{ color:'var(--text-dim)', fontSize:'0.75rem', padding:'1rem 0' }}>Guardá el ticket primero para comentar.</p>
        )}

        {err && <p style={{ color:'var(--alert)', fontSize:'0.8rem', marginBottom:'1rem' }}>{err}</p>}

        {(tab === 'datos' || tab === 'costos') && (
          <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end', marginTop:'0.5rem' }}>
            <button onClick={onClose} style={{ padding:'0.65rem 1.2rem', borderRadius:2, background:'rgba(57,255,20,0.05)', color:'var(--text-dim)', border:'none', cursor:'pointer', fontWeight:600 }}>
              {readOnly ? 'Cerrar' : 'Cancelar'}
            </button>
            {!readOnly && <button onClick={handleSave} disabled={saving}
              style={{ padding:'0.65rem 1.4rem', borderRadius:2, background: saving ? 'rgba(57,255,20,0.4)' : 'var(--phosphor)', color:'#0A0A0E', border:'none', cursor: saving ? 'not-allowed' : 'pointer', fontWeight:700 }}>
              {saving ? 'Guardando...' : (isNew ? 'Crear Ticket' : 'Guardar')}
            </button>}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Vista principal ──────────────────────────────────────────────────────────
export default function MntTickets({ focusId }) {
  const [tickets, setTickets]           = useState([])
  const [activos, setActivos]           = useState([])
  const [proveedores, setProveedores]   = useState([])
  const [responsables, setResponsables] = useState([])
  const [loading, setLoading]           = useState(true)
  const [modalTicket, setModalTicket]   = useState(null)
  const [filtroEstado, setFiltroEstado] = usePersistedState('mntTickets.filtroEstado', 'todos')
  const [filtroTipo, setFiltroTipo]     = usePersistedState('mntTickets.filtroTipo', 'todos')
  const [filtroSLA, setFiltroSLA]       = usePersistedState('mntTickets.filtroSLA', false)
  const { allowedSedeIds, can } = useAuth()
  const canManage = can('mantenimiento', 'manage')
  const canReport = canManage || can('mantenimiento', 'report')
  const [sedeId, setSedeId]             = usePersistedState('mntTickets.sedeId', '')
  const [sedes, setSedes]               = useState([])
  const [visibles, setVisibles]         = useState(100)

  const load = useCallback(() => {
    setLoading(true)
    const tfiltros = sedeId ? { sede_id: Number(sedeId) } : {}
    Promise.all([
      getTickets({ ...tfiltros, sedeIds: allowedSedeIds || undefined }), getActivos(sedeId ? { sede_id: Number(sedeId) } : {}), getProveedores(),
      supabase.from('mnt_responsables').select('id,nombre,rol,telefono,email').eq('activo',true).order('nombre')
    ])
      .then(([t, a, p, r]) => {
      const tFilt = (allowedSedeIds !== null && !sedeId)
        ? t.filter(tk => allowedSedeIds.includes(tk.sede_id))
        : t
      const tNoVeh = tFilt.filter(tk => tk.categoria !== 'Vehiculos')
      setTickets(tNoVeh); setActivos(a); setProveedores(p); setResponsables(r.data||[])

      // Deep-link desde notificación
      const dl = window.__pendingDeepLink
      if (dl?.tipo === 'ticket' && dl?.id) {
        const target = tNoVeh.find(tk => String(tk.id) === String(dl.id))
        if (target) setModalTicket(target)
        delete window.__pendingDeepLink
      }
    })
      .finally(() => setLoading(false))
  }, [sedeId, allowedSedeIds])

  useEffect(() => { load() }, [load])

  // Escucha deep-links en tiempo real (cuando el componente ya está montado)
  useEffect(() => {
    const handleDeepLink = (e) => {
      const { tipo, id } = e.detail || {}
      if (tipo !== 'ticket' || !id) return
      const target = tickets.find(tk => String(tk.id) === String(id))
      if (target) {
        setModalTicket(target)
        delete window.__pendingDeepLink
      }
    }
    window.addEventListener('bitacora:deeplink', handleDeepLink)
    return () => window.removeEventListener('bitacora:deeplink', handleDeepLink)
  }, [tickets])

  useEffect(() => {
    if (!focusId || loading) return
    const target = tickets.find(ticket => String(ticket.id) === String(focusId))
    if (target) setModalTicket(target)
  }, [focusId, loading, tickets])
  useEffect(() => {
    getSedes(allowedSedeIds).then(all => {
      const filtered = allowedSedeIds === null
        ? all
        : all.filter(s => allowedSedeIds.includes(s.id))
      setSedes(filtered)
      // Roles territoriales arrancan con su primera sede asignada
      if (allowedSedeIds !== null && filtered.length > 0 && !sedeId)
        setSedeId(String(filtered[0].id))
    })
  }, [allowedSedeIds])

  let filtrados = tickets
    .filter(t => filtroEstado === 'todos' || t.estado === filtroEstado)
    .filter(t => filtroTipo   === 'todos' || t.tipo   === filtroTipo)
  if (filtroSLA) filtrados = filtrados.filter(t => slaStatus(t) === 'vencido')
  const totalFiltrados = filtrados.length
  const hayMas = totalFiltrados > visibles
  filtrados = filtrados.slice(0, visibles)

  useEffect(() => { setVisibles(100) }, [filtroEstado, filtroTipo, filtroSLA, sedeId])

  const vencidos   = tickets.filter(t => slaStatus(t) === 'vencido').length
  const sinAsignar = tickets.filter(t => !t.responsable_id && t.estado !== 'resuelto' && t.estado !== 'rechazado').length

  const SEL = (active) => ({
    padding: '0.3rem 0.75rem', borderRadius:3, fontSize: '0.65rem', fontWeight: 600,
    border: 'none', cursor: 'pointer',
    background: active ? 'rgba(249,115,22,0.15)' : 'var(--surface)',
    color: active ? '#F97316' : 'var(--text-dim)',
  })

  return (
    <div style={{ padding: '1.5rem 2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <PageHeader title="Tickets de Mantenimiento" subtitle="ISO 9001 cl. 10.2 · gestión de no conformidades">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {vencidos > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', borderRadius:2, padding: '4px 10px' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff5050', display: 'inline-block', boxShadow: '0 0 5px #ff5050' }} />
              <span style={{ fontSize: '0.65rem', color: '#ff5050', fontWeight: 600 }}>{vencidos} SLA vencido{vencidos !== 1 ? 's' : ''}</span>
            </div>
          )}
          {sinAsignar > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.3)', borderRadius:2, padding: '4px 10px' }}>
              <span style={{ fontSize: '0.65rem', color: '#ffb400', fontWeight: 600 }}>{sinAsignar} sin asignar</span>
            </div>
          )}
          <select value={sedeId} onChange={e=>setSedeId(e.target.value)}
            style={{ background:'#1a1a2e', border:'1px solid rgba(57,255,20,0.15)', color:'#e2e8f0', borderRadius:2, padding:'0.4rem 0.75rem', fontSize:'0.72rem', fontFamily:'inherit', cursor:'pointer' }}>
            <option value=''>Todas las sedes</option>
            {sedes.map(s=><option key={s.id} value={s.id} style={{ background:'#1a1a2e' }}>{s.nombre}</option>)}
          </select>
          <button onClick={() => exportTicketsCSV(filtrados, responsables)}
            title="Exportar CSV"
            style={{ background:'transparent', border:'1px solid rgba(57,255,20,0.3)', borderRadius:3, padding:'0.5rem 0.65rem', cursor:'pointer', color:'var(--phosphor)', display:'flex', alignItems:'center', gap:4 }}>
            <Download size={14} />
          </button>
          <button
            title={sedeId ? 'Reporte de eficiencia PDF de la sede seleccionada' : 'Reporte de eficiencia PDF general (todas las sedes)'}
            onClick={async () => {
              try {
                toast('Generando reporte de eficiencia...')
                await generarReporteEficienciaMnt({
                  sedeId: sedeId || null,
                  sedeNombre: sedeId ? sedes.find(s => String(s.id) === String(sedeId))?.nombre : null,
                })
                toast.ok('Reporte PDF descargado.')
              } catch (e) { toast.error('No se pudo generar el reporte: ' + mensajeError(e)) }
            }}
            style={{ background:'transparent', border:'1px solid rgba(57,255,20,0.3)', borderRadius:3, padding:'0.5rem 0.65rem', cursor:'pointer', color:'var(--phosphor)', display:'flex', alignItems:'center', gap:4, fontSize:'0.68rem' }}>
            <FileText size={14} /> Eficiencia PDF
          </button>
          {canReport && <button onClick={() => setModalTicket({})}
            style={{ background: 'var(--phosphor)', color: '#0A0A0E', border: 'none', borderRadius:3, padding: '0.55rem 1.1rem', fontWeight: 700, cursor: 'pointer' }}>
            + Nuevo Ticket
          </button>}
        </div>
      </PageHeader>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        {['todos', ...ESTADOS].map(s => (
          <button key={s} onClick={() => setFiltroEstado(s)} style={SEL(filtroEstado === s)}>
            {s === 'todos' ? 'Todos' : s.replace('_',' ')}
          </button>
        ))}
        <span style={{ borderLeft: '1px solid rgba(57,255,20,0.08)', margin: '0 0.25rem', height: 16 }} />
        {['todos','correctivo','preventivo'].map(s => (
          <button key={s} onClick={() => setFiltroTipo(s)} style={SEL(filtroTipo === s)}>
            {s === 'todos' ? 'Ambos tipos' : s}
          </button>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.65rem', color: 'var(--text-dim)', cursor: 'pointer', marginLeft: 4 }}>
          <input type="checkbox" checked={filtroSLA} onChange={e => setFiltroSLA(e.target.checked)} style={{ accentColor: '#ff5050' }} />
          Solo SLA vencido
        </label>
      </div>

      {/* Tabla */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--surface)', borderRadius:3 }}>
        {loading ? (
          <SkeletonTable filas={8} columnas={6} />
        ) : filtrados.length === 0 ? (
          <EmptyState icono={Wrench} titulo="Sin tickets"
            detalle="No hay tickets que coincidan con los filtros actuales. Probá ajustarlos o creá uno nuevo." />
        ) : <>
        {filtrados.map((t, i) => {
          const dias = diasAbierto(t)
          return (
            <div key={t.id} onClick={() => setModalTicket(t)}
              style={{
                display: 'grid', gridTemplateColumns: '24px 40px 1fr 130px 90px 90px 75px 65px',
                alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.1rem',
                borderBottom: i < filtrados.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                cursor: 'pointer', transition: 'background 0.1s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

              {/* SLA dot */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <SlaDot ticket={t} />
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem', fontFamily: 'var(--font-metric)' }}>#{t.numero}</p>
              <div>
                <p style={{ color: 'var(--text)', fontSize: '0.85rem', fontWeight: 500 }}>{t.descripcion}</p>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem' }}>{t.activos?.nombre || t.activo_nombre || '—'}</p>
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {responsables.find(r => r.id === t.responsable_id)?.nombre || t.responsable || '—'}
              </p>
              <Badge text={t.tipo} color={t.tipo === 'correctivo' ? '#F97316' : '#3B82F6'} />
              <Badge text={t.estado} color={ESTADO_COLOR[t.estado] || '#555'} />
              <Badge text={t.prioridad} color={PRIORIDAD_COLOR[t.prioridad] || '#555'} />
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.65rem', fontFamily: 'var(--font-metric)' }}>{fmtFecha(t.fecha_creacion || t.created_at)}</p>
                {dias !== null && (
                  <p style={{ fontSize: '0.6rem', color: dias > 7 ? '#ff5050' : 'var(--text-dim)', fontFamily: 'var(--font-metric)' }}>{dias}d</p>
                )}
              </div>
            </div>
          )
        })}
        {hayMas && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0.9rem' }}>
            <button onClick={() => setVisibles(v => v + 100)} className="btn-ghost"
              style={{ fontSize: '0.7rem', padding: '0.4rem 1rem' }}>
              Mostrar 100 más ({totalFiltrados - visibles} restantes)
            </button>
          </div>
        )}
        </>}
      </div>

      {modalTicket !== null && (
        <TicketModal
          ticket={modalTicket?.id ? modalTicket : null}
          activos={activos}
          proveedores={proveedores}
          responsables={responsables}
          sedes={sedes}
          readOnly={Boolean(modalTicket?.id) && !canManage}
          onClose={() => setModalTicket(null)}
          onSaved={() => { setModalTicket(null); load() }}
        />
      )}
    </div>
  )
}
