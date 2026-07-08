import { supabase } from '../../lib/supabase'
import { useState, useEffect, useCallback } from 'react'
import { getInsumos, getSedes, registrarMovimiento } from '../../lib/queries'
import { useAuth } from '../../lib/auth'
import PageHeader from '../../components/PageHeader'

export default function MntInsumos({ focusId }) {
  const { allowedSedeIds } = useAuth()
  const [insumos, setInsumos] = useState([])
  const [sedes, setSedes] = useState([])
  const [sedeId, setSedeId] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalMov, setModalMov] = useState(null) // insumo para registrar movimiento
  const [nuevoModal, setNuevoModal] = useState(false)

  useEffect(() => { getSedes(allowedSedeIds).then(setSedes) }, [])

  // Si el usuario tiene una sola sede asignada (ej: encargado), queda preseleccionada
  useEffect(() => { if (allowedSedeIds?.length === 1) setSedeId(String(allowedSedeIds[0])) }, [allowedSedeIds])

  const load = useCallback(() => {
    setLoading(true)
    const filtros = { sedeIds: allowedSedeIds || undefined }
    if (sedeId) filtros.sede_id = Number(sedeId)
    getInsumos(filtros).then(setInsumos).finally(() => setLoading(false))
  }, [sedeId])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!focusId || loading) return
    document.getElementById(`insumo-${focusId}`)?.scrollIntoView({ behavior:'smooth', block:'center' })
  }, [focusId, loading, insumos])

  const nombreSede = (id) => sedes.find(s => s.id === id)?.nombre || '—'
  const bajoPorcentaje = (i) => i.stock_minimo > 0 ? (i.stock_actual / i.stock_minimo) : 999

  const SEL_S = { background:'#1a1a2e', border:'1px solid rgba(57,255,20,0.15)', color:'#e2e8f0', borderRadius:2, padding:'0.35rem 0.75rem', fontSize:'0.72rem', fontFamily:'inherit', cursor:'pointer' }

  return (
    <div style={{ padding: '1.5rem 2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Insumos">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={sedeId} onChange={e => setSedeId(e.target.value)} style={SEL_S}>
            <option value=''>Todas las sedes</option>
            {sedes.map(s => <option key={s.id} value={s.id} style={{ background:'#1a1a2e' }}>{s.nombre}</option>)}
          </select>
          <button onClick={() => setNuevoModal(true)} style={{ background: 'var(--phosphor)', color: '#0A0A0E', border: 'none', borderRadius:3, padding: '0.55rem 1.1rem', fontWeight: 700, cursor: 'pointer' }}>+ Insumo</button>
        </div>
      </PageHeader>

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--surface)', borderRadius:3 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--phosphor)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : insumos.length === 0 ? (
          <p style={{ padding: '2rem', color: 'var(--text-dim)', textAlign: 'center' }}>Sin insumos cargados{sedeId ? ' para esta sede' : ''}</p>
        ) : insumos.map((ins, i) => {
          const pct = bajoPorcentaje(ins)
          const bajo = pct < 1
          return (
            <div id={`insumo-${ins.id}`} key={ins.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 200px 60px', alignItems: 'center', gap: '1rem', padding: '0.85rem 1.1rem',
              border: String(ins.id) === String(focusId) ? '1px solid var(--phosphor)' : 'none',
              boxShadow: String(ins.id) === String(focusId) ? 'inset 0 0 0 2px rgba(57,255,20,0.1)' : 'none',
              borderBottom: String(ins.id) === String(focusId) ? '1px solid var(--phosphor)' : (i < insumos.length-1 ? '1px solid rgba(255,255,255,0.03)' : 'none') }}>
              <div>
                <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem' }}>{ins.nombre}
                  {bajo && <span style={{ color: '#FF2A2A', fontSize: '0.6rem', marginLeft: 6 }}>⚠ Stock bajo</span>}
                </p>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem' }}>{ins.categoria || '—'} · mín {ins.stock_minimo} {ins.unidad || ''}</p>
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>{nombreSede(ins.sede_id)}</div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: bajo ? '#FF2A2A' : 'var(--phosphor)', fontWeight: 700, fontSize: '0.9rem' }}>{ins.stock_actual}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>{ins.unidad || 'u'}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(57,255,20,0.07)', borderRadius: 2 }}>
                  <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(100, pct * 100)}%`, background: bajo ? '#FF2A2A' : 'var(--phosphor)' }} />
                </div>
              </div>
              <button onClick={() => setModalMov(ins)}
                style={{ background: 'rgba(57,255,20,0.1)', color: 'var(--phosphor)', border: '1px solid rgba(57,255,20,0.2)', borderRadius:2, padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                Mov.
              </button>
            </div>
          )
        })}
      </div>

      {modalMov && (
        <MovimientoModal insumo={modalMov} onClose={() => setModalMov(null)} onSaved={() => { setModalMov(null); load() }} />
      )}
      {nuevoModal && (
        <NuevoInsumoModal sedes={sedes} sedeIdDefault={sedeId} onClose={() => setNuevoModal(false)} onSaved={() => { setNuevoModal(false); load() }} />
      )}
    </div>
  )
}

function MovimientoModal({ insumo, onClose, onSaved }) {
  const [tipo, setTipo] = useState('entrada')
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const handleSave = async () => {
    if (!cantidad || +cantidad <= 0) { setErr('Ingresá una cantidad válida'); return }
    setSaving(true); setErr(null)
    try {
      await registrarMovimiento({ insumo_id: insumo.id, tipo, cantidad: +cantidad, motivo: motivo || null })
      onSaved()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const INPUT = { width: '100%', padding: '0.7rem 0.9rem', borderRadius:2, background: 'var(--bg)', border: '1px solid rgba(57,255,20,0.08)', color: 'var(--text)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' }
  const LABEL = { color: 'var(--text-dim)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.35rem' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: 'var(--surface)', borderRadius:3, padding: '1.75rem', width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700 }}>Movimiento · {insumo.nombre}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={LABEL}>Tipo</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['entrada','salida','ajuste'].map(t => (
              <button key={t} onClick={() => setTipo(t)}
                style={{ flex: 1, padding: '0.5rem', borderRadius:2, fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: tipo === t ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.03)',
                  color: tipo === t ? 'var(--phosphor)' : 'var(--text-dim)' }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: '1rem' }}><label style={LABEL}>Cantidad *</label><input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} style={INPUT} min="0" step="0.1" placeholder="Ej: 10" required /></div>
        <div style={{ marginBottom: '1.25rem' }}><label style={LABEL}>Motivo</label><input value={motivo} onChange={e => setMotivo(e.target.value)} style={INPUT} placeholder="Ej: Compra mensual" /></div>
        {err && <p style={{ color: 'var(--alert)', fontSize: '0.8rem', marginBottom: '1rem' }}>{err}</p>}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.65rem 1.2rem', borderRadius:2, background: 'rgba(57,255,20,0.05)', color: 'var(--text-dim)', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '0.65rem 1.4rem', borderRadius:2, background: saving ? 'rgba(57,255,20,0.4)' : 'var(--phosphor)', color: '#0A0A0E', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
            {saving ? 'Guardando...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NuevoInsumoModal({ sedes, sedeIdDefault, onClose, onSaved }) {
  const [form, setForm] = useState({ nombre: '', unidad: '', stock_minimo: 0, sede_id: sedeIdDefault ? Number(sedeIdDefault) : '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.nombre) { setErr('Nombre requerido'); return }
    if (!form.sede_id) { setErr('Sede requerida'); return }
    setSaving(true); setErr(null)
    try {
      const { error } = await supabase.schema('mantenimiento').from('insumos').insert({ ...form, sede_id: Number(form.sede_id) })
      if (error) throw error
      onSaved()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const INPUT = { width: '100%', padding: '0.7rem 0.9rem', borderRadius:2, background: 'var(--bg)', border: '1px solid rgba(57,255,20,0.08)', color: 'var(--text)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' }
  const LABEL = { color: 'var(--text-dim)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.35rem' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: 'var(--surface)', borderRadius:3, padding: '1.75rem', width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700 }}>Nuevo Insumo</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>
        <div style={{ marginBottom: '1rem' }}><label style={LABEL}>Nombre *</label><input value={form.nombre} onChange={e => set('nombre', e.target.value)} style={INPUT} placeholder="Ej: Detergente industrial" required /></div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={LABEL}>Sede *</label>
          <select value={form.sede_id} onChange={e => set('sede_id', e.target.value)} style={INPUT} required>
            <option value="">Seleccionar sede...</option>
            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
          <div style={{ marginBottom: '1rem' }}><label style={LABEL}>Unidad</label><input value={form.unidad} onChange={e => set('unidad', e.target.value)} style={INPUT} placeholder="kg, litros, u..." /></div>
          <div style={{ marginBottom: '1rem' }}><label style={LABEL}>Stock mínimo</label><input type="number" value={form.stock_minimo} onChange={e => set('stock_minimo', +e.target.value)} style={INPUT} placeholder="Ej: 5" /></div>
        </div>
        <div style={{ marginBottom: '1.25rem' }}><label style={LABEL}>Categoría</label><input value={form.categoria||''} onChange={e => set('categoria', e.target.value)} style={INPUT} placeholder="Ej: Limpieza" /></div>
        {err && <p style={{ color: 'var(--alert)', fontSize: '0.8rem', marginBottom: '1rem' }}>{err}</p>}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.65rem 1.2rem', borderRadius:2, background: 'rgba(57,255,20,0.05)', color: 'var(--text-dim)', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '0.65rem 1.4rem', borderRadius:2, background: saving ? 'rgba(57,255,20,0.4)' : 'var(--phosphor)', color: '#0A0A0E', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
            {saving ? 'Guardando...' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  )
}
