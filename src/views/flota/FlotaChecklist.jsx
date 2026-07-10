import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Car, CheckCircle2, ClipboardCheck, RefreshCw, Save, Ticket } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { getActivos, createTicket } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { mensajeError } from '../../lib/errores'
import { toast } from '../../lib/feedback'

const CHECKLIST_PREFIX = 'CHECKLIST_VEHICULO::'

const ITEMS = [
  { id:'documentacion', label:'Documentación obligatoria a bordo', help:'Cédula, seguro, VTV/RTO, SENASA/RMTSA si aplica.' },
  { id:'luces', label:'Luces y señalización', help:'Bajas, altas, giro, balizas, stop y marcha atrás.' },
  { id:'cubiertas', label:'Cubiertas y auxilio', help:'Estado visual, presión aparente, dibujo y rueda de auxilio.' },
  { id:'frenos', label:'Frenos y dirección', help:'Respuesta normal, sin ruidos ni vibraciones anormales.' },
  { id:'fluidos', label:'Fluidos y pérdidas', help:'Aceite, refrigerante, líquido de frenos y pérdidas visibles.' },
  { id:'matafuego', label:'Matafuego y elementos de seguridad', help:'Carga vigente, precinto, balizas/chaleco si corresponde.' },
  { id:'limpieza', label:'Limpieza e higiene', help:'Cabina, caja/sector de carga y ausencia de residuos.' },
  { id:'carroceria', label:'Carrocería / caja / frío', help:'Golpes, cierres, burletes, equipo de frío o aislamiento si aplica.' },
]

