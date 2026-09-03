import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtFecha } from '../../lib/dateUtils'
import { useAuth } from '../../lib/auth'
import { getActivos, upsertActivo, getSedes, getTicketsActivo, getProveedores } from '../../lib/queries'
import AdjuntosPanel from '../../components/AdjuntosPanel'
import PageHeader from '../../components/PageHeader'
import { isQualityOnlyProfile } from '../../lib/access'
import { Mail, MessageCircle, Phone, ScanLine } from 'lucide-react'
import { normalizeQrLabel } from '../../lib/qrLabel'
import AssetQrScannerModal from '../../components/AssetQrScannerModal'
import { findScannedAsset } from '../../lib/assetQrScan'

const TIPO_COLOR  = { VEHICULO:'#3B82F6', EQUIPO:'#F59E0B', INSTALACION:'#8B5CF6' }
import { ACTIVO_ESTADO_COLOR as ESTADO_COLOR } from '../../lib/estados'
const INPUT_S = { width:'100%', padding:'0.4rem 0.75rem', borderRadius:2, background:'var(--surface)', border:'1px solid rgba(107,114,128,0.3)', color:'var(--text)', fontSize:'0.875rem', fontFamily:'Inter,sans-serif', boxSizing:'border-box', outline:'none' }
const LABEL_S = { color:'var(--text-dim)', fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.35rem', fontFamily:"'Roboto Mono',monospace" }
const ROW_S   = { marginBottom:'1rem' }

const phoneDigits = phone => String(phone || '').replace(/\D/g, '')
const callHref = phone => phoneDigits(phone) ? `tel:${phoneDigits(phone)}` : ''
const whatsappHref = phone => {
  const digits = phoneDigits(phone)
  if (!digits) return ''
  if (digits.startsWith('549')) return `https://wa.me/${digits}`
  if (digits.startsWith('54')) return `https://wa.me/549${digits.slice(2).replace(/^9/, '')}`
  return `https://wa.me/549${digits.replace(/^9/, '')}`
}
const contactButtonStyle = {
  display:'inline-flex', alignItems:'center', gap:5, padding:'0.38rem 0.65rem',
  borderRadius:3, fontSize:'0.65rem', fontWeight:700, textDecoration:'none',
  border:'1px solid rgba(57,255,20,0.16)', background:'rgba(57,255,20,0.06)',
  color:'var(--phosphor)', whiteSpace:'nowrap',
}

export const CATEGORIAS_OFICIALES = [
  'Amasadora',
  'Aire Acondicionado',
  'Anafe',
  'Batidora',
  'Bomba de Agua',
  'Campana / Extracción',
  'Camión',
  'Cámara Frigorífica',
  'Cocina',
  'Freezer',
  'Freidora',
  'Generador Eléctrico',
  'Heladera',
  'Heladera Exhibidora',
  'Horno',
  'Mobiliario Inox',
  'Montacargas',
  'Refrigeración Genérica',
  'Sobadora',
  'Termotanque',
  'Vehículo Utilitario',
  'Otro'
]


function ActivoModal({ activo, sedes, onClose, onSaved, onCreateNovedad }) {
  const isNew = !activo?.id
  const { rol, perfil } = useAuth()
  const canEdit = ['admin','encargado','editor'].includes(rol) && !isQualityOnlyProfile(perfil)

  const [tab, setTab]         = useState('ficha')
  const [editing, setEditing] = useState(isNew)
  const [form, setForm]       = useState(activo || { tipo:'EQUIPO', estado:'operativo', nombre:'' })
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState(null)
  const [historial, setHistorial] = useState([])
  const [responsables, setResponsables] = useState([])
  const [personas, setPersonas] = useState([])
  const [custodias, setCustodias] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [loadingHist, setLoadingHist] = useState(false)
  const [historialError, setHistorialError] = useState(null)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => {
    let cancelled = false
    setLoadingHist(true)
    setHistorialError(null)
    Promise.all([
      activo?.id ? getTicketsActivo({ id: activo.id, nombre: activo.nombre }) : Promise.resolve([]),
      getProveedores(),
      supabase.from('mnt_responsables').select('id,nombre,rol,telefono,email').order('nombre'),
      supabase.schema('equipo').from('personas').select('id,nombre,apellido,puesto,activo,fecha_baja,sede_ids').order('nombre'),
      activo?.id
        ? supabase.schema('mantenimiento').from('activo_custodias').select('*').eq('activo_id', activo.id).order('created_at', { ascending:false }).limit(50)
        : Promise.resolve({ data:[], error:null }),
    ])
      .then(([tickets, proveedoresData, responsablesResult, personasResult, custodiasResult]) => {
        if (responsablesResult.error) throw responsablesResult.error
        if (personasResult.error) throw personasResult.error
        if (custodiasResult.error) throw custodiasResult.error
        if (cancelled) return
        setHistorial(tickets.slice(0, 50))
        setProveedores(proveedoresData)
        setResponsables(responsablesResult.data || [])
        setPersonas(personasResult.data || [])
        setCustodias(custodiasResult.data || [])
      })
      .catch(error => { if (!cancelled) setHistorialError(error.message) })
      .finally(() => { if (!cancelled) setLoadingHist(false) })
    return () => { cancelled = true }
  }, [activo?.id, activo?.nombre])

  const handleSave = async () => {
    if (!form.nombre) { setErr('El nombre es obligatorio'); return }
    setSaving(true); setErr(null)
    try {
      let payload = { ...form }
      if (payload.sede_id) {
        const sede = sedes.find(s => s.id === Number(payload.sede_id))
        if (sede) payload.sede_nombre = sede.nombre
      }
      await upsertActivo(payload)
      onSaved()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  // Read-only ficha
  const Field = ({ label, value, wide }) => value ? (
    <div style={{ marginBottom:'0.85rem', ...(wide ? { gridColumn:'1 / -1' } : {}) }}>
      <p style={{ ...LABEL_S, marginBottom:'0.2rem' }}>{label}</p>
      <p style={{ color:'var(--text)', fontSize:'0.85rem', margin:0 }}>{value}</p>
    </div>
  ) : null

  const VencChip = ({ label, fecha }) => {
    if (!fecha) return <div style={{ marginBottom:'0.85rem' }}><p style={LABEL_S}>{label}</p><p style={{ color:'var(--text-dim)', fontSize:'0.8rem' }}>—</p></div>
    const d = new Date(fecha)
    const diff = (d - new Date()) / 86400000
    const color = diff < 0 ? '#FF2A2A' : diff < 30 ? '#F59E0B' : '#39FF14'
    return (
      <div style={{ marginBottom:'0.85rem' }}>
        <p style={LABEL_S}>{label}</p>
        <p style={{ color, fontSize:'0.82rem', fontFamily:'monospace', margin:0 }}>{fmtFecha(fecha)}</p>
      </div>
    )
  }

  const sedeName = activo?.sede_nombre || sedes.find(s=>s.id===activo?.sede_id)?.nombre
  const personaNombre = persona => [persona?.nombre, persona?.apellido].filter(Boolean).join(' ')
  const custodioActual = personas.find(p => p.id === (form.custodio_persona_id || activo?.custodio_persona_id))
  const custodioNombre = personaNombre(custodioActual) || activo?.custodio_nombre || activo?.responsable || ''
  const personaPorId = id => personas.find(p => p.id === id)
  const personasDisponibles = personas.filter(p => (p.activo !== false && !p.fecha_baja) || p.id === form.custodio_persona_id)
  const nombreResponsable = ticket => responsables.find(r => r.id === ticket?.responsable_id)?.nombre || ticket?.responsable || ''
  const nombreProveedor = ticket => proveedores.find(p => p.id === ticket?.proveedor_id)?.nombre || ''
  const proveedorServicio = proveedores.find(p => p.id === activo?.proveedor_servicio_id)
  const proveedoresDisponibles = proveedores
    .filter(p => p.estado === 'activo' || p.id === form.proveedor_servicio_id)
    .filter(p => !form.sede_id || !p.sede_ids?.length || p.sede_ids.includes(Number(form.sede_id)))
  const estadosCerrados = ['resuelto','rechazado','cancelado','cerrado']
  const reparacionActual = historial.find(ticket => !estadosCerrados.includes(String(ticket.estado || '').toLowerCase().replace(' ', '_')))
  const reparacionVisible = reparacionActual || historial[0]
  const waServicio = whatsappHref(proveedorServicio?.telefono)
  const callServicio = callHref(proveedorServicio?.telefono)

  return (
    <div className='modal-overlay'>
      <div style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.08)', borderRadius:3, padding:'1.75rem', width:'100%', maxWidth:580, maxHeight:'90vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
          <div>
            <h2 style={{ color:'var(--text)', fontWeight:700, fontSize:'1.1rem', margin:0 }}>
              {isNew ? 'Nuevo Activo' : activo.nombre}
            </h2>
            {!isNew && (
              <div style={{ display:'flex', gap:6, marginTop:5 }}>
                <span className='chip' style={{ background:`${TIPO_COLOR[activo.tipo]||'#888'}22`, color:TIPO_COLOR[activo.tipo]||'#888', border:`1px solid ${TIPO_COLOR[activo.tipo]||'#888'}44`, borderRadius:2 }}>{activo.tipo}</span>
                <span className='chip' style={{ background:`${ESTADO_COLOR[activo.estado]||'#888'}18`, color:ESTADO_COLOR[activo.estado]||'#888', border:`1px solid ${ESTADO_COLOR[activo.estado]||'#888'}33`, borderRadius:2 }}>{activo.estado}</span>
                {activo.codigo_interno && <span className='chip' style={{ borderRadius:2 }}>#{activo.codigo_interno}</span>}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'1.2rem', marginLeft:8 }}>✕</button>
        </div>

        {/* Tabs */}
        {!isNew && !editing && (
          <div style={{ display:'flex', gap:6, marginBottom:'1.25rem', borderBottom:'1px solid rgba(57,255,20,0.08)', paddingBottom:'0.75rem' }}>
            {[
              { id:'ficha', label:'Ficha' },
              { id:'historial', label:'Historial' },
              { id:'documentos', label:'Documentos / Manuales' },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => setTab(id)}
                style={{ padding:'0.3rem 0.85rem', borderRadius:2, fontSize:'0.65rem', fontWeight:700, cursor:'pointer',
                  border: tab === id ? '1px solid rgba(57,255,20,0.3)' : '1px solid transparent',
                  background: tab === id ? 'rgba(57,255,20,0.1)' : 'transparent',
                  color: tab === id ? 'var(--phosphor)' : 'var(--text-dim)',
                  fontFamily:"'Roboto Mono',monospace", letterSpacing:'0.06em', textTransform:'uppercase',
                }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* FICHA (read-only) */}
        {!isNew && !editing && tab === 'ficha' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1.5rem' }}>
              <Field label="Marca / Modelo" value={[activo.marca, activo.modelo].filter(Boolean).join(' ')} />
              <Field label="Categoría" value={activo.categoria} />
              <Field label="Sede / Unidad" value={sedeName} />
              <Field label="Asignado a" value={custodioNombre || 'Sin asignar / uso compartido'} />
              <Field label="En custodia desde" value={activo.custodia_desde ? fmtFecha(activo.custodia_desde) : null} />
              <Field label="Ubicación actual" value={activo.ubicacion_detalle} />
              <Field label="Nro. Serie" value={activo.numero_serie} />
            </div>
            <div style={{ borderTop:'1px solid rgba(57,255,20,0.08)', paddingTop:'0.75rem', marginTop:'0.25rem' }}>
              <p style={LABEL_S}>Servicio tecnico</p>
              {proveedorServicio ? (
                <div style={{ background:'rgba(57,255,20,0.03)', border:'1px solid rgba(57,255,20,0.08)', borderRadius:3, padding:'0.75rem 0.8rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'flex-start', flexWrap:'wrap' }}>
                    <div>
                      <p style={{ color:'var(--text)', fontSize:'0.82rem', fontWeight:700, margin:0 }}>{proveedorServicio.nombre}</p>
                      <p style={{ color:'var(--text-dim)', fontSize:'0.68rem', margin:'3px 0 0' }}>
                        {[proveedorServicio.categoria, proveedorServicio.contacto, proveedorServicio.telefono].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {callServicio && <a href={callServicio} style={contactButtonStyle} title="Llamar"><Phone size={12}/> Llamar</a>}
                      {waServicio && <a href={waServicio} target="_blank" rel="noreferrer" style={{ ...contactButtonStyle, color:'#25d366', borderColor:'rgba(37,211,102,0.22)', background:'rgba(37,211,102,0.08)' }} title="WhatsApp"><MessageCircle size={12}/> WhatsApp</a>}
                      {proveedorServicio.email && <a href={`mailto:${proveedorServicio.email}`} style={{ ...contactButtonStyle, color:'#60A5FA', borderColor:'rgba(96,165,250,0.22)', background:'rgba(96,165,250,0.08)' }} title="Email"><Mail size={12}/> Email</a>}
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ color:'var(--text-dim)', fontSize:'0.75rem', margin:0 }}>Sin proveedor de servicio tecnico asignado</p>
              )}
            </div>
            <div style={{ borderTop:'1px solid rgba(57,255,20,0.08)', paddingTop:'0.75rem', marginTop:'0.25rem' }}>
              <p style={LABEL_S}>{reparacionActual ? 'Reparación actual' : 'Última reparación'}</p>
              {loadingHist ? (
                <p style={{ color:'var(--text-dim)', fontSize:'0.75rem', margin:0 }}>Cargando asignación...</p>
              ) : historialError ? (
                <p style={{ color:'#FF5050', fontSize:'0.72rem', margin:0 }}>{historialError}</p>
              ) : reparacionVisible ? (
                <div style={{ background:'rgba(57,255,20,0.03)', border:'1px solid rgba(57,255,20,0.08)', borderRadius:3, padding:'0.7rem 0.8rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:8 }}>
                    <span style={{ color:'var(--text)', fontSize:'0.74rem', fontWeight:600 }}>Ticket #{reparacionVisible.numero || '—'} · {reparacionVisible.descripcion}</span>
                    <span style={{ color:reparacionActual?'#F59E0B':'#39FF14', fontSize:'0.6rem', textTransform:'uppercase', whiteSpace:'nowrap' }}>{String(reparacionVisible.estado || '—').replace('_',' ')}</span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.6rem 1rem' }}>
                    <div><p style={{ ...LABEL_S, marginBottom:2 }}>Técnico / Responsable</p><p style={{ color:'var(--text)', fontSize:'0.76rem', margin:0 }}>{nombreResponsable(reparacionVisible) || 'Sin asignar'}</p></div>
                    <div><p style={{ ...LABEL_S, marginBottom:2 }}>Proveedor / Taller</p><p style={{ color:'var(--text)', fontSize:'0.76rem', margin:0 }}>{nombreProveedor(reparacionVisible) || 'Sin asignar'}</p></div>
                  </div>
                </div>
              ) : (
                <p style={{ color:'var(--text-dim)', fontSize:'0.75rem', margin:0 }}>Sin reparaciones registradas</p>
              )}
            </div>
            {activo.notas && (
              <div style={{ borderTop:'1px solid rgba(57,255,20,0.08)', paddingTop:'0.75rem', marginTop:'0.25rem' }}>
                <p style={LABEL_S}>Notas</p>
                <p style={{ color:'var(--text-dim)', fontSize:'0.8rem', margin:0, lineHeight:1.5 }}>{activo.notas}</p>
              </div>
            )}
          </div>
        )}

        {/* HISTORIAL */}
        {!isNew && !editing && tab === 'historial' && (
          <div style={{ minHeight:200 }}>
            <div style={{ marginBottom:18 }}>
              <p style={{ ...LABEL_S, color:'var(--phosphor)', marginBottom:8 }}>Historial de custodia</p>
              {custodias.length === 0 ? (
                <p style={{ color:'var(--text-dim)', fontSize:'0.72rem', margin:0 }}>Sin entregas ni transferencias registradas</p>
              ) : custodias.map(movimiento => {
                const anterior = personaNombre(personaPorId(movimiento.persona_anterior_id)) || movimiento.persona_anterior_nombre
                const nueva = personaNombre(personaPorId(movimiento.persona_nueva_id)) || movimiento.persona_nueva_nombre
                const detalle = movimiento.tipo_movimiento === 'devolucion'
                  ? `Devuelto por ${anterior || 'persona no disponible'}`
                  : movimiento.tipo_movimiento === 'transferencia'
                    ? `${anterior || 'Sin asignar'} → ${nueva || 'Sin asignar'}`
                    : `Entregado a ${nueva || 'persona no disponible'}`
                return (
                  <div key={movimiento.id} style={{ borderLeft:'2px solid rgba(57,255,20,.35)', padding:'2px 0 10px 12px', marginLeft:3 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
                      <p style={{ color:'var(--text)', fontSize:'.72rem', fontWeight:700, margin:0 }}>{detalle}</p>
                      <span style={{ color:'var(--text-dim)', fontSize:'.58rem', whiteSpace:'nowrap' }}>{fmtFecha(movimiento.created_at)}</span>
                    </div>
                    {movimiento.observacion && <p style={{ color:'var(--text-dim)', fontSize:'.62rem', margin:'3px 0 0' }}>{movimiento.observacion}</p>}
                  </div>
                )
              })}
            </div>
            <p style={{ ...LABEL_S, marginBottom:8 }}>Historial de mantenimiento</p>
            <div style={{ borderBottom:'1px solid rgba(57,255,20,0.08)', paddingBottom:12, marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                <span style={{ fontSize:'0.6rem', color:'var(--text-dim)', fontFamily:'monospace' }}>{activo.created_at ? fmtFecha(activo.created_at) : 'Fecha no registrada'}</span>
                <span style={{ fontSize:'0.6rem', padding:'1px 7px', borderRadius:4, background:'rgba(57,255,20,0.12)', color:'var(--phosphor)', border:'1px solid rgba(57,255,20,0.25)' }}>alta</span>
              </div>
              <p style={{ fontSize:'0.74rem', color:'var(--text)', margin:0, fontWeight:600 }}>Alta del activo</p>
              <p style={{ fontSize:'0.62rem', color:'var(--text-dim)', margin:'3px 0 0' }}>
                {[activo.codigo_interno ? `Codigo ${activo.codigo_interno}` : null, activo.fecha_compra ? `Compra ${fmtFecha(activo.fecha_compra)}` : null].filter(Boolean).join(' · ') || 'Registro inicial del equipo'}
              </p>
            </div>
            {loadingHist ? (
              <p style={{ color:'var(--text-dim)', fontSize:'0.75rem', textAlign:'center', padding:'2rem' }}>Cargando...</p>
            ) : historialError ? (
              <p style={{ color:'#FF5050', fontSize:'0.75rem', textAlign:'center', padding:'2rem' }}>{historialError}</p>
            ) : historial.length === 0 ? (
              <p style={{ color:'var(--text-dim)', fontSize:'0.75rem', textAlign:'center', padding:'2rem' }}>Sin tickets registrados para este activo</p>
            ) : (
              <>
                <div style={{ display:'flex', gap:12, marginBottom:14, flexWrap:'wrap' }}>
                  <div className='kpi-card' style={{ minWidth:100 }}>
                    <p className='kpi-label'>Total tickets</p>
                    <p className='kpi-value' style={{ fontSize:'1.5rem' }}>{historial.length}</p>
                  </div>
                  {historial.some(h => h.costo_real) && (
                    <div className='kpi-card' style={{ minWidth:100 }}>
                      <p className='kpi-label'>Costo total</p>
                      <p className='kpi-value' style={{ fontSize:'1.3rem' }}>
                        ${historial.reduce((s,h) => s+(h.costo_real||0), 0).toLocaleString('es-AR')}
                      </p>
                    </div>
                  )}
                </div>
                {historial.map(h => {
                  const PC = { critica:'#FF2A2A', alta:'#F59E0B', media:'#50b4ff', baja:'#aaa' }
                  const EC = { resuelto:'#39FF14', 'en progreso':'#F59E0B', abierto:'#50b4ff', rechazado:'#aaa' }
                  return (
                    <div key={h.id} style={{ borderBottom:'1px solid rgba(57,255,20,0.05)', paddingBottom:10, marginBottom:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:'0.6rem', color:'var(--text-dim)', fontFamily:'monospace' }}>{h.created_at ? fmtFecha(h.created_at) : '—'}</span>
                        <span style={{ fontSize:'0.6rem', padding:'1px 7px', borderRadius:4, background:`${PC[h.prioridad]||'#aaa'}18`, color:PC[h.prioridad]||'#aaa', border:`1px solid ${PC[h.prioridad]||'#aaa'}33` }}>{h.prioridad}</span>
                        <span style={{ fontSize:'0.6rem', padding:'1px 7px', borderRadius:4, background:`${EC[h.estado]||'#aaa'}18`, color:EC[h.estado]||'#aaa', border:`1px solid ${EC[h.estado]||'#aaa'}33` }}>{h.estado}</span>
                        {h.costo_real && <span style={{ marginLeft:'auto', fontSize:'0.62rem', color:'var(--phosphor)', fontFamily:'monospace' }}>${h.costo_real.toLocaleString('es-AR')}</span>}
                      </div>
                      <p style={{ fontSize:'0.72rem', color:'var(--text)', margin:0 }}>{h.descripcion}</p>
                      {h.diagnostico && <p style={{ fontSize:'0.62rem', color:'var(--text-dim)', margin:'3px 0 0' }}>{h.diagnostico}</p>}
                      <p style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.4)', margin:'4px 0 0' }}>Técnico: {nombreResponsable(h) || 'Sin asignar'}</p>
                      <p style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.4)', margin:'2px 0 0' }}>Proveedor: {nombreProveedor(h) || 'Sin asignar'}</p>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

        {/* DOCUMENTOS Y MANUALES */}
        {!isNew && !editing && tab === 'documentos' && (
          <div style={{ minHeight:200 }}>
            <div style={{ background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.12)', borderRadius:3, padding:'0.65rem 0.8rem', marginBottom:'0.75rem' }}>
              <p style={{ color:'var(--text)', fontSize:'0.72rem', margin:0 }}>Manuales, fichas técnicas, garantías e informes permanentes del equipo.</p>
              <p style={{ color:'var(--text-dim)', fontSize:'0.62rem', margin:'3px 0 0' }}>Podés subir archivos o agregar un link de Google Drive.</p>
            </div>
            {activo.manual_url && (
              <a href={activo.manual_url} target="_blank" rel="noreferrer"
                style={{ display:'block', color:'#60A5FA', fontSize:'0.72rem', marginBottom:'0.75rem', textDecoration:'none' }}>
                ↗ Abrir manual principal
              </a>
            )}
            <AdjuntosPanel entityType="activo" entityId={activo.id} readOnly={!canEdit} />
          </div>
        )}

        {/* FORM (new or editing) */}
        {(isNew || editing) && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem' }}>
              <div style={ROW_S}>
                <label style={LABEL_S}>Sede / Unidad</label>
                <select value={form.sede_id||''} onChange={e=>set('sede_id', e.target.value ? Number(e.target.value) : null)} style={INPUT_S}>
                  <option value="">Sin asignar</option>
                  {sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div style={ROW_S}><label style={LABEL_S}>Categoría</label>
                <select value={form.categoria||''} onChange={e=>set('categoria',e.target.value)} style={INPUT_S}>
                  <option value="">Seleccionar Categoría...</option>
                  {CATEGORIAS_OFICIALES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={ROW_S}>
              <label style={LABEL_S}>Nombre *</label>
              <input value={form.nombre} onChange={e=>set('nombre',e.target.value)} style={INPUT_S} />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:isNew ? '1fr' : '1fr 1fr', gap:'0 1rem' }}>
              <div style={ROW_S}>
                <label style={LABEL_S}>Tipo *</label>
                <select value={form.tipo} onChange={e=>set('tipo',e.target.value)} style={INPUT_S}>
                  <option value="EQUIPO">Equipo</option>
                  <option value="INSTALACION">Instalación</option>
                </select>
              </div>
              {!isNew && <div style={ROW_S}>
                <label style={LABEL_S}>Estado</label>
                <select value={form.estado} onChange={e=>set('estado',e.target.value)} style={INPUT_S}>
                  <option value="operativo">Operativo</option>
                  <option value="en_reparacion">En Reparación</option>
                  <option value="baja">Baja</option>
                </select>
              </div>}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0 1rem' }}>
              <div style={ROW_S}>
                <label style={LABEL_S}>Código interno</label>
                <input
                  value={form.codigo_interno || 'Se asignará automáticamente al guardar'}
                  readOnly
                  aria-readonly="true"
                  style={{ ...INPUT_S, color: form.codigo_interno ? 'var(--text)' : 'var(--text-dim)', cursor:'default' }}
                />
                <p style={{ color:'var(--text-dim)', fontSize:'0.58rem', margin:'0.3rem 0 0' }}>
                  Identificador único administrado por el sistema.
                </p>
              </div>
              <div style={ROW_S}><label style={LABEL_S}>Marca</label><input value={form.marca||''} onChange={e=>set('marca',e.target.value)} style={INPUT_S} /></div>
              <div style={ROW_S}><label style={LABEL_S}>Modelo</label><input value={form.modelo||''} onChange={e=>set('modelo',e.target.value)} style={INPUT_S} /></div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem' }}>
              <div style={ROW_S}>
                <label style={LABEL_S}>Asignado a / Custodio</label>
                <select value={form.custodio_persona_id || ''} onChange={e => {
                  const personaId = e.target.value || null
                  const persona = personas.find(p => p.id === personaId)
                  setForm(f => ({
                    ...f,
                    custodio_persona_id: personaId,
                    custodia_desde: personaId ? (f.custodia_desde || new Date().toISOString().slice(0,10)) : null,
                    responsable: persona ? personaNombre(persona) : null,
                  }))
                }} style={INPUT_S}>
                  <option value="">Sin asignar / uso compartido</option>
                  {personasDisponibles.map(p => <option key={p.id} value={p.id}>{personaNombre(p)}{p.puesto ? ` · ${p.puesto}` : ''}</option>)}
                </select>
                <p style={{ color:'var(--text-dim)', fontSize:'.58rem', margin:'5px 0 0' }}>La sede indica la base física; esta persona conserva la custodia.</p>
              </div>
              <div style={ROW_S}><label style={LABEL_S}>Nro. Serie</label><input value={form.numero_serie||''} onChange={e=>set('numero_serie',e.target.value)} style={INPUT_S} /></div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem' }}>
              <div style={ROW_S}>
                <label style={LABEL_S}>En custodia desde</label>
                <input type="date" value={form.custodia_desde || ''} disabled={!form.custodio_persona_id} onChange={e=>set('custodia_desde',e.target.value||null)} style={INPUT_S} />
              </div>
              <div style={ROW_S}>
                <label style={LABEL_S}>Ubicación actual</label>
                <input value={form.ubicacion_detalle || ''} onChange={e=>set('ubicacion_detalle',e.target.value)} placeholder="Ej: Administración · Oficina 2" style={INPUT_S} />
              </div>
            </div>

            <div style={ROW_S}>
              <label style={LABEL_S}>Servicio tecnico</label>
              <select value={form.proveedor_servicio_id || ''} onChange={e=>set('proveedor_servicio_id', e.target.value || null)} style={INPUT_S}>
                <option value="">Sin proveedor asignado</option>
                {proveedoresDisponibles.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}{p.telefono ? ` · ${p.telefono}` : ''}</option>
                ))}
              </select>
              <p style={{ color:'var(--text-dim)', fontSize:'0.62rem', margin:'0.35rem 0 0' }}>
                Se toma de Proveedores. Carga ahi el telefono del service para habilitar WhatsApp.
              </p>
            </div>

            <div style={ROW_S}><label style={LABEL_S}>Notas</label><textarea value={form.notas||''} onChange={e=>set('notas',e.target.value)} rows={3} style={{ ...INPUT_S, resize:'vertical' }} /></div>
          </>
        )}

        {err && <p style={{ color:'#FF2A2A', fontSize:'0.8rem', marginBottom:'1rem' }}>{err}</p>}

        {/* Footer */}
        <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end', marginTop:'1rem' }}>
          {!isNew && !editing && tab === 'ficha' && onCreateNovedad && activo?.sede_id && (
            <button onClick={() => onCreateNovedad({ type:'activo', id:activo.id, label:activo.nombre, sedeId:activo.sede_id, sedeLabel:sedeName, returnView:'mntActivos' })} className='btn-primary'>+ Crear novedad</button>
          )}
          {!isNew && !editing && canEdit && tab === 'ficha' && (
            <button onClick={() => setEditing(true)} className='btn-primary'>
              Editar
            </button>
          )}
          {(isNew || editing) && (
            <>
              <button onClick={() => editing ? setEditing(false) : onClose()} className='btn-ghost'>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className='btn-primary'
                style={{ opacity: saving ? 0.5 : 1 }}>
                {saving ? 'Guardando...' : (isNew ? 'Crear' : 'Guardar')}
              </button>
            </>
          )}
          {!editing && (
            <button onClick={onClose} className='btn-ghost'>Cerrar</button>
          )}
        </div>
      </div>
    </div>
  )
}

function QRModal({ activo, onClose }) {
  const [labelWidthMm, setLabelWidthMm] = useState(50)
  const [labelHeightMm, setLabelHeightMm] = useState(30)
  const [labelOrientation, setLabelOrientation] = useState('horizontal')
  const url = `${window.location.origin}/?scan=activo&id=${activo.id}`
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}&bgcolor=0A0A0E&color=39FF14&margin=10`
  const escapeHtml = value => String(value || '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;')

  const printLabel = () => {
    const { widthMm, heightMm } = normalizeQrLabel({ widthMm:labelWidthMm, heightMm:labelHeightMm, orientation:labelOrientation })
    const w = window.open('', '_blank', 'width=400,height=500')
    if (!w) return
    const printQrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=000000&margin=12`
    w.document.write(`<!DOCTYPE html><html><head><title>QR ${escapeHtml(activo.nombre)}</title>
    <style>
      @page { size:${widthMm}mm ${heightMm}mm; margin:0; }
      * { box-sizing:border-box; }
      html, body { width:${widthMm}mm; height:${heightMm}mm; margin:0; background:#fff; color:#000; }
      body { font-family:Arial,sans-serif; display:flex; align-items:center; justify-content:center; }
      .label { width:100%; height:100%; border:0.4mm solid #000; padding:2mm; display:grid; grid-template-columns:minmax(16mm,38%) 1fr; grid-template-rows:auto 1fr auto; gap:1mm 2mm; align-items:center; overflow:hidden; }
      .brand { grid-column:1/-1; font-size:7px; font-weight:800; letter-spacing:1px; padding-bottom:1mm; border-bottom:0.2mm solid #000; }
      img { grid-column:1; grid-row:2/4; width:100%; max-height:100%; aspect-ratio:1; object-fit:contain; display:block; image-rendering:pixelated; }
      .details { min-width:0; align-self:center; }
      h2 { font-size:10px; line-height:1.15; margin:0 0 1mm; overflow-wrap:anywhere; }
      .asset { font-family:monospace; font-size:8px; font-weight:700; margin:0; overflow-wrap:anywhere; }
      .instruction { margin:0; border-top:0.2mm solid #000; padding-top:1mm; font-size:6px; line-height:1.2; font-weight:700; }
    </style></head><body><section class="label">
    <div class="brand">FLY KITCHEN · ACTIVO</div>
    <img id="qr-print" src="${printQrSrc}" alt="QR del activo" />
    <div class="details"><h2>${escapeHtml(activo.nombre)}</h2>
    <p class="asset">${escapeHtml(`${activo.codigo_interno ? '#'+activo.codigo_interno+' · ' : ''}${activo.categoria||activo.tipo||''}`)}</p></div>
    <p class="instruction">ESCANEAR PARA VER LA FICHA Y MANUALES<br/>O NOTIFICAR UNA AVERÍA</p>
    </section></body></html>`)
    w.document.close()
    const qrImage = w.document.getElementById('qr-print')
    const doPrint = () => setTimeout(() => { w.focus(); w.print() }, 100)
    if (qrImage.complete && qrImage.naturalWidth > 0) doPrint()
    else qrImage.onload = doPrint
    qrImage.onerror = () => { w.document.body.insertAdjacentHTML('beforeend', '<p style="color:#c00">No se pudo cargar el QR. Cerrá esta ventana e intentá nuevamente.</p>') }
  }

  const printCompactLabel = () => {
    const { widthMm, heightMm } = normalizeQrLabel({ widthMm:labelWidthMm, heightMm:labelHeightMm, orientation:labelOrientation })
    const code = activo.codigo_interno || activo.id
    const w = window.open('', '_blank', 'width=400,height=500')
    if (!w) return
    const printQrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=000000&margin=4`
    w.document.write(`<!DOCTYPE html><html><head><title>QR ${escapeHtml(code)}</title>
    <style>
      @page { size:${widthMm}mm ${heightMm}mm; margin:0; }
      * { box-sizing:border-box; }
      html, body { width:${widthMm}mm; height:${heightMm}mm; margin:0; padding:0; background:#fff; color:#000; }
      body { font-family:Arial,sans-serif; display:flex; align-items:center; justify-content:center; }
      .compact-label { width:${widthMm}mm; height:${heightMm}mm; padding:2mm; display:flex; ${widthMm >= heightMm ? 'flex-direction:row' : 'flex-direction:column'}; align-items:center; justify-content:center; gap:1.5mm; overflow:hidden; }
      img { width:auto; height:auto; max-width:${widthMm >= heightMm ? '65%' : '90%'}; max-height:${widthMm >= heightMm ? '90%' : '72%'}; aspect-ratio:1; object-fit:contain; display:block; image-rendering:pixelated; }
      .code { margin:0; font-family:monospace; font-size:${Math.max(8, Math.min(16, Math.min(widthMm,heightMm) * .32))}px; line-height:1.1; font-weight:800; text-align:center; overflow-wrap:anywhere; }
    </style></head><body><section class="compact-label"><img id="qr-compact" src="${printQrSrc}" alt="QR del activo"/><p class="code">${escapeHtml(code)}</p></section></body></html>`)
    w.document.close()
    const qrImage = w.document.getElementById('qr-compact')
    const doPrint = () => setTimeout(() => { w.focus(); w.print() }, 100)
    if (qrImage.complete && qrImage.naturalWidth > 0) doPrint()
    else qrImage.onload = doPrint
    qrImage.onerror = () => { w.document.body.insertAdjacentHTML('beforeend', '<p style="color:#c00">No se pudo cargar el QR.</p>') }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60 }}
      onClick={onClose}>
      <div style={{ background:'var(--surface)', borderRadius:3, padding:'1.75rem', width:380, textAlign:'center' }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <p style={{ color:'var(--text)', fontWeight:700, fontSize:'1rem' }}>QR — {activo.nombre}</p>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
        </div>
        <div style={{ background:'#0A0A0E', borderRadius:3, padding:'0.75rem', marginBottom:'1rem', display:'inline-block' }}>
          <img src={qrSrc} alt="QR" width={200} height={200} style={{ display:'block', imageRendering:'pixelated' }} />
        </div>
        <p style={{ color:'var(--text-dim)', fontSize:'0.65rem', fontFamily:'monospace', wordBreak:'break-all', marginBottom:'1rem', padding:'0 0.5rem' }}>{url}</p>
        <div style={{ marginBottom:'0.65rem', padding:'0.65rem', border:'1px solid rgba(255,255,255,0.08)', borderRadius:3, textAlign:'left' }}>
          <p style={{ color:'var(--text)', fontSize:'0.72rem', fontWeight:700, margin:'0 0 8px' }}>Tamaño de etiqueta</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <label style={{ color:'var(--text-dim)', fontSize:'0.65rem' }}>Ancho (mm)<input aria-label="Ancho de etiqueta en milímetros" type="number" min="20" max="200" step="1" value={labelWidthMm} onChange={e=>setLabelWidthMm(e.target.value)} className="input-dark" style={{ marginTop:4 }}/></label>
            <label style={{ color:'var(--text-dim)', fontSize:'0.65rem' }}>Alto (mm)<input aria-label="Alto de etiqueta en milímetros" type="number" min="20" max="200" step="1" value={labelHeightMm} onChange={e=>setLabelHeightMm(e.target.value)} className="input-dark" style={{ marginTop:4 }}/></label>
          </div>
          <label style={{ color:'var(--text-dim)', fontSize:'0.65rem' }}>Orientación<select aria-label="Orientación de etiqueta" value={labelOrientation} onChange={e=>setLabelOrientation(e.target.value)} className="input-dark" style={{ marginTop:4 }}><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.6rem' }}>
          <button onClick={printLabel}
            style={{ flex:1, background:'var(--phosphor)', color:'#0A0A0E', border:'none', borderRadius:3, padding:'0.65rem', fontWeight:700, cursor:'pointer', fontSize:'0.82rem' }}>
            🖨 Imprimir etiqueta
          </button>
          <button onClick={printCompactLabel}
            style={{ background:'rgba(255,255,255,0.04)', color:'var(--text)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:3, padding:'0.65rem', fontWeight:700, cursor:'pointer', fontSize:'0.82rem' }}>
            🖨 Solo QR + código
          </button>
          <a href={qrSrc} download={`qr-${activo.id}.png`} target="_blank" rel="noreferrer"
            style={{ gridColumn:'1 / -1', background:'rgba(57,255,20,0.06)', color:'var(--text)', border:'1px solid rgba(57,255,20,0.08)', borderRadius:3, padding:'0.65rem', fontWeight:600, cursor:'pointer', fontSize:'0.82rem', textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center' }}>
            ⬇ Descargar QR
          </a>
        </div>
      </div>
    </div>
  )
}

export default function MntActivos({ focusId, onCreateNovedad }) {
  const { mantenimientoSedeIds:allowedSedeIds, rol, perfil } = useAuth()
  const canWrite = ['admin','encargado','editor'].includes(rol) && !isQualityOnlyProfile(perfil)
  const [activos, setActivos] = useState([])
  const [sedes, setSedes]     = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)
  const [qrModal, setQrModal] = useState(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerError, setScannerError] = useState('')
  const [sedeId, setSedeId]   = useState('')
  const [filtroTipo, setFiltroTipo]     = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda, setBusqueda]         = useState('')

  useEffect(() => { getSedes(allowedSedeIds).then(setSedes) }, [allowedSedeIds])

  // Si el usuario tiene una sola sede asignada (ej: encargado), queda preseleccionada
  useEffect(() => { if (allowedSedeIds?.length === 1) setSedeId(String(allowedSedeIds[0])) }, [allowedSedeIds])

  const load = useCallback(() => {
    setLoading(true)
    const filtros = {}
    if (sedeId) filtros.sede_id = Number(sedeId)
    getActivos({ ...filtros, sedeIds: allowedSedeIds || undefined })
      .then(data => setActivos(data.filter(a => a.tipo !== 'VEHICULO')))
      .finally(() => setLoading(false))
  }, [sedeId, allowedSedeIds])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!focusId || loading) return
    const target = activos.find(activo => String(activo.id) === String(focusId))
    if (target) setModal(target)
  }, [focusId, loading, activos])

  const filtrados = activos
    .filter(a => filtroTipo   === 'todos' || a.tipo   === filtroTipo)
    .filter(a => filtroEstado === 'todos' || a.estado === filtroEstado)
    .filter(a => !busqueda || a.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || (a.codigo_interno||'').toLowerCase().includes(busqueda.toLowerCase()))

  const openScannedAsset = scanValue => {
    const target = findScannedAsset(activos, scanValue)
    if (!target) {
      setScannerError('No se encontró el activo o no tenés permiso para verlo.')
      setScannerOpen(false)
      return
    }
    setScannerError('')
    setScannerOpen(false)
    setModal(target)
  }

  const CHIP = active => ({
    padding:'0.3rem 0.75rem', borderRadius:3, fontSize:'0.65rem', fontWeight:600,
    border:'none', cursor:'pointer',
    background: active ? 'rgba(249,115,22,0.15)' : 'var(--surface)',
    color:       active ? '#F97316'               : 'var(--text-dim)',
  })
  const SEL_S = { background:'#1a1a2e', border:'1px solid rgba(57,255,20,0.15)', color:'#e2e8f0', borderRadius:2, padding:'0.35rem 0.75rem', fontSize:'0.72rem', fontFamily:'inherit', cursor:'pointer' }

  const hoy = new Date().toISOString().split('T')[0]
  const estaVencido  = f => f && f < hoy
  const proximoVencer = f => { if (!f) return false; const d = (new Date(f)-new Date())/86400000; return d>=0&&d<=30 }

  return (
    <div style={{ padding:'1.5rem 2rem', height:'100%', display:'flex', flexDirection:'column' }}>
      <PageHeader title="Activos">
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select value={sedeId} onChange={e=>setSedeId(e.target.value)} style={SEL_S}>
            <option value=''>Todas las sedes</option>
            {sedes.map(s=><option key={s.id} value={s.id} style={{ background:'#1a1a2e' }}>{s.nombre}</option>)}
          </select>
          <button onClick={()=>{ setScannerError(''); setScannerOpen(true) }} className="btn-ghost" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <ScanLine size={16}/> Escanear QR
          </button>
          {canWrite && <button onClick={()=>setModal({})}
            style={{ background:'var(--phosphor)', color:'#0A0A0E', border:'none', borderRadius:3, padding:'0.55rem 1.1rem', fontWeight:700, cursor:'pointer' }}>
            + Nuevo Activo
          </button>}
        </div>
      </PageHeader>

      {scannerError && <p role="alert" style={{ color:'#F59E0B', fontSize:'.75rem', margin:'0 0 .75rem' }}>{scannerError}</p>}

      <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'1rem', alignItems:'center' }}>
        <input value={busqueda} onChange={e=>setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o código..."
          style={{ padding:'0.4rem 0.8rem', borderRadius:2, background:'var(--surface)', border:'1px solid rgba(57,255,20,0.07)', color:'var(--text)', fontSize:'0.8rem', width:220 }} />
        {['todos','EQUIPO','INSTALACION'].map(t=>(
          <button key={t} onClick={()=>setFiltroTipo(t)} style={CHIP(filtroTipo===t)}>
            {t==='todos' ? 'Todos' : t.charAt(0)+t.slice(1).toLowerCase()}
          </button>
        ))}
        <span style={{ borderLeft:'1px solid rgba(57,255,20,0.08)', margin:'0 0.1rem' }} />
        {['todos','operativo','en_reparacion','baja'].map(s=>(
          <button key={s} onClick={()=>setFiltroEstado(s)} style={CHIP(filtroEstado===s)}>
            {s==='todos' ? 'Todos' : s.replace('_',' ')}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', background:'var(--surface)', borderRadius:3 }}>
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'3rem' }}>
            <div style={{ width:28, height:28, borderRadius:'50%', border:'2px solid var(--phosphor)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
          </div>
        ) : filtrados.length === 0 ? (
          <p style={{ padding:'2rem', color:'var(--text-dim)', textAlign:'center' }}>Sin activos{sedeId ? ' para esta sede' : ''}</p>
        ) : filtrados.map((a,i) => {
          const vencimientos = [a.vencimiento_seguro, a.vencimiento_vtv, a.vencimiento_senasa, a.vencimiento_rmtsa]
          const tieneVencido = vencimientos.some(estaVencido)
          const tieneProximo = vencimientos.some(proximoVencer)
          const sedeLabel = a.sede_nombre || a.sede || '—'
          return (
            <div key={a.id} onClick={()=>setModal(a)}
              style={{ display:'grid', gridTemplateColumns:'1fr 110px 130px 130px 90px 36px', alignItems:'center', gap:'0.75rem',
                padding:'0.8rem 1.1rem', borderBottom: i<filtrados.length-1?'1px solid rgba(255,255,255,0.03)':'none', cursor:'pointer' }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <div>
                <p style={{ color:'var(--text)', fontSize:'0.9rem', fontWeight:600 }}>{a.nombre}
                  {tieneVencido && <span style={{ color:'#FF2A2A', fontSize:'0.65rem', marginLeft:6 }}>⚠ Vencido</span>}
                  {!tieneVencido && tieneProximo && <span style={{ color:'#F59E0B', fontSize:'0.65rem', marginLeft:6 }}>⚠ Próx. venc.</span>}
                </p>
                <p style={{ color:'var(--text-dim)', fontSize:'0.68rem' }}>{a.codigo_interno||'—'} · {a.categoria||'—'} · {sedeLabel}</p>
              </div>
              <span style={{ fontSize:'0.65rem', fontWeight:700, padding:'0.2rem 0.5rem', borderRadius:4,
                background:`${TIPO_COLOR[a.tipo]||'#555'}22`, color:TIPO_COLOR[a.tipo]||'#555' }}>
                {a.tipo?.charAt(0)+a.tipo?.slice(1).toLowerCase()}
              </span>
              <p style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>{a.custodio_nombre || a.responsable || 'Sin asignar'}</p>
              <p style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>{a.marca||'—'} {a.modelo||''}</p>
              <span style={{ fontSize:'0.65rem', fontWeight:700, padding:'0.2rem 0.5rem', borderRadius:4,
                background:`${ESTADO_COLOR[a.estado]||'#555'}22`, color:ESTADO_COLOR[a.estado]||'#555' }}>
                {a.estado?.replace('_',' ')}
              </span>
              <button onClick={e=>{e.stopPropagation(); setQrModal(a)}}
                title="Ver QR"
                style={{ background:'rgba(57,255,20,0.08)', border:'1px solid rgba(57,255,20,0.2)', borderRadius:2, padding:'0.3rem 0.4rem', cursor:'pointer', fontSize:'0.85rem', color:'var(--phosphor)', lineHeight:1 }}>
                ▣
              </button>
            </div>
          )
        })}
      </div>

      {qrModal && <QRModal activo={qrModal} onClose={()=>setQrModal(null)} />}
      {scannerOpen && (
        <AssetQrScannerModal onClose={()=>setScannerOpen(false)} onScan={openScannedAsset}/>
      )}
      {modal !== null && (
        <ActivoModal
          activo={modal?.id ? modal : null}
          sedes={sedes}
          onClose={()=>setModal(null)}
          onSaved={()=>{ setModal(null); load() }}
          onCreateNovedad={onCreateNovedad}
        />
      )}
    </div>
  )
}
