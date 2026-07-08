import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { getSedes } from '../../lib/queries'
import { useAuth } from '../../lib/auth'
import { fmtFecha } from '../../lib/dateUtils'
import { CheckSquare, Square, Plus, X, ChevronDown, ChevronRight, Play, ClipboardList } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { toast } from '../../lib/feedback'
import { mensajeError } from '../../lib/errores'

const FREC_COLOR = { DIARIA:'#39FF14', SEMANAL:'#3B82F6', MENSUAL:'#F59E0B', TRIMESTRAL:'#8B5CF6', ANUAL:'#F97316', POR_KM:'#EC4899' }
const CAT_COLOR  = { inspeccion:'#50b4ff', limpieza:'#39FF14', lubricacion:'#ffb400', ajuste:'#f97316', reemplazo:'#ff5050', medicion:'#c084fc' }
const CAT_LABEL  = { inspeccion:'Inspecc.', limpieza:'Limpieza', lubricacion:'Lubric.', ajuste:'Ajuste', reemplazo:'Reemplazo', medicion:'Medición' }
const TIPO_COLOR = { VEHICULO:'#50b4ff', EQUIPO:'#ffb400', INSTALACION:'#c084fc' }

function dias(fecha) {
  if (!fecha) return null
  return Math.ceil((new Date(fecha) - new Date()) / 86400000)
}

function ProximaBadge({ fecha }) {
  if (!fecha) return <span style={{ fontSize:'0.62rem', color:'var(--text-dim)' }}>—</span>
  const d = dias(fecha)
  const color = d < 0 ? '#ff5050' : d <= 7 ? '#f59e0b' : '#39FF14'
  return (
    <span style={{ fontSize:'0.62rem', fontFamily:'monospace', color, background:`${color}15`, border:`1px solid ${color}30`, borderRadius:3, padding:'1px 6px' }}>
      {d < 0 ? `${Math.abs(d)}d vencido` : d === 0 ? 'Hoy' : `en ${d}d`}
    </span>
  )
}

