import { useState, useEffect, useCallback } from 'react'
import { getCapa, createCapa, updateCapa, getNoConformidades, createNoConformidad, updateNoConformidad, getSedes } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { ClipboardList, AlertTriangle, ChevronDown, Calendar, Plus, X } from 'lucide-react'
import { fmtFecha } from '../lib/dateUtils'
import ComentariosHilo from '../components/ComentariosHilo'
import MobileContactosBtn from './MobileContactosBtn'

const ESTADOS_CAPA = ['Pendiente', 'En ejecución', 'Completada', 'Verificada']
const TIPOS_CAPA = ['Correctiva', 'Preventiva']
const ESTADOS_NC = ['Abierta', 'En proceso', 'Cerrada', 'Verificada']
const CATEGORIAS_NC = ['Higiene', 'Producción', 'Servicio', 'Infraestructura', 'Proceso', 'Proveedor', 'Otro']

const ESTADO_CAPA_COLOR = { 'Pendiente': '#6B7280', 'En ejecución': '#3B82F6', 'Completada': '#F59E0B', 'Verificada': '#39FF14' }
const ESTADO_NC_COLOR = { 'Abierta': '#FF2A2A', 'En proceso': '#F59E0B', 'Cerrada': '#6B7280', 'Verificada': '#39FF14' }

function Chip({ children, color }) {
  return (
    <span style={{
      fontSize: '0.6rem', padding: '0.2rem 0.5rem', borderRadius: 12, fontWeight: 700,
      background: `${color}22`, color, textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

function Card({ children }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '1rem', marginBottom: '0.75rem' }}>
      {children}
    </div>
  )
}

function CapaCard({ item, canManage, onUpdate, updating }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <div style={{ flex: 1, marginRight: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ color: 'var(--phosphor)', fontSize: '0.65rem', fontWeight: 800 }}>{item.codigo}</span>
            <span style={{ fontSize: '0.55rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{item.tipo}</span>
          </div>
          <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: expanded ? 10 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.descripcion}
          </p>
        </div>
        <Chip color={ESTADO_CAPA_COLOR[item.estado] || '#999'}>{item.estado}</Chip>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>{item.sedes?.nombre || 'Sin sede'}</span>
        {item.responsable && <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>{item.responsable}</span>}
        {item.fecha_limite && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-dim)', fontSize: '0.65rem' }}>
            <Calendar size={10} /> {fmtFecha(item.fecha_limite)}
          </span>
        )}
      </div>
      <button onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--phosphor)', fontSize: '0.7rem', background: 'none', border: 'none', padding: 0 }}>
        {expanded ? 'Menos info' : 'Ver detalle'} <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
      </button>
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
          <label style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Estado</label>
          <select
            value={item.estado}
            onChange={e => onUpdate(item.id, { estado: e.target.value })}
            disabled={!canManage || updating === item.id}
            className="input-dark w-full"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}>
            {ESTADOS_CAPA.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          {item.auditoria_codigo && (
            <p style={{ marginTop: 8, fontSize: '0.65rem', color: 'var(--text-dim)' }}>Auditoría: {item.auditoria_codigo}</p>
          )}
        </div>
      )}
    </Card>
  )
}

function NCCard({ item, canManage, onUpdate, updating }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <div style={{ flex: 1, marginRight: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ color: 'var(--phosphor)', fontSize: '0.65rem', fontWeight: 800 }}>{item.codigo}</span>
            <span style={{ fontSize: '0.55rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{item.categoria}</span>
          </div>
          <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: expanded ? 10 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.descripcion}
          </p>
        </div>
        <Chip color={ESTADO_NC_COLOR[item.estado] || '#999'}>{item.estado}</Chip>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>{item.sedes?.nombre || item.sede_nombre || 'Sin sede'}</span>
        {item.responsable && <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>{item.responsable}</span>}
        {item.fecha_apertura && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-dim)', fontSize: '0.65rem' }}>
            <Calendar size={10} /> {fmtFecha(item.fecha_apertura)}
          </span>
        )}
      </div>
      <button onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--phosphor)', fontSize: '0.7rem', background: 'none', border: 'none', padding: 0 }}>
        {expanded ? 'Menos info' : 'Ver detalle'} <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
      </button>
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
          {item.causa_raiz && <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: 8 }}>Causa raíz: {item.causa_raiz}</p>}
          <label style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Estado</label>
          <select
            value={item.estado}
            onChange={e => onUpdate(item.id, { estado: e.target.value })}
            disabled={!canManage || updating === item.id}
            className="input-dark w-full"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}>
            {ESTADOS_NC.map(e => <option key={e} value={e}>{e}</option>)}
          </select>

          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <ComentariosHilo entidadTipo="no_conformidad" entidadId={item.id} compact />
          </div>
        </div>
      )}
    </Card>
  )
}