const ESTADOS = {
  apto: { label:'Apto', color:'#39FF14' },
  observado: { label:'Observado', color:'#F59E0B' },
  no_apto: { label:'No apto', color:'#FF5050' },
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function dateKey(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
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

function buildEmptyItems() {
  return ITEMS.reduce((acc, item) => ({ ...acc, [item.id]:'ok' }), {})
}

function overallStatus(respuestas) {
  const values = Object.values(respuestas || {})
  if (values.includes('critico')) return 'no_apto'
  if (values.includes('observado')) return 'observado'
  return 'apto'
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
  const { perfil, rol, allowedSedeIds, can } = useAuth()
  const canManage = can('flota', 'manage') || ['admin','editor','grupo','encargado'].includes(rol)
  const [vehiculos, setVehiculos] = useState([])
  const [visitas, setVisitas] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const [form, setForm] = useState({
    activo_id:'',
    conductor: perfil?.nombre || '',
    km:'',
    observaciones:'',
    respuestas: buildEmptyItems(),
    crearTicket: true,
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
      const [vehiculosData, visitasResult] = await Promise.all([
        getActivos(filtros),
        supabase.from('mnt_visitas')
          .select('id,activo_id,activo_nombre,activo_sede,fecha,visitante,tipo_visita,observacion')
          .eq('activo_tipo', 'VEHICULO')
          .order('fecha', { ascending:false })
          .limit(250),
      ])
      if (visitasResult.error) throw visitasResult.error
      const activos = (vehiculosData || []).filter(v => !['baja','inactivo'].includes(String(v.estado || '').toLowerCase()))
      const activoIds = new Set(activos.map(v => String(v.id)))
      setVehiculos(activos)
      setVisitas((visitasResult.data || []).map(parseChecklist).filter(Boolean).filter(v => activoIds.has(String(v.activo_id))))
    } catch (e) {
      setErr(mensajeError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [allowedSedeIds])

  const selected = vehiculos.find(v => String(v.id) === String(form.activo_id)) || null
  const estado = overallStatus(form.respuestas)
  const requiereTicket = estado === 'no_apto' || estado === 'observado'
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

  const setItem = (id, value) => setForm(f => ({ ...f, respuestas:{ ...f.respuestas, [id]:value } }))

  const handleSave = async () => {
    if (!canManage) return
    if (!selected) { setErr('Seleccioná un vehículo.'); return }
    setSaving(true)
    setErr(null)
    try {
      const payload = {
        version: 1,
        tipo: 'checklist_vehiculo',
        estado,
        activo_id: selected.id,
        activo_nombre: selected.nombre,
        sede_id: selected.sede_id || null,
        sede: selected.sede_nombre || selected.sede || null,
        conductor: form.conductor.trim() || perfil?.nombre || null,
        km: form.km !== '' ? Number(form.km) : null,
        observaciones: form.observaciones.trim() || null,
        respuestas: form.respuestas,
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

      if (form.crearTicket && requiereTicket) {
        const problemas = ITEMS
          .filter(item => ['observado','critico'].includes(form.respuestas[item.id]))
          .map(item => `${item.label}: ${form.respuestas[item.id] === 'critico' ? 'crítico' : 'observado'}`)
          .join('\n')

        await createTicket({
          tipo: 'correctivo',
          prioridad: estado === 'no_apto' ? 'critica' : 'alta',
          estado: 'abierto',
          categoria: 'Vehiculos',
          activo_id: selected.id,
          activo_nombre: selected.nombre,
          sede_id: selected.sede_id || null,
          sede: selected.sede_nombre || selected.sede || null,
          lectura_km: payload.km,
          creado_por: perfil?.id || null,
          descripcion: `Checklist vehicular ${ESTADOS[estado].label}: ${selected.nombre}`,
          diagnostico: [problemas, payload.observaciones].filter(Boolean).join('\n\n'),
        })
      }

      toast.success(requiereTicket && form.crearTicket ? 'Checklist guardado y ticket creado.' : 'Checklist guardado.')
      setForm({
        activo_id:'',
        conductor: perfil?.nombre || '',
        km:'',
        observaciones:'',
        respuestas: buildEmptyItems(),
        crearTicket: true,
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
    <div style={{ padding:'1.5rem 2rem', overflowY:'auto', height:'100%' }}>
      <PageHeader title="Checklist vehicular" subtitle="Control obligatorio de salida/uso para vehículos Fly">
        <button onClick={load} disabled={loading} className="btn btn-secondary"><RefreshCw size={14}/> Actualizar</button>
      </PageHeader>

      <div style={{ display:'flex', gap:'0.65rem', flexWrap:'wrap', marginBottom:'1rem' }}>
        <KPI label="Vehículos activos" value={vehiculos.length} color="var(--phosphor)" />
        <KPI label="Checklists hoy" value={checksHoy.length} sub={`de ${vehiculos.length} unidades`} color="#50B4FF" />
        <KPI label="Pendientes hoy" value={pendientes.length} color={pendientes.length ? '#F59E0B' : '#39FF14'} />
        <KPI label="Observados hoy" value={observadosHoy} color={observadosHoy ? '#FF5050' : '#39FF14'} />
      </div>

      {err && <div style={{ border:'1px solid rgba(255,80,80,0.35)', color:'#FF5050', background:'rgba(255,80,80,0.08)', padding:'0.8rem 1rem', borderRadius:3, marginBottom:'1rem', fontSize:'0.75rem' }}>{err}</div>}

      <div style={{ display:'grid', gridTemplateColumns:'minmax(0, 1.15fr) minmax(320px, 0.85fr)', gap:'1rem', alignItems:'start' }}>
        <section style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.08)', borderRadius:3, padding:'1rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'0.9rem' }}>
            <ClipboardCheck size={16} color="var(--phosphor)" />
            <div>
              <h3 style={{ margin:0, color:'var(--text)', fontSize:'0.95rem' }}>Nuevo checklist</h3>
              <p style={{ margin:0, color:'var(--text-dim)', fontSize:'0.68rem' }}>Si queda observado o no apto puede abrir ticket automáticamente.</p>
            </div>
            <span style={{ ...estadoBadge(estado), marginLeft:'auto' }}>{ESTADOS[estado].label}</span>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr 0.6fr', gap:'0.7rem', marginBottom:'0.9rem' }}>
            <div>
              <label style={LBL}>Vehículo *</label>
              <select style={INPUT} value={form.activo_id} onChange={e => setForm(f => ({ ...f, activo_id:e.target.value }))} disabled={!canManage}>
                <option value="">— Seleccionar vehículo —</option>
                {vehiculos.map(v => <option key={v.id} value={v.id}>{v.nombre}{v.sede_nombre || v.sede ? ` · ${v.sede_nombre || v.sede}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>Conductor / responsable</label>
              <input style={INPUT} value={form.conductor} onChange={e => setForm(f => ({ ...f, conductor:e.target.value }))} disabled={!canManage} placeholder="Nombre de quien controla" />
            </div>
            <div>
              <label style={LBL}>Km</label>
              <input style={INPUT} type="number" value={form.km} onChange={e => setForm(f => ({ ...f, km:e.target.value }))} disabled={!canManage} placeholder="0" />
            </div>
          </div>

          <div style={{ display:'grid', gap:'0.55rem' }}>
            {ITEMS.map(item => (
              <div key={item.id} style={{ border:'1px solid rgba(255,255,255,0.06)', borderRadius:3, padding:'0.7rem', display:'grid', gridTemplateColumns:'1fr auto', gap:'0.8rem', alignItems:'center' }}>
                <div>
                  <p style={{ margin:0, color:'var(--text)', fontWeight:700, fontSize:'0.78rem' }}>{item.label}</p>
                  <p style={{ margin:'0.2rem 0 0', color:'var(--text-dim)', fontSize:'0.65rem' }}>{item.help}</p>
                </div>
                <div style={{ display:'flex', gap:4 }}>
                  {[
                    ['ok','OK','#39FF14'],
                    ['observado','OBS','#F59E0B'],
                    ['critico','CRÍTICO','#FF5050'],
                  ].map(([value, label, color]) => {
                    const active = form.respuestas[item.id] === value
                    return (
                      <button key={value} type="button" disabled={!canManage} onClick={() => setItem(item.id, value)}
                        style={{ border:`1px solid ${active ? color : 'rgba(255,255,255,0.12)'}`, background:active ? `${color}22` : 'transparent', color:active ? color : 'var(--text-dim)', borderRadius:3, padding:'0.35rem 0.5rem', fontSize:'0.62rem', fontWeight:800, cursor:canManage ? 'pointer' : 'default', fontFamily:'monospace' }}>
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
            <textarea style={{ ...INPUT, minHeight:90, resize:'vertical' }} value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones:e.target.value }))} disabled={!canManage} placeholder="Describí cualquier desvío, daño, faltante o condición de uso." />
          </div>

          {requiereTicket && (
            <label style={{ display:'flex', gap:8, alignItems:'center', color:'var(--text)', fontSize:'0.72rem', marginTop:'0.8rem' }}>
              <input type="checkbox" checked={form.crearTicket} onChange={e => setForm(f => ({ ...f, crearTicket:e.target.checked }))} disabled={!canManage} />
              Crear ticket de flota automáticamente por este desvío.
            </label>
          )}

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
                  <button key={v.id} onClick={() => canManage && setForm(f => ({ ...f, activo_id:v.id }))} style={{ textAlign:'left', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', color:'var(--text)', borderRadius:3, padding:'0.55rem 0.7rem', cursor:canManage ? 'pointer' : 'default' }}>
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
                      {v.conductor ? `Conductor: ${v.conductor}` : 'Sin conductor'}{v.km ? ` · Km ${v.km}` : ''}{v.observaciones ? ` · ${v.observaciones}` : ''}
                    </p>
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
