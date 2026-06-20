import { useState, useEffect, useCallback } from 'react'
import { getProveedores, upsertProveedor } from '../../lib/queries'

const ESTADO_COLOR = { activo: '#39FF14', inactivo: '#6B7280', bloqueado: '#FF2A2A' }
const STARS = (n) => '★'.repeat(n) + '☆'.repeat(5-n)

function ProveedorModal({ proveedor, onClose, onSaved }) {
  const isNew = !proveedor?.id
  const [form, setForm] = useState(proveedor || { estado: 'activo', rating: 0, nombre: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.nombre) { setErr('El nombre es obligatorio'); return }
    setSaving(true); setErr(null)
    try { await upsertProveedor(form); onSaved() }
    catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const INPUT = { width: '100%', padding: '0.7rem 0.9rem', borderRadius:2, background: 'var(--bg)', border: '1px solid rgba(57,255,20,0.08)', color: 'var(--text)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' }
  const LABEL = { color: 'var(--text-dim)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.35rem' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: 'var(--surface)', borderRadius:3, padding: '1.75rem', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700 }}>{isNew ? 'Nuevo Proveedor' : 'Editar Proveedor'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>
        <div style={{ marginBottom: '1rem' }}><label style={LABEL}>Nombre *</label><input value={form.nombre} onChange={e => set('nombre', e.target.value)} style={INPUT} placeholder="Ej: Frigorífico San Martín" required /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
          <div style={{ marginBottom: '1rem' }}><label style={LABEL}>Categoría</label><input value={form.categoria||''} onChange={e => set('categoria', e.target.value)} style={INPUT} placeholder="Frigorífico, Electricista..." /></div>
          <div style={{ marginBottom: '1rem' }}><label style={LABEL}>Estado</label>
            <select value={form.estado} onChange={e => set('estado', e.target.value)} style={INPUT}>
              <option value="activo">Activo</option><option value="inactivo">Inactivo</option><option value="bloqueado">Bloqueado</option>
            </select>
          </div>
          <div style={{ marginBottom: '1rem' }}><label style={LABEL}>Email</label><input value={form.email||''} onChange={e => set('email', e.target.value)} style={INPUT} placeholder="Ej: contacto@proveedor.com" /></div>
          <div style={{ marginBottom: '1rem' }}><label style={LABEL}>Teléfono</label><input value={form.telefono||''} onChange={e => set('telefono', e.target.value)} style={INPUT} placeholder="Ej: 351 555-1234" /></div>
        </div>
        <div style={{ marginBottom: '1rem' }}><label style={LABEL}>Dirección</label><input value={form.direccion||''} onChange={e => set('direccion', e.target.value)} style={INPUT} placeholder="Ej: Av. Colón 1234, Córdoba" /></div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={LABEL}>Rating</label>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => set('rating', n)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: n <= (form.rating||0) ? '#F59E0B' : 'rgba(255,255,255,0.2)' }}>★</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: '1.25rem' }}><label style={LABEL}>Notas</label><textarea value={form.notas||''} onChange={e => set('notas', e.target.value)} rows={2} style={{ ...INPUT, resize: 'vertical' }} placeholder="Ej: Entrega los martes y viernes" /></div>
        {err && <p style={{ color: 'var(--alert)', fontSize: '0.8rem', marginBottom: '1rem' }}>{err}</p>}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.65rem 1.2rem', borderRadius:2, background: 'rgba(57,255,20,0.05)', color: 'var(--text-dim)', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '0.65rem 1.4rem', borderRadius:2, background: saving ? 'rgba(57,255,20,0.4)' : 'var(--phosphor)', color: '#0A0A0E', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
            {saving ? 'Guardando...' : (isNew ? 'Crear' : 'Guardar')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MntProveedores() {
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getProveedores().then(setProveedores).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div style={{ padding: '1.5rem 2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className='font-title' style={{ color:'var(--text)', fontWeight:800, fontSize:'1.4rem' }}>Proveedores</h1>
        <button onClick={() => setModal({})} style={{ background: 'var(--phosphor)', color: '#0A0A0E', border: 'none', borderRadius:3, padding: '0.55rem 1.1rem', fontWeight: 700, cursor: 'pointer' }}>
          + Nuevo
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--surface)', borderRadius:3 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--phosphor)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : proveedores.length === 0 ? (
          <p style={{ padding: '2rem', color: 'var(--text-dim)', textAlign: 'center' }}>Sin proveedores</p>
        ) : proveedores.map((p, i) => (
          <div key={p.id} onClick={() => setModal(p)}
            style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px 80px', alignItems: 'center', gap: '1rem', padding: '0.85rem 1.1rem',
              borderBottom: i < proveedores.length-1 ? '1px solid rgba(255,255,255,0.03)' : 'none', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div>
              <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem' }}>{p.nombre}</p>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem' }}>{p.categoria || '—'} {p.telefono ? `· ${p.telefono}` : ''} {p.email ? `· ${p.email}` : ''}</p>
            </div>
            <p style={{ color: '#F59E0B', fontSize: '0.75rem' }}>{STARS(p.rating||0)}</p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>{p.categoria || '—'}</p>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: 4, background: `${ESTADO_COLOR[p.estado]}22`, color: ESTADO_COLOR[p.estado] }}>
              {p.estado}
            </span>
          </div>
        ))}
      </div>

      {modal !== null && (
        <ProveedorModal proveedor={modal?.id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />
      )}
    </div>
  )
}
