import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import {
  getActivos, upsertActivo, getSedes, getTicketsActivo,
  getInsumos, registrarMovimiento, getMatafuegos, upsertMatafuego,
} from '../lib/queries'
import { fmtFecha } from '../lib/dateUtils'
import { isQualityOnlyProfile } from '../lib/access'
import { Wrench, Package, Flame, Plus, X, ChevronRight, ChevronLeft, Search } from 'lucide-react'
import { toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'
import { TabPlanes, TabProveedores, TabResponsables, TabTablero } from './MobileMntTabs'

const TIPO_COLOR_ACTIVO = { EQUIPO: '#F59E0B', INSTALACION: '#8B5CF6' }
import {
  ACTIVO_ESTADO_COLOR as ESTADO_COLOR_ACTIVO, MATAFUEGO_ESTADO_COLOR as ESTADO_COLOR_MATAFUEGO,
} from '../lib/estados'

function Chip({ children, color }) {
  return <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: 4, background: `${color}22`, color }}>{children}</span>
}
function Card({ children, onClick, style }) {
  return (
    <div onClick={onClick} style={{ background: 'var(--surface)', borderRadius: 10, padding: '0.85rem', marginBottom: '0.6rem', cursor: onClick ? 'pointer' : 'default', ...style }}>
      {children}
    </div>
  )
}
function SheetModal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--surface)', width: '100%', borderRadius: '14px 14px 0 0', padding: '1.25rem', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>{label}</label>
      <input className="input-dark w-full" value={value.val} onChange={e => value.set(e.target.value)} placeholder={value.ph} type={value.type || 'text'} />
    </div>
  )
}

// ───────────────────────── ACTIVOS ─────────────────────────