function QuickCapaModal({ sedes, onClose, onCreated }) {
  const { user, perfil } = useAuth()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ tipo: 'Correctiva', sede_id: '', descripcion: '', responsable: '', fecha_limite: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Si el usuario solo tiene una sede asignada (ej: encargado), queda preseleccionada
  useEffect(() => { if (sedes?.length === 1) setForm(f => f.sede_id ? f : { ...f, sede_id: String(sedes[0].id) }) }, [sedes])

  const submit = async () => {
    if (!form.sede_id || !form.descripcion) { alert('Completá sede y descripción.'); return }
    setSaving(true)
    try {
      const created = await createCapa({
        ...form,
        fecha_limite: form.fecha_limite || null,
        created_by: perfil?.nombre || user?.email,
      })
      onCreated(created)
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', width: '100%', borderRadius: '14px 14px 0 0', padding: '1.25rem', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem' }}>Nueva Acción CAPA</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)' }}><X size={18} /></button>
        </div>
        <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Sede *</label>
        <select className="input-dark w-full mb-3" value={form.sede_id} onChange={e => set('sede_id', e.target.value)} style={{ marginBottom: 12 }}>
          <option value="">— Seleccionar —</option>
          {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Tipo *</label>
        <select className="input-dark w-full" value={form.tipo} onChange={e => set('tipo', e.target.value)} style={{ marginBottom: 12 }}>
          {TIPOS_CAPA.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Descripción *</label>
        <textarea className="input-dark w-full" rows={3} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Qué acción hay que tomar..." style={{ marginBottom: 12 }} />
        <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Responsable</label>
        <input className="input-dark w-full" value={form.responsable} onChange={e => set('responsable', e.target.value)} placeholder="Nombre del responsable" style={{ marginBottom: 12 }} />
        <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Fecha límite</label>
        <input type="date" className="input-dark w-full" value={form.fecha_limite} onChange={e => set('fecha_limite', e.target.value)} style={{ marginBottom: 16 }} />
        <button onClick={submit} disabled={saving} className="btn-primary w-full" style={{ padding: '0.75rem' }}>
          {saving ? 'Guardando...' : 'Crear acción CAPA'}
        </button>
      </div>
    </div>
  )
}

function QuickNCModal({ sedes, onClose, onCreated }) {
  const { user, perfil } = useAuth()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ sede_id: '', categoria: CATEGORIAS_NC[0], descripcion: '', responsable: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Si el usuario solo tiene una sede asignada (ej: encargado), queda preseleccionada
  useEffect(() => { if (sedes?.length === 1) setForm(f => f.sede_id ? f : { ...f, sede_id: String(sedes[0].id) }) }, [sedes])

  const submit = async () => {
    if (!form.sede_id || !form.descripcion) { alert('Completá sede y descripción.'); return }
    setSaving(true)
    try {
      const sede = sedes.find(s => String(s.id) === String(form.sede_id))
      const created = await createNoConformidad({
        ...form,
        sede_nombre: sede?.nombre || '',
        estado: 'Abierta',
        fecha_apertura: new Date().toISOString().slice(0, 10),
        created_by: perfil?.nombre || user?.email,
      })
      onCreated(created)
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', width: '100%', borderRadius: '14px 14px 0 0', padding: '1.25rem', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem' }}>Nueva No Conformidad</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)' }}><X size={18} /></button>
        </div>
        <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Sede *</label>
        <select className="input-dark w-full" value={form.sede_id} onChange={e => set('sede_id', e.target.value)} style={{ marginBottom: 12 }}>
          <option value="">— Seleccionar —</option>
          {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Categoría *</label>
        <select className="input-dark w-full" value={form.categoria} onChange={e => set('categoria', e.target.value)} style={{ marginBottom: 12 }}>
          {CATEGORIAS_NC.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Descripción *</label>
        <textarea className="input-dark w-full" rows={3} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Qué se detectó..." style={{ marginBottom: 12 }} />
        <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Responsable</label>
        <input className="input-dark w-full" value={form.responsable} onChange={e => set('responsable', e.target.value)} placeholder="Nombre del responsable" style={{ marginBottom: 16 }} />
        <button onClick={submit} disabled={saving} className="btn-primary w-full" style={{ padding: '0.75rem' }}>
          {saving ? 'Guardando...' : 'Crear no conformidad'}
        </button>
      </div>
    </div>
  )
}

