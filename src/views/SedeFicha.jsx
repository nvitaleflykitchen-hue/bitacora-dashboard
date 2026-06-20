import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { getGrupos, createGrupo, getHistorialSemanal } from '../lib/queries'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { supabase } from '../lib/supabase'
import { fmtFecha } from '../lib/dateUtils'
import { Pencil, Plus, X, Save, MapPin, Phone, User, Building2 } from 'lucide-react'

const TIPO_COLOR = {
  Planta:      { color:'#39FF14', bg:'rgba(57,255,20,0.1)' },
  Comedor:     { color:'#F59E0B', bg:'rgba(245,158,11,0.1)' },
  Hospital:    { color:'#3B82F6', bg:'rgba(59,130,246,0.1)' },
  Aeropuerto:  { color:'#a78bfa', bg:'rgba(167,139,250,0.1)' },
  Universidad: { color:'#f472b6', bg:'rgba(244,114,182,0.1)' },
  default:     { color:'#9ca3af', bg:'rgba(156,163,175,0.1)' },
}

const TIPOS = ['Comedor','Hospital','Aeropuerto','Planta','Universidad','Otro']

function kpiColor(val, warn, crit) {
  if (val === 0) return '#39FF14'
  if (val >= crit) return '#FF2A2A'
  if (val >= warn) return '#F59E0B'
  return '#60a5fa'
}

function Avatar({ nombre, color, bg, size = 30 }) {
  const ini = nombre ? nombre.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '?'
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:bg||'rgba(57,255,20,0.1)',
      color:color||'#39FF14', display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:size*0.32, fontWeight:800, flexShrink:0 }}>
      {ini}
    </div>
  )
}

