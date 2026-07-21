import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'

const STATUS = {
  borrador: '#94a3b8', solicitado: '#38bdf8', aprobado: '#39FF14',
  rechazado: '#ff4444', cancelado: '#94a3b8', utilizado: '#a78bfa'
}

export default function VacacionesPanel({ personas = [], canManage = false, compact = false }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ persona_id:'', fecha_desde:'', fecha_hasta:'', reemplazo_persona_id:'', observaciones:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.schema('equipo').from('vacaciones').select('*').order('fecha_desde')
    if (error) toast.error('No se pudieron cargar las vacaciones: ' + mensajeError(error))
    setItems(data || [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const personaById = useMemo(() => new Map(personas.map(p => [p.id, p])), [personas])
  const overlap = (a, b) => a.fecha_desde <= b.fecha_hasta && a.fecha_hasta >= b.fecha_desde
  const conflictsFor = item => {
    const person = personaById.get(item.persona_id)
    if (!person) return []
    return items.filter(other => other.id !== item.id && ['solicitado','aprobado'].includes(other.estado) && overlap(item, other) &&
      personaById.get(other.persona_id)?.sede_ids?.some(id => person.sede_ids?.includes(id)))
  }

  const save = async () => {
    if (savingRef.current) return
    if (!form.persona_id || !form.fecha_desde || !form.fecha_hasta) return toast.warn('Completá persona y fechas.')
    if (form.fecha_hasta < form.fecha_desde) return toast.warn('La fecha hasta no puede ser anterior.')
    const duplicate = items.some(item => item.persona_id === form.persona_id && item.fecha_desde === form.fecha_desde && item.fecha_hasta === form.fecha_hasta && ['solicitado','aprobado'].includes(item.estado))
    if (duplicate) return toast.warn('Ya existe una solicitud activa para esa persona y esas fechas.')
    savingRef.current = true
    setSaving(true)
    try {
    // solicitado_por es obligatorio: la policy de INSERT exige que sea el usuario actual
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) return toast.error('Tu sesión venció. Volvé a iniciar sesión para enviar la solicitud.')
    const dias = Math.round((new Date(form.fecha_hasta) - new Date(form.fecha_desde)) / 86400000) + 1
    const { error } = await supabase.schema('equipo').from('vacaciones').insert({
      persona_id: form.persona_id, periodo: Number(form.fecha_desde.slice(0,4)), fecha_desde: form.fecha_desde,
      fecha_hasta: form.fecha_hasta, dias_solicitados: dias, reemplazo_persona_id: form.reemplazo_persona_id || null,
      observaciones: form.observaciones.trim() || null, estado:'solicitado', solicitado_por: user.id
    })
    if (error?.code === '23505') return toast.warn('Esa solicitud ya fue registrada.')
    if (error) return toast.error('No se pudo registrar: ' + mensajeError(error))
    toast.success('Solicitud registrada.'); setShowForm(false); setForm({ persona_id:'', fecha_desde:'', fecha_hasta:'', reemplazo_persona_id:'', observaciones:'' }); load()
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const decide = async (id, estado) => {
    const { data:{ user } } = await supabase.auth.getUser()
    const { error } = await supabase.schema('equipo').from('vacaciones').update({ estado, aprobado_por:user?.id || null, aprobado_at:new Date().toISOString() }).eq('id', id)
    if (error) return toast.error('No se pudo actualizar: ' + mensajeError(error))
    load()
  }

  const upcoming = items.filter(i => !['rechazado','cancelado'].includes(i.estado))
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div><h2 className="font-title font-bold" style={{color:'var(--phosphor)'}}>Vacaciones y coberturas</h2><p style={{fontSize:'.72rem',color:'var(--text-dim)'}}>{upcoming.length} períodos vigentes o pendientes</p></div>
      <button className="btn-primary" onClick={() => setShowForm(v => !v)}>+ Nueva solicitud</button>
    </div>
    {showForm && <div className="glass p-4 grid gap-3" style={{gridTemplateColumns:compact?'1fr':'repeat(2,minmax(0,1fr))'}}>
      <select className="input-dark" value={form.persona_id} onChange={e=>setForm(f=>({...f,persona_id:e.target.value,reemplazo_persona_id:''}))}><option value="">Persona...</option>{personas.map(p=><option key={p.id} value={p.id}>{p.nombre} {p.apellido||''}</option>)}</select>
      <select className="input-dark" value={form.reemplazo_persona_id} onChange={e=>setForm(f=>({...f,reemplazo_persona_id:e.target.value}))}><option value="">Sin reemplazo definido</option>{personas.filter(p=>p.id!==form.persona_id).map(p=><option key={p.id} value={p.id}>{p.nombre} {p.apellido||''}</option>)}</select>
      <input type="date" className="input-dark" value={form.fecha_desde} onChange={e=>setForm(f=>({...f,fecha_desde:e.target.value}))}/>
      <input type="date" className="input-dark" value={form.fecha_hasta} onChange={e=>setForm(f=>({...f,fecha_hasta:e.target.value}))}/>
      <textarea className="input-dark" placeholder="Observaciones" value={form.observaciones} onChange={e=>setForm(f=>({...f,observaciones:e.target.value}))} style={{gridColumn:'1 / -1'}}/>
      <div className="flex gap-2"><button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Guardando...' : 'Solicitar'}</button><button className="btn-ghost" disabled={saving} onClick={()=>setShowForm(false)}>Cancelar</button></div>
    </div>}
    {loading ? <p style={{color:'var(--text-dim)'}}>Cargando...</p> : items.length===0 ? <div className="glass p-8 text-center" style={{color:'var(--text-dim)'}}>Todavía no hay vacaciones registradas.</div> :
      <div className={compact?'space-y-2':'grid grid-cols-1 xl:grid-cols-2 gap-3'}>{items.map(i=>{
        const p=personaById.get(i.persona_id), r=personaById.get(i.reemplazo_persona_id), conflicts=conflictsFor(i)
        return <div key={i.id} className="glass p-4" style={{borderLeft:`3px solid ${STATUS[i.estado]||'#94a3b8'}`}}>
          <div className="flex justify-between gap-3"><div><p className="font-title font-bold">{p?`${p.nombre} ${p.apellido||''}`:'Persona'}</p><p style={{fontSize:'.7rem',color:'var(--text-dim)'}}>{i.fecha_desde} → {i.fecha_hasta}{i.dias_solicitados ? ` · ${i.dias_solicitados} días` : ''}</p></div><span className="font-metric" style={{fontSize:'.62rem',color:STATUS[i.estado],textTransform:'uppercase'}}>{i.estado}</span></div>
          <p style={{fontSize:'.7rem',marginTop:8,color:r?'var(--text)':'var(--text-dim)'}}>Cobertura: {r?`${r.nombre} ${r.apellido||''}`:'Sin definir'}</p>
          {conflicts.length>0 && <p style={{fontSize:'.68rem',color:'#f59e0b',marginTop:6}}>⚠ Coincide con {conflicts.length} ausencia(s) de la misma sede</p>}
          {canManage && i.estado==='solicitado' && <div className="flex gap-2 mt-3"><button className="btn-primary" onClick={()=>decide(i.id,'aprobado')}>Aprobar</button><button className="btn-ghost" onClick={()=>decide(i.id,'rechazado')} style={{color:'#ff4444'}}>Rechazar</button></div>}
        </div>
      })}</div>}
  </div>
}