// ─── Modal Ejecutar Plan ──────────────────────────────────────────────────────
function EjecucionModal({ plan, onClose, onSaved }) {
  const [checklist, setChecklist] = useState([])
  const [checks, setChecks]       = useState({})
  const [obs, setObs]             = useState({})
  const [fecha, setFecha]         = useState(new Date().toISOString().split('T')[0])
  const [realizado, setRealizado] = useState('')
  const [notas, setNotas]         = useState('')
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    supabase.from('mnt_plan_checklist').select('*')
      .eq('plan_id', plan.id).order('orden')
      .then(({ data }) => {
        setChecklist(data || [])
        const init = {}
        ;(data || []).forEach(i => { init[i.id] = false })
        setChecks(init)
      })
  }, [plan.id])

  const toggle = (id) => setChecks(c => ({ ...c, [id]: !c[id] }))
  const completados = Object.values(checks).filter(Boolean).length
  const total = checklist.length
  const pct = total > 0 ? Math.round((completados / total) * 100) : 0

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: ejec, error } = await supabase
        .from('mnt_ejecuciones')
        .insert({ plan_id: plan.id, fecha, realizado_por: realizado, observaciones: notas })
        .select('id').single()
      if (error) throw error

      const items = checklist.map(i => ({
        ejecucion_id: ejec.id,
        checklist_id: i.id,
        completado: checks[i.id] || false,
        observacion: obs[i.id] || null,
      }))
      await supabase.from('ejecucion_items').insert(items)

      // Actualizar proxima_fecha y ultimo_realizado en el plan
      const proxima = calcProxima(plan.frecuencia, fecha)
      await supabase.from('mnt_planes').update({ ultimo_realizado: fecha, proxima_fecha: proxima })
        .eq('id', plan.id)

      onSaved()
    } catch(e) { toast.error(mensajeError(e)) } finally { setSaving(false) }
  }

  function calcProxima(frecuencia, desde) {
    const d = new Date(desde)
    switch(frecuencia) {
      case 'DIARIA':      d.setDate(d.getDate() + 1); break
      case 'SEMANAL':     d.setDate(d.getDate() + 7); break
      case 'MENSUAL':     d.setMonth(d.getMonth() + 1); break
      case 'TRIMESTRAL':  d.setMonth(d.getMonth() + 3); break
      case 'ANUAL':       d.setFullYear(d.getFullYear() + 1); break
      default:            d.setMonth(d.getMonth() + 1)
    }
    return d.toISOString().split('T')[0]
  }

  const INPUT = { padding:'0.5rem 0.75rem', borderRadius:5, background:'#1a1a22', border:'1px solid rgba(57,255,20,0.08)', color:'var(--text)', fontSize:'0.8rem', fontFamily:'inherit', width:'100%', colorScheme:'dark' }
  const LABEL = { fontSize:'0.6rem', color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:'0.3rem' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:16 }}>
      <div style={{ background:'var(--surface)', borderRadius:3, padding:'1.5rem', width:'100%', maxWidth:620, maxHeight:'92vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
              <Play size={14} style={{ color:'var(--phosphor)' }} />
              <h2 style={{ color:'var(--text)', fontWeight:700, fontSize:'1rem' }}>Ejecutar: {plan.nombre}</h2>
            </div>
            {plan.activo_nombre && (
              <p style={{ fontSize:'0.68rem', color:'var(--text-dim)' }}>{plan.activo_nombre}</p>
            )}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'1.2rem' }}>×</button>
        </div>

        {/* Progreso */}
        <div style={{ background:'var(--surface)', borderRadius:2, padding:'10px 14px', marginBottom:'1rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <span style={{ fontSize:'0.62rem', color:'var(--text-dim)', fontFamily:'monospace' }}>PROGRESO</span>
            <span style={{ fontSize:'0.75rem', color: pct === 100 ? 'var(--phosphor)' : 'var(--text)', fontFamily:'monospace', fontWeight:700 }}>{completados}/{total} — {pct}%</span>
          </div>
          <div style={{ height:6, background:'rgba(57,255,20,0.07)', borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${pct}%`, background: pct === 100 ? 'var(--phosphor)' : '#f59e0b', borderRadius:3, transition:'width 0.3s', boxShadow: pct === 100 ? '0 0 8px var(--phosphor)' : 'none' }} />
          </div>
        </div>

        {/* Datos básicos */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem', marginBottom:'1rem' }}>
          <div><label style={LABEL}>Fecha ejecución</label>
            <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={INPUT} /></div>
          <div><label style={LABEL}>Realizado por *</label>
            <input required value={realizado} onChange={e=>setRealizado(e.target.value)} style={INPUT} placeholder="Ej: Juan Pérez" /></div>
        </div>

        {/* Checklist */}
        <div style={{ marginBottom:'1rem' }}>
          <p style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', marginBottom:8 }}>CHECKLIST</p>
          {checklist.map(item => (
            <div key={item.id} style={{
              padding:'10px 12px', marginBottom:4, borderRadius:2,
              background: checks[item.id] ? 'rgba(57,255,20,0.05)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${checks[item.id] ? 'rgba(57,255,20,0.15)' : 'rgba(57,255,20,0.05)'}`,
              transition:'all 0.15s',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <button onClick={() => toggle(item.id)}
                  style={{ background:'none', border:'none', cursor:'pointer', padding:0, color: checks[item.id] ? 'var(--phosphor)' : 'rgba(255,255,255,0.25)', flexShrink:0 }}>
                  {checks[item.id] ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
                <span style={{ flex:1, fontSize:'0.8rem', color: checks[item.id] ? 'var(--text)' : 'var(--text-dim)', textDecoration: checks[item.id] ? 'none' : 'none' }}>
                  {item.tarea}
                  {item.obligatorio && <span style={{ marginLeft:6, fontSize:'0.6rem', color:'#ff5050' }}>*</span>}
                </span>
                {item.categoria && (
                  <span style={{ fontSize:'0.6rem', padding:'1px 6px', borderRadius:3, background:`${CAT_COLOR[item.categoria]}18`, color:CAT_COLOR[item.categoria], border:`1px solid ${CAT_COLOR[item.categoria]}30`, fontFamily:'monospace', flexShrink:0 }}>
                    {CAT_LABEL[item.categoria]}
                  </span>
                )}
              </div>
              {checks[item.id] && (
                <input
                  value={obs[item.id] || ''}
                  onChange={e => setObs(o => ({...o, [item.id]: e.target.value}))}
                  style={{ marginTop:6, marginLeft:26, ...INPUT, fontSize:'0.72rem', padding:'0.3rem 0.6rem' }}
                  placeholder="Observación (opcional)"
                />
              )}
            </div>
          ))}
        </div>

        {/* Notas generales */}
        <div style={{ marginBottom:'1rem' }}>
          <label style={LABEL}>Observaciones generales</label>
          <textarea value={notas} onChange={e=>setNotas(e.target.value)} rows={2} style={{...INPUT, resize:'vertical'}} placeholder="Ej: Todo en orden, sin novedades" />
        </div>

        <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'0.6rem 1.1rem', borderRadius:2, background:'rgba(57,255,20,0.05)', color:'var(--text-dim)', border:'none', cursor:'pointer', fontWeight:600 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || !realizado}
            style={{ padding:'0.6rem 1.3rem', borderRadius:2, background: (!realizado || saving) ? 'rgba(57,255,20,0.4)' : 'var(--phosphor)', color:'#0A0A0E', border:'none', cursor: !realizado ? 'not-allowed' : 'pointer', fontWeight:700 }}>
            {saving ? 'Guardando...' : 'Registrar Ejecución'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Panel detalle plan ───────────────────────────────────────────────────────
function PlanDetalle({ plan, activos, responsables, onClose, onSaved, onMassAssign }) {
  const [checklist, setChecklist] = useState([])
  const [ejecuciones, setEjecuciones] = useState([])
  const [newTarea, setNewTarea]  = useState('')
  const [newCat, setNewCat]      = useState('inspeccion')
  const [form, setForm]          = useState({ ...plan })
  const [saving, setSaving]      = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    supabase.from('mnt_plan_checklist').select('*').eq('plan_id', plan.id).order('orden')
      .then(({ data }) => setChecklist(data || []))
    supabase.from('mnt_ejecuciones').select('*').eq('plan_id', plan.id).order('fecha', { ascending: false }).limit(10)
      .then(({ data }) => setEjecuciones(data || []))
  }, [plan.id])

  const addTarea = async () => {
    if (!newTarea.trim()) return
    const orden = (checklist[checklist.length - 1]?.orden || 0) + 1
    const { data } = await supabase.from('plan_checklist').insert({ plan_id: plan.id, tarea: newTarea, categoria: newCat, orden }).select().single()
    if (data) { setChecklist(c => [...c, data]); setNewTarea('') }
  }

  const removeTarea = async (id) => {
    await supabase.from('plan_checklist').delete().eq('id', id)
    setChecklist(c => c.filter(i => i.id !== id))
  }

  const savePlan = async () => {
    setSaving(true)
    await supabase.from('mnt_planes').update({
      nombre: form.nombre, descripcion: form.descripcion,
      frecuencia: form.frecuencia, proxima_fecha: form.proxima_fecha,
      responsable_id: form.responsable_id || null,
      activo_id: form.activo_id || null,
    }).eq('id', plan.id)
    setSaving(false)
    onSaved()
  }

  const INPUT = { padding:'0.45rem 0.7rem', borderRadius:5, background:'#1a1a22', border:'1px solid rgba(57,255,20,0.08)', color:'var(--text)', fontSize:'0.78rem', fontFamily:'inherit', width:'100%', colorScheme:'dark' }
  const LABEL = { fontSize:'0.6rem', color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:'0.25rem' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:16 }}>
      <div style={{ background:'var(--surface)', borderRadius:3, padding:'1.5rem', width:'100%', maxWidth:680, maxHeight:'92vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <ClipboardList size={14} style={{ color:'var(--phosphor)' }} />
            <h2 style={{ color:'var(--text)', fontWeight:700, fontSize:'1rem' }}>Configurar Plan</h2>
          </div>
          <div style={{ display:'flex', gap:'0.5rem' }}>
            {!form.activo_id && plan.id !== 'nuevo' && (
              <button onClick={() => onMassAssign(plan)} style={{ background:'rgba(57,255,20,0.1)', color:'var(--phosphor)', border:'1px solid var(--phosphor)', borderRadius:3, padding:'0.3rem 0.6rem', fontSize:'0.7rem', fontWeight:600, cursor:'pointer' }}>
                Asignar Lote a Sede
              </button>
            )}
            <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'1.2rem' }}>×</button>
          </div>
        </div>

        {/* Datos del plan */}
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'0 1rem', marginBottom:'0.8rem' }}>
          <div><label style={LABEL}>Nombre del plan</label>
            <input value={form.nombre || ''} onChange={e=>set('nombre',e.target.value)} style={INPUT} placeholder="Ej: Mantenimiento preventivo cámara frigorífica" /></div>
          <div><label style={LABEL}>Frecuencia</label>
            <select value={form.frecuencia || 'MENSUAL'} onChange={e=>set('frecuencia',e.target.value)} style={INPUT}>
              {Object.keys(FREC_COLOR).map(f => <option key={f} value={f}>{f}</option>)}
            </select></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0 1rem', marginBottom:'0.8rem' }}>
          <div><label style={LABEL}>Activo asignado</label>
            <select value={form.activo_id || ''} onChange={e=>set('activo_id',e.target.value||null)} style={INPUT}>
              <option value="">Sin activo (plantilla)</option>
              {activos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select></div>
          <div><label style={LABEL}>Responsable</label>
            <select value={form.responsable_id || ''} onChange={e=>set('responsable_id',e.target.value||null)} style={INPUT}>
              <option value="">Sin asignar</option>
              {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select></div>
          <div><label style={LABEL}>Próxima fecha</label>
            <input type="date" value={form.proxima_fecha || ''} onChange={e=>set('proxima_fecha',e.target.value)} style={INPUT} /></div>
        </div>

        {/* Checklist */}
        <div style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.06)', borderRadius:3, padding:'12px 14px', marginBottom:'1rem' }}>
          <p style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', marginBottom:8 }}>ÍTEMS DE CHECKLIST ({checklist.length})</p>
          {checklist.map((item, i) => (
            <div key={item.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom: i < checklist.length-1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
              <span style={{ fontSize:'0.62rem', color:'var(--text-dim)', fontFamily:'monospace', minWidth:18 }}>{item.orden}.</span>
              <span style={{ flex:1, fontSize:'0.78rem', color:'var(--text)' }}>{item.tarea}</span>
              {item.categoria && (
                <span style={{ fontSize:'0.6rem', padding:'1px 6px', borderRadius:3, background:`${CAT_COLOR[item.categoria]}15`, color:CAT_COLOR[item.categoria], fontFamily:'monospace' }}>
                  {CAT_LABEL[item.categoria]}
                </span>
              )}
              <button onClick={() => removeTarea(item.id)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,80,80,0.5)', padding:0, fontSize:'0.85rem' }}>×</button>
            </div>
          ))}
          {/* Agregar ítem */}
          <div style={{ display:'flex', gap:6, marginTop:10, alignItems:'center' }}>
            <input value={newTarea} onChange={e=>setNewTarea(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTarea()}
              style={{ flex:1, ...INPUT }} placeholder="Nueva tarea..." />
            <select value={newCat} onChange={e=>setNewCat(e.target.value)} style={{ ...INPUT, width:'auto', minWidth:100 }}>
              {Object.entries(CAT_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button onClick={addTarea} style={{ padding:'0.45rem 0.7rem', borderRadius:5, background:'rgba(57,255,20,0.1)', border:'1px solid var(--phosphor)', color:'var(--phosphor)', cursor:'pointer', fontWeight:700, fontSize:'0.75rem' }}>+</button>
          </div>
        </div>

        {/* Historial ejecuciones */}
        {ejecuciones.length > 0 && (
          <div style={{ marginBottom:'1rem' }}>
            <p style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em', marginBottom:8 }}>ÚLTIMAS EJECUCIONES</p>
            {ejecuciones.slice(0,5).map(e => (
              <div key={e.id} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.03)', fontSize:'0.72rem' }}>
                <span style={{ color:'var(--phosphor)', fontFamily:'monospace' }}>{fmtFecha(e.fecha)}</span>
                <span style={{ color:'var(--text-dim)' }}>{e.realizado_por || '—'}</span>
                {e.observaciones && <span style={{ color:'var(--text-dim)', fontSize:'0.65rem', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.observaciones}</span>}
              </div>
            ))}
          </div>
        )}

        <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'0.6rem 1.1rem', borderRadius:2, background:'rgba(57,255,20,0.05)', color:'var(--text-dim)', border:'none', cursor:'pointer', fontWeight:600 }}>Cancelar</button>
          <button onClick={savePlan} disabled={saving}
            style={{ padding:'0.6rem 1.3rem', borderRadius:2, background:saving?'rgba(57,255,20,0.4)':'var(--phosphor)', color:'#0A0A0E', border:'none', cursor:'pointer', fontWeight:700 }}>
            {saving ? 'Guardando...' : 'Guardar Plan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Asignación Masiva ───────────────────────────────────────────────────
function MassAssignModal({ plan, activos, sedes, onClose, onSaved }) {
  const [sedeId, setSedeId] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [fecha, setFecha] = useState('')
  const [saving, setSaving] = useState(false)

  // Si el usuario solo tiene una sede asignada (ej: encargado), queda preseleccionada
  useEffect(() => { if (sedes?.length === 1) setSedeId(String(sedes[0].id)) }, [sedes])

  // Get unique categories for this Sede and Tipo
  const categoriasSede = Array.from(new Set(activos.filter(a => a.sede_id === sedeId && (plan.tipo_activo ? a.tipo === plan.tipo_activo : true)).map(a => a.categoria))).filter(Boolean).sort()

  // Filter activos by selected sede, matching plan.tipo_activo, AND category filter
  const activosSede = activos.filter(a => 
    a.sede_id === sedeId && 
    (plan.tipo_activo ? a.tipo === plan.tipo_activo : true) &&
    (categoriaFiltro ? a.categoria === categoriaFiltro : true)
  )

  const handleSave = async () => {
    if (!sedeId || selectedIds.length === 0 || !fecha) return toast.warn('Completa todos los campos')
    setSaving(true)
    
    try {
      const { data: templateItems } = await supabase.from('mnt_plan_checklist').select('*').eq('plan_id', plan.id).order('orden')
      
      for (const act_id of selectedIds) {
        const { data: newPlan, error: pErr } = await supabase.from('mnt_planes').insert({
          nombre: plan.nombre,
          descripcion: plan.descripcion,
          frecuencia: plan.frecuencia,
          tipo_activo: plan.tipo_activo,
          responsable: plan.responsable || null,
          responsable_id: plan.responsable_id || null,
          activo_id: act_id,
          proxima_fecha: fecha,
          activo: true
        }).select('id').single()
        
        if (pErr) throw pErr
        
        if (templateItems && templateItems.length > 0) {
          const itemsToInsert = templateItems.map(ti => ({
            plan_id: newPlan.id,
            tarea: ti.tarea,
            categoria: ti.categoria,
            orden: ti.orden
          }))
          const { error: cErr } = await supabase.from('plan_checklist').insert(itemsToInsert)
          if (cErr) throw cErr
        }
      }
      
      onSaved()
    } catch(e) {
      toast.error(mensajeError(e))
    } finally {
      setSaving(false)
    }
  }

  const INPUT = { padding:'0.5rem 0.75rem', borderRadius:5, background:'#1a1a22', border:'1px solid rgba(57,255,20,0.08)', color:'var(--text)', fontSize:'0.8rem', fontFamily:'inherit', width:'100%', colorScheme:'dark' }
  const LABEL = { fontSize:'0.6rem', color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:'0.3rem' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:70, padding:16 }}>
      <div style={{ background:'var(--surface)', borderRadius:3, padding:'1.5rem', width:'100%', maxWidth:500, maxHeight:'92vh', overflowY:'auto' }}>
        <h2 style={{ color:'var(--text)', fontWeight:700, fontSize:'1rem', marginBottom:'1rem' }}>Asignación Masiva por Sede</h2>
        <p style={{ fontSize:'0.75rem', color:'var(--text-dim)', marginBottom:'1.5rem' }}>
          Se crearán instancias individuales de <strong style={{ color:'var(--phosphor)' }}>{plan.nombre}</strong> para los activos seleccionados.
        </p>

        <div style={{ marginBottom:'1rem' }}>
          <label style={LABEL}>1. Seleccionar Sede</label>
          <select value={sedeId} onChange={e => { setSedeId(e.target.value); setSelectedIds([]); setCategoriaFiltro('') }} style={INPUT}>
            <option value="">-- Elige una sede --</option>
            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>

        {sedeId && (
          <div style={{ marginBottom:'1rem' }}>
            <label style={LABEL}>2. Filtrar por Categoría (Opcional)</label>
            <select value={categoriaFiltro} onChange={e => { setCategoriaFiltro(e.target.value); setSelectedIds([]) }} style={INPUT}>
              <option value="">-- Todas las categorías --</option>
              {categoriasSede.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {sedeId && (
          <div style={{ marginBottom:'1rem' }}>
            <label style={LABEL}>3. Equipos Disponibles ({activosSede.length})</label>
            <div style={{ background:'#1a1a22', border:'1px solid rgba(255,255,255,0.05)', borderRadius:5, maxHeight:180, overflowY:'auto', padding:'0.5rem' }}>
              {activosSede.length === 0 ? <p style={{ fontSize:'0.75rem', color:'var(--text-dim)', textAlign:'center', margin:'1rem 0' }}>No hay activos coincidentes.</p> : null}
              {activosSede.map(a => (
                <label key={a.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:'0.8rem', color:'var(--text)', padding:'0.4rem', borderBottom:'1px solid rgba(255,255,255,0.02)', cursor:'pointer' }}>
                  <input type="checkbox" 
                    checked={selectedIds.includes(a.id)}
                    onChange={e => {
                      if (e.target.checked) setSelectedIds(prev => [...prev, a.id])
                      else setSelectedIds(prev => prev.filter(id => id !== a.id))
                    }}
                    style={{ accentColor:'var(--phosphor)' }}
                  />
                  <span>{a.nombre}</span>
                  <span style={{ color:'var(--text-dim)', fontSize:'0.65rem', marginLeft:'auto' }}>{a.categoria || 'Sin categoría'}</span>
                </label>
              ))}
            </div>
            {activosSede.length > 0 && (
              <div style={{ marginTop:8, display:'flex', gap:10 }}>
                <button onClick={() => setSelectedIds(activosSede.map(a => a.id))} style={{ background:'none', border:'none', color:'var(--phosphor)', fontSize:'0.65rem', cursor:'pointer' }}>Seleccionar Todos</button>
                <button onClick={() => setSelectedIds([])} style={{ background:'none', border:'none', color:'var(--text-dim)', fontSize:'0.65rem', cursor:'pointer' }}>Desmarcar Todos</button>
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom:'1.5rem' }}>
          <label style={LABEL}>4. Próxima Fecha (Inicio)</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={INPUT} />
        </div>

        <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'0.6rem 1.1rem', borderRadius:2, background:'rgba(57,255,20,0.05)', color:'var(--text-dim)', border:'none', cursor:'pointer', fontWeight:600 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || !sedeId || selectedIds.length === 0 || !fecha}
            style={{ padding:'0.6rem 1.3rem', borderRadius:2, background: (saving || !sedeId || selectedIds.length === 0 || !fecha) ? 'rgba(57,255,20,0.4)' : 'var(--phosphor)', color:'#0A0A0E', border:'none', cursor: (saving || !sedeId || selectedIds.length === 0 || !fecha) ? 'not-allowed' : 'pointer', fontWeight:700 }}>
            {saving ? 'Clonando...' : 'Clonar y Asignar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Vista principal ──────────────────────────────────────────────────────────
export default function MntPlanes({ defaultTipo, focusId } = {}) {
  const { allowedSedeIds } = useAuth()
  const [planes, setPlanes]           = useState([])
  const [activos, setActivos]         = useState([])
  const [sedes, setSedes]             = useState([])
  const [responsables, setResponsables] = useState([])
  const [loading, setLoading]         = useState(true)
  const [filtroTipo, setFiltroTipo]   = useState(defaultTipo || 'todos')
  const [modalEjec, setModalEjec]     = useState(null)
  const [modalDet, setModalDet]       = useState(null)
  const [modalMass, setModalMass]     = useState(null) // plan to mass assign
  useEffect(() => {
    if (!focusId || loading) return
    const target = planes.find(item => String(item.id) === String(focusId))
    if (target) setModalDet(target)
  }, [focusId, loading, planes])

  const load = useCallback(async () => {
    setLoading(true)
    let activosQuery = supabase.from('mnt_activos').select('id,nombre,tipo,sede_id').order('nombre')
    if (allowedSedeIds?.length) activosQuery = activosQuery.in('sede_id', allowedSedeIds)
    const [pRes, aRes, rRes, sRes] = await Promise.all([
      supabase.from('mnt_planes').select('*').eq('activo', true).order('proxima_fecha'),
      activosQuery,
      supabase.from('mnt_responsables').select('id,nombre,rol,telefono,email').eq('activo', true),
      getSedes(allowedSedeIds)
    ])
    const activosPermitidos = aRes.data || []
    // mnt_planes no tiene sede_id propio: se acota por el activo al que está asignado.
    // Los planes sin activo asignado (plantillas) quedan visibles para todos los roles territoriales.
    const idsActivoPermitidos = new Set(activosPermitidos.map(a => a.id))
    const planesPermitidos = allowedSedeIds === null
      ? (pRes.data || [])
      : (pRes.data || []).filter(p => !p.activo_id || idsActivoPermitidos.has(p.activo_id))
    setPlanes(planesPermitidos)
    setActivos(activosPermitidos)
    setResponsables(rRes.data || [])
    setSedes(sRes || [])
    setLoading(false)
  }, [allowedSedeIds])

  useEffect(() => { load() }, [load])

  const tipos = ['todos', 'VEHICULO', 'EQUIPO', 'INSTALACION']
  const filtrados = planes.filter(p => filtroTipo === 'todos' || p.tipo_activo === filtroTipo || p.activo_tipo_real === filtroTipo)

  const vencidos   = planes.filter(p => p.proxima_fecha && dias(p.proxima_fecha) < 0).length
  const proximos   = planes.filter(p => p.proxima_fecha && dias(p.proxima_fecha) >= 0 && dias(p.proxima_fecha) <= 7).length

  const CHIP = (active) => ({
    padding:'0.3rem 0.75rem', borderRadius:3, fontSize:'0.65rem', fontWeight:600,
    border:'none', cursor:'pointer',
    background: active ? 'rgba(80,180,255,0.15)' : 'var(--surface)',
    color: active ? '#50b4ff' : 'var(--text-dim)',
  })

  return (
    <div style={{ padding:'1.5rem 2rem', height:'100%', display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <PageHeader title="Planes Preventivos" subtitle="Checklist por tipo de activo · FK mantenimiento">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {vencidos > 0 && (
            <span style={{ fontSize:'0.62rem', color:'#ff5050', background:'rgba(255,80,80,0.1)', border:'1px solid rgba(255,80,80,0.3)', borderRadius:4, padding:'3px 8px' }}>
              {vencidos} vencido{vencidos>1?'s':''}
            </span>
          )}
          {proximos > 0 && (
            <span style={{ fontSize:'0.62rem', color:'#f59e0b', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:4, padding:'3px 8px' }}>
              {proximos} próximo{proximos>1?'s':''} (7d)
            </span>
          )}
          <button onClick={() => setModalDet({ id:'nuevo', nombre:'', frecuencia:'MENSUAL', tipo_activo:'EQUIPO', activo:true })}
            style={{ background:'var(--phosphor)', color:'#0A0A0E', border:'none', borderRadius:3, padding:'0.5rem 1rem', fontWeight:700, cursor:'pointer', fontSize:'0.8rem' }}>
            + Nuevo Plan
          </button>
        </div>
      </PageHeader>

      {/* Filtros */}
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1rem' }}>
        {tipos.map(t => (
          <button key={t} onClick={() => setFiltroTipo(t)} style={CHIP(filtroTipo === t)}>
            {t === 'todos' ? 'Todos' : t}
          </button>
        ))}
      </div>

      {/* Grid de planes */}
      {loading ? (
        <div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center' }}>
          <div style={{ width:28, height:28, borderRadius:'50%', border:'2px solid var(--phosphor)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ flex:1, overflowY:'auto', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'0.75rem', alignContent:'start' }}>
          {filtrados.map(plan => {
            const d = dias(plan.proxima_fecha)
            const urgente = d !== null && d < 0
            const proximo = d !== null && d >= 0 && d <= 7
            const tipoColor = TIPO_COLOR[plan.tipo_activo || plan.activo_tipo_real] || '#6B7280'
            const frecColor = FREC_COLOR[plan.frecuencia] || '#6B7280'

            return (
              <div key={plan.id}
                style={{
                  background:'var(--surface)', borderRadius:3, padding:'1rem 1.1rem',
                  border: urgente ? '1px solid rgba(255,80,80,0.3)' : proximo ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(57,255,20,0.05)',
                  display:'flex', flexDirection:'column', gap:'0.6rem',
                  transition:'border-color 0.15s, box-shadow 0.15s',
                  cursor:'default',
                }}>

                {/* Tipo + frecuencia */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:'0.6rem', padding:'2px 8px', borderRadius:3, background:`${tipoColor}18`, color:tipoColor, border:`1px solid ${tipoColor}30`, fontFamily:'monospace' }}>
                    {plan.tipo_activo || plan.activo_tipo_real || 'GENERAL'}
                  </span>
                  <span style={{ fontSize:'0.6rem', padding:'2px 8px', borderRadius:3, background:`${frecColor}18`, color:frecColor, fontFamily:'monospace' }}>
                    {plan.frecuencia}
                  </span>
                </div>

                {/* Nombre */}
                <h3 style={{ color:'var(--text)', fontWeight:600, fontSize:'0.85rem', lineHeight:1.3, margin:0 }}>{plan.nombre}</h3>

                {/* Activo */}
                {plan.activo_nombre && (
                  <p style={{ fontSize:'0.68rem', color:'var(--text-dim)', margin:0 }}>📍 {plan.activo_nombre}</p>
                )}

                {/* Fechas */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <p style={{ fontSize:'0.6rem', color:'var(--text-dim)', margin:0 }}>Próxima ejecución</p>
                    <ProximaBadge fecha={plan.proxima_fecha} />
                  </div>
                  {plan.ultimo_realizado && (
                    <div style={{ textAlign:'right' }}>
                      <p style={{ fontSize:'0.6rem', color:'var(--text-dim)', margin:0 }}>Último</p>
                      <p style={{ fontSize:'0.65rem', color:'var(--text)', fontFamily:'monospace', margin:0 }}>{fmtFecha(plan.ultimo_realizado)}</p>
                    </div>
                  )}
                </div>

                {/* Responsable */}
                {plan.responsable_nombre && (
                  <p style={{ fontSize:'0.65rem', color:'var(--text-dim)', margin:0 }}>👤 {plan.responsable_nombre}</p>
                )}

                {/* Acciones */}
                <div style={{ display:'flex', gap:6, marginTop:'auto', paddingTop:4 }}>
                  <button
                    onClick={() => setModalEjec(plan)}
                    style={{ flex:1, padding:'0.45rem', borderRadius:2, background: urgente ? 'rgba(255,80,80,0.1)' : 'rgba(57,255,20,0.08)', border:`1px solid ${urgente ? 'rgba(255,80,80,0.3)' : 'rgba(57,255,20,0.2)'}`, color: urgente ? '#ff5050' : 'var(--phosphor)', cursor:'pointer', fontWeight:600, fontSize:'0.68rem', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    <Play size={11} /> Ejecutar
                  </button>
                  <button
                    onClick={() => setModalDet(plan)}
                    style={{ flex:1, padding:'0.45rem', borderRadius:2, background:'var(--surface)', border:'1px solid rgba(57,255,20,0.08)', color:'var(--text-dim)', cursor:'pointer', fontWeight:600, fontSize:'0.68rem', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    <ClipboardList size={11} /> Editar
                  </button>
                </div>
              </div>
            )
          })}

          {filtrados.length === 0 && (
            <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'3rem', color:'var(--text-dim)' }}>
              <ClipboardList size={32} style={{ opacity:0.3, marginBottom:8 }} />
              <p style={{ fontSize:'0.8rem' }}>Sin planes para este filtro</p>
            </div>
          )}
        </div>
      )}

      {modalEjec && (
        <EjecucionModal plan={modalEjec} onClose={() => setModalEjec(null)} onSaved={() => { setModalEjec(null); load() }} />
      )}
      {modalDet && (
        <PlanDetalle plan={modalDet} activos={activos} responsables={responsables} onClose={() => setModalDet(null)} onSaved={() => { setModalDet(null); load() }} onMassAssign={(p) => { setModalDet(null); setModalMass(p); }} />
      )}
      {modalMass && (
        <MassAssignModal plan={modalMass} activos={activos} sedes={sedes} onClose={() => setModalMass(null)} onSaved={() => { setModalMass(null); load() }} />
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}
