import { useState, useEffect, useCallback } from 'react'
import { fmtFecha } from '../../lib/dateUtils'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { getActivos, upsertActivo, getSedes } from '../../lib/queries'
import { Plus, RefreshCw, Filter } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import DocumentacionChecklist from '../../components/DocumentacionChecklist'
import { VEHICULO_DOCUMENTACION_TEMPLATE } from '../../lib/documentacion'
import { isQualityOnlyProfile } from '../../lib/access'

const ESTADO_COLOR = { operativo:'#39FF14', en_reparacion:'#F59E0B', baja:'#FF2A2A' }
const INPUT_S = { width:'100%', padding:'0.4rem 0.75rem', borderRadius:2, background:'var(--surface)', border:'1px solid rgba(107,114,128,0.3)', color:'var(--text)', fontSize:'0.875rem', fontFamily:'Inter,sans-serif', boxSizing:'border-box', outline:'none' }
const LABEL_S = { color:'var(--text-dim)', fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.35rem', fontFamily:"'Roboto Mono',monospace" }
const ROW_S   = { marginBottom:'1rem' }

const DOCS = [
  { key:'vencimiento_seguro',  label:'Seguro' },
  { key:'vencimiento_vtv',     label:'VTV' },
  { key:'vencimiento_senasa',  label:'SENASA' },
  { key:'vencimiento_rmtsa',   label:'RMTSA' },
]

const hoy = () => new Date().toISOString().split('T')[0]
const estaVencido   = f => !!f && f < hoy()
const proximoVencer = f => { if (!f) return false; const d = (new Date(f)-new Date())/86400000; return d>=0 && d<=30 }
const docColor = f => estaVencido(f) ? '#FF2A2A' : proximoVencer(f) ? '#F59E0B' : f ? '#39FF14' : 'var(--text-dim)'

function VehiculoModal({ vehiculo, sedes, onClose, onSaved }) {
  const isNew = !vehiculo?.id
  const { rol, perfil } = useAuth()
  const canEdit = ['admin','encargado','editor','flota'].includes(rol) && !isQualityOnlyProfile(perfil)
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState(vehiculo || { tipo:'VEHICULO', estado:'operativo', nombre:'' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const [planes, setPlanes] = useState([])
  const [loadingPlanes, setLoadingPlanes] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  useEffect(() => {
    if (!isNew && vehiculo?.id) {
      setLoadingPlanes(true)
      supabase.from('mnt_planes').select('*').eq('activo_id', vehiculo.id).eq('activo', true).order('proxima_fecha')
        .then(({ data }) => { setPlanes(data || []); setLoadingPlanes(false) })
    }
  }, [isNew, vehiculo?.id])

  const handleSave = async () => {
    if (!form.nombre) { setErr('El nombre / patente es obligatorio'); return }
    setSaving(true); setErr(null)
    try {
      let payload = { ...form, tipo:'VEHICULO' }
      // 'dominio' no existe como columna en mantenimiento.activos — eliminarlo del payload
      // para evitar el error "Could not find the 'dominio' column of 'mnt_activos'"
      delete payload.dominio
      if (payload.sede_id) {
        const sede = sedes.find(s => s.id === Number(payload.sede_id))
        if (sede) payload.sede_nombre = sede.nombre
      }
      await upsertActivo(payload)
      onSaved()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const Field = ({ label, value }) => value ? (
    <div style={{ marginBottom:'0.85rem' }}>
      <p style={{ ...LABEL_S, marginBottom:'0.2rem' }}>{label}</p>
      <p style={{ color:'var(--text)', fontSize:'0.85rem', margin:0 }}>{value}</p>
    </div>
  ) : null

  const VencChip = ({ label, fecha }) => (
    <div style={{ marginBottom:'0.85rem' }}>
      <p style={LABEL_S}>{label}</p>
      <p style={{ color: docColor(fecha), fontSize:'0.82rem', fontFamily:'monospace', margin:0 }}>
        {fecha ? fmtFecha(fecha) : '—'}
        {estaVencido(fecha) && <span style={{ marginLeft:6, fontSize:'0.65rem' }}>⚠ Vencido</span>}
        {!estaVencido(fecha) && proximoVencer(fecha) && <span style={{ marginLeft:6, fontSize:'0.65rem' }}>⚡ Próx.</span>}
      </p>
    </div>
  )

  const sedeName = vehiculo?.sede_nombre || sedes.find(s=>s.id===vehiculo?.sede_id)?.nombre

  return (
    <div className='modal-overlay'>
      <div style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.08)', borderRadius:3, padding:'1.75rem', width:'100%', maxWidth:580, maxHeight:'90vh', overflowY:'auto' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
          <div>
            <h2 style={{ color:'var(--text)', fontWeight:700, fontSize:'1.1rem', margin:0 }}>
              {isNew ? 'Nuevo Vehículo' : vehiculo.nombre}
            </h2>
            {!isNew && (
              <div style={{ display:'flex', gap:6, marginTop:5 }}>
                <span className='chip' style={{ background:`${ESTADO_COLOR[vehiculo.estado]||'#888'}18`, color:ESTADO_COLOR[vehiculo.estado]||'#888', border:`1px solid ${ESTADO_COLOR[vehiculo.estado]||'#888'}33`, borderRadius:2 }}>{vehiculo.estado}</span>
                {vehiculo.dominio && <span className='chip' style={{ borderRadius:2 }}>{vehiculo.dominio}</span>}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'1.2rem', marginLeft:8 }}>✕</button>
        </div>

        {!isNew && !editing ? (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1.5rem' }}>
              <Field label="Marca / Modelo" value={[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ')} />
              <Field label="Categoría" value={vehiculo.categoria} />
              <Field label="Sede / Unidad" value={sedeName} />
              <Field label="Responsable" value={vehiculo.responsable} />
              <Field label="Dominio" value={vehiculo.dominio} />
              <Field label="Año" value={vehiculo.anio} />
            </div>
            <p style={{ color:'var(--phosphor)', fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.1em', margin:'0.5rem 0 0.75rem', borderTop:'1px solid rgba(57,255,20,0.08)', paddingTop:'0.75rem', fontFamily:"'Roboto Mono',monospace" }}>Documentación</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1.5rem' }}>
              {DOCS.map(d => <VencChip key={d.key} label={`Venc. ${d.label}`} fecha={vehiculo[d.key]} />)}
            </div>

            <div style={{ marginTop:'1rem' }}>
              <DocumentacionChecklist
                entityType="vehiculo"
                entityId={vehiculo.id}
                template={VEHICULO_DOCUMENTACION_TEMPLATE}
                canEdit={canEdit}
                title="Documentación auditoría / flota"
              />
            </div>

            <p style={{ color:'var(--phosphor)', fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.1em', margin:'0.5rem 0 0.75rem', borderTop:'1px solid rgba(57,255,20,0.08)', paddingTop:'0.75rem', fontFamily:"'Roboto Mono',monospace" }}>Mantenimiento Preventivo</p>
            {loadingPlanes ? (
              <p style={{ color:'var(--text-dim)', fontSize:'0.7rem' }}>Cargando...</p>
            ) : planes.length === 0 ? (
              <p style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>Sin plan preventivo asignado</p>
            ) : (
              planes.map(p => {
                const d = p.proxima_fecha ? Math.ceil((new Date(p.proxima_fecha) - new Date()) / 86400000) : null
                const color = d === null ? 'var(--text-dim)' : d < 0 ? '#FF2A2A' : d <= 7 ? '#F59E0B' : '#39FF14'
                return (
                  <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
                    <div>
                      <p style={{ color:'var(--text)', fontSize:'0.8rem', margin:0 }}>{p.nombre}</p>
                      <p style={{ color:'var(--text-dim)', fontSize:'0.65rem', margin:0 }}>{p.frecuencia}{p.ultimo_realizado ? ` · último: ${fmtFecha(p.ultimo_realizado)}` : ''}</p>
                    </div>
                    <span style={{ color, fontSize:'0.72rem', fontFamily:'monospace', whiteSpace:'nowrap' }}>
                      {d === null ? '—' : d < 0 ? `${Math.abs(d)}d vencido` : d === 0 ? 'Hoy' : `en ${d}d`}
                    </span>
                  </div>
                )
              })
            )}

            {vehiculo.notas && (
              <div style={{ borderTop:'1px solid rgba(57,255,20,0.08)', paddingTop:'0.75rem', marginTop:'0.25rem' }}>
                <p style={LABEL_S}>Notas</p>
                <p style={{ color:'var(--text-dim)', fontSize:'0.8rem', margin:0, lineHeight:1.5 }}>{vehiculo.notas}</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0 1rem' }}>
              <div style={ROW_S}><label style={LABEL_S}>Nombre / Patente *</label><input value={form.nombre} onChange={e=>set('nombre',e.target.value.toUpperCase())} style={INPUT_S} placeholder="Ej: AA239RK" required /></div>
              <div style={ROW_S}><label style={LABEL_S}>Dominio</label><input value={form.dominio||''} onChange={e=>set('dominio',e.target.value.toUpperCase())} style={INPUT_S} placeholder="Ej: AA239RK" /></div>
              <div style={ROW_S}><label style={LABEL_S}>Año</label><input type="number" value={form.anio||''} onChange={e=>set('anio',+e.target.value)} style={INPUT_S} placeholder="Ej: 2019" /></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem' }}>
              <div style={ROW_S}><label style={LABEL_S}>Marca</label><input value={form.marca||''} onChange={e=>set('marca',e.target.value)} style={INPUT_S} placeholder="Ej: Ford" /></div>
              <div style={ROW_S}><label style={LABEL_S}>Modelo</label><input value={form.modelo||''} onChange={e=>set('modelo',e.target.value)} style={INPUT_S} placeholder="Ej: Transit" /></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem' }}>
              <div style={ROW_S}>
                <label style={LABEL_S}>Sede / Unidad</label>
                <select value={form.sede_id||''} onChange={e=>set('sede_id', e.target.value ? Number(e.target.value) : null)} style={INPUT_S}>
                  <option value="">Sin asignar</option>
                  {sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div style={ROW_S}>
                <label style={LABEL_S}>Estado</label>
                <select value={form.estado} onChange={e=>set('estado',e.target.value)} style={INPUT_S}>
                  <option value="operativo">Operativo</option>
                  <option value="en_reparacion">En Reparación</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem' }}>
              <div style={ROW_S}><label style={LABEL_S}>Responsable</label><input value={form.responsable||''} onChange={e=>set('responsable',e.target.value)} style={INPUT_S} placeholder="Ej: Juan Pérez" /></div>
              <div style={ROW_S}><label style={LABEL_S}>Categoría</label><input value={form.categoria||''} onChange={e=>set('categoria',e.target.value)} style={INPUT_S} placeholder="CAMION, UTILITARIO..." /></div>
            </div>

            <p style={{ color:'var(--phosphor)', fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.75rem', marginTop:'0.5rem', fontFamily:"'Roboto Mono',monospace" }}>Documentación</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem' }}>
              {DOCS.map(d => (
                <div key={d.key} style={ROW_S}>
                  <label style={LABEL_S}>Venc. {d.label}</label>
                  <input type="date" value={form[d.key]||''} onChange={e=>set(d.key,e.target.value)} style={INPUT_S} />
                </div>
              ))}
            </div>

            <div style={ROW_S}><label style={LABEL_S}>Notas</label><textarea value={form.notas||''} onChange={e=>set('notas',e.target.value)} rows={3} style={{ ...INPUT_S, resize:'vertical' }} placeholder="Ej: Service cada 10.000 km" /></div>
          </>
        )}

        {err && <p style={{ color:'#FF2A2A', fontSize:'0.8rem', marginBottom:'1rem' }}>{err}</p>}

        <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end', marginTop:'1rem' }}>
          {!isNew && !editing && canEdit && (
            <button onClick={() => setEditing(true)} className='btn-primary'>Editar</button>
          )}
          {(isNew || editing) && (
            <>
              <button onClick={() => editing ? setEditing(false) : onClose()} className='btn-ghost'>Cancelar</button>
              <button onClick={handleSave} disabled={saving} className='btn-primary' style={{ opacity: saving ? 0.5 : 1 }}>
                {saving ? 'Guardando...' : (isNew ? 'Crear' : 'Guardar')}
              </button>
            </>
          )}
          {!editing && <button onClick={onClose} className='btn-ghost'>Cerrar</button>}
        </div>
      </div>
    </div>
  )
}

export default function MntFlotaGestion({ focusId }) {
  const { allowedSedeIds, rol, perfil } = useAuth()
  const canWrite = ['admin','editor','encargado','flota'].includes(rol) && !isQualityOnlyProfile(perfil)
  const [vehiculos, setVehiculos] = useState([])
  const [sedes, setSedes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [sedeId, setSedeId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [soloVenc, setSoloVenc] = useState(false)

  useEffect(() => { getSedes(allowedSedeIds).then(setSedes) }, [])

  // Si el usuario tiene una sola sede asignada (ej: encargado), queda preseleccionada
  useEffect(() => { if (allowedSedeIds?.length === 1) setSedeId(String(allowedSedeIds[0])) }, [allowedSedeIds])

  const load = useCallback(() => {
    setLoading(true)
    const filtros = { tipo: 'VEHICULO', sedeIds: allowedSedeIds || undefined }
    if (sedeId) filtros.sede_id = Number(sedeId)
    getActivos(filtros).then(setVehiculos).finally(() => setLoading(false))
  }, [sedeId])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!focusId || loading) return
    const target = vehiculos.find(item => String(item.id) === String(focusId))
    if (target) setModal(target)
  }, [focusId, loading, vehiculos])

  const conVencido = v => DOCS.some(d => estaVencido(v[d.key]))
  const conProximo = v => DOCS.some(d => proximoVencer(v[d.key])) && !conVencido(v)

  const filtrados = vehiculos
    .filter(v => !busqueda || v.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || (v.dominio||'').toLowerCase().includes(busqueda.toLowerCase()))
    .filter(v => !soloVenc || conVencido(v) || conProximo(v))

  const vencidos  = vehiculos.filter(conVencido).length
  const proximos  = vehiculos.filter(conProximo).length

  const SEL_S = { background:'#1a1a2e', border:'1px solid rgba(57,255,20,0.15)', color:'#e2e8f0', borderRadius:2, padding:'0.35rem 0.75rem', fontSize:'0.72rem', fontFamily:'inherit', cursor:'pointer' }

  return (
    <div style={{ padding:'1.5rem 2rem', height:'100%', display:'flex', flexDirection:'column' }}>
      <PageHeader title="Gestión Flota" subtitle="Documentación y vencimientos por vehículo">
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select value={sedeId} onChange={e=>setSedeId(e.target.value)} style={SEL_S}>
            <option value=''>Todas las sedes</option>
            {sedes.map(s=><option key={s.id} value={s.id} style={{ background:'#1a1a2e' }}>{s.nombre}</option>)}
          </select>
          <button onClick={load} style={{ ...SEL_S, display:'flex', alignItems:'center', gap:5 }}><RefreshCw size={11}/> Actualizar</button>
          {canWrite && (
            <button onClick={()=>setModal({})} className='btn-primary' style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Plus size={13}/> Nuevo Vehículo
            </button>
          )}
        </div>
      </PageHeader>

      {/* KPIs */}
      <div style={{ display:'flex', gap:'0.6rem', marginBottom:'1rem', flexWrap:'wrap' }}>
        {[
          { label:'Total vehículos', value: vehiculos.length, color:'var(--text)' },
          { label:'Doc. vencida', value: vencidos, color:'#FF2A2A' },
          { label:'Vence en 30 días', value: proximos, color:'#F59E0B' },
          { label:'Operativos', value: vehiculos.filter(v=>v.estado==='operativo').length, color:'#39FF14' },
        ].map(k=>(
          <div key={k.label} style={{ background:'var(--surface)', borderRadius:3, padding:'0.75rem 1rem', flex:1, minWidth:120 }}>
            <p style={{ color:'var(--text-dim)', fontSize:'0.58rem', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{k.label}</p>
            <p style={{ color:k.color, fontWeight:800, fontSize:'1.5rem', lineHeight:1 }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'1rem', alignItems:'center' }}>
        <Filter size={13} style={{ color:'rgba(255,255,255,0.3)' }} />
        <input value={busqueda} onChange={e=>setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o dominio..."
          style={{ padding:'0.4rem 0.8rem', borderRadius:2, background:'var(--surface)', border:'1px solid rgba(57,255,20,0.07)', color:'var(--text)', fontSize:'0.8rem', width:220 }} />
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.65rem', color:'rgba(255,255,255,0.4)', cursor:'pointer' }}>
          <input type="checkbox" checked={soloVenc} onChange={e=>setSoloVenc(e.target.checked)} style={{ accentColor:'#ff5050' }}/>
          Solo con vencimientos
        </label>
      </div>

      <div style={{ flex:1, overflowY:'auto', background:'var(--surface)', borderRadius:3 }}>
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'3rem' }}>
            <div style={{ width:28, height:28, borderRadius:'50%', border:'2px solid var(--phosphor)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
          </div>
        ) : filtrados.length === 0 ? (
          <p style={{ padding:'2rem', color:'var(--text-dim)', textAlign:'center' }}>Sin vehículos{sedeId ? ' para esta sede' : ''}</p>
        ) : (
          <table className="table-dark" style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8rem' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid rgba(57,255,20,0.05)' }}>
                {['Vehículo','Sede','Responsable','Seguro','VTV','SENASA','RMTSA','Estado'].map(h=>(
                  <th key={h} style={{ padding:'0.55rem 0.9rem', color:'var(--text-dim)', fontSize:'0.58rem', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, textAlign:'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((v,i) => (
                <tr key={v.id} onClick={()=>setModal(v)}
                  style={{ borderBottom:i<filtrados.length-1?'1px solid rgba(255,255,255,0.03)':'none', cursor:'pointer' }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ padding:'0.6rem 0.9rem' }}>
                    <p style={{ color:'var(--text)', fontWeight:600, margin:0 }}>{v.nombre}</p>
                    <p style={{ color:'var(--text-dim)', fontSize:'0.65rem', margin:0 }}>{v.dominio||'—'} {v.marca?`· ${v.marca} ${v.modelo||''}`:''}</p>
                  </td>
                  <td style={{ padding:'0.6rem 0.9rem', color:'var(--text-dim)' }}>{v.sede_nombre||'—'}</td>
                  <td style={{ padding:'0.6rem 0.9rem', color:'var(--text-dim)' }}>{v.responsable||'—'}</td>
                  {DOCS.map(d => (
                    <td key={d.key} style={{ padding:'0.6rem 0.9rem', color:docColor(v[d.key]), fontFamily:'monospace', fontSize:'0.74rem' }}>
                      {v[d.key] || '—'}
                      {estaVencido(v[d.key]) && <span style={{ marginLeft:4 }}>⚠</span>}
                      {!estaVencido(v[d.key]) && proximoVencer(v[d.key]) && <span style={{ marginLeft:4 }}>⚡</span>}
                    </td>
                  ))}
                  <td style={{ padding:'0.6rem 0.9rem' }}>
                    <span style={{ fontSize:'0.65rem', fontWeight:700, padding:'0.2rem 0.5rem', borderRadius:4,
                      background:`${ESTADO_COLOR[v.estado]||'#555'}22`, color:ESTADO_COLOR[v.estado]||'#555' }}>
                      {v.estado?.replace('_',' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal !== null && (
        <VehiculoModal
          vehiculo={modal?.id ? modal : null}
          sedes={sedes}
          onClose={()=>setModal(null)}
          onSaved={()=>{ setModal(null); load() }}
        />
      )}
    </div>
  )
}
