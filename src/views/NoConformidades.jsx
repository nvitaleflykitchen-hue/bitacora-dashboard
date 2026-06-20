import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { getNoConformidades, createNoConformidad, updateNoConformidad, getSedes, createCapa } from '../lib/queries'
import { fmtFechaLarga } from '../lib/dateUtils'
import { Plus, X, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { useAuth } from '../lib/auth'

const ESTADOS_NC = ['Abierta','En proceso','Cerrada','Verificada']
const CATEGORIAS_NC = ['Higiene','Producción','Servicio','Infraestructura','Proceso','Proveedor','Otro']

function estadoChip(estado) {
  if (estado === 'Abierta')    return <span className="chip chip-red">{estado}</span>
  if (estado === 'En proceso') return <span className="chip chip-yellow">{estado}</span>
  if (estado === 'Cerrada')    return <span className="chip chip-gray">{estado}</span>
  if (estado === 'Verificada') return <span className="chip chip-green">{estado}</span>
  return <span className="chip chip-gray">{estado}</span>
}

function NCForm({ onClose, onCreated, sedes, rol }) {
  const { user, perfil } = useAuth()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    sede_id: '', sede_nombre: '', descripcion: '', categoria: CATEGORIAS_NC[0],
    causa_raiz: '', responsable: '', estado: 'Abierta',
    fecha_apertura: format(new Date(), 'yyyy-MM-dd'),
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
      const nc = await createNoConformidad({
        ...form,
        sede_id: form.sede_id || null,
        created_by: perfil?.nombre || user?.email,
      })
      onCreated(nc)
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass hud-corner fade-in w-full max-w-lg rounded" style={{ borderRadius:'3px' }}>
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
          <h2 className="font-title font-bold" style={{ color:'var(--text)' }}>Nueva No Conformidad</h2>
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

function NCRow({ nc, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [editEstado, setEditEstado] = useState(false)
  const [nuevoEstado, setNuevoEstado] = useState(nc.estado)
  const [saving, setSaving]     = useState(false)
  const [generandoCAPA, setGCAPA] = useState(false)
  const [capaOk, setCapaOk]       = useState(false)

  const generarCAPA = async (e) => {
    e.stopPropagation()
    setGCAPA(true)
    try {
      await createCapa({
        no_conformidad_id: nc.id,
        tipo: 'Correctiva',
        descripcion: `[Auto] Acción correctiva para NC ${nc.codigo}: ${nc.descripcion?.slice(0,120) || ''}`,
        responsable: nc.responsable || '',
        sede_id: nc.sede_id || null,
        sede_nombre: nc.sede_nombre || '',
        estado: 'Pendiente',
        fecha_limite: new Date(Date.now() + 7*86400000).toISOString().split('T')[0],
      })
      setCapaOk(true)
      setTimeout(() => setCapaOk(false), 3000)
      onUpdate(nc.id, {})
    } catch(err) { alert('Error al crear CAPA: ' + err.message) }
    finally { setGCAPA(false) }
  }

  const saveEstado = async () => {
    setSaving(true)
    try { await onUpdate(nc.id, { estado: nuevoEstado, fecha_cierre: nuevoEstado === 'Cerrada' || nuevoEstado === 'Verificada' ? format(new Date(), 'yyyy-MM-dd') : null }); setEditEstado(false) }
    catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <tr className="cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <td>
          <div className="flex items-center gap-1.5">
            {expanded ? <ChevronDown size={11} style={{ color:'var(--phosphor)' }} /> : <ChevronRight size={11} style={{ color:'var(--text-dim)' }} />}
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
      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding:0 }}>
            <div className="px-6 py-4 space-y-4"
              style={{ background:'rgba(57,255,20,0.03)', borderTop:'1px solid rgba(57,255,20,0.06)' }}>
              {/* Detalle */}
              <div className="grid grid-cols-2 gap-4">
                {nc.causa_raiz && (
                  <div>
                    <p className="font-metric text-xs mb-1 tracking-wider" style={{ color:'var(--text-dim)' }}>CAUSA RAÍZ</p>
                    <p className="text-xs" style={{ color:'var(--text)' }}>{nc.causa_raiz}</p>
                  </div>
                )}
                <div>
                  <p className="font-metric text-xs mb-1 tracking-wider" style={{ color:'var(--text-dim)' }}>CREADO POR</p>
                  <p className="text-xs" style={{ color:'var(--text)' }}>{nc.created_by || '—'}</p>
                </div>
              </div>

              {/* Cambiar estado */}
              {editEstado ? (
                <div className="flex items-center gap-2">
                  <select className="input-dark" style={{ maxWidth:180 }} value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)}>
                    {ESTADOS_NC.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <button onClick={saveEstado} disabled={saving} className="btn-primary" style={{ padding:'0.3rem 0.6rem', fontSize:'0.65rem' }}>
                    {saving ? '...' : 'Guardar'}
                  </button>
                  <button onClick={() => setEditEstado(false)} className="btn-ghost" style={{ padding:'0.3rem 0.6rem', fontSize:'0.65rem' }}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={e => { e.stopPropagation(); setEditEstado(true) }} className="btn-ghost" style={{ padding:'0.3rem 0.75rem', fontSize:'0.65rem' }}>
                    Cambiar estado
                  </button>
                  {(!nc.capa || nc.capa.length === 0) && nc.estado !== 'Verificada' && (
                    <button
                      onClick={generarCAPA}
                      disabled={generandoCAPA}
                      className="btn-primary"
                      style={{ padding:'0.3rem 0.75rem', fontSize:'0.65rem' }}>
                      {capaOk ? '✓ CAPA creada' : generandoCAPA ? 'Generando...' : '+ Generar CAPA'}
                    </button>
                  )}
                </div>
              )}

              {/* CAPA asociadas */}
              {nc.capa?.length > 0 && (
                <div>
                  <p className="font-metric text-xs mb-2 tracking-wider" style={{ color:'var(--phosphor)', opacity:0.7 }}>
                    ACCIONES CAPA ({nc.capa.length})
                  </p>
                  <div className="space-y-1.5">
                    {nc.capa.map(c => (
                      <div key={c.id} className="rounded px-3 py-2 flex items-center gap-3"
                        style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                        <span className="font-metric text-xs" style={{ color:'var(--phosphor)', fontSize:'0.68rem' }}>{c.codigo}</span>
                        <span className={`chip ${c.tipo === 'Preventiva' ? 'chip-blue' : 'chip-yellow'}`} style={{ fontSize:'0.58rem' }}>{c.tipo}</span>
                        <span className="text-xs flex-1 truncate" style={{ color:'var(--text-dim)' }}>{c.descripcion}</span>
                        <span className="chip chip-gray" style={{ fontSize:'0.58rem' }}>{c.estado}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function NoConformidades() {
  const { rol, sedeIds, allowedSedeIds } = useAuth()
  const [items, setItems]     = useState([])
  const [sedes, setSedes]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
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
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filtroEstado, filtroSede, rol, sedeIds])

  useEffect(() => { load() }, [load])

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
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-title font-bold text-lg" style={{ color:'var(--text)' }}>No Conformidades</h1>
          <p className="font-metric text-xs mt-0.5" style={{ color:'var(--text-dim)' }}>ISO 9001 · Registro de no conformidades</p>
        </div>
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
      </div>

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
                  <NCRow key={nc.id} nc={nc} onUpdate={handleUpdate} />
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

      {showForm && (
        <NCForm sedes={sedes} rol={rol}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); load() }} />
      )}
    </div>
  )
}
