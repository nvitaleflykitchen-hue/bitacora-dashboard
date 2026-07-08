import { useState, useEffect, useCallback } from 'react'
import { getMatafuegos, upsertMatafuego, getActivos } from '../../lib/queries'
import { useAuth } from '../../lib/auth'
import { isQualityOnlyProfile } from '../../lib/access'
import PageHeader from '../../components/PageHeader'

const ESTADO_COLOR = { operativo:'#39FF14', vencido:'#FF2A2A', baja:'#6B7280' }
const INPUT_S = { width:'100%', padding:'0.7rem 0.9rem', borderRadius:2, background:'#1a1a2e', border:'1px solid rgba(57,255,20,0.08)', color:'#e2e8f0', fontSize:'0.88rem', fontFamily:'inherit', boxSizing:'border-box' }
const LABEL_S = { color:'var(--text-dim)', fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.35rem' }
const ROW_S   = { marginBottom:'1rem' }

function MatafuegoModal({ item, vehiculos, onClose, onSaved }) {
  const isNew = !item?.id
  const [form, setForm] = useState(item || { estado:'operativo', codigo:'', tipo:'ABC' })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState(null)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleSave = async () => {
    if (!form.codigo) { setErr('El código es obligatorio'); return }
    if (!form.activo_id) { setErr('Seleccioná el vehículo'); return }
    setSaving(true); setErr(null)
    try {
      let payload = { ...form, activo_id: Number(form.activo_id) || form.activo_id }
      const veh = vehiculos.find(v => String(v.id) === String(payload.activo_id))
      if (veh) payload.activo_patente = veh.dominio || veh.nombre
      await upsertMatafuego(payload)
      onSaved()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
      <div style={{ background:'var(--surface)', borderRadius:3, padding:'1.75rem', width:'100%', maxWidth:480, overflowY:'auto', maxHeight:'90vh' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1.5rem' }}>
          <h2 style={{ color:'var(--text)', fontWeight:700 }}>{isNew ? 'Nuevo Matafuego' : `Editar ${item.codigo}`}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem' }}>
          <div style={ROW_S}><label style={LABEL_S}>Código *</label><input value={form.codigo} onChange={e=>set('codigo',e.target.value)} style={INPUT_S} placeholder="Ej: MAT-V014" required /></div>
          <div style={ROW_S}><label style={LABEL_S}>Tipo</label><input value={form.tipo||''} onChange={e=>set('tipo',e.target.value)} style={INPUT_S} placeholder="ABC, CO2..." /></div>
          <div style={ROW_S}><label style={LABEL_S}>Capacidad (kg)</label><input type="number" step="0.5" value={form.capacidad_kg||''} onChange={e=>set('capacidad_kg',+e.target.value)} style={INPUT_S} placeholder="Ej: 1" /></div>
          <div style={ROW_S}>
            <label style={LABEL_S}>Estado</label>
            <select value={form.estado} onChange={e=>set('estado',e.target.value)} style={INPUT_S}>
              <option value="operativo">Operativo</option>
              <option value="vencido">Vencido</option>
              <option value="baja">Baja</option>
            </select>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem' }}>
          <div style={ROW_S}>
            <label style={LABEL_S}>Vehículo *</label>
            <select value={form.activo_id||''} onChange={e=>set('activo_id', e.target.value || null)} style={INPUT_S}>
              <option value="">Seleccionar...</option>
              {vehiculos.map(v=><option key={v.id} value={v.id}>{v.dominio || v.nombre}</option>)}
            </select>
          </div>
          <div style={ROW_S}><label style={LABEL_S}>Ubicación (descripción)</label><input value={form.ubicacion||''} onChange={e=>set('ubicacion',e.target.value)} style={INPUT_S} placeholder="Ej: Cabina, baúl" /></div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem' }}>
          <div style={ROW_S}><label style={LABEL_S}>Vencimiento</label><input type="date" value={form.vencimiento||''} onChange={e=>set('vencimiento',e.target.value)} style={INPUT_S} /></div>
          <div style={ROW_S}><label style={LABEL_S}>Última Recarga</label><input type="date" value={form.ultima_recarga||''} onChange={e=>set('ultima_recarga',e.target.value)} style={INPUT_S} /></div>
        </div>

        {err && <p style={{ color:'#FF2A2A', fontSize:'0.8rem', marginBottom:'1rem' }}>{err}</p>}
        <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'0.65rem 1.2rem', borderRadius:2, background:'#1a1a22', color:'var(--text-dim)', border:'none', cursor:'pointer', fontWeight:600 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding:'0.65rem 1.4rem', borderRadius:2, background:saving?'rgba(57,255,20,0.4)':'var(--phosphor)', color:'#0A0A0E', border:'none', cursor:'pointer', fontWeight:700 }}>
            {saving ? 'Guardando...' : (isNew ? 'Crear' : 'Guardar')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FlotaMatafuegos() {
  const { rol, perfil } = useAuth()
  const canWrite = ['admin','editor','encargado','flota'].includes(rol) && !isQualityOnlyProfile(perfil)
  const [items, setItems]       = useState([])
  const [vehiculos, setVehiculos] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null)
  const [errLoad, setErrLoad]   = useState(null)

  useEffect(() => { getActivos({ tipo:'VEHICULO' }).then(setVehiculos).catch(()=>{}) }, [])

  const load = useCallback(() => {
    setLoading(true); setErrLoad(null)
    getMatafuegos()
      .then(data => setItems(data.filter(m => m.activo_id)))
      .catch(e => setErrLoad(e.message))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const hoy     = new Date().toISOString().split('T')[0]
  const vencidos = items.filter(m => m.vencimiento && m.vencimiento < hoy).length
  const proximos = items.filter(m => {
    if (!m.vencimiento) return false
    const diff = (new Date(m.vencimiento) - new Date()) / 86400000
    return diff >= 0 && diff <= 30
  }).length

  return (
    <div style={{ padding:'1.5rem 2rem', height:'100%', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <PageHeader title="Matafuegos · Flota">
        {canWrite && (
          <button onClick={()=>setModal({})}
            style={{ background:'var(--phosphor)', color:'#0A0A0E', border:'none', borderRadius:3, padding:'0.55rem 1.1rem', fontWeight:700, cursor:'pointer' }}>
            + Nuevo
          </button>
        )}
      </PageHeader>

      {errLoad && (
        <p style={{ color:'#F59E0B', fontSize:'0.78rem', marginBottom:'0.75rem' }}>
          No se pudo cargar matafuegos por vehículo ({errLoad}). Puede que falte ejecutar la migración SQL pendiente.
        </p>
      )}

      {/* KPIs */}
      <div style={{ display:'flex', gap:'0.6rem', marginBottom:'1rem' }}>
        {[
          { label:'Total', value:items.length, color:'var(--text)' },
          { label:'Vencidos', value:vencidos, color:'#FF2A2A' },
          { label:'Próx. vencer (30d)', value:proximos, color:'#F59E0B' },
          { label:'Operativos', value:items.filter(m=>m.estado==='operativo').length, color:'#39FF14' },
        ].map(k=>(
          <div key={k.label} style={{ background:'var(--surface)', borderRadius:3, padding:'0.75rem 1rem', flex:1, minWidth:90 }}>
            <p style={{ color:'var(--text-dim)', fontSize:'0.58rem', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{k.label}</p>
            <p style={{ color:k.color, fontWeight:800, fontSize:'1.5rem', lineHeight:1 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div style={{ flex:1, overflowY:'auto', background:'var(--surface)', borderRadius:3 }}>
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'3rem' }}>
            <div style={{ width:28, height:28, borderRadius:'50%', border:'2px solid var(--phosphor)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
          </div>
        ) : items.length === 0 ? (
          <p style={{ padding:'2rem', color:'var(--text-dim)', textAlign:'center' }}>Sin matafuegos asignados a vehículos</p>
        ) : (
          <table className="table-dark" style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid rgba(57,255,20,0.05)' }}>
                {['Código','Tipo','Cap.','Vehículo','Ubicación','Vencimiento','Estado'].map(h=>(
                  <th key={h} style={{ padding:'0.6rem 1rem', color:'var(--text-dim)', fontSize:'0.58rem', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, textAlign:'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((m,i) => {
                const vencido  = m.vencimiento && m.vencimiento < hoy
                const proximoV = m.vencimiento && !vencido && (new Date(m.vencimiento)-new Date())/86400000 <= 30
                return (
                  <tr key={m.id} onClick={()=>canWrite && setModal(m)}
                    style={{ borderBottom:i<items.length-1?'1px solid rgba(255,255,255,0.03)':'none', cursor:canWrite?'pointer':'default' }}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'0.65rem 1rem', color:'var(--text)', fontWeight:600 }}>{m.codigo}</td>
                    <td style={{ padding:'0.65rem 1rem', color:'var(--text-dim)' }}>{m.tipo||'—'}</td>
                    <td style={{ padding:'0.65rem 1rem', color:'var(--text-dim)' }}>{m.capacidad_kg ? `${m.capacidad_kg}kg` : '—'}</td>
                    <td style={{ padding:'0.65rem 1rem', color:'var(--text)' }}>{m.activo_patente || '—'}</td>
                    <td style={{ padding:'0.65rem 1rem', color:'var(--text-dim)' }}>{m.ubicacion||'—'}</td>
                    <td style={{ padding:'0.65rem 1rem', color: vencido?'#FF2A2A' : proximoV?'#F59E0B' : 'var(--text-dim)', fontFamily:'monospace' }}>
                      {m.vencimiento || '—'}
                      {vencido  && <span style={{ fontSize:'0.65rem', marginLeft:5 }}>⚠</span>}
                      {proximoV && <span style={{ fontSize:'0.65rem', marginLeft:5 }}>⚡</span>}
                    </td>
                    <td style={{ padding:'0.65rem 1rem' }}>
                      <span style={{ fontSize:'0.65rem', fontWeight:700, padding:'0.2rem 0.5rem', borderRadius:4,
                        background:`${ESTADO_COLOR[m.estado]||'#555'}22`, color:ESTADO_COLOR[m.estado]||'#555' }}>
                        {m.estado}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal !== null && (
        <MatafuegoModal
          item={modal?.id ? modal : null}
          vehiculos={vehiculos}
          onClose={()=>setModal(null)}
          onSaved={()=>{ setModal(null); load() }}
        />
      )}
    </div>
  )
}
