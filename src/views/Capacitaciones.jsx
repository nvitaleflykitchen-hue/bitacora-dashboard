import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Download, Plus, Save, Users, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getPersonasBySede, getSedes } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'
import AdjuntosPanel from '../components/AdjuntosPanel'
import { descargarPlanillaCapacitacion } from '../lib/capacitacionPdf'

const today = () => new Date().toISOString().slice(0, 10)
const emptyForm = () => ({ titulo:'', objetivo:'', sede_id:'', fecha:today(), hora_inicio:'', duracion_minutos:'', instructor_nombre:'', instructor_tipo:'interno', instructor_area:'', instructor_procedencia:'', planificada:true, material_entregado:false, observaciones:'' })

export default function Capacitaciones({ mobile = false }) {
  const { allowedSedeIds, can } = useAuth()
  const canManage = can('calidad', 'manage')
  const [items, setItems] = useState([])
  const [sedes, setSedes] = useState([])
  const [selected, setSelected] = useState(null)
  const [attendees, setAttendees] = useState([])
  const [people, setPeople] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterSede, setFilterSede] = useState('')

  const load = useCallback(async () => {
    const [{ data, error }, sedeRows] = await Promise.all([
      supabase.schema('bitacora').from('capacitaciones')
        .select('*, sedes(nombre), capacitacion_asistentes(id,persona_id,estado,observaciones)')
        .order('fecha', { ascending:false }).order('created_at', { ascending:false }),
      getSedes(allowedSedeIds),
    ])
    if (error) throw error
    setItems(data || []); setSedes(sedeRows || [])
  }, [allowedSedeIds])

  useEffect(() => { load().catch(error => toast.error(mensajeError(error))) }, [load])

  const open = useCallback(async item => {
    setSelected(item)
    const [{ data, error }, sedePeople] = await Promise.all([
      supabase.schema('bitacora').from('capacitacion_asistentes')
        .select('id,persona_id,estado,observaciones')
        .eq('capacitacion_id', item.id).order('created_at'),
      getPersonasBySede(item.sede_id),
    ])
    if (error) throw error
    const byId = new Map((sedePeople || []).map(person => [person.id, person]))
    setAttendees((data || []).map(row => ({ ...row, persona:byId.get(row.persona_id) || { nombre:'Persona', apellido:'no disponible' } })))
    setPeople(sedePeople || [])
  }, [])

  const filtered = useMemo(() => filterSede ? items.filter(item => String(item.sede_id) === filterSede) : items, [filterSede, items])
  const selectedIds = useMemo(() => new Set(attendees.map(item => item.persona_id)), [attendees])
  const presentCount = attendees.filter(item => item.estado === 'presente').length
  const percent = attendees.length ? Math.round(presentCount * 100 / attendees.length) : 0

  async function createTraining() {
    if (form.titulo.trim().length < 3) return toast.warn('El tema debe tener al menos 3 caracteres.')
    if (!form.sede_id || !form.fecha || !form.instructor_nombre.trim()) return toast.warn('Completá sede, fecha e instructor.')
    setSaving(true)
    try {
      const payload = { ...form, titulo:form.titulo.trim(), instructor_nombre:form.instructor_nombre.trim(), sede_id:Number(form.sede_id), duracion_minutos:form.duracion_minutos ? Number(form.duracion_minutos) : null, hora_inicio:form.hora_inicio || null }
      const { data, error } = await supabase.schema('bitacora').from('capacitaciones').insert(payload).select('*, sedes(nombre)').single()
      if (error) throw error
      setCreating(false); setForm(emptyForm()); await load(); await open(data)
      toast.success('Capacitación creada. Ahora seleccioná a los asistentes.')
    } catch (error) { toast.error(mensajeError(error)) } finally { setSaving(false) }
  }

  async function addPerson(person) {
    try {
      const { data, error } = await supabase.schema('bitacora').from('capacitacion_asistentes')
        .insert({ capacitacion_id:selected.id, persona_id:person.id, estado:'convocado' })
        .select('id,persona_id,estado,observaciones').single()
      if (error) throw error
      setAttendees(current => [...current, { ...data, persona:person }])
    } catch (error) { toast.error(mensajeError(error)) }
  }

  async function setAttendance(row, estado) {
    const { error } = await supabase.schema('bitacora').from('capacitacion_asistentes').update({ estado, updated_at:new Date().toISOString() }).eq('id', row.id)
    if (error) return toast.error(mensajeError(error))
    setAttendees(current => current.map(item => item.id === row.id ? { ...item, estado } : item))
  }

  async function finish() {
    if (!attendees.length) return toast.warn('Agregá al menos una persona antes de finalizar.')
    const { error } = await supabase.schema('bitacora').from('capacitaciones').update({ estado:'realizada', finalizada_at:new Date().toISOString(), updated_at:new Date().toISOString() }).eq('id', selected.id)
    if (error) return toast.error(mensajeError(error))
    const updated = { ...selected, estado:'realizada' }; setSelected(updated); setItems(current => current.map(item => item.id === updated.id ? updated : item)); toast.success('Capacitación finalizada y registrada en los historiales.')
  }

  const input = { width:'100%', minHeight:44 }
  return <div className={mobile ? 'mobile-scroll' : ''} style={{ padding:mobile ? '0 1rem 1rem' : '4px 10px 24px', height:mobile ? '100%' : undefined, overflowY:mobile ? 'auto' : undefined }}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:16 }}>
      <div><h2 style={{ fontSize:mobile ? '1.15rem' : '1.35rem', fontWeight:800 }}>Capacitaciones</h2><p style={{ color:'var(--text-dim)', fontSize:'.78rem' }}>Formación, asistencia y evidencia por sede y persona</p></div>
      {canManage && <button className="btn-primary" style={{ minHeight:44 }} onClick={() => setCreating(true)}><Plus size={16}/> Nueva capacitación</button>}
    </div>
    <select className="input-dark" style={{ ...input, maxWidth:360, marginBottom:16 }} value={filterSede} onChange={event => setFilterSede(event.target.value)}><option value="">Todas las sedes</option>{sedes.map(sede => <option key={sede.id} value={sede.id}>{sede.nombre}</option>)}</select>

    {!filtered.length ? <div className="glass p-5" style={{ textAlign:'center' }}><CalendarDays size={26} style={{ margin:'0 auto 8px', color:'var(--phosphor)' }}/><p>No hay capacitaciones registradas.</p>{canManage && <button className="btn-ghost" style={{ marginTop:10, minHeight:44 }} onClick={() => setCreating(true)}>Crear la primera</button>}</div> :
      <div style={{ display:'grid', gridTemplateColumns:mobile ? '1fr' : 'repeat(auto-fill,minmax(290px,1fr))', gap:10 }}>{filtered.map(item => { const total=item.capacitacion_asistentes?.length || 0; const present=item.capacitacion_asistentes?.filter(row=>row.estado==='presente').length || 0; return <button key={item.id} type="button" onClick={() => open(item).catch(error=>toast.error(mensajeError(error)))} className="glass" style={{ padding:14, textAlign:'left', border:item.estado==='realizada'?'1px solid rgba(57,255,20,.28)':'1px solid var(--line)', minHeight:112 }}><div style={{ display:'flex', justifyContent:'space-between', gap:8 }}><strong>{item.titulo}</strong><span style={{ color:item.estado==='realizada'?'var(--phosphor)':'#F59E0B', fontSize:'.65rem', textTransform:'uppercase' }}>{item.estado}</span></div><p style={{ color:'var(--text-dim)', fontSize:'.75rem', marginTop:8 }}>{item.sedes?.nombre} · {item.fecha}</p><p style={{ color:'var(--text-dim)', fontSize:'.72rem', marginTop:5 }}>{item.instructor_nombre}</p>{total>0 && <p style={{ color:'var(--phosphor)', fontSize:'.72rem', marginTop:6 }}>{present}/{total} presentes · {Math.round(present*100/total)}%</p>}</button>})}</div>}

    {(creating || selected) && <div className="modal-overlay" style={{ zIndex:1100 }}><div className="glass" style={{ width:'min(760px,96vw)', maxHeight:'92vh', overflowY:'auto', padding:18 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}><h3 style={{ fontWeight:800 }}>{creating ? 'Nueva capacitación' : selected.titulo}</h3><button className="btn-ghost" style={{ minWidth:44, minHeight:44 }} onClick={() => { setCreating(false); setSelected(null) }}><X size={18}/></button></div>
      {creating ? <div style={{ display:'grid', gridTemplateColumns:mobile?'1fr':'1fr 1fr', gap:10 }}>
        <label style={{ gridColumn:mobile?undefined:'1 / -1' }}>Tema *<input className="input-dark" style={input} minLength={3} required value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))}/><small style={{ display:'block', marginTop:4, color:form.titulo.length>0&&form.titulo.trim().length<3?'#F59E0B':'var(--text-dim)' }}>Mínimo 3 caracteres.</small></label>
        <label>Sede *<select className="input-dark" style={input} value={form.sede_id} onChange={e=>setForm(f=>({...f,sede_id:e.target.value}))}><option value="">Seleccionar</option>{sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
        <label>Fecha *<input type="date" className="input-dark" style={input} value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/></label>
        <label>Instructor *<input className="input-dark" style={input} value={form.instructor_nombre} onChange={e=>setForm(f=>({...f,instructor_nombre:e.target.value}))}/></label>
        <label>Tipo<select className="input-dark" style={input} value={form.instructor_tipo} onChange={e=>setForm(f=>({...f,instructor_tipo:e.target.value}))}><option value="interno">Interno</option><option value="externo">Externo</option></select></label>
        <label>Hora<input type="time" className="input-dark" style={input} value={form.hora_inicio} onChange={e=>setForm(f=>({...f,hora_inicio:e.target.value}))}/></label>
        <label>Duración (minutos)<input type="number" min="1" className="input-dark" style={input} value={form.duracion_minutos} onChange={e=>setForm(f=>({...f,duracion_minutos:e.target.value}))}/></label>
        <label style={{ gridColumn:mobile?undefined:'1 / -1' }}>Objetivo<textarea className="input-dark" style={input} rows="2" value={form.objetivo} onChange={e=>setForm(f=>({...f,objetivo:e.target.value}))}/></label>
        <label><input type="checkbox" checked={form.planificada} onChange={e=>setForm(f=>({...f,planificada:e.target.checked}))}/> Planificada</label><label><input type="checkbox" checked={form.material_entregado} onChange={e=>setForm(f=>({...f,material_entregado:e.target.checked}))}/> Se entrega material didáctico</label>
        <button className="btn-primary" style={{ minHeight:46, gridColumn:mobile?undefined:'1 / -1' }} disabled={saving || form.titulo.trim().length < 3 || !form.sede_id || !form.fecha || !form.instructor_nombre.trim()} onClick={createTraining}><Save size={16}/>{saving?'Guardando…':'Guardar y seleccionar asistentes'}</button>
      </div> : <>
        <div style={{ display:'grid', gridTemplateColumns:mobile?'1fr 1fr':'repeat(4,1fr)', gap:8, marginBottom:14 }}><div className="glass p-3"><small>Fecha</small><strong style={{ display:'block' }}>{selected.fecha}</strong></div><div className="glass p-3"><small>Convocados</small><strong style={{ display:'block' }}>{attendees.length}</strong></div><div className="glass p-3"><small>Presentes</small><strong style={{ display:'block' }}>{presentCount}</strong></div><div className="glass p-3"><small>Asistencia</small><strong style={{ display:'block', color:'var(--phosphor)' }}>{percent}%</strong></div></div>
        {canManage && selected.estado!=='realizada' && <><h4 style={{ marginBottom:8 }}>Personal activo de {selected.sedes?.nombre}</h4><div style={{ maxHeight:190, overflowY:'auto', border:'1px solid var(--line)', marginBottom:14 }}>{people.map(person => <div key={person.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', borderBottom:'1px solid var(--line)' }}><span style={{ fontSize:'.78rem' }}>{person.apellido}, {person.nombre} <small style={{ color:'var(--text-dim)' }}>· {person.puesto}</small></span><button className="btn-ghost" style={{ minHeight:40 }} disabled={selectedIds.has(person.id)} onClick={()=>addPerson(person)}>{selectedIds.has(person.id)?'Agregado':'+ Agregar'}</button></div>)}</div></>}
        <h4 style={{ marginBottom:8 }}><Users size={15} style={{ display:'inline', marginRight:6 }}/>Asistencia</h4><div style={{ display:'grid', gap:7 }}>{attendees.map(row => <div key={row.id} className="glass p-3" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}><span style={{ fontSize:'.8rem', fontWeight:600 }}>{row.persona?.apellido}, {row.persona?.nombre}</span><div style={{ display:'flex', gap:5 }}>{['convocado','presente','ausente'].map(status=><button key={status} className={row.estado===status?'btn-primary':'btn-ghost'} style={{ minHeight:40, fontSize:'.68rem' }} disabled={!canManage||selected.estado==='realizada'} onClick={()=>setAttendance(row,status)}>{status}</button>)}</div></div>)}</div>
        {!attendees.length && <p style={{ color:'var(--text-dim)', fontSize:'.8rem', padding:'12px 0' }}>Todavía no hay personas seleccionadas.</p>}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:16 }}><button className="btn-ghost" style={{ minHeight:44 }} onClick={()=>descargarPlanillaCapacitacion(selected,attendees,selected.sedes?.nombre)}><Download size={15}/> Imprimir planilla</button>{canManage&&selected.estado!=='realizada'&&<button className="btn-primary" style={{ minHeight:44 }} onClick={finish}><CheckCircle2 size={15}/> Finalizar capacitación</button>}</div>
        <AdjuntosPanel entityType="capacitacion" entityId={selected.id} readOnly={!canManage} camera label="Material y planilla firmada" />
      </>}
    </div></div>}
  </div>
}