function ActivoFicha({ activo, sedes, canEdit, onBack, onUpdated }) {
  const [historial, setHistorial] = useState([])
  const [loadingHist, setLoadingHist] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(activo)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    setLoadingHist(true)
    getTicketsActivo({ id: activo.id, nombre: activo.nombre })
      .then(t => setHistorial(t.slice(0, 20)))
      .catch(console.error)
      .finally(() => setLoadingHist(false))
  }, [activo.id, activo.nombre])

  const save = async () => {
    if (!form.nombre?.trim()) { toast.warn('El nombre es obligatorio.'); return }
    setSaving(true)
    try {
      let payload = { ...form }
      if (payload.sede_id) {
        const sede = sedes.find(s => s.id === Number(payload.sede_id))
        if (sede) payload.sede_nombre = sede.nombre
      }
      await upsertActivo(payload)
      setEditing(false)
      onUpdated()
    } catch (e) { toast.error('Error: ' + mensajeError(e)) } finally { setSaving(false) }
  }

  const sedeName = activo.sede_nombre || sedes.find(s => s.id === activo.sede_id)?.nombre

  return (
    <div className="mobile-scroll" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '0.75rem 1rem 0', flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--phosphor)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 10 }}>
          <ChevronLeft size={15} /> Activos
        </button>
        <h1 style={{ color: 'var(--text)', fontSize: '1.1rem', fontWeight: 700 }}>{activo.nombre}</h1>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <Chip color={TIPO_COLOR_ACTIVO[activo.tipo] || '#888'}>{activo.tipo}</Chip>
          <Chip color={ESTADO_COLOR_ACTIVO[activo.estado] || '#888'}>{activo.estado?.replace('_', ' ')}</Chip>
          {activo.codigo_interno && <Chip color="#6B7280">#{activo.codigo_interno}</Chip>}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem 1rem', minHeight: 0 }}>
        {!editing ? (
          <>
            <Card>
              {[['Marca / Modelo', [activo.marca, activo.modelo].filter(Boolean).join(' ')], ['Categoría', activo.categoria],
                ['Sede / Unidad', sedeName], ['Responsable', activo.responsable], ['Nro. Serie', activo.numero_serie]]
                .filter(([, v]) => v).map(([l, v]) => (
                  <div key={l} style={{ marginBottom: 8 }}>
                    <p style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>{l}</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{v}</p>
                  </div>
                ))}
              {activo.notas && (
                <div style={{ marginTop: 6 }}>
                  <p style={{ fontSize: '0.6rem', color: 'var(--phosphor)', textTransform: 'uppercase', marginBottom: 4 }}>Notas</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.5 }}>{activo.notas}</p>
                </div>
              )}
              {canEdit && (
                <button onClick={() => setEditing(true)} className="btn-primary" style={{ marginTop: 10, fontSize: '0.72rem', padding: '0.5rem 0.8rem' }}>Editar</button>
              )}
            </Card>

            <p style={{ fontSize: '0.65rem', color: 'var(--phosphor)', textTransform: 'uppercase', fontWeight: 700, margin: '0.75rem 0 0.5rem' }}>Historial de tickets</p>
            {loadingHist ? <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>Cargando...</p>
              : historial.length === 0 ? <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>Sin tickets registrados.</p>
              : historial.map(h => (
                <Card key={h.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>{h.created_at ? fmtFecha(h.created_at) : '—'}</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{h.estado}</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text)' }}>{h.descripcion}</p>
                  {h.costo_real ? <p style={{ fontSize: '0.65rem', color: 'var(--phosphor)', marginTop: 2 }}>${Number(h.costo_real).toLocaleString('es-AR')}</p> : null}
                </Card>
              ))}
          </>
        ) : (
          <Card>
            <Field label="Nombre *" value={{ val: form.nombre || '', set: v => set('nombre', v), ph: 'Ej: Horno convector 1' }} />
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Tipo</label>
              <select className="input-dark w-full" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                <option value="EQUIPO">Equipo</option>
                <option value="INSTALACION">Instalación</option>
              </select>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Estado</label>
              <select className="input-dark w-full" value={form.estado} onChange={e => set('estado', e.target.value)}>
                <option value="operativo">Operativo</option>
                <option value="en_reparacion">En reparación</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <Field label="Código interno" value={{ val: form.codigo_interno || '', set: v => set('codigo_interno', v), ph: 'Ej: EQ-014' }} />
            <Field label="Marca" value={{ val: form.marca || '', set: v => set('marca', v), ph: 'Ej: Rational' }} />
            <Field label="Modelo" value={{ val: form.modelo || '', set: v => set('modelo', v), ph: 'Ej: CPC 101' }} />
            <Field label="Categoría" value={{ val: form.categoria || '', set: v => set('categoria', v), ph: 'Ej: HORNO' }} />
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Sede / Unidad</label>
              <select className="input-dark w-full" value={form.sede_id || ''} onChange={e => set('sede_id', e.target.value ? Number(e.target.value) : null)}>
                <option value="">Sin asignar</option>
                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <Field label="Responsable" value={{ val: form.responsable || '', set: v => set('responsable', v), ph: 'Ej: Carlos Ruiz' }} />
            <Field label="Nro. Serie" value={{ val: form.numero_serie || '', set: v => set('numero_serie', v), ph: 'Ej: SN-88421' }} />
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Notas</label>
              <textarea className="input-dark w-full" rows={3} value={form.notas || ''} onChange={e => set('notas', e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setEditing(false); setForm(activo) }} style={{ flex: 1, padding: '0.65rem', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: 'var(--text-dim)', border: 'none', fontWeight: 600 }}>Cancelar</button>
              <button onClick={save} disabled={saving} className="btn-primary" style={{ flex: 1, padding: '0.65rem' }}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function QuickActivoModal({ sedes, onClose, onCreated }) {
  const [form, setForm] = useState({ tipo: 'EQUIPO', estado: 'operativo', nombre: '', sede_id: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Si el usuario solo tiene una sede asignada (ej: encargado), queda preseleccionada
  useEffect(() => { if (sedes?.length === 1) setForm(f => f.sede_id ? f : { ...f, sede_id: String(sedes[0].id) }) }, [sedes])

  const submit = async () => {
    if (!form.nombre.trim()) { toast.warn('El nombre es obligatorio.'); return }
    setSaving(true)
    try {
      let payload = { ...form, sede_id: form.sede_id ? Number(form.sede_id) : null }
      const sede = sedes.find(s => s.id === payload.sede_id)
      if (sede) payload.sede_nombre = sede.nombre
      await upsertActivo(payload)
      onCreated()
    } catch (e) { toast.error('Error: ' + mensajeError(e)) } finally { setSaving(false) }
  }

  return (
    <SheetModal title="Nuevo activo" onClose={onClose}>
      <Field label="Nombre *" value={{ val: form.nombre, set: v => set('nombre', v), ph: 'Ej: Horno convector 1' }} />
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Tipo</label>
        <select className="input-dark w-full" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
          <option value="EQUIPO">Equipo</option>
          <option value="INSTALACION">Instalación</option>
        </select>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Sede / Unidad</label>
        <select className="input-dark w-full" value={form.sede_id} onChange={e => set('sede_id', e.target.value)}>
          <option value="">Sin asignar</option>
          {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </div>
      <Field label="Categoría" value={{ val: form.categoria || '', set: v => set('categoria', v), ph: 'Ej: HORNO' }} />
      <button onClick={submit} disabled={saving} className="btn-primary w-full" style={{ padding: '0.75rem', marginTop: 6 }}>
        {saving ? 'Guardando...' : 'Crear activo'}
      </button>
    </SheetModal>
  )
}

function TabActivos({ allowedSedeIds, canEdit }) {
  const [items, setItems] = useState([])
  const [sedes, setSedes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [showNew, setShowNew] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      getActivos({ sedeIds: allowedSedeIds || undefined }),
      getSedes(allowedSedeIds),
    ]).then(([activos, sedesData]) => {
      setItems(activos.filter(a => a.tipo !== 'VEHICULO'))
      setSedes(sedesData)
    }).catch(console.error).finally(() => setLoading(false))
  }, [allowedSedeIds])

  useEffect(() => { load() }, [load])

  if (selected) {
    return <ActivoFicha activo={selected} sedes={sedes} canEdit={canEdit} onBack={() => setSelected(null)} onUpdated={() => { load(); setSelected(null) }} />
  }

  const filtered = items.filter(a => !search || (a.nombre + ' ' + (a.codigo_interno || '') + ' ' + (a.categoria || '')).toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
      <div style={{ padding: '0.75rem 1rem 0', flexShrink: 0, position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 26, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
        <input className="input-dark w-full" placeholder="Buscar activo..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 30 }} />
      </div>
      <div className="mobile-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem 5rem', minHeight: 0 }}>
        {loading ? <p style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: '2rem' }}>Cargando...</p>
          : filtered.length === 0 ? <p style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: '2rem', fontSize: '0.85rem' }}>Sin activos.</p>
          : filtered.map(a => (
            <Card key={a.id} onClick={() => setSelected(a)} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.85rem' }}>{a.nombre}</p>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem', marginTop: 2 }}>{a.codigo_interno || '—'} · {a.categoria || '—'} · {a.sede_nombre || '—'}</p>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <Chip color={TIPO_COLOR_ACTIVO[a.tipo] || '#888'}>{a.tipo}</Chip>
                  <Chip color={ESTADO_COLOR_ACTIVO[a.estado] || '#888'}>{a.estado?.replace('_', ' ')}</Chip>
                </div>
              </div>
              <ChevronRight size={15} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            </Card>
          ))}
      </div>
      {canEdit && (
        <button onClick={() => setShowNew(true)} style={{
          position: 'absolute', bottom: '1rem', right: '1.25rem', width: 48, height: 48, borderRadius: 24,
          background: 'var(--phosphor)', color: '#000', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(57,255,20,0.3)', zIndex: 10,
        }}><Plus size={22} /></button>
      )}
      {showNew && <QuickActivoModal sedes={sedes} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load() }} />}
    </div>
  )
}