export default function MobileCapa() {
  const { allowedSedeIds, can } = useAuth()
  const canManage = can('calidad', 'manage')
  const [tab, setTab] = useState('capa') // 'capa' | 'nc'
  const [capaItems, setCapaItems] = useState([])
  const [ncItems, setNcItems] = useState([])
  const [sedes, setSedes] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      getCapa({ sedeIds: allowedSedeIds || undefined }),
      getNoConformidades({ sedeIds: allowedSedeIds || undefined }),
      getSedes(allowedSedeIds),
    ])
      .then(([capa, nc, sedesData]) => {
        setCapaItems(capa)
        setNcItems(nc)
        setSedes(sedesData)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [allowedSedeIds])

  useEffect(() => { load() }, [load])

  // Deep-link desde notificación: si llega una NC, cambiar al tab NC
  useEffect(() => {
    const handler = (e) => {
      const { tipo } = e.detail || {}
      if (tipo === 'no_conformidad') setTab('nc')
      else if (tipo === 'capa') setTab('capa')
    }
    window.addEventListener('bitacora:deeplink', handler)
    return () => window.removeEventListener('bitacora:deeplink', handler)
  }, [])

  const handleUpdateCapa = async (id, payload) => {
    setUpdating(id)
    try {
      await updateCapa(id, payload)
      setCapaItems(prev => prev.map(i => i.id === id ? { ...i, ...payload } : i))
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setUpdating(null)
    }
  }

  const handleUpdateNc = async (id, payload) => {
    setUpdating(id)
    try {
      await updateNoConformidad(id, payload)
      setNcItems(prev => prev.map(i => i.id === id ? { ...i, ...payload } : i))
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setUpdating(null)
    }
  }

  const items = tab === 'capa' ? capaItems : ncItems
  const abiertosCount = tab === 'capa'
    ? capaItems.filter(i => !['Completada', 'Verificada'].includes(i.estado)).length
    : ncItems.filter(i => !['Cerrada', 'Verificada'].includes(i.estado)).length

  return (
    <div className="mobile-scroll" style={{ padding: '1.25rem 1rem 1rem', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ color: 'var(--text)', fontSize: '1.3rem', fontWeight: 700 }}>Calidad</h1>
        <MobileContactosBtn modulo="calidad" />
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--surface)', padding: '0.2rem', borderRadius: 20, marginBottom: '1rem', flexShrink: 0 }}>
        <button onClick={() => setTab('capa')} style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: 16, fontSize: '0.7rem', fontWeight: 700, border: 'none', background: tab === 'capa' ? 'rgba(57,255,20,0.15)' : 'transparent', color: tab === 'capa' ? 'var(--phosphor)' : 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <ClipboardList size={12} /> CAPA ({capaItems.length})
        </button>
        <button onClick={() => setTab('nc')} style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: 16, fontSize: '0.7rem', fontWeight: 700, border: 'none', background: tab === 'nc' ? 'rgba(57,255,20,0.15)' : 'transparent', color: tab === 'nc' ? 'var(--phosphor)' : 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <AlertTriangle size={12} /> No Conf. ({ncItems.length})
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--phosphor)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '2rem', textAlign: 'center', marginTop: '1rem' }}>
            {tab === 'capa' ? <ClipboardList size={32} style={{ color: 'var(--phosphor)', margin: '0 auto 0.5rem', opacity: 0.8 }} /> : <AlertTriangle size={32} style={{ color: 'var(--phosphor)', margin: '0 auto 0.5rem', opacity: 0.8 }} />}
            <p style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Sin registros</p>
          </div>
        ) : tab === 'capa' ? (
          capaItems.map(item => <CapaCard key={item.id} item={item} canManage={canManage} onUpdate={handleUpdateCapa} updating={updating} />)
        ) : (
          ncItems.map(item => <NCCard key={item.id} item={item} canManage={canManage} onUpdate={handleUpdateNc} updating={updating} />)
        )}
      </div>

      {canManage && (
        <button
          onClick={() => setShowModal(true)}
          style={{
            position: 'absolute', bottom: '1.5rem', right: '1.5rem',
            width: 50, height: 50, borderRadius: 25,
            background: 'var(--phosphor)', color: '#000',
            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(57,255,20,0.3)', zIndex: 10,
          }}>
          <Plus size={24} />
        </button>
      )}

      {showModal && tab === 'capa' && (
        <QuickCapaModal sedes={sedes} onClose={() => setShowModal(false)} onCreated={item => { setCapaItems(prev => [item, ...prev]); setShowModal(false) }} />
      )}
      {showModal && tab === 'nc' && (
        <QuickNCModal sedes={sedes} onClose={() => setShowModal(false)} onCreated={item => { setNcItems(prev => [item, ...prev]); setShowModal(false) }} />
      )}
    </div>
  )
}