function KpiCard({ label, val, sub, color, onClick }) {
  return (
    <div onClick={onClick} style={{ background:'var(--surface)', borderRadius:3, border:'1px solid rgba(57,255,20,0.08)', padding:'1rem 1.1rem', cursor: onClick ? 'pointer' : 'default', transition:'border-color .15s' }}
      onMouseEnter={e => onClick && (e.currentTarget.style.borderColor = 'rgba(57,255,20,0.3)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.borderColor = 'rgba(57,255,20,0.08)')}>
      <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.3)', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:'2rem', fontWeight:700, color, lineHeight:1 }}>{val}</div>
      {sub && <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.3)', marginTop:6 }}>{sub}</div>}
    </div>
  )
}

const EMPTY_FORM = { nombre:'', tipo:'Comedor', direccion:'', telefono:'', responsable:'', contacto_nombre:'', descripcion:'', lat:'', lng:'', activa:true, grupo_id:null }

function SedeModal({ sede, personal = [], onClose, onSaved }) {
  const [form, setForm] = useState(sede ? {
    nombre: sede.nombre || '',
    tipo: sede.tipo || 'Comedor',
    direccion: sede.direccion || '',
    telefono: sede.telefono || personal[0]?.telefono || '',
    responsable: sede.responsable || (personal.find(p=>p.rol==='Admin')||personal[0])?.nombre || '',
    contacto_nombre: sede.contacto_nombre || '',
    descripcion: sede.descripcion || '',
    lat: sede.lat || '',
    lng: sede.lng || '',
    activa: sede.activa !== false,
    grupo_id: sede.grupo_id || null,
  } : { ...EMPTY_FORM })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [grupos, setGrupos]       = useState([])
  const [newGrupo, setNewGrupo]   = useState('')
  const [creandoGrupo, setCreandoGrupo] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    getGrupos().then(setGrupos).catch(() => {})
  }, [])

  async function save() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError(null)
    try {
      // Crear grupo nuevo si se indicó
      let grupoId = form.grupo_id
      if (creandoGrupo && newGrupo.trim()) {
        const slug = newGrupo.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
        const g = await createGrupo({ nombre: newGrupo.trim(), slug })
        grupoId = g.id
        setCreandoGrupo(false); setNewGrupo('')
        setGrupos(gs => [...gs, g])
        set('grupo_id', g.id)
      }
      const payload = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        direccion: form.direccion.trim() || null,
        telefono: form.telefono.trim() || null,
        responsable: form.responsable.trim() || null,
        contacto_nombre: form.contacto_nombre.trim() || null,
        descripcion: form.descripcion.trim() || null,
        lat: form.lat !== '' ? parseFloat(form.lat) : null,
        lng: form.lng !== '' ? parseFloat(form.lng) : null,
        activa: form.activa,
        grupo_id: grupoId || null,
      }
      let err
      if (sede?.id) {
        ;({ error: err } = await supabase.schema('bitacora').from('sedes').update(payload).eq('id', sede.id))
      } else {
        ;({ error: err } = await supabase.schema('bitacora').from('sedes').insert(payload))
      }
      if (err) { setError(err.message); return }
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const inp = { background:'#0A0A0E', border:'1px solid rgba(57,255,20,0.12)', color:'#e2e8f0', fontFamily:'monospace', fontSize:'0.85rem', padding:'8px 10px', borderRadius:2, width:'100%', outline:'none' }
  const lbl = { fontSize:'0.65rem', color:'rgba(255,255,255,0.35)', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:4, display:'block' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.2)', borderRadius:3, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto', padding:24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ fontSize:'0.65rem', color:'rgba(57,255,20,0.5)', letterSpacing:'.12em', textTransform:'uppercase' }}>{sede?.id ? 'EDITAR' : 'NUEVA'} UNIDAD</div>
            <div style={{ fontSize:'1rem', fontWeight:700, color:'#e2e8f0', marginTop:2 }}>{sede?.nombre || 'Nueva sede'}</div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.3)', cursor:'pointer', padding:4 }}><X size={18}/></button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 160px', gap:10, marginBottom:10 }}>
          <div><label style={lbl}>Nombre *</label><input required style={inp} value={form.nombre} onChange={e=>set('nombre',e.target.value)} placeholder="Ej: Comedor Central Plaza"/></div>
          <div><label style={lbl}>Tipo</label>
            <select style={inp} value={form.tipo} onChange={e=>set('tipo',e.target.value)}>
              {TIPOS.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom:10 }}>
          <label style={lbl}>Grupo</label>
          {!creandoGrupo ? (
            <div style={{ display:'flex', gap:6 }}>
              <select style={{ ...inp, flex:1 }}
                value={form.grupo_id || ''}
                onChange={e => set('grupo_id', e.target.value ? Number(e.target.value) : null)}>
                <option value="">Sin grupo</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
              <button type="button" onClick={() => setCreandoGrupo(true)}
                style={{ background:'rgba(57,255,20,0.08)', border:'1px solid rgba(57,255,20,0.25)', color:'#39FF14', fontSize:'0.68rem', padding:'0 10px', borderRadius:2, cursor:'pointer', whiteSpace:'nowrap' }}>
                + Nuevo
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', gap:6 }}>
              <input style={{ ...inp, flex:1 }} autoFocus value={newGrupo} onChange={e=>setNewGrupo(e.target.value)} placeholder="Ej: Zona Norte"/>
              <button type="button" onClick={() => { setCreandoGrupo(false); setNewGrupo('') }}
                style={{ background:'transparent', border:'1px solid rgba(57,255,20,0.12)', color:'rgba(255,255,255,0.4)', fontSize:'0.68rem', padding:'0 10px', borderRadius:2, cursor:'pointer' }}>
                Cancelar
              </button>
            </div>
          )}
          {creandoGrupo && newGrupo.trim() && (
            <div style={{ fontSize:'0.68rem', color:'rgba(57,255,20,0.6)', marginTop:4 }}>
              Se creará el grupo "<strong style={{color:'#39FF14'}}>{newGrupo.trim()}</strong>" al guardar
            </div>
          )}
        </div>

        <div style={{ marginBottom:10 }}><label style={lbl}>Dirección</label><input style={inp} value={form.direccion} onChange={e=>set('direccion',e.target.value)} placeholder="Ej: Av. Colón 1234, Córdoba"/></div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div><label style={lbl}>Teléfono</label><input style={inp} value={form.telefono} onChange={e=>set('telefono',e.target.value)} placeholder="Ej: +54 351 1234567"/></div>
          <div><label style={lbl}>Responsable</label><input style={inp} value={form.responsable} onChange={e=>set('responsable',e.target.value)} placeholder="Ej: Carlos Pérez"/></div>
        </div>

        <div style={{ marginBottom:10 }}><label style={lbl}>Contacto en sede</label><input style={inp} value={form.contacto_nombre} onChange={e=>set('contacto_nombre',e.target.value)} placeholder="Ej: Lucía Fernández"/></div>

        <div style={{ marginBottom:10 }}><label style={lbl}>Descripción / Notas</label><textarea style={{ ...inp, minHeight:64, resize:'vertical' }} value={form.descripcion} onChange={e=>set('descripcion',e.target.value)} placeholder="Ej: Atiende turno mañana y tarde, capacidad 200 cubiertos"/></div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
          <div><label style={lbl}>Latitud</label><input style={inp} type="number" step="any" value={form.lat} onChange={e=>set('lat',e.target.value)} placeholder="-31.4135"/></div>
          <div><label style={lbl}>Longitud</label><input style={inp} type="number" step="any" value={form.lng} onChange={e=>set('lng',e.target.value)} placeholder="-64.1811"/></div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:18 }}>
          <input type="checkbox" id="activa" checked={form.activa} onChange={e=>set('activa',e.target.checked)} style={{ accentColor:'#39FF14' }}/>
          <label htmlFor="activa" style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.5)', cursor:'pointer' }}>Sede activa</label>
        </div>

        {error && <div style={{ fontSize:'0.75rem', color:'#ff5050', marginBottom:10, padding:'6px 10px', background:'rgba(255,80,80,0.1)', borderRadius:2, border:'1px solid rgba(255,80,80,0.2)' }}>{error}</div>}

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ background:'transparent', border:'1px solid rgba(57,255,20,0.12)', color:'rgba(255,255,255,0.4)', fontFamily:'monospace', fontSize:'0.72rem', padding:'7px 16px', borderRadius:2, cursor:'pointer' }}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{ background:saving?'rgba(57,255,20,0.1)':'rgba(57,255,20,0.15)', border:'1px solid rgba(57,255,20,0.4)', color:'#39FF14', fontFamily:'monospace', fontSize:'0.72rem', padding:'7px 18px', borderRadius:2, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontWeight:700 }}>
            <Save size={13}/>{saving ? 'Guardando...' : sede?.id ? 'Guardar cambios' : 'Crear sede'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SedeFicha({ onNavigate }) {
  const [sedes, setSedes]         = useState([])
  const [sedeId, setSedeId]       = useState(null)
  const [sede, setSede]           = useState(null)
  const [kpis, setKpis]           = useState(null)
  const [personal, setPersonal]   = useState([])
  const [novedades, setNovedades] = useState([])
  const [activos, setActivos]     = useState([])
  const [tickets, setTickets]     = useState([])
  const [capas, setCapas]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [modal, setModal]         = useState(null) // null | 'edit' | 'new'
  const [histSemanal,  setHistSemanal]   = useState([])

  const loadSedes = useCallback(() => {
    return supabase.schema('bitacora').from('sedes')
      .select('id,nombre,tipo,direccion,lat,lng,telefono,contacto_nombre,responsable,descripcion,activa')
      .order('tipo').order('nombre')
      .then(({ data }) => {
        setSedes(data || [])
        return data || []
      })
  }, [])

  useEffect(() => {
    loadSedes().then(data => {
      if (data.length) setSedeId(data[0].id)
    }).finally(() => setLoading(false))
  }, [loadSedes])

  useEffect(() => {
    if (!sedeId) return
    setLoadingDetail(true)
    const s = sedes.find(x => x.id === sedeId)
    setSede(s || null)
    setKpis(null)

    Promise.all([
      supabase.schema('bitacora').from('registros').select('id,estado_general', { count:'exact' })
        .eq('sede_id', sedeId)
        .gte('fecha_reporte', new Date(Date.now()-30*86400000).toISOString().split('T')[0]),
      supabase.schema('mantenimiento').from('mnt_tickets').select('id,estado,prioridad')
        .eq('sede_id', sedeId).not('estado','in','(resuelto,rechazado)'),
      supabase.schema('bitacora').from('tareas').select('id,estado')
        .eq('sede_id', sedeId).not('estado','in','(Completada,Cancelada)'),
      supabase.schema('bitacora').from('no_conformidades').select('id,estado')
        .eq('sede_id', sedeId).not('estado','eq','Verificada'),
      supabase.schema('bitacora').from('perfiles').select('id,nombre,rol,telefono,email')
        .contains('sede_ids', [sedeId]).eq('activo', true),
      supabase.schema('bitacora').from('registros')
        .select('id,fecha_reporte,turno,reportante,estado_general,detalle_a,detalle_b,detalle_c,detalle_d,detalle_e')
        .eq('sede_id', sedeId).order('fecha_reporte', { ascending: false }).limit(6),
      supabase.schema('mantenimiento').from('mnt_activos').select('id,nombre,tipo,estado')
        .eq('sede_id', sedeId).order('nombre').limit(8),
      supabase.schema('mantenimiento').from('mnt_tickets').select('id,numero,descripcion,estado,prioridad,categoria,created_at')
        .eq('sede_id', sedeId).not('estado','in','(resuelto,rechazado)')
        .order('created_at', { ascending: false }).limit(50),
      supabase.schema('bitacora').from('capa')
        .select('id,codigo,estado,fecha_limite,descripcion,responsable,auditoria_codigo')
        .eq('sede_id', sedeId).order('codigo'),
    ]).then(([reg, tkt, tar, nc, perf, nov, act, tktList, capaList]) => {
      const criticos = (tkt.data||[]).filter(t=>t.prioridad==='critica').length
      setKpis({
        registros: reg.count || (reg.data||[]).length,
        tickets: (tkt.data||[]).length, criticos,
        tareas: (tar.data||[]).length,
        ncs: (nc.data||[]).length,
        personal: (perf.data||[]).length,
        activos: (act.data||[]).length,
      })
      setPersonal(perf.data || [])
      setNovedades(nov.data || [])
      setActivos(act.data || [])
      setTickets(tktList.data || [])
      setCapas(capaList.data || [])
    }).finally(() => setLoadingDetail(false))

    // Historial semanal independiente
    getHistorialSemanal([sedeId], 8).then(setHistSemanal).catch(console.error)
  }, [sedeId, sedes])

  async function handleSaved() {
    setModal(null)
    const data = await loadSedes()
    // If new sede was created, select the last one added (highest id among same tipo)
    if (modal === 'new' && data.length) {
      const newest = data.reduce((a,b) => b.id > a.id ? b : a, data[0])
      setSedeId(newest.id)
    }
  }

  const tc = TIPO_COLOR[sede?.tipo] || TIPO_COLOR.default
  const tiposByGroup = sedes.reduce((acc, s) => {
    if (!acc[s.tipo]) acc[s.tipo] = []
    acc[s.tipo].push(s)
    return acc
  }, {})

  const PRIO_COLOR = { critica:'#FF2A2A', alta:'#F97316', media:'#F59E0B', baja:'#60a5fa' }
  const EST_COLOR  = { operativo:'#39FF14', en_reparacion:'#F59E0B', baja:'#9ca3af' }
  const ESTADO_COLOR = { Normal:'#39FF14', Alerta:'#F59E0B', Critico:'#FF2A2A', ok:'#39FF14', alerta:'#F59E0B', critico:'#FF2A2A' }

  if (loading) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--abyss)' }}>
      <div style={{ width:28, height:28, borderRadius:'50%', border:'2px solid #39FF14', borderTopColor:'transparent', animation:'spin .8s linear infinite' }}/>
    </div>
  )

  return (
    <div style={{ flex:1, overflowY:'auto', background:'var(--abyss)', color:'var(--text)', fontFamily:'monospace' }}>
      {/* HEADER */}
      <div style={{ background:'#0d0d12', borderBottom:'1px solid rgba(57,255,20,0.15)', padding:'12px 20px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <div>
          <div style={{ color:'rgba(57,255,20,0.5)', fontSize:'0.68rem', letterSpacing:'.12em', textTransform:'uppercase' }}>BITACORA · FICHAS DE UNIDAD</div>
          <div style={{ color:'#e2e8f0', fontWeight:700, fontSize:'1.125rem', marginTop:2 }}>Dashboard por Sede</div>
        </div>
        <div style={{ flex:1 }}/>
        <button onClick={()=>setModal('new')} style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(57,255,20,0.1)', border:'1px solid rgba(57,255,20,0.3)', color:'#39FF14', fontFamily:'monospace', fontSize:'0.72rem', padding:'6px 14px', borderRadius:2, cursor:'pointer', fontWeight:700 }}>
          <Plus size={13}/> Nueva sede
        </button>
        <select value={sedeId || ''} onChange={e=>setSedeId(Number(e.target.value))}
          style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.25)', color:'#39FF14', fontFamily:'monospace', fontSize:'0.8rem', padding:'6px 10px', borderRadius:2, maxWidth:260 }}>
          {Object.entries(tiposByGroup).map(([tipo, list]) => (
            <optgroup key={tipo} label={"-- " + tipo.toUpperCase() + " --"} style={{ background:'#0A0A0E', color:'rgba(255,255,255,0.4)' }}>
              {list.map(s => <option key={s.id} value={s.id} style={{ background:'var(--surface)', color:'#e2e8f0' }}>{s.nombre}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      {!sede ? (
        <div style={{ padding:'3rem', textAlign:'center', color:'rgba(255,255,255,0.2)', fontSize:'0.85rem' }}>Selecciona una unidad</div>
      ) : (
        <div style={{ padding:'14px 20px' }}>

          {/* UNIT CARD */}
          <div style={{ background:'var(--surface)', borderRadius:3, border:'1px solid ' + tc.color + '33', padding:'14px 18px', marginBottom:14, display:'flex', alignItems:'flex-start', gap:16 }}>
            <div style={{ width:46, height:46, borderRadius:3, background:tc.bg, border:'1px solid ' + tc.color + '44', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Building2 size={20} style={{ color:tc.color }} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:'18px', fontWeight:800, color:'#e2e8f0' }}>{sede.nombre}</span>
                <span style={{ fontSize:'0.65rem', padding:'2px 8px', borderRadius:2, fontWeight:700, background:tc.bg, color:tc.color, border:'1px solid ' + tc.color + '44' }}>{sede.tipo?.toUpperCase()}</span>
                {!sede.activa && <span style={{ fontSize:'0.65rem', padding:'2px 8px', borderRadius:2, background:'rgba(255,80,80,0.1)', color:'#ff5050', border:'1px solid rgba(255,80,80,0.2)' }}>INACTIVA</span>}
              </div>
              <div style={{ display:'flex', gap:20, marginTop:6, flexWrap:'wrap' }}>
                {sede.direccion && <span style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.5)', display:'flex', alignItems:'center', gap:4 }}><MapPin size={11}/>  {sede.direccion}</span>}
                {sede.responsable && <span style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.5)', display:'flex', alignItems:'center', gap:4 }}><User size={11}/> {sede.responsable}</span>}
                {sede.telefono && <span style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.5)', display:'flex', alignItems:'center', gap:4 }}><Phone size={11}/> {sede.telefono}</span>}
                {!sede.direccion && !sede.responsable && !sede.telefono && (
                  <span style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.2)', fontStyle:'italic' }}>
                    Sin datos completados —
                    <button onClick={()=>setModal('edit')} style={{ background:'transparent', border:'none', color:'rgba(57,255,20,0.5)', cursor:'pointer', fontFamily:'monospace', fontSize:'0.8rem', fontStyle:'normal', marginLeft:4 }}>
                      completar ahora
                    </button>
                  </span>
                )}
                {sede.descripcion && <span style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.3)', marginTop:2, width:'100%' }}>{sede.descripcion}</span>}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, flexShrink:0, alignItems:'center' }}>
              <button onClick={()=>setModal('edit')} title="Editar datos de sede" style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(57,255,20,0.08)', border:'1px solid rgba(57,255,20,0.2)', color:'rgba(57,255,20,0.7)', fontFamily:'monospace', fontSize:'0.7rem', padding:'5px 10px', borderRadius:2, cursor:'pointer' }}>
                <Pencil size={11}/> Editar
              </button>
              <button onClick={()=>onNavigate && onNavigate('sede')} style={{ background:'transparent', border:'1px solid rgba(57,255,20,0.12)', color:'rgba(255,255,255,0.4)', fontFamily:'monospace', fontSize:'0.7rem', padding:'5px 10px', borderRadius:2, cursor:'pointer' }}>VER BITACORA</button>
              <button onClick={()=>onNavigate && onNavigate('mntTickets')} style={{ background:'transparent', border:'1px solid rgba(57,255,20,0.2)', color:'rgba(57,255,20,0.6)', fontFamily:'monospace', fontSize:'0.7rem', padding:'5px 10px', borderRadius:2, cursor:'pointer' }}>TICKETS MNT</button>
            </div>
          </div>

          {loadingDetail ? (
            <div style={{ textAlign:'center', padding:'2rem', color:'rgba(255,255,255,0.2)', fontSize:'0.8rem' }}>Cargando datos...</div>
          ) : kpis && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8, marginBottom:14 }}>
                <KpiCard label="Registros 30d"    val={kpis.registros} color="#60a5fa" sub="bitacora" onClick={()=>onNavigate && onNavigate('sede')} />
                <KpiCard label="Tickets abiertos" val={kpis.tickets}   color={kpiColor(kpis.tickets,3,6)} sub={kpis.criticos>0 ? kpis.criticos + ' criticos' : ''} onClick={()=>onNavigate && onNavigate('mntTickets')} />
                <KpiCard label="Tareas pendientes" val={kpis.tareas}   color={kpiColor(kpis.tareas,3,8)} sub="" onClick={()=>onNavigate && onNavigate('tareas')} />
                <KpiCard label="NCs activas"       val={kpis.ncs}      color={kpiColor(kpis.ncs,1,3)} sub="" onClick={()=>onNavigate && onNavigate('noConformidades')} />
                <KpiCard label="Personal asignado" val={kpis.personal} color={kpis.personal>0?'#39FF14':'#FF2A2A'} sub="" onClick={()=>onNavigate && onNavigate('sedeResponsables')} />
                <KpiCard label="Activos"           val={kpis.activos}  color="#9ca3af" sub="" onClick={()=>onNavigate && onNavigate('mntActivos')} />
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1.5fr 1fr', gap:10 }}>
                {/* PERSONAL */}
                <div style={{ background:'#0d0d12', border:'1px solid rgba(57,255,20,0.08)', borderRadius:3, padding:12 }}>
                  <div style={{ fontSize:'0.7rem', color:'rgba(57,255,20,0.5)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:5, height:5, borderRadius:'50%', background:'#39FF14' }}/>Personal afectado
                  </div>
                  {personal.length === 0 ? (
                    <p style={{ color:'rgba(255,255,255,0.2)', fontSize:'0.8rem', textAlign:'center', padding:'1rem 0' }}>Sin personal asignado</p>
                  ) : personal.map(p => {
                    const rolColor = p.rol==='Admin'?'#a78bfa':p.rol==='Editor'?'#F59E0B':'#60a5fa'
                    return (
                      <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9, paddingBottom:9, borderBottom:'1px solid rgba(57,255,20,0.06)' }}>
                        <Avatar nombre={p.nombre} color={rolColor} bg={rolColor + '18'} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:'0.85rem', color:'#e2e8f0', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.nombre}</div>
                          <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.35)', marginTop:1 }}>{p.rol}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* NOVEDADES */}
                <div style={{ background:'#0d0d12', border:'1px solid rgba(57,255,20,0.08)', borderRadius:3, padding:12 }}>
                  <div style={{ fontSize:'0.7rem', color:'rgba(57,255,20,0.5)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:5, height:5, borderRadius:'50%', background:'#39FF14' }}/>Novedades de bitacora
                  </div>
                  {novedades.length === 0 ? (
                    <p style={{ color:'rgba(255,255,255,0.2)', fontSize:'0.8rem', textAlign:'center', padding:'1rem' }}>Sin registros recientes</p>
                  ) : novedades.map(n => {
                    const color = ESTADO_COLOR[n.estado_general] || '#9ca3af'
                    const detalles = [n.detalle_a, n.detalle_b, n.detalle_c, n.detalle_d, n.detalle_e].filter(Boolean)
                    const resumen = detalles[0]?.slice(0,80) || 'Sin detalle'
                    return (
                      <div key={n.id} style={{ display:'grid', gridTemplateColumns:'40px 1fr', gap:8, marginBottom:9, paddingBottom:9, borderBottom:'1px solid rgba(57,255,20,0.06)' }}>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:'1rem', fontWeight:800, color:color + 'cc', lineHeight:1 }}>
                            {n.fecha_reporte ? new Date((n.fecha_reporte||'').slice(0,10)+'T12:00:00').getDate() : '...'}
                          </div>
                          <div style={{ fontSize:'0.62rem', color:color + '77' }}>
                            {n.fecha_reporte ? new Date((n.fecha_reporte||'').slice(0,10)+'T12:00:00').toLocaleDateString('es',{month:'short'}).toUpperCase() : ''}
                          </div>
                        </div>
                        <div>
                          <div style={{ display:'flex', gap:5, alignItems:'center', marginBottom:3 }}>
                            <span style={{ fontSize:'0.62rem', padding:'1px 6px', borderRadius:3, fontWeight:700, background:color + '18', color, border:'1px solid ' + color + '33' }}>{n.estado_general || 'Normal'}</span>
                            {n.turno && <span style={{ fontSize:'0.62rem', color:'rgba(255,255,255,0.25)' }}>{n.turno}</span>}
                          </div>
                          <div style={{ fontSize:'0.82rem', color:'#e2e8f0', lineHeight:1.35 }}>{resumen}</div>
                          {n.reportante && <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.3)', marginTop:2 }}>por {n.reportante}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* PLAN CAPA */}
                {capas.length > 0 && (() => {
                  const total    = capas.length
                  const cerradas = capas.filter(c => ['Completada','Verificada'].includes(c.estado)).length
                  const pct      = Math.round(cerradas / total * 100)
                  const pctColor = pct === 100 ? '#39FF14' : pct >= 50 ? '#60a5fa' : '#F59E0B'
                  const abiertas = capas.filter(c => !['Completada','Verificada'].includes(c.estado))
                  const audCod   = capas.find(c => c.auditoria_codigo)?.auditoria_codigo
                  return (
                    <div style={{ background:'#0d0d12', border:'1px solid rgba(139,92,246,0.2)', borderRadius:3, padding:12 }}>
                      <div style={{ fontSize:'0.7rem', color:'#a78bfa', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ width:5, height:5, borderRadius:'50%', background:'#a78bfa' }}/>
                          Plan CAPA {audCod && <span style={{ color:'rgba(167,139,250,0.5)', marginLeft:4 }}>· {audCod}</span>}
                        </div>
                        <span style={{ color:'rgba(255,255,255,0.25)' }}>{cerradas}/{total}</span>
                      </div>

                      {/* Barra de progreso */}
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                        <div style={{ flex:1, height:5, background:'rgba(57,255,20,0.06)', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ width:`${pct}%`, height:'100%', background:pctColor, borderRadius:3, transition:'width 0.4s', boxShadow: pct===100 ? `0 0 6px ${pctColor}` : undefined }} />
                        </div>
                        <span style={{ fontSize:'0.85rem', fontWeight:800, color:pctColor, minWidth:30, textAlign:'right' }}>{pct}%</span>
                      </div>

                      {/* CAPAs abiertas */}
                      {abiertas.length === 0 ? (
                        <p style={{ color:'#39FF14', fontSize:'0.78rem', textAlign:'center', padding:'4px 0', fontWeight:600 }}>✓ Plan completado</p>
                      ) : abiertas.slice(0,5).map(c => {
                        const vencida = c.fecha_limite && new Date(c.fecha_limite) < new Date() && !['Completada','Verificada'].includes(c.estado)
                        const estadoColor = c.estado === 'En ejecución' ? '#60a5fa' : '#9ca3af'
                        return (
                          <div key={c.id} style={{ marginBottom:7, paddingBottom:7, borderBottom:'1px solid rgba(57,255,20,0.06)', display:'flex', alignItems:'flex-start', gap:6 }}>
                            <div style={{ width:4, height:4, borderRadius:'50%', background:estadoColor, marginTop:4, flexShrink:0 }}/>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                                <span style={{ fontSize:'0.62rem', color:'#a78bfa', fontFamily:'monospace', fontWeight:700 }}>{c.codigo}</span>
                                {vencida && <span style={{ fontSize:'0.62rem', color:'#ff5050', fontWeight:700, background:'rgba(255,80,80,0.12)', padding:'0 4px', borderRadius:2 }}>VEN</span>}
                                {c.fecha_limite && !vencida && <span style={{ fontSize:'0.62rem', color:'rgba(255,255,255,0.2)' }}>{new Date(c.fecha_limite).toLocaleDateString('es',{day:'2-digit',month:'short'})}</span>}
                              </div>
                              <div style={{ fontSize:'0.8rem', color:'#e2e8f0', lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.descripcion}</div>
                              {c.responsable && <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.25)', marginTop:1 }}>{c.responsable}</div>}
                            </div>
                          </div>
                        )
                      })}
                      {abiertas.length > 5 && (
                        <div style={{ fontSize:'0.65rem', color:'rgba(167,139,250,0.5)', textAlign:'center', paddingTop:2 }}>+{abiertas.length-5} más pendientes</div>
                      )}
                    </div>
                  )
                })()}

                {/* ACTIVOS + TICKETS */}
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <div style={{ background:'#0d0d12', border:'1px solid rgba(57,255,20,0.08)', borderRadius:3, padding:12 }}>
                    <div style={{ fontSize:'0.7rem', color:'rgba(57,255,20,0.5)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:5, height:5, borderRadius:'50%', background:'#39FF14' }}/>Activos / Equipos
                    </div>
                    {activos.length === 0 ? (
                      <p style={{ color:'rgba(255,255,255,0.2)', fontSize:'0.8rem', textAlign:'center', padding:'0.5rem 0' }}>Sin activos registrados</p>
                    ) : activos.map(a => {
                      const sc = EST_COLOR[a.estado] || '#9ca3af'
                      return (
                        <div key={a.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7, paddingBottom:7, borderBottom:'1px solid rgba(57,255,20,0.06)' }}>
                          <div>
                            <div style={{ fontSize:'0.8rem', color:'#e2e8f0' }}>{a.nombre}</div>
                            <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.3)', marginTop:1 }}>{a.tipo}</div>
                          </div>
                          <div style={{ width:6, height:6, borderRadius:'50%', background:sc, flexShrink:0 }}/>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ background:'#0d0d12', border:'1px solid rgba(57,255,20,0.08)', borderRadius:3, padding:12 }}>
                    <div style={{ fontSize:'0.7rem', color:'rgba(57,255,20,0.5)', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:5, height:5, borderRadius:'50%', background:'#F59E0B' }}/>Tickets abiertos por área
                    </div>
                    {tickets.length === 0 ? (
                      <p style={{ color:'rgba(57,255,20,0.4)', fontSize:'0.8rem', textAlign:'center', padding:'0.5rem 0' }}>Sin tickets abiertos</p>
                    ) : (() => {
                      const cats = {}
                      tickets.forEach(t => {
                        const cat = t.categoria || 'Sin categoría'
                        if (!cats[cat]) cats[cat] = []
                        cats[cat].push(t)
                      })
                      const CAT_COLOR = {
                        'Mantenimiento':'#60a5fa', 'Vehiculos':'#a78bfa', 'Compras':'#F59E0B',
                        'Personal':'#34d399', 'Infraestructura':'#fb7185', 'Sin categoría':'#9ca3af'
                      }
                      return Object.entries(cats).map(([cat, tkts]) => (
                        <div key={cat} style={{ marginBottom:10 }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                              <div style={{ width:4, height:4, borderRadius:'50%', background: CAT_COLOR[cat]||'#9ca3af' }}/>
                              <span style={{ fontSize:'0.7rem', color: CAT_COLOR[cat]||'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em' }}>{cat}</span>
                            </div>
                            <span style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.3)', background:'rgba(57,255,20,0.08)', borderRadius:2, padding:'0 6px' }}>{tkts.length}</span>
                          </div>
                          {tkts.slice(0,3).map(t => {
                            const pc = PRIO_COLOR[t.prioridad] || '#9ca3af'
                            return (
                              <div key={t.id} style={{ marginBottom:5, paddingBottom:5, paddingLeft:10, borderLeft:'1px solid rgba(57,255,20,0.08)', borderBottom:'1px solid rgba(57,255,20,0.05)' }}>
                                <div style={{ display:'flex', gap:4, alignItems:'center', marginBottom:2 }}>
                                  <span style={{ fontSize:'0.6rem', padding:'1px 4px', borderRadius:2, fontWeight:700, background:pc+'18', color:pc }}>{t.prioridad}</span>
                                  <span style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.2)' }}>#{t.numero}</span>
                                </div>
                                <div style={{ fontSize:'0.8rem', color:'#e2e8f0', lineHeight:1.3 }}>{t.descripcion?.slice(0,55)||'Sin descripcion'}</div>
                              </div>
                            )
                          })}
                          {tkts.length > 3 && <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.2)', textAlign:'center', paddingTop:3 }}>+{tkts.length-3} más</div>}
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Historial semanal de estado ── */}
      {histSemanal.length > 0 && (
        <div className="glass rounded mt-5" style={{ borderRadius:'3px', padding:'1rem' }}>
          <p className="font-metric text-xs tracking-widest uppercase mb-3" style={{ color:'var(--text-dim)' }}>
            Estado general · últimas 8 semanas
          </p>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={histSemanal} margin={{ top:4, right:8, left:-20, bottom:0 }}>
              <XAxis dataKey="semana"
                tick={{ fill:'rgba(255,255,255,0.3)', fontSize:9 }}
                tickFormatter={d => d?.slice(5)}
                axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false}
                tick={{ fill:'rgba(255,255,255,0.3)', fontSize:9 }}
                axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.12)', borderRadius:2, fontSize:'0.72rem' }}
                labelStyle={{ color:'var(--text-dim)', marginBottom:4 }}
              />
              <Legend wrapperStyle={{ fontSize:'0.65rem', paddingTop:8 }}
                formatter={v => ({ sin_novedades:'Sin novedades', hay_novedades:'Hay novedades', condicionada:'Op. Condicionada' }[v] || v)} />
              <Bar dataKey="sin_novedades" stackId="a" fill="#39FF14" fillOpacity={0.7} radius={[0,0,0,0]} />
              <Bar dataKey="hay_novedades" stackId="a" fill="#F59E0B" fillOpacity={0.8} />
              <Bar dataKey="condicionada"  stackId="a" fill="#FF2A2A" fillOpacity={0.85} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {(modal === 'edit' || modal === 'new') && (
        <SedeModal
          sede={modal === 'edit' ? sede : null}
          personal={modal === 'edit' ? personal : []}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
