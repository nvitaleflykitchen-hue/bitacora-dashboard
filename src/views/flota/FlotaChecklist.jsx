import { useChecklistFindings } from '../../components/ChecklistFindings'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Car, CheckCircle2, ClipboardCheck, RefreshCw, Save, Ticket } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { getActivos } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { mensajeError } from '../../lib/errores'
import { toast } from '../../lib/feedback'
import FleetChecklistDashboard from '../../components/FleetChecklistDashboard'
import AirportVehicleChecklist from '../../components/AirportVehicleChecklist'
import { isAirportVehicle } from '../../lib/airportChecklist'
import { GENERAL_VEHICLE_ITEMS as ITEMS, GENERAL_ANSWERS, emptyGeneralAnswers as buildEmptyItems, generalChecklistError, generalChecklistStatus as overallStatus } from '../../lib/generalVehicleChecklist'
import { vehicleIdentity, fleetToday, FLEET_TZ } from '../../lib/flotaModel'
import './FlotaChecklist.css'

const CHECKLIST_PREFIX = 'CHECKLIST_VEHICULO::'

const ESTADOS = {
  pendiente: { label:'Sin completar', color:'#94A3B8' },
  apto: { label:'Apto', color:'#39FF14' },
  observado: { label:'Observado', color:'#F59E0B' },
  no_apto: { label:'No apto', color:'#FF5050' },
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function todayKey() {
  return fleetToday()
}

function dateKey(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone:FLEET_TZ }).format(d)
}

function fmtFechaHora(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseChecklist(row) {
  const raw = String(row?.observacion || '')
  if (!raw.startsWith(CHECKLIST_PREFIX)) return null
  try {
    const parsed = JSON.parse(raw.slice(CHECKLIST_PREFIX.length))
    return { ...parsed, row }
  } catch {
    return null
  }
}

function estadoBadge(estado) {
  const meta = ESTADOS[estado] || ESTADOS.apto
  return {
    border:`1px solid ${meta.color}55`,
    background:`${meta.color}16`,
    color:meta.color,
    borderRadius:3,
    padding:'3px 8px',
    fontSize:'0.62rem',
    fontWeight:800,
    letterSpacing:'.08em',
    textTransform:'uppercase',
    fontFamily:'monospace',
  }
}

function KPI({ label, value, sub, color }) {
  return (
    <div style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.06)', borderRadius:3, padding:'0.9rem 1rem', minWidth:150, flex:1 }}>
      <p style={{ color:'var(--text-dim)', fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4 }}>{label}</p>
      <p style={{ color:color || 'var(--text)', fontSize:'1.8rem', fontWeight:900, lineHeight:1 }}>{value}</p>
      {sub && <p style={{ color:'var(--text-dim)', fontSize:'0.64rem', marginTop:4 }}>{sub}</p>}
    </div>
  )
}

export default function FlotaChecklist() {
  const [mode,setMode]=useState(null)
  if(mode===null)return <FleetChecklistDashboard onStart={id=>setMode(id||'general')}/>
  if(isAirportVehicle(mode))return <AirportVehicleChecklist activoId={mode} onBack={()=>setMode(null)}/>
  if(mode==='airport')return <AirportVehicleChecklist onBack={()=>setMode(null)}/>
  return <div style={{height:'100%',overflow:'auto'}}><button className="btn-ghost" onClick={()=>setMode('airport')}>Control de gran porte</button><GeneralFlotaChecklist activoId={mode==='general'?null:mode} onBack={()=>setMode(null)}/></div>
}