// ───────────────────────── INSUMOS ─────────────────────────

function QuickMovimientoModal({ insumo, onClose, onSaved }) {
  const [tipo, setTipo] = useState('entrada')
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!cantidad || +cantidad <= 0) { toast.warn('Ingresá una cantidad válida.'); return }
    setSaving(true)
    try {
      await registrarMovimiento({ insumo_id: insumo.id, tipo, cantidad: +cantidad, motivo: motivo || null })
      onSaved()
    } catch (e) { toast.error('Error: ' + mensajeError(e)) } finally { setSaving(false) }
  }

  return (
    <SheetModal title={`Movimiento · ${insumo.nombre}`} onClose={onClose}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['entrada', 'salida', 'ajuste'].map(t => (
          <button key={t} onClick={() => setTipo(t)} style={{
            flex: 1, padding: '0.5rem', borderRadius: 8, fontSize: '0.72rem', fontWeight: 700, border: 'none',
            background: tipo === t ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.05)', color: tipo === t ? 'var(--phosphor)' : 'var(--text-dim)',
          }}>{t}</button>
        ))}
      </div>
      <Field label="Cantidad *" value={{ val: cantidad, set: setCantidad, ph: 'Ej: 10', type: 'number' }} />
      <Field label="Motivo" value={{ val: motivo, set: setMotivo, ph: 'Ej: Compra mensual' }} />
      <button onClick={submit} disabled={saving} className="btn-primary w-full" style={{ padding: '0.75rem', marginTop: 6 }}>
        {saving ? 'Guardando...' : 'Registrar movimiento'}
      </button>
    </SheetModal>
  )
}

function QuickInsumoModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ nombre: '', unidad: '', stock_minimo: 0, categoria: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.nombre.trim()) { toast.warn('El nombre es obligatorio.'); return }
    setSaving(true)
    const { error } = await supabase.schema('mantenimiento').from('insumos').insert(form)
    setSaving(false)
    if (error) { toast.error('Error: ' + mensajeError(error)); return }
    onCreated()
  }

  return (
    <SheetModal title="Nuevo insumo" onClose={onClose}>
      <Field label="Nombre *" value={{ val: form.nombre, set: v => set('nombre', v), ph: 'Ej: Detergente industrial' }} />
      <Field label="Unidad" value={{ val: form.unidad, set: v => set('unidad', v), ph: 'kg, litros, u...' }} />
      <Field label="Stock mínimo" value={{ val: form.stock_minimo, set: v => set('stock_minimo', +v || 0), ph: 'Ej: 5', type: 'number' }} />
      <Field label="Categoría" value={{ val: form.categoria, set: v => set('categoria', v), ph: 'Ej: Limpieza' }} />
      <button onClick={submit} disabled={saving} className="btn-primary w-full" style={{ padding: '0.75rem', marginTop: 6 }}>
        {saving ? 'Guardando...' : 'Crear insumo'}
      </button>
    </SheetModal>
  )
}

