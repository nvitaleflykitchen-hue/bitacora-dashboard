import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { UserCircle, Plus, X, Edit2, Trash2, Phone, Mail, Clock, Shield, Save } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { confirmar, toast } from '../../lib/feedback'
import { mensajeError } from '../../lib/errores'

const CATEGORIAS = [
  'Edificio','Equipos grandes','Equipos medianos','Equipos chicos',
  'Vehiculos','Cuchillas','Matafuegos','Insumos','RRHH','General'
]
const NIVELES = [
  { value:1, label:'1er Nivel', desc:'Responsable directo', color:'#39ff14' },
  { value:2, label:'2do Nivel', desc:'Jefe de área',        color:'#ffb400' },
  { value:3, label:'Gerencia',  desc:'Escalación máxima',   color:'#ff5050' },
]

function NivelBadge({ nivel }) {
  const n = NIVELES.find(x => x.value === nivel) || NIVELES[0]
  return (
    <span style={{
      fontSize:'0.6rem', fontWeight:'bold', padding:'2px 7px', borderRadius:2,
      background:`${n.color}22`, color:n.color, border:`1px solid ${n.color}44`,
      fontFamily:'monospace', letterSpacing:'0.05em'
    }}>{n.label}</span>
  )
}

function ResponsableModal({ responsable, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre:'', rol:'', area:'', telefono:'', email:'',
    disponibilidad:'Lunes a viernes 8-18', nivel_escalacion:1,
    categorias:[], activo:true, ...(responsable || {})
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const toggleCat = cat => setForm(f => ({
    ...f, categorias: f.categorias.includes(cat) ? f.categorias.filter(c=>c!==cat) : [...f.categorias, cat]
  }))

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.rol.trim()) { setError('Nombre y rol son obligatorios.'); return }
    setLoading(true); setError(null)
    try {
      const payload = {
        nombre:form.nombre.trim(), rol:form.rol.trim(),
        area:form.area?.trim()||null, telefono:form.telefono?.trim()||null,
        email:form.email?.trim()||null, disponibilidad:form.disponibilidad?.trim()||null,
        nivel_escalacion:form.nivel_escalacion, categorias:form.categorias,
        activo:form.activo, updated_at:new Date().toISOString(),
      }
      const q = supabase.schema('mantenimiento').from('responsables')
      const res = responsable?.id ? await q.update(payload).eq('id',responsable.id) : await q.insert(payload)
      if (res.error) throw res.error
      onSave()
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const INPUT = { width:'100%', padding:'0.6rem 0.8rem', borderRadius:2, background:'var(--bg,#0A0A0E)', border:'1px solid rgba(57,255,20,0.08)', color:'var(--text)', fontSize:'0.82rem', fontFamily:'inherit', boxSizing:'border-box' }
  const LABEL = { color:'var(--text-dim)', fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.3rem' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60 }}>
      <div style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.15)', borderRadius:3, padding:'1.5rem', width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.2rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <UserCircle size={16} style={{ color:'#39ff14' }}/>
            <h2 style={{ color:'var(--text)', fontWeight:700, fontSize:'1rem' }}>
              {responsable?.id ? 'Editar Responsable' : 'Nuevo Responsable'}
            </h2>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem' }}>
          <div style={{ marginBottom:'0.9rem' }}>
            <label style={LABEL}>Nombre *</label>
            <input style={INPUT} placeholder="Ej: Carlos Gómez" value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} required/>
          </div>
          <div style={{ marginBottom:'0.9rem' }}>
            <label style={LABEL}>Rol *</label>
            <input style={INPUT} placeholder="Ej: Jefe de Mantenimiento" value={form.rol} onChange={e=>setForm(f=>({...f,rol:e.target.value}))} required/>
          </div>
          <div style={{ marginBottom:'0.9rem' }}>
            <label style={LABEL}>Área</label>
            <input style={INPUT} placeholder="Ej: Planta Córdoba" value={form.area||''} onChange={e=>setForm(f=>({...f,area:e.target.value}))}/>
          </div>
          <div style={{ marginBottom:'0.9rem' }}>
            <label style={LABEL}>Nivel de Escalación</label>
            <select style={INPUT} value={form.nivel_escalacion} onChange={e=>setForm(f=>({...f,nivel_escalacion:parseInt(e.target.value)}))}>
              {NIVELES.map(n=><option key={n.value} value={n.value}>{n.label} — {n.desc}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:'0.9rem' }}>
            <label style={LABEL}>Teléfono</label>
            <input style={INPUT} placeholder="+54 9 351..." value={form.telefono||''} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))}/>
          </div>
          <div style={{ marginBottom:'0.9rem' }}>
            <label style={LABEL}>Email</label>
            <input style={INPUT} placeholder="email@flykitchen.com" value={form.email||''} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/>
          </div>
        </div>

        <div style={{ marginBottom:'0.9rem' }}>
          <label style={LABEL}>Disponibilidad</label>
          <input style={INPUT} placeholder="Lunes a viernes 8-18" value={form.disponibilidad||''} onChange={e=>setForm(f=>({...f,disponibilidad:e.target.value}))}/>
        </div>

        <div style={{ marginBottom:'0.9rem' }}>
          <label style={LABEL}>Categorías a cargo</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
            {CATEGORIAS.map(cat => {
              const active = form.categorias.includes(cat)
              return (
                <button key={cat} onClick={()=>toggleCat(cat)} style={{
                  fontSize:'0.6rem', padding:'3px 10px', borderRadius:4, cursor:'pointer',
                  background: active ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.05)',
                  color: active ? '#39ff14' : 'rgba(255,255,255,0.5)',
                  border:`1px solid ${active ? 'rgba(57,255,20,0.35)' : 'rgba(57,255,20,0.08)'}`,
                  transition:'all 0.15s', fontFamily:'inherit'
                }}>{cat}</button>
              )
            })}
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'1rem' }}>
          <input type="checkbox" checked={form.activo} onChange={e=>setForm(f=>({...f,activo:e.target.checked}))} style={{ accentColor:'#39ff14' }}/>
          <span style={{ fontSize:'0.7rem', color:'var(--text-dim)' }}>Responsable activo</span>
        </div>

        {error && <p style={{ color:'#ff5050', fontSize:'0.75rem', marginBottom:'0.8rem' }}>{error}</p>}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'0.6rem 1.1rem', borderRadius:2, background:'rgba(57,255,20,0.05)', color:'var(--text-dim)', border:'none', cursor:'pointer', fontWeight:600 }}>Cancelar</button>
          <button onClick={handleSave} disabled={loading} style={{ padding:'0.6rem 1.3rem', borderRadius:2, background:loading?'rgba(57,255,20,0.4)':'#39ff14', color:'#0A0A0E', border:'none', cursor:loading?'not-allowed':'pointer', fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
            <Save size={13}/>{loading ? 'Guardando...' : (responsable?.id ? 'Actualizar' : 'Crear Responsable')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ResponsableCard({ r, onEdit, onDelete }) {
  const n = NIVELES.find(x => x.value === r.nivel_escalacion) || NIVELES[0]
  return (
    <div style={{
      background:'var(--surface)', border:`1px solid ${n.color}22`,
      borderRadius:3, padding:'1rem', display:'flex', flexDirection:'column', gap:8,
      opacity: r.activo ? 1 : 0.45
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <p style={{ fontWeight:700, color:'var(--text)', fontSize:'0.9rem', marginBottom:2 }}>{r.nombre}</p>
          <p style={{ fontSize:'0.68rem', color:n.color, opacity:0.85 }}>{r.rol}</p>
          {r.area && <p style={{ fontSize:'0.62rem', color:'var(--text-dim)' }}>{r.area}</p>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <NivelBadge nivel={r.nivel_escalacion}/>
          <button onClick={()=>onEdit(r)} title="Editar / marcar inactivo" style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', padding:'3px 5px' }}><Edit2 size={12}/></button>
          <button onClick={()=>onDelete(r)} title="Eliminar" style={{ background:'none', border:'none', color:'rgba(255,80,80,0.6)', cursor:'pointer', padding:'3px 5px' }}><Trash2 size={12}/></button>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {r.telefono && <div style={{ display:'flex', alignItems:'center', gap:6 }}><Phone size={11} style={{ color:'var(--text-dim)', flexShrink:0 }}/><span style={{ fontSize:'0.65rem', color:'var(--text-dim)' }}>{r.telefono}</span></div>}
        {r.email    && <div style={{ display:'flex', alignItems:'center', gap:6 }}><Mail  size={11} style={{ color:'var(--text-dim)', flexShrink:0 }}/><span style={{ fontSize:'0.65rem', color:'var(--text-dim)' }}>{r.email}</span></div>}
        {r.disponibilidad && <div style={{ display:'flex', alignItems:'center', gap:6 }}><Clock size={11} style={{ color:'var(--text-dim)', flexShrink:0 }}/><span style={{ fontSize:'0.65rem', color:'var(--text-dim)' }}>{r.disponibilidad}</span></div>}
      </div>

      {r.categorias?.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
          {r.categorias.map(c=>(
            <span key={c} style={{ fontSize:'0.6rem', padding:'2px 7px', borderRadius:4, background:`${n.color}11`, color:n.color, border:`1px solid ${n.color}22` }}>{c}</span>
          ))}
        </div>
      )}
      {!r.activo && <span style={{ fontSize:'0.6rem', color:'#ff5050' }}>· Inactivo</span>}
    </div>
  )
}

function ReglasTab({ responsables }) {
  const [reglas, setReglas]   = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState({ categoria:CATEGORIAS[0], prioridad:'alta', responsable_id:'', escalacion_id:'', sla_horas:4 })

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.schema('mantenimiento').from('reglas_escalacion').select('*').order('categoria').order('prioridad')
    setReglas(data||[]); setLoading(false)
  }
  useEffect(()=>{ load() },[])

  const addRegla = async () => {
    if (!form.responsable_id) return
    await supabase.schema('mantenimiento').from('reglas_escalacion').insert({
      categoria:form.categoria, prioridad:form.prioridad,
      responsable_id:form.responsable_id||null, escalacion_id:form.escalacion_id||null,
      sla_horas:parseInt(form.sla_horas)||48,
    })
    load()
  }
  const delRegla = async id => { await supabase.schema('mantenimiento').from('reglas_escalacion').delete().eq('id',id); load() }

  const pc = { alta:'#ff5050', media:'#ffb400', baja:'#50b4ff' }
  const TH = { padding:'6px 10px', textAlign:'left', fontSize:'0.6rem', color:'rgba(57,255,20,0.5)', fontFamily:'monospace', letterSpacing:'0.1em', fontWeight:600 }
  const TD = { padding:'7px 10px', fontSize:'0.68rem', color:'var(--text)', borderBottom:'1px solid rgba(255,255,255,0.03)' }
  const SEL = { background:'rgba(57,255,20,0.05)', border:'1px solid rgba(57,255,20,0.1)', color:'var(--text)', borderRadius:5, padding:'4px 8px', fontSize:'0.65rem', fontFamily:'inherit' }

  if (loading) return <p style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>Cargando reglas...</p>

  return (
    <div style={{ overflowX:'auto' }}>
      <table className="table-dark" style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ borderBottom:'1px solid rgba(57,255,20,0.15)' }}>
            {['Categoría','Prioridad','1er Responsable','Escalación a','SLA',''].map(h=><th key={h} style={TH}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {reglas.map(r=>{
            const resp  = responsables.find(x=>x.id===r.responsable_id)
            const escal = responsables.find(x=>x.id===r.escalacion_id)
            return (
              <tr key={r.id}>
                <td style={TD}>{r.categoria}</td>
                <td style={TD}><span style={{ fontSize:'0.62rem', padding:'2px 8px', borderRadius:4, fontWeight:700, background:`${pc[r.prioridad]}22`, color:pc[r.prioridad], border:`1px solid ${pc[r.prioridad]}44` }}>{r.prioridad}</span></td>
                <td style={{ ...TD, color:'#39ff14' }}>{resp?.nombre||'—'}</td>
                <td style={{ ...TD, color:'#ffb400' }}>{escal?.nombre||'—'}</td>
                <td style={{ ...TD, color:'var(--text-dim)' }}>{r.sla_horas}h</td>
                <td style={TD}><button onClick={()=>delRegla(r.id)} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer' }}><X size={13}/></button></td>
              </tr>
            )
          })}
          <tr style={{ background:'rgba(57,255,20,0.03)', borderTop:'1px solid rgba(57,255,20,0.15)' }}>
            <td style={{ padding:'8px 10px' }}><select style={SEL} value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))}>{CATEGORIAS.map(c=><option key={c}>{c}</option>)}</select></td>
            <td style={{ padding:'8px 10px' }}><select style={SEL} value={form.prioridad} onChange={e=>setForm(f=>({...f,prioridad:e.target.value}))}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></td>
            <td style={{ padding:'8px 10px' }}><select style={SEL} value={form.responsable_id} onChange={e=>setForm(f=>({...f,responsable_id:e.target.value}))}><option value="">— Seleccionar —</option>{responsables.map(r=><option key={r.id} value={r.id}>{r.nombre}</option>)}</select></td>
            <td style={{ padding:'8px 10px' }}><select style={SEL} value={form.escalacion_id} onChange={e=>setForm(f=>({...f,escalacion_id:e.target.value}))}><option value="">— Opcional —</option>{responsables.map(r=><option key={r.id} value={r.id}>{r.nombre}</option>)}</select></td>
            <td style={{ padding:'8px 10px' }}><input type="number" style={{...SEL,width:70}} value={form.sla_horas} onChange={e=>setForm(f=>({...f,sla_horas:e.target.value}))} placeholder="Ej: 24"/></td>
            <td style={{ padding:'8px 10px' }}><button onClick={addRegla} style={{ background:'#39ff14', color:'#0A0A0E', border:'none', borderRadius:5, padding:'5px 12px', fontSize:'0.65rem', fontWeight:700, cursor:'pointer' }}>+ Agregar</button></td>
          </tr>
        </tbody>
      </table>
      {!reglas.length && <p style={{ padding:'1.5rem', color:'var(--text-dim)', fontSize:'0.75rem', textAlign:'center' }}>Agregá reglas para asignación automática de tickets.</p>}
    </div>
  )
}

export default function MntResponsables({ focusId }) {
  const [responsables, setResponsables] = useState([])
  const [loading, setLoading]           = useState(true)
  const [modal, setModal]               = useState(null)
  useEffect(() => {
    if (!focusId || loading) return
    const target = responsables.find(item => String(item.id) === String(focusId))
    if (target) setModal(target)
  }, [focusId, loading, responsables])
  const [tab, setTab]                   = useState('fichas')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.schema('mantenimiento').from('responsables').select('*').order('nivel_escalacion').order('nombre')
    setResponsables(data||[]); setLoading(false)
  }
  useEffect(()=>{ load() },[])

  const deleteResponsable = async (r) => {
    if (!await confirmar({ titulo: `Eliminar a ${r.nombre}`, mensaje: `Esta acción no se puede deshacer.\n\nSi tiene tickets o reglas de escalación asignadas, considerá marcarlo como "Inactivo" (editar → desmarcar "Responsable activo") en vez de eliminarlo.`, peligro: true, confirmText: 'Eliminar' })) return
    try {
      const { error } = await supabase.schema('mantenimiento').from('responsables').delete().eq('id', r.id)
      if (error) throw error
      load()
    } catch (e) {
      toast.error('Error al eliminar: ' + mensajeError(e))
    }
  }

  const SEL = active => ({
    padding:'0.35rem 0.9rem', borderRadius:3, fontSize:'0.68rem', fontWeight:600, border:'none', cursor:'pointer',
    background: active ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.05)',
    color: active ? '#39ff14' : 'var(--text-dim)',
  })

  return (
    <div style={{ padding:'1.5rem 2rem', height:'100%', display:'flex', flexDirection:'column', gap:20 }}>
      {modal && <ResponsableModal responsable={modal==='new'?null:modal} onClose={()=>setModal(null)} onSave={()=>{ setModal(null); load() }}/>}

      {/* Header */}
      <PageHeader title="Responsables" subtitle="Matriz de responsabilidades · ISO 9001 cl. 5.3">
        <button onClick={()=>setModal('new')} style={{ background:'#39ff14', color:'#0A0A0E', border:'none', borderRadius:3, padding:'0.55rem 1.1rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          <Plus size={14}/>Nuevo Responsable
        </button>
      </PageHeader>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
        {NIVELES.map(({ value, label, color })=>{
          const count = responsables.filter(r=>r.nivel_escalacion===value&&r.activo).length
          return (
            <div key={value} style={{ background:'var(--surface)', border:`1px solid ${color}33`, borderRadius:3, padding:'12px 16px' }}>
              <p style={{ fontSize:'1.6rem', fontWeight:800, color, lineHeight:1 }}>{count}</p>
              <p style={{ fontSize:'0.65rem', color:'var(--text-dim)', marginTop:3 }}>{label}</p>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:6 }}>
        {[['fichas','Fichas de Responsables'],['reglas','Reglas de Escalación']].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={SEL(tab===id)}>{label}</button>
        ))}
      </div>

      {loading ? (
        <p style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>Cargando...</p>
      ) : tab==='fichas' ? (
        <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:20 }}>
          {NIVELES.map(({ value, label, desc, color })=>{
            const grupo = responsables.filter(r=>r.nivel_escalacion===value)
            if (!grupo.length) return null
            return (
              <div key={value}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <Shield size={12} style={{ color }}/>
                  <span style={{ fontSize:'0.65rem', color, fontFamily:'monospace', letterSpacing:'0.1em' }}>
                    {label.toUpperCase()} — {desc.toUpperCase()}
                  </span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))', gap:10 }}>
                  {grupo.map(r=><ResponsableCard key={r.id} r={r} onEdit={setModal} onDelete={deleteResponsable}/>)}
                </div>
              </div>
            )
          })}
          {!responsables.length && (
            <div style={{ textAlign:'center', padding:'4rem', color:'var(--text-dim)' }}>
              <UserCircle size={40} style={{ margin:'0 auto 12px', opacity:0.2 }}/>
              <p style={{ fontSize:'0.85rem' }}>No hay responsables cargados.</p>
              <p style={{ fontSize:'0.7rem', marginTop:4 }}>Creá el primero para empezar a asignar tickets.</p>
            </div>
          )}
        </div>
      ) : (
        <ReglasTab responsables={responsables}/>
      )}
    </div>
  )
}
