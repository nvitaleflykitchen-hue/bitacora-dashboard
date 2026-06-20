import { useState, useEffect, useCallback, useRef } from 'react'
import { isPast, isToday } from 'date-fns'
import { fmtFecha } from '../lib/dateUtils'
import { getTareas, getSedes, updateTarea } from '../lib/queries'
import KanbanBoard from '../components/KanbanBoard'
import TareaForm, { CATEGORIAS, getCategoriaLabel } from '../components/TareaForm'
import { Plus, RefreshCw, LayoutGrid, List } from 'lucide-react'
import { useAuth } from '../lib/auth'

const PRIORIDADES = ['Alta','Media','Baja']

function fechaChip(f) {
  if (!f) return <span style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>—</span>
  const d = new Date(f)
  if (isPast(d) && !isToday(d)) return <span className="chip chip-red">{fmtFecha(f)}</span>
  const diff = (d - new Date()) / 86400000
  if (diff < 7) return <span className="chip chip-yellow">{fmtFecha(f)}</span>
  return <span className="chip chip-gray">{fmtFecha(f)}</span>
}

export default function Tareas() {
  const { rol, sedeIds, allowedSedeIds, perfil, can } = useAuth()
  const canManage = can('tareas', 'manage')
  const [tareas, setTareas]   = useState([])
  const [sedes, setSedes]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [viewMode, setViewMode] = useState('kanban')

  const [filtroSede, setFiltroSede]           = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [mostrarResueltas, setMostrarResueltas] = useState(true)
  const [soloMias, setSoloMias] = useState(false)

  const hasLoadedRef = useRef(false)

  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true)
    try {
      // Encargado: si filtra por sede, usar esa; sino traer todas sus sedes
      const sedeFilter = rol === 'encargado'
        ? (filtroSede || undefined)  // el filtro visual usa sus sedes (ver select abajo)
        : (filtroSede || undefined)

      const [t, allSedes] = await Promise.all([
        getTareas({ sedeIds: allowedSedeIds || undefined,
          sedeId: sedeFilter,
          prioridad: filtroPrioridad || undefined,
          categoria: filtroCategoria || undefined,
          incluirResueltas: mostrarResueltas,
        }),
        getSedes(allowedSedeIds),
      ])
      // Encargado filtra tareas y sedes a las suyas
      const sedesFilt = (rol === 'encargado' && sedeIds.length > 0)
        ? allSedes.filter(s => sedeIds.includes(s.id))
        : allSedes
      const tareasFilt = (rol === 'encargado' && sedeIds.length > 0)
        ? t.filter(tarea => !tarea.sede_id || sedeIds.includes(tarea.sede_id))
        : t
      // Filtro "mis tareas": por nombre de responsable o creador
      const nombreUsuario = perfil?.nombre || ''
      const tareasFinal = soloMias && nombreUsuario
        ? tareasFilt.filter(t =>
            (t.responsable || '').toLowerCase().includes(nombreUsuario.toLowerCase()) ||
            (t.creado_por  || '').toLowerCase().includes(nombreUsuario.toLowerCase())
          )
        : tareasFilt
      setTareas(tareasFinal); setSedes(sedesFilt)
    } catch (e) { console.error(e) }
    finally { setLoading(false); hasLoadedRef.current = true }
  }, [filtroSede, filtroPrioridad, filtroCategoria, mostrarResueltas, soloMias, rol, sedeIds, perfil])

  useEffect(() => { load() }, [load])

  const pendientes = tareas.filter(t => t.estado === 'Pendiente').length
  const enProceso  = tareas.filter(t => t.estado === 'En proceso').length
  const resueltas  = tareas.filter(t => t.estado === 'Resuelto').length

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-title font-bold text-lg" style={{ color:'var(--text)' }}>Tareas</h1>
          <p className="font-metric text-xs mt-0.5" style={{ color:'var(--text-dim)' }}>
            {tareas.length} tarea{tareas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle Todas / Mis tareas */}
          <div className="flex rounded overflow-hidden" style={{ border:'1px solid rgba(57,255,20,0.15)' }}>
            {[
              { id: false, label: 'Todas' },
              { id: true,  label: 'Mis tareas' },
            ].map(({ id, label }) => (
              <button key={String(id)} onClick={() => setSoloMias(id)}
                className="font-metric px-3 py-1.5 transition-all"
                style={{
                  background: soloMias === id ? 'rgba(57,255,20,0.15)' : 'transparent',
                  color: soloMias === id ? 'var(--phosphor)' : 'var(--text-dim)',
                  borderRight: !id ? '1px solid rgba(57,255,20,0.08)' : undefined,
                  fontSize:'0.68rem',
                }}>
                {label}
              </button>
            ))}
          </div>
          {/* Toggle kanban/tabla */}
          <div className="flex rounded overflow-hidden" style={{ border:'1px solid rgba(57,255,20,0.15)' }}>
            {[
              { id:'kanban', label:'Kanban', icon: LayoutGrid },
              { id:'tabla',  label:'Tabla',  icon: List },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setViewMode(id)}
                className="flex items-center gap-1.5 font-metric px-3 py-1.5 transition-all"
                style={{
                  background: viewMode === id ? 'rgba(57,255,20,0.15)' : 'transparent',
                  color: viewMode === id ? 'var(--phosphor)' : 'var(--text-dim)',
                  borderRight: id === 'kanban' ? '1px solid rgba(57,255,20,0.08)' : undefined,
                  fontSize:'0.68rem',
                }}>
                <Icon size={11} />{label}
              </button>
            ))}
          </div>
          <button onClick={load} className="btn-ghost" style={{ padding:'0.35rem 0.5rem' }}>
            <RefreshCw size={12} />
          </button>
          {canManage && <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5">
            <Plus size={12} /> Nueva tarea
          </button>}
        </div>
      </div>

      {/* KPIs */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="kpi-card"><p className="kpi-value" style={{ color:'var(--text-dim)' }}>{pendientes}</p><p className="kpi-label">Pendientes</p></div>
          <div className="kpi-card"><p className="kpi-value" style={{ color:'#60A5FA' }}>{enProceso}</p><p className="kpi-label">En proceso</p></div>
          <div className="kpi-card"><p className="kpi-value">{resueltas}</p><p className="kpi-label">Resueltas</p></div>
        </div>
      )}

      {/* Filtros */}
      <div className="glass rounded p-3 flex flex-wrap gap-3 items-end" style={{ borderRadius:'3px' }}>
        <div>
          <label className="font-metric text-xs tracking-wider uppercase mb-1 block" style={{ color:'var(--text-dim)' }}>Sede</label>
          <select className="input-dark" style={{ minWidth:140 }} value={filtroSede} onChange={e => setFiltroSede(e.target.value)}>
            <option value="">Todas</option>
            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="font-metric text-xs tracking-wider uppercase mb-1 block" style={{ color:'var(--text-dim)' }}>Prioridad</label>
          <select className="input-dark" style={{ minWidth:120 }} value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)}>
            <option value="">Todas</option>
            {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="font-metric text-xs tracking-wider uppercase mb-1 block" style={{ color:'var(--text-dim)' }}>Categoría</label>
          <select className="input-dark" style={{ minWidth:120 }} value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
            <option value="">Todas</option>
            {CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.key} — {c.label}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={mostrarResueltas} onChange={e => setMostrarResueltas(e.target.checked)}
            style={{ accentColor:'var(--phosphor)' }} />
          <span className="font-metric text-xs" style={{ color:'var(--text-dim)', fontSize:'0.68rem' }}>
            Incluir resueltas
          </span>
        </label>
        <button onClick={() => { setFiltroSede(''); setFiltroPrioridad(''); setFiltroCategoria(''); setMostrarResueltas(false); setSoloMias(false) }}
          className="btn-ghost" style={{ padding:'0.35rem 0.75rem' }}>
          Limpiar
        </button>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 rounded-full border-2 animate-spin"
            style={{ borderColor:'var(--phosphor)', borderTopColor:'transparent' }} />
        </div>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard tareas={tareas} onRefresh={load} readOnly={!canManage} />
      ) : (
        <div className="glass rounded overflow-hidden" style={{ borderRadius:'3px' }}>
          <div className="overflow-x-auto">
            <table className="table-dark w-full">
              <thead>
                <tr>
                  <th>Título</th>
                  <th className="hidden sm:table-cell">Sede</th>
                  <th className="hidden md:table-cell">Responsable</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th className="hidden lg:table-cell">Vence</th>
                </tr>
              </thead>
              <tbody>
                {tareas.map(t => (
                  <tr key={t.id}>
                    <td>
                      <p style={{ color:'var(--text)', fontWeight:500, fontSize:'0.8rem' }}>{t.titulo}</p>
                      {t.categoria && (
                        <span className="chip chip-blue" style={{ fontSize:'0.58rem', marginTop:2 }}>{getCategoriaLabel(t.categoria)}</span>
                      )}
                    </td>
                    <td className="hidden sm:table-cell" style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>
                      {t.sedes?.nombre || '—'}
                    </td>
                    <td className="hidden md:table-cell" style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>
                      {t.responsable || '—'}
                    </td>
                    <td>
                      <span className={`chip ${t.prioridad === 'Alta' ? 'chip-red' : t.prioridad === 'Media' ? 'chip-yellow' : 'chip-gray'}`}>
                        {t.prioridad}
                      </span>
                    </td>
                    <td>
                      <span className={`chip ${t.estado === 'Resuelto' ? 'chip-green' : t.estado === 'En proceso' ? 'chip-blue' : t.estado === 'Cancelado' ? 'chip-gray' : 'chip-yellow'}`}>
                        {t.estado}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell">{fechaChip(t.fecha_limite)}</td>
                  </tr>
                ))}
                {tareas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10" style={{ color:'var(--text-dim)' }}>Sin tareas</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <TareaForm onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); load() }} />
      )}
    </div>
  )
}