function TabInsumos() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [movModal, setMovModal] = useState(null)
  const [showNew, setShowNew] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getInsumos().then(setItems).catch(console.error).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
      <div className="mobile-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem 5rem', minHeight: 0 }}>
        {loading ? <p style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: '2rem' }}>Cargando...</p>
          : items.length === 0 ? <p style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: '2rem', fontSize: '0.85rem' }}>Sin insumos cargados.</p>
          : items.map(ins => {
            const pct = ins.stock_minimo > 0 ? ins.stock_actual / ins.stock_minimo : 999
            const bajo = pct < 1
            return (
              <Card key={ins.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div>
                    <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.85rem' }}>{ins.nombre}{bajo && <span style={{ color: '#FF2A2A', fontSize: '0.6rem', marginLeft: 6 }}>⚠ Stock bajo</span>}</p>
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.65rem', marginTop: 2 }}>{ins.categoria || '—'} · mín {ins.stock_minimo} {ins.unidad || ''}</p>
                  </div>
                  <button onClick={() => setMovModal(ins)} style={{ background: 'rgba(57,255,20,0.1)', color: 'var(--phosphor)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: 6, padding: '0.4rem 0.7rem', fontSize: '0.68rem', fontWeight: 700, flexShrink: 0 }}>Mov.</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: bajo ? '#FF2A2A' : 'var(--phosphor)', fontWeight: 700, fontSize: '0.85rem' }}>{ins.stock_actual}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.68rem' }}>{ins.unidad || 'u'}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(57,255,20,0.07)', borderRadius: 2 }}>
                  <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(100, pct * 100)}%`, background: bajo ? '#FF2A2A' : 'var(--phosphor)' }} />
                </div>
              </Card>
            )
          })}
      </div>
      <button onClick={() => setShowNew(true)} style={{
        position: 'absolute', bottom: '1rem', right: '1.25rem', width: 48, height: 48, borderRadius: 24,
        background: 'var(--phosphor)', color: '#000', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(57,255,20,0.3)', zIndex: 10,
      }}><Plus size={22} /></button>
      {movModal && <QuickMovimientoModal insumo={movModal} onClose={() => setMovModal(null)} onSaved={() => { setMovModal(null); load() }} />}
      {showNew && <QuickInsumoModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load() }} />}
    </div>
  )
}

// ───────────────────────── MATAFUEGOS ─────────────────────────

function QuickMatafuegoModal({ sedes, onClose, onCreated }) {
  const [form, setForm] = useState({ estado: 'operativo', codigo: '', tipo: 'ABC', sede_id: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Si el usuario solo tiene una sede asignada (ej: encargado), queda preseleccionada
  useEffect(() => { if (sedes?.length === 1) setForm(f => f.sede_id ? f : { ...f, sede_id: String(sedes[0].id) }) }, [sedes])

  const submit = async () => {
    if (!form.codigo.trim()) { toast.warn('El código es obligatorio.'); return }
    setSaving(true)
    try {
      let payload = { ...form, sede_id: form.sede_id ? Number(form.sede_id) : null }
      const sede = sedes.find(s => s.id === payload.sede_id)
      if (sede) payload.sede_nombre = sede.nombre
      await upsertMatafuego(payload)
      onCreated()
    } catch (e) { toast.error('Error: ' + mensajeError(e)) } finally { setSaving(false) }
  }

  return (
    <SheetModal title="Nuevo matafuego" onClose={onClose}>
      <Field label="Código *" value={{ val: form.codigo, set: v => set('codigo', v), ph: 'Ej: MAT-014' }} />
      <Field label="Tipo" value={{ val: form.tipo, set: v => set('tipo', v), ph: 'ABC, CO2...' }} />
      <Field label="Capacidad (kg)" value={{ val: form.capacidad_kg || '', set: v => set('capacidad_kg', +v || null), ph: 'Ej: 5', type: 'number' }} />
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Sede / Unidad</label>
        <select className="input-dark w-full" value={form.sede_id} onChange={e => set('sede_id', e.target.value)}>
          <option value="">Sin asignar</option>
          {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </div>
      <Field label="Ubicación" value={{ val: form.ubicacion || '', set: v => set('ubicacion', v), ph: 'Ej: Cocina, junto a la puerta' }} />
      <Field label="Vencimiento" value={{ val: form.vencimiento || '', set: v => set('vencimiento', v), type: 'date' }} />
      <button onClick={submit} disabled={saving} className="btn-primary w-full" style={{ padding: '0.75rem', marginTop: 6 }}>
        {saving ? 'Guardando...' : 'Crear matafuego'}
      </button>
    </SheetModal>
  )
}

function TabMatafuegos({ allowedSedeIds }) {
  const [items, setItems] = useState([])
  const [sedes, setSedes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      getMatafuegos({ sedeIds: allowedSedeIds || undefined }),
      getSedes(allowedSedeIds),
    ]).then(([m, s]) => { setItems(m); setSedes(s) }).catch(console.error).finally(() => setLoading(false))
  }, [allowedSedeIds])
  useEffect(() => { load() }, [load])

  const hoy = new Date().toISOString().split('T')[0]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
      <div className="mobile-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem 5rem', minHeight: 0 }}>
        {loading ? <p style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: '2rem' }}>Cargando...</p>
          : items.length === 0 ? <p style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: '2rem', fontSize: '0.85rem' }}>Sin matafuegos.</p>
          : items.map(m => {
            const vencido = m.vencimiento && m.vencimiento < hoy
            const proximo = m.vencimiento && !vencido && (new Date(m.vencimiento) - new Date()) / 86400000 <= 30
            return (
              <Card key={m.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.85rem' }}>{m.codigo} <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: '0.7rem' }}>{m.tipo}{m.capacidad_kg ? ` · ${m.capacidad_kg}kg` : ''}</span></p>
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem', marginTop: 2 }}>{m.sede_nombre || '—'}{m.ubicacion ? ` · ${m.ubicacion}` : ''}</p>
                  </div>
                  <Chip color={ESTADO_COLOR_MATAFUEGO[m.estado] || '#888'}>{m.estado}</Chip>
                </div>
                {m.vencimiento && (
                  <p style={{ fontSize: '0.68rem', marginTop: 6, color: vencido ? '#FF2A2A' : proximo ? '#F59E0B' : 'var(--text-dim)' }}>
                    Vence: {m.vencimiento}{vencido && ' ⚠'}{proximo && ' ⚡'}
                  </p>
                )}
              </Card>
            )
          })}
      </div>
      <button onClick={() => setShowNew(true)} style={{
        position: 'absolute', bottom: '1rem', right: '1.25rem', width: 48, height: 48, borderRadius: 24,
        background: 'var(--phosphor)', color: '#000', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(57,255,20,0.3)', zIndex: 10,
      }}><Plus size={22} /></button>
      {showNew && <QuickMatafuegoModal sedes={sedes} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load() }} />}
    </div>
  )
}

// ───────────────────────── ROOT ─────────────────────────

export default function MobileMantenimiento() {
  const { rol, allowedSedeIds, perfil } = useAuth()
  const canEditActivos = ['admin', 'editor', 'encargado', 'mnt_editor'].includes(rol) && !isQualityOnlyProfile(perfil)
  const [tab, setTab] = useState('activos')

  const allTabs = [
    { id: 'activos', label: 'Activos', icon: Wrench },
    { id: 'insumos', label: 'Insumos', icon: Package },
    { id: 'matafuegos', label: 'Matafuegos', icon: Flame },
    { id: 'tablero', label: 'Tablero', icon: Wrench },
    { id: 'planes', label: 'Planes', icon: Wrench },
    { id: 'proveedores', label: 'Proveedores', icon: Wrench },
    { id: 'responsables', label: 'Responsables', icon: Wrench },
  ]
  const TABS = rol === 'mnt_editor'
    ? allTabs.filter(item => ['activos', 'insumos', 'matafuegos', 'planes', 'proveedores'].includes(item.id))
    : allTabs

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '0.75rem 1rem 0', flexShrink: 0 }}>
        <h1 style={{ color: 'var(--text)', fontSize: '1.2rem', fontWeight: 700, marginBottom: 10 }}>Mantenimiento</h1>
        <div style={{ display: 'flex', gap: 6, background: 'var(--surface)', padding: '0.25rem', borderRadius: 20, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flexShrink: 0, padding: '0.4rem 0.75rem', borderRadius: 16, fontSize: '0.65rem', fontWeight: 700, border: 'none',
              background: tab === t.id ? 'rgba(57,255,20,0.15)' : 'transparent', color: tab === t.id ? 'var(--phosphor)' : 'var(--text-dim)',
              whiteSpace: 'nowrap',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === 'activos' && <TabActivos allowedSedeIds={allowedSedeIds} canEdit={canEditActivos} />}
        {tab === 'insumos' && <TabInsumos />}
        {tab === 'matafuegos' && <TabMatafuegos allowedSedeIds={allowedSedeIds} />}
        {tab === 'tablero' && <TabTablero allowedSedeIds={allowedSedeIds} canManage={canEditActivos} />}
        {tab === 'planes' && <TabPlanes />}
        {tab === 'proveedores' && <TabProveedores allowedSedeIds={allowedSedeIds} />}
        {tab === 'responsables' && <TabResponsables />}
      </div>
    </div>
  )
}
