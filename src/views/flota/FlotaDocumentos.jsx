import { useState, useEffect, useCallback } from 'react'
import { getPoes, upsertPoe, deletePoe, getActivos } from '../../lib/queries'
import { useAuth } from '../../lib/auth'
import AdjuntosPanel from '../../components/AdjuntosPanel'
import PageHeader from '../../components/PageHeader'
import { isQualityOnlyProfile } from '../../lib/access'
import { confirmar } from '../../lib/feedback'

const TIPO_LABEL  = { poe:'POE', legal:'Legal', seguro:'Seguro', manual:'Manual', circulacion:'Circulación', otro:'Otro' }
import { DOC_ESTADO_COLOR as ESTADO_COLOR } from '../../lib/estados'
const INPUT_S = { width:'100%', padding:'0.7rem 0.9rem', borderRadius:2, background:'#1a1a2e', border:'1px solid rgba(57,255,20,0.08)', color:'#e2e8f0', fontSize:'0.88rem', fontFamily:'inherit', boxSizing:'border-box' }
const LABEL_S = { color:'var(--text-dim)', fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.35rem' }
const ROW_S   = { marginBottom:'1rem' }

function DocumentoModal({ item, vehiculos, canWrite, onClose, onSaved, onDeleted }) {
  const isNew = !item?.id
  const [form, setForm] = useState(item || { tipo:'poe', estado:'vigente', titulo:'' })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState(null)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleSave = async () => {
    if (!form.titulo) { setErr('El título es obligatorio'); return }
    setSaving(true); setErr(null)
    try {
      let payload = { ...form }
      if (payload.activo_id) {
        const veh = vehiculos.find(v => String(v.id) === String(payload.activo_id))
        if (veh) payload.activo_patente = veh.dominio || veh.nombre
      } else {
        payload.activo_id = null
        payload.activo_patente = null
      }
      const saved = await upsertPoe(payload)
      setForm(saved)
      onSaved()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!await confirmar({ mensaje: `¿Eliminar "${form.titulo}"?`, peligro: true, confirmText: 'Eliminar' })) return
    try { await deletePoe(form.id); onDeleted() } catch(e) { setErr(e.message) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
      <div style={{ background:'var(--surface)', borderRadius:3, padding:'1.75rem', width:'100%', maxWidth:540, overflowY:'auto', maxHeight:'90vh' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1.5rem' }}>
          <h2 style={{ color:'var(--text)', fontWeight:700 }}>{isNew ? 'Nuevo Documento' : form.titulo}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
        </div>

        <fieldset disabled={!canWrite} style={{ border:'none', padding:0, margin:0 }}>
          <div style={ROW_S}><label style={LABEL_S}>Título *</label><input value={form.titulo} onChange={e=>set('titulo',e.target.value)} style={INPUT_S} placeholder="Ej: POE carga de combustible" required /></div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem' }}>
            <div style={ROW_S}>
              <label style={LABEL_S}>Tipo</label>
              <select value={form.tipo} onChange={e=>set('tipo',e.target.value)} style={INPUT_S}>
                {Object.entries(TIPO_LABEL).map(([k,l])=><option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div style={ROW_S}>
              <label style={LABEL_S}>Estado</label>
              <select value={form.estado} onChange={e=>set('estado',e.target.value)} style={INPUT_S}>
                <option value="vigente">Vigente</option>
                <option value="vencido">Vencido</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>

          <div style={ROW_S}>
            <label style={LABEL_S}>Vehículo (vacío = documento general de flota)</label>
            <select value={form.activo_id||''} onChange={e=>set('activo_id', e.target.value || null)} style={INPUT_S}>
              <option value="">General (toda la flota)</option>
              {vehiculos.map(v=><option key={v.id} value={v.id}>{v.dominio || v.nombre}</option>)}
            </select>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 1rem' }}>
            <div style={ROW_S}><label style={LABEL_S}>Vigente desde</label><input type="date" value={form.vigente_desde||''} onChange={e=>set('vigente_desde',e.target.value)} style={INPUT_S} /></div>
            <div style={ROW_S}><label style={LABEL_S}>Vencimiento</label><input type="date" value={form.vencimiento||''} onChange={e=>set('vencimiento',e.target.value)} style={INPUT_S} /></div>
          </div>

          <div style={ROW_S}><label style={LABEL_S}>Versión</label><input value={form.version||''} onChange={e=>set('version',e.target.value)} style={INPUT_S} placeholder="Ej: v2 / Rev. 03" /></div>
          <div style={ROW_S}><label style={LABEL_S}>Notas</label><textarea value={form.notas||''} onChange={e=>set('notas',e.target.value)} style={{...INPUT_S, minHeight:60, resize:'vertical'}} /></div>
        </fieldset>

        {err && <p style={{ color:'#FF2A2A', fontSize:'0.8rem', marginBottom:'1rem' }}>{err}</p>}

        {!isNew && (
          <AdjuntosPanel entityType="flota_documento" entityId={form.id} readOnly={!canWrite} />
        )}
        {isNew && (
          <p style={{ color:'var(--text-dim)', fontSize:'0.7rem', marginBottom:'1rem' }}>
            Guardá el documento para poder adjuntar el archivo (PDF, imagen, link).
          </p>
        )}

        {canWrite && (
          <div style={{ display:'flex', gap:'0.75rem', justifyContent:'space-between', marginTop:'1rem' }}>
            <div>{!isNew && <button onClick={handleDelete} style={{ padding:'0.65rem 1.1rem', borderRadius:2, background:'transparent', color:'#FF2A2A', border:'1px solid rgba(255,42,42,0.3)', cursor:'pointer', fontWeight:600 }}>Eliminar</button>}</div>
            <div style={{ display:'flex', gap:'0.75rem' }}>
              <button onClick={onClose} style={{ padding:'0.65rem 1.2rem', borderRadius:2, background:'#1a1a22', color:'var(--text-dim)', border:'none', cursor:'pointer', fontWeight:600 }}>Cerrar</button>
              <button onClick={handleSave} disabled={saving} style={{ padding:'0.65rem 1.4rem', borderRadius:2, background:saving?'rgba(57,255,20,0.4)':'var(--phosphor)', color:'#0A0A0E', border:'none', cursor:'pointer', fontWeight:700 }}>
                {saving ? 'Guardando...' : (isNew ? 'Crear' : 'Guardar')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function FlotaDocumentos({ focusId }) {
  const { rol, perfil } = useAuth()
  const canWrite = ['admin','editor','encargado','flota'].includes(rol) && !isQualityOnlyProfile(perfil)
  const [items, setItems]         = useState([])
  const [vehiculos, setVehiculos] = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(null)
  const [errLoad, setErrLoad]     = useState(null)
  const [filtroTipo, setFiltroTipo] = useState('todos')
  useEffect(() => {
    if (!focusId || loading) return
    const target = items.find(item => String(item.id) === String(focusId))
    if (target) setModal(target)
  }, [focusId, loading, items])

  useEffect(() => { getActivos({ tipo:'VEHICULO' }).then(setVehiculos).catch(()=>{}) }, [])

  const load = useCallback(() => {
    setLoading(true); setErrLoad(null)
    getPoes()
      .then(setItems)
      .catch(e => setErrLoad(e.message))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const hoy = new Date().toISOString().split('T')[0]
  const vencidos = items.filter(d => d.vencimiento && d.vencimiento < hoy).length
  const proximos = items.filter(d => {
    if (!d.vencimiento) return false
    const diff = (new Date(d.vencimiento) - new Date()) / 86400000
    return diff >= 0 && diff <= 30
  }).length

  const visibles = items.filter(d => filtroTipo === 'todos' || d.tipo === filtroTipo)
  const SEL_S = { background:'#1a1a2e', border:'1px solid rgba(57,255,20,0.15)', color:'#e2e8f0', borderRadius:2, padding:'0.35rem 0.75rem', fontSize:'0.72rem', fontFamily:'inherit', cursor:'pointer' }

  return (
    <div style={{ padding:'1.5rem 2rem', height:'100%', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <PageHeader title="Documentos · POEs">
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)} style={SEL_S}>
            <option value="todos">Todos los tipos</option>
            {Object.entries(TIPO_LABEL).map(([k,l])=><option key={k} value={k}>{l}</option>)}
          </select>
          {canWrite && (
            <button onClick={()=>setModal({})}
              style={{ background:'var(--phosphor)', color:'#0A0A0E', border:'none', borderRadius:3, padding:'0.55rem 1.1rem', fontWeight:700, cursor:'pointer' }}>
              + Nuevo
            </button>
          )}
        </div>
      </PageHeader>

      {errLoad && (
        <p style={{ color:'#F59E0B', fontSize:'0.78rem', marginBottom:'0.75rem' }}>
          No se pudo cargar documentos de flota ({errLoad}). Puede que falte ejecutar la migración SQL pendiente.
        </p>
      )}

      {/* KPIs */}
      <div style={{ display:'flex', gap:'0.6rem', marginBottom:'1rem' }}>
        {[
          { label:'Total', value:items.length, color:'var(--text)' },
          { label:'Vencidos', value:vencidos, color:'#FF2A2A' },
          { label:'Próx. vencer (30d)', value:proximos, color:'#F59E0B' },
          { label:'Vigentes', value:items.filter(d=>d.estado==='vigente').length, color:'#39FF14' },
        ].map(k=>(
          <div key={k.label} style={{ background:'var(--surface)', borderRadius:3, padding:'0.75rem 1rem', flex:1, minWidth:90 }}>
            <p style={{ color:'var(--text-dim)', fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{k.label}</p>
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
        ) : visibles.length === 0 ? (
          <p style={{ padding:'2rem', color:'var(--text-dim)', textAlign:'center' }}>Sin documentos{filtroTipo!=='todos' ? ' de este tipo' : ''}</p>
        ) : (
          <table className="table-dark" style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid rgba(57,255,20,0.05)' }}>
                {['Título','Tipo','Vehículo','Versión','Vencimiento','Estado'].map(h=>(
                  <th key={h} style={{ padding:'0.6rem 1rem', color:'var(--text-dim)', fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, textAlign:'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((d,i) => {
                const vencido  = d.vencimiento && d.vencimiento < hoy
                const proximoV = d.vencimiento && !vencido && (new Date(d.vencimiento)-new Date())/86400000 <= 30
                return (
                  <tr key={d.id} onClick={()=>setModal(d)}
                    style={{ borderBottom:i<visibles.length-1?'1px solid rgba(255,255,255,0.03)':'none', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'0.65rem 1rem', color:'var(--text)', fontWeight:600 }}>{d.titulo}</td>
                    <td style={{ padding:'0.65rem 1rem', color:'var(--text-dim)' }}>{TIPO_LABEL[d.tipo]||d.tipo}</td>
                    <td style={{ padding:'0.65rem 1rem', color:'var(--text-dim)' }}>{d.activo_patente || 'General'}</td>
                    <td style={{ padding:'0.65rem 1rem', color:'var(--text-dim)' }}>{d.version||'—'}</td>
                    <td style={{ padding:'0.65rem 1rem', color: vencido?'#FF2A2A' : proximoV?'#F59E0B' : 'var(--text-dim)', fontFamily:'monospace' }}>
                      {d.vencimiento || '—'}
                      {vencido  && <span style={{ fontSize:'0.65rem', marginLeft:5 }}>⚠</span>}
                      {proximoV && <span style={{ fontSize:'0.65rem', marginLeft:5 }}>⚡</span>}
                    </td>
                    <td style={{ padding:'0.65rem 1rem' }}>
                      <span style={{ fontSize:'0.65rem', fontWeight:700, padding:'0.2rem 0.5rem', borderRadius:4,
                        background:`${ESTADO_COLOR[d.estado]||'#555'}22`, color:ESTADO_COLOR[d.estado]||'#555' }}>
                        {d.estado}
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
        <DocumentoModal
          item={modal?.id ? modal : null}
          vehiculos={vehiculos}
          canWrite={canWrite}
          onClose={()=>{ setModal(null); load() }}
          onSaved={load}
          onDeleted={()=>{ setModal(null); load() }}
        />
      )}
    </div>
  )
}
