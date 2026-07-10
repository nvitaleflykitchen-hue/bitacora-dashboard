import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { getNoConformidades, createNoConformidad, updateNoConformidad, getSedes, createCapa } from '../lib/queries'
import { fmtFechaLarga } from '../lib/dateUtils'
import { Plus, X, ChevronRight, RefreshCw } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../lib/auth'
import NCFicha from './NCFicha'
import { toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'

const ESTADOS_NC = ['Abierta','En proceso','Cerrada','Verificada']
const CATEGORIAS_NC = ['Higiene','Producción','Servicio','Infraestructura','Proceso','Proveedor','Otro']

function estadoChip(estado) {
  if (estado === 'Abierta')    return <span className="chip chip-red">{estado}</span>
  if (estado === 'En proceso') return <span className="chip chip-yellow">{estado}</span>
  if (estado === 'Cerrada')    return <span className="chip chip-gray">{estado}</span>
  if (estado === 'Verificada') return <span className="chip chip-green">{estado}</span>
  return <span className="chip chip-gray">{estado}</span>
}

function NCForm({ onClose, onCreated, sedes, rol, ncOrigen }) {
  const { user, perfil } = useAuth()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    sede_id: ncOrigen?.sede_id || '', sede_nombre: ncOrigen?.sede_nombre || '',
    descripcion: '', categoria: CATEGORIAS_NC[0],
    causa_raiz: '', responsable: ncOrigen?.responsable || '', estado: 'Abierta',
    fecha_apertura: format(new Date(), 'yyyy-MM-dd'),
    // Datos de producto / proveedor (opcionales — para NC de recepción)
    producto: '', marca: '', lote: '', presentacion: '', proveedor: '',
    fecha_recepcion: '', vencimiento: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSedeChange = (id) => {
    const s = sedes.find(s => String(s.id) === String(id))
    set('sede_id', id)
    set('sede_nombre', s?.nombre || '')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const nn = (v) => (v === '' || v == null ? null : v)  // vacío → null (necesario para columnas date)
      const nc = await createNoConformidad({
        ...form,
        sede_id: form.sede_id || null,
        producto: nn(form.producto), marca: nn(form.marca), lote: nn(form.lote),
        presentacion: nn(form.presentacion), proveedor: nn(form.proveedor),
        fecha_recepcion: nn(form.fecha_recepcion), vencimiento: nn(form.vencimiento),
        created_by: perfil?.id || null,
        nc_origen_id: ncOrigen?.id || null,
      })
      onCreated(nc)
    } catch (err) {
      toast.error('Error: ' + mensajeError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass hud-corner fade-in w-full max-w-lg rounded" style={{ borderRadius:'3px' }}>
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
          <div>
            <h2 className="font-title font-bold" style={{ color:'var(--text)' }}>Nueva No Conformidad</h2>
            {ncOrigen && (
              <p className="font-metric text-xs mt-0.5" style={{ color:'#a78bfa' }}>
                ↳ Derivada de {ncOrigen.codigo}
              </p>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5" style={{ padding:'0.3rem' }}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Sede</label>
              <select className="input-dark" value={form.sede_id} onChange={e => handleSedeChange(e.target.value)}>
                <option value="">—</option>
                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Categoría</label>
              <select className="input-dark" value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                {CATEGORIAS_NC.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Descripción *</label>
            <textarea required className="input-dark" rows={3} value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)} placeholder="Ej: Se encontró producto vencido en cámara de frío 1"
              style={{ resize:'vertical' }} />
          </div>
          <div>
            <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Causa raíz</label>
            <textarea className="input-dark" rows={2} value={form.causa_raiz}
              onChange={e => set('causa_raiz', e.target.value)} placeholder="Ej: Falta de mantenimiento preventivo en el equipo"
              style={{ resize:'vertical' }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Responsable</label>
              <input className="input-dark" value={form.responsable} onChange={e => set('responsable', e.target.value)} placeholder="Ej: Ana López" />
            </div>
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Fecha apertura</label>
              <input type="date" className="input-dark" value={form.fecha_apertura} onChange={e => set('fecha_apertura', e.target.value)} />
            </div>
          </div>
          {/* Datos de producto / proveedor — opcionales (NC de recepción de mercadería) */}
          <details style={{ borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:'0.75rem' }}>
            <summary className="font-metric text-xs tracking-wider uppercase cursor-pointer" style={{ color:'var(--text-dim)' }}>
              Datos de producto / proveedor (opcional)
            </summary>
            <div className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Producto</label>
                  <input className="input-dark" value={form.producto} onChange={e => set('producto', e.target.value)} placeholder="Ej: Queso con Crema Clásico" />
                </div>
                <div>
                  <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Marca</label>
                  <input className="input-dark" value={form.marca} onChange={e => set('marca', e.target.value)} placeholder="Ej: La Tonadita" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Lote</label>
                  <input className="input-dark" value={form.lote} onChange={e => set('lote', e.target.value)} placeholder="Ej: 26171 17:08" />
                </div>
                <div>
                  <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Presentación</label>
                  <input className="input-dark" value={form.presentacion} onChange={e => set('presentacion', e.target.value)} placeholder="Ej: Bolsa x 3 kg" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Proveedor</label>
                  <input className="input-dark" value={form.proveedor} onChange={e => set('proveedor', e.target.value)} placeholder="Ej: ELCOR S.A." />
                </div>
                <div>
                  <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Recepción</label>
                  <input type="date" className="input-dark" value={form.fecha_recepcion} onChange={e => set('fecha_recepcion', e.target.value)} />
                </div>
                <div>
                  <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Vencimiento</label>
                  <input type="date" className="input-dark" value={form.vencimiento} onChange={e => set('vencimiento', e.target.value)} />
                </div>
              </div>
            </div>
          </details>

          <div className="flex justify-end gap-3 pt-2" style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : 'Crear NC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function NCRow({ nc, onSelect }) {
  return (
    <tr className="cursor-pointer hover:bg-white/5 transition-colors" onClick={() => onSelect(nc.id)}>
      <td>
        <div className="flex items-center gap-1.5">
          <ChevronRight size={11} style={{ color:'var(--text-dim)' }} />
          <span className="font-metric text-xs" style={{ color:'var(--phosphor)' }}>{nc.codigo}</span>
        </div>
      </td>
      <td>
        <p className="text-xs" style={{ color:'var(--text)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {nc.descripcion}
        </p>
      </td>
      <td><span className="chip chip-blue" style={{ fontSize:'0.6rem' }}>{nc.categoria}</span></td>
      <td style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>{nc.sede_nombre || '—'}</td>
      <td>{estadoChip(nc.estado)}</td>
      <td className="font-metric" style={{ color:'var(--text-dim)', fontSize:'0.7rem' }}>
        {nc.fecha_apertura ? fmtFechaLarga(nc.fecha_apertura) : '—'}
      </td>
      <td style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>{nc.responsable || '—'}</td>
    </tr>
  )
}

export default function NoConformidades() {
  const { rol, sedeIds, allowedSedeIds } = useAuth()
  const [items, setItems]     = useState([])
  const [sedes, setSedes]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedNcId, setSelectedNcId] = useState(null)
  const [derivarDesde, setDerivarDesde] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroSede, setFiltroSede]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, s] = await Promise.all([
        getNoConformidades({ estado: filtroEstado || undefined, sedeIds: allowedSedeIds || undefined, sedeId: filtroSede || undefined }),
        getSedes(allowedSedeIds),
      ])
      // Encargado: solo ve sus sedes
      const dataFilt = (rol === 'encargado' && sedeIds.length > 0)
        ? data.filter(nc => sedeIds.includes(nc.sede_id))
        : data
      const sedesFilt = (rol === 'encargado' && sedeIds.length > 0)
        ? s.filter(sede => sedeIds.includes(sede.id))
        : s
      setItems(dataFilt); setSedes(sedesFilt)

      // Deep-link desde notificación: abrir NC específica si hay pending
      const dl = window.__pendingDeepLink
      if (dl?.tipo === 'no_conformidad' && dl?.id) {
        const target = dataFilt.find(nc => String(nc.id) === String(dl.id))
        if (target) setSelectedNcId(target.id)
        delete window.__pendingDeepLink
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filtroEstado, filtroSede, rol, sedeIds, allowedSedeIds])

  useEffect(() => { load() }, [load])

  // Escucha deep-links en tiempo real (cuando el componente ya está montado y los datos cargados)
  useEffect(() => {
    const handleDeepLink = (e) => {
      const { tipo, id } = e.detail || {}
      if (tipo !== 'no_conformidad' || !id) return
      const target = items.find(nc => String(nc.id) === String(id))
      if (target) {
        setSelectedNcId(target.id)
        delete window.__pendingDeepLink
      }
    }
    window.addEventListener('bitacora:deeplink', handleDeepLink)
    return () => window.removeEventListener('bitacora:deeplink', handleDeepLink)
  }, [items])

  const canWrite = rol === 'admin' || rol === 'editor' || rol === 'encargado'

  const handleUpdate = async (id, payload) => {
    await updateNoConformidad(id, payload)
    load()
  }

  const abiertas   = items.filter(i => i.estado === 'Abierta').length
  const enProceso  = items.filter(i => i.estado === 'En proceso').length
  const cerradas   = items.filter(i => i.estado === 'Cerrada' || i.estado === 'Verificada').length

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 fade-in">
      <PageHeader title="No Conformidades" subtitle="ISO 9001 · Registro de no conformidades">
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost flex items-center gap-1.5" style={{ padding:'0.35rem 0.75rem' }}>
            <RefreshCw size={11} /> Actualizar
          </button>
          {canWrite && (
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5">
              <Plus size={12} /> Nueva NC
            </button>
          )}
        </div>
      </PageHeader>

      {/* KPIs */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="kpi-card" style={{ borderColor:'rgba(255,42,42,0.2)' }}>
            <p className="kpi-value" style={{ color:'var(--alert)' }}>{abiertas}</p>
            <p className="kpi-label">Abiertas</p>
          </div>
          <div className="kpi-card" style={{ borderColor:'rgba(245,158,11,0.2)' }}>
            <p className="kpi-value" style={{ color:'var(--warn)' }}>{enProceso}</p>
            <p className="kpi-label">En proceso</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-value">{cerradas}</p>
            <p className="kpi-label">Cerradas/Verificadas</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="glass rounded p-3 flex flex-wrap gap-3" style={{ borderRadius:'3px' }}>
        <div>
          <label className="font-metric text-xs tracking-wider uppercase mb-1 block" style={{ color:'var(--text-dim)' }}>Estado</label>
          <select className="input-dark" style={{ minWidth:140 }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS_NC.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label className="font-metric text-xs tracking-wider uppercase mb-1 block" style={{ color:'var(--text-dim)' }}>Sede</label>
          <select className="input-dark" style={{ minWidth:160 }} value={filtroSede} onChange={e => setFiltroSede(e.target.value)}>
            <option value="">Todas</option>
            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <button onClick={() => { setFiltroEstado(''); setFiltroSede('') }}
          className="btn-ghost self-end" style={{ padding:'0.35rem 0.75rem' }}>
          Limpiar
        </button>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 rounded-full border-2 animate-spin"
            style={{ borderColor:'var(--phosphor)', borderTopColor:'transparent' }} />
        </div>
      ) : (
        <div className="glass rounded overflow-hidden" style={{ borderRadius:'3px' }}>
          <div className="overflow-x-auto">
            <table className="table-dark w-full">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th>Sede</th>
                  <th>Estado</th>
                  <th>Apertura</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {items.map(nc => (
                  <NCRow key={nc.id} nc={nc} onSelect={setSelectedNcId} />
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10" style={{ color:'var(--text-dim)' }}>
                      Sin no conformidades registradas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(showForm || derivarDesde) && (
        <NCForm sedes={sedes} rol={rol}
          ncOrigen={derivarDesde || null}
          onClose={() => { setShowForm(false); setDerivarDesde(null) }}
          onCreated={() => { setShowForm(false); setDerivarDesde(null); load() }} />
      )}

      {selectedNcId && (() => {
        const nc = items.find(i => i.id === selectedNcId)
        const ncOrigen = nc?.nc_origen_id ? items.find(i => String(i.id) === String(nc.nc_origen_id)) : null
        const ncsDerivadas = items.filter(i => String(i.nc_origen_id) === String(nc?.id))
        return (
          <NCFicha
            nc={nc}
            ncOrigen={ncOrigen}
            ncsDerivadas={ncsDerivadas}
            onClose={() => setSelectedNcId(null)}
            onUpdate={handleUpdate}
            onDerivar={ncSrc => { setSelectedNcId(null); setDerivarDesde(ncSrc) }}
            onSelect={id => setSelectedNcId(id)}
          />
        )
      })()}
    </div>
  )
}