export function GeneralFlotaChecklist({ onBack, activoId = null } = {}) {
  const { perfil, rol, allowedSedeIds, can } = useAuth()
  const canCreateTicket = can('flota', 'manage') || ['admin','editor','grupo','encargado'].includes(rol)
  const canManage = canCreateTicket || ['operario','sede'].includes(rol)
  const [vehiculos, setVehiculos] = useState([])
  const [visitas, setVisitas] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const [form, setForm] = useState({
    activo_id:activoId || '',
    conductor: perfil?.nombre || '',
    km:'',
    observaciones:'',
    respuestas: buildEmptyItems(),
    crearTicket: canCreateTicket,
  })

  const load = async () => {
    setLoading(true)
    setErr(null)
    try {
      const filtros = { tipo:'VEHICULO' }
      if (Array.isArray(allowedSedeIds) && allowedSedeIds.length === 0) {
        setVehiculos([])
        setVisitas([])
        return
      }
      if (allowedSedeIds?.length) filtros.sedeIds = allowedSedeIds
      const vehiculosData = await getActivos(filtros)
      const activos = (vehiculosData || []).filter(v => (!activoId || v.id === activoId) && !isAirportVehicle(v.id) && !['baja','inactivo'].includes(String(v.estado || '').toLowerCase()))
      const activoIds = new Set(activos.map(v => String(v.id)))
      setVehiculos(activos)
      if (!activos.length) { setVisitas([]); return }
      const visitasResult = await supabase.from('mnt_visitas')
          .select('id,activo_id,activo_nombre,activo_sede,fecha,visitante,tipo_visita,observacion')
          .eq('activo_tipo', 'VEHICULO')
          .in('activo_id', [...activoIds])
          .like('observacion', CHECKLIST_PREFIX + '%')
          .order('fecha', { ascending:false })
          .limit(1000)
      if (visitasResult.error) throw visitasResult.error
      setVisitas((visitasResult.data || []).map(parseChecklist).filter(Boolean).filter(v => activoIds.has(String(v.activo_id))))
    } catch (e) {
      setErr(mensajeError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [allowedSedeIds, activoId])

  const selected = vehiculos.find(v => String(v.id) === String(form.activo_id)) || null
  const findings=useChecklistFindings(selected,(item,value,detail)=>setForm(f=>({...f,respuestas:{...f.respuestas,[item.id]:value},observaciones_puntos:{...f.observaciones_puntos,[item.id]:detail},observaciones:detail?[f.observaciones,`${item.label}: ${detail.texto} (ticket ${detail.ticket_id})`].filter(Boolean).join('\n'):f.observaciones})))
  const estado = overallStatus(form.respuestas)
  const hoy = todayKey()

  const latestByVehicle = useMemo(() => {
    const map = new Map()
    visitas.forEach(v => {
      if (!map.has(v.activo_id)) map.set(v.activo_id, v)
    })
    return map
  }, [visitas])

  const checksHoy = visitas.filter(v => dateKey(v.row?.fecha) === hoy)
  const pendientes = vehiculos.filter(v => dateKey(latestByVehicle.get(v.id)?.row?.fecha) !== hoy)
  const observadosHoy = checksHoy.filter(v => ['observado','no_apto'].includes(v.estado)).length

  const setItem = (id,value)=>findings.choose(ITEMS.find(i=>i.id===id),value)

  const handleSave = async () => {
    if (!canManage) return
    if (!selected) { setErr('Seleccioná un vehículo.'); return }
    if (saving) return
    const validation = generalChecklistError(form)
    if (validation) { setErr(validation); return }
    setSaving(true)
    setErr(null)
    try {
      const payload = {
        version: 2,
        plantilla: 'control_diario_general',
        fecha_control: fleetToday(),
        dominio: vehicleIdentity(selected).dominio,
        tipo: 'checklist_vehiculo',
        estado,
        activo_id: selected.id,
        activo_nombre: selected.nombre,
        sede_id: selected.sede_id || null,
        sede: selected.sede_nombre || selected.sede || null,
        conductor: perfil?.nombre || perfil?.email || null,
        km: form.km !== '' ? Number(form.km) : null,
        observaciones: form.observaciones.trim() || null,
        respuestas: form.respuestas,
        observaciones_puntos: form.observaciones_puntos || {},
        creado_por: perfil?.nombre || perfil?.email || null,
        created_at: new Date().toISOString(),
      }

      const { error: visitaError } = await supabase
        .schema('mantenimiento')
        .from('visitas_activo')
        .insert({
          activo_id: selected.id,
          tipo_visita: 'inspeccion',
          visitante: payload.conductor,
          observacion: CHECKLIST_PREFIX + JSON.stringify(payload),
          created_by: perfil?.id || null,
        })
      if (visitaError) throw visitaError

      toast.ok('Checklist guardado. Los tickets de cada desvío quedaron registrados al confirmar sus observaciones.')
      setForm({
        activo_id:activoId || '',
        conductor: perfil?.nombre || '',
        km:'',
        observaciones:'',
        respuestas: buildEmptyItems(),
        crearTicket: canCreateTicket,
      })
      await load()
    } catch (e) {
      setErr(mensajeError(e))
    } finally {
      setSaving(false)
    }
  }

  const INPUT = { background:'var(--surface)', border:'1px solid rgba(57,255,20,0.09)', color:'var(--text)', borderRadius:3, padding:'0.75rem 0.85rem', width:'100%', boxSizing:'border-box', fontFamily:'monospace', outline:'none' }
  const LBL = { display:'block', color:'var(--text-dim)', fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:5 }

  return (
    <div className="general-checklist">
      {onBack && <button className="btn-ghost" onClick={onBack}>← Volver a checklists</button>}
      <PageHeader title="Checklist vehicular" subtitle="Control diario · Vehículos de flota general">
        <button onClick={load} disabled={loading} className="btn btn-secondary"><RefreshCw size={14}/> Actualizar</button>
      </PageHeader>
      {activoId && !loading && !selected && <p role="alert">Este vehículo no está disponible para tu cuenta o está dado de baja. Consultá con el responsable de tu sede.</p>}

      <div style={{ display:'flex', gap:'0.65rem', flexWrap:'wrap', marginBottom:'1rem' }}>
        <KPI label="Vehículos activos" value={vehiculos.length} color="var(--phosphor)" />
        <KPI label="Checklists hoy" value={checksHoy.length} sub={`de ${vehiculos.length} unidades`} color="#50B4FF" />
        <KPI label="Pendientes hoy" value={pendientes.length} color={pendientes.length ? '#F59E0B' : '#39FF14'} />
        <KPI label="Observados hoy" value={observadosHoy} color={observadosHoy ? '#FF5050' : '#39FF14'} />
      </div>

      {err && <div style={{ border:'1px solid rgba(255,80,80,0.35)', color:'#FF5050', background:'rgba(255,80,80,0.08)', padding:'0.8rem 1rem', borderRadius:3, marginBottom:'1rem', fontSize:'0.75rem' }}>{err}</div>}

      {selected && findings.panel}
      <div className="general-checklist-layout">
        <section style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.08)', borderRadius:3, padding:'1rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'0.9rem' }}>
            <ClipboardCheck size={16} color="var(--phosphor)" />
            <div>
              <h3 style={{ margin:0, color:'var(--text)', fontSize:'0.95rem' }}>Nuevo control diario</h3>
              <p style={{ margin:0, color:'var(--text-dim)', fontSize:'0.68rem' }}>Respondé cada control. Registrar el checklist no cambia el estado del vehículo.</p>
            </div>
            <span style={{ ...estadoBadge(estado), marginLeft:'auto' }}>{ESTADOS[estado].label}</span>
          </div>

          <div className="general-checklist-fields">
            <div>
              <label style={LBL}>Vehículo *</label>
              <select aria-label="Vehículo" style={INPUT} value={form.activo_id} onChange={e => setForm(f => ({ ...f, activo_id:e.target.value, respuestas:buildEmptyItems(), observaciones:'', km:'' }))} disabled={!canManage || !!activoId}>
                <option value="">— Seleccionar vehículo —</option>
                {vehiculos.map(v => <option key={v.id} value={v.id}>{v.nombre}{vehicleIdentity(v).dominio ? ` · ${vehicleIdentity(v).dominio}` : ''}{v.sede_nombre || v.sede ? ` · ${v.sede_nombre || v.sede}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>Conductor / responsable</label>
              <input aria-label="Responsable" style={INPUT} value={perfil?.nombre || perfil?.email || ''} readOnly />
            </div>
            <div>
              <label style={LBL}>Km</label>
              <input style={INPUT} aria-label="Kilometraje" type="number" min="0" step="1" value={form.km} onChange={e => setForm(f => ({ ...f, km:e.target.value }))} disabled={!canManage} placeholder="0" />
            </div>
          </div>

          <p style={{marginBottom:12}}>Fecha: {fleetToday().split('-').reverse().join('/')} · {Object.values(form.respuestas).filter(Boolean).length}/10 controles respondidos{selected ? ` · Estado: ${selected.estado || 'Sin informar'}` : ''}</p>
          <div style={{ display:'grid', gap:'0.55rem' }}>
            {ITEMS.map(item => (
              <div key={item.id} className="general-checklist-item" role="group" aria-label={item.label}>
                <div>
                  <p style={{ margin:0, color:'var(--text)', fontWeight:700, fontSize:'0.78rem' }}>{item.label}</p>
                  <p style={{ margin:'0.2rem 0 0', color:'var(--text-dim)', fontSize:'0.65rem' }}>{item.help}</p>
                </div>
                <div className="general-checklist-answers">
                  {[
                    ['ok','Conforme','var(--phosphor)'],
                    ['observado','No conforme','#F59E0B'],
                    ['critico','Crítico','#FF5050'],
                    ...(item.optional ? [['na','No aplica','#94A3B8']] : []),
                  ].map(([value, label, color]) => {
                    const active = form.respuestas[item.id] === value
                    return (
                      <button key={value} type="button" aria-pressed={active} disabled={!canManage || saving} onClick={() => setItem(item.id, value)}
                        style={{ border:`1px solid ${active ? color : 'var(--paper-muted, rgba(255,255,255,0.12))'}`, background:active ? 'var(--surface2, var(--surface))' : 'transparent', color:active ? color : 'var(--text-dim)', borderRadius:3, padding:'0.35rem 0.5rem', fontSize:'0.62rem', fontWeight:800, cursor:canManage ? 'pointer' : 'default', fontFamily:'monospace' }}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop:'0.8rem' }}>
            <label style={LBL}>Observaciones</label>
            <textarea aria-label="Observaciones" style={{ ...INPUT, minHeight:90, resize:'vertical' }} value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones:e.target.value }))} disabled={!canManage} placeholder="Describí cualquier desvío, daño, faltante o condición de uso." />
          </div>

          <div style={{ display:'flex', gap:8, marginTop:'1rem' }}>
            <button onClick={handleSave} disabled={!canManage || saving || !selected} className="btn btn-primary"><Save size={14}/> {saving ? 'Guardando...' : 'Guardar checklist'}</button>
            {!canManage && <span style={{ color:'var(--text-dim)', fontSize:'0.68rem', alignSelf:'center' }}>Solo lectura para tu rol.</span>}
          </div>
        </section>

        <section style={{ display:'grid', gap:'1rem' }}>
          <div style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.08)', borderRadius:3, padding:'1rem' }}>
            <h3 style={{ margin:'0 0 0.75rem', color:'var(--text)', fontSize:'0.85rem' }}><AlertTriangle size={14} style={{ verticalAlign:'middle', marginRight:6 }}/> Pendientes de hoy</h3>
            {loading ? (
              <p style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>Cargando...</p>
            ) : pendientes.length === 0 ? (
              <p style={{ color:'#39FF14', fontSize:'0.72rem' }}><CheckCircle2 size={13} style={{ verticalAlign:'middle', marginRight:5 }}/> Todos los vehículos activos tienen checklist hoy.</p>
            ) : (
              <div style={{ display:'grid', gap:6, maxHeight:260, overflowY:'auto' }}>
                {pendientes.map(v => (
                  <button key={v.id} onClick={() => canManage && setForm(f => ({ ...f, activo_id:v.id, respuestas:buildEmptyItems(), observaciones:'', km:'' }))} style={{ textAlign:'left', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', color:'var(--text)', borderRadius:3, padding:'0.55rem 0.7rem', cursor:canManage ? 'pointer' : 'default' }}>
                    <strong style={{ display:'block', fontSize:'0.75rem' }}><Car size={12} style={{ verticalAlign:'middle', marginRight:5 }}/>{v.nombre}</strong>
                    <span style={{ color:'var(--text-dim)', fontSize:'0.63rem' }}>{v.sede_nombre || v.sede || 'Sin sede'} · Último: {fmtFechaHora(latestByVehicle.get(v.id)?.row?.fecha)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.08)', borderRadius:3, padding:'1rem' }}>
            <h3 style={{ margin:'0 0 0.75rem', color:'var(--text)', fontSize:'0.85rem' }}>Últimos controles</h3>
            {visitas.length === 0 ? (
              <p style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>Todavía no hay checklists registrados.</p>
            ) : (
              <div style={{ display:'grid', gap:7, maxHeight:420, overflowY:'auto' }}>
                {visitas.slice(0, 20).map(v => (
                  <div key={v.row.id} style={{ border:'1px solid rgba(255,255,255,0.06)', borderRadius:3, padding:'0.65rem 0.75rem' }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <span style={estadoBadge(v.estado)}>{ESTADOS[v.estado]?.label || v.estado}</span>
                      <strong style={{ color:'var(--text)', fontSize:'0.75rem' }}>{v.activo_nombre || v.row.activo_nombre}</strong>
                      <span style={{ color:'var(--text-dim)', fontSize:'0.63rem', marginLeft:'auto' }}>{fmtFechaHora(v.row.fecha)}</span>
                    </div>
                    <p style={{ margin:'0.45rem 0 0', color:'var(--text-dim)', fontSize:'0.66rem' }}>
                      {v.conductor ? `Conductor: ${v.conductor}` : 'Sin conductor'}{v.km != null ? ` · Km ${v.km}` : ''}{v.observaciones ? ` · ${v.observaciones}` : ''}
                    </p>
                    <details style={{marginTop:8}}><summary>Ver controles</summary>{Object.entries(v.respuestas || {}).map(([id, answer])=><p key={id}>{ITEMS.find(i=>i.id===id)?.label || id}: {GENERAL_ANSWERS[answer] || answer}</p>)}</details>
                    {['observado','no_apto'].includes(v.estado) && (
                      <p style={{ margin:'0.35rem 0 0', color:v.estado === 'no_apto' ? '#FF5050' : '#F59E0B', fontSize:'0.64rem' }}>
                        <Ticket size={12} style={{ verticalAlign:'middle', marginRight:4 }}/> Revisar ticket asociado si se generó automáticamente.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
