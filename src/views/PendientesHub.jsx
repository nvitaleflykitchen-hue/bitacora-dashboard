import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, RefreshCw, Search } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { getWorkQueue } from '../lib/workQueue'
import WorkspaceTabs from '../components/WorkspaceTabs'
import Tareas from './Tareas'
import Escalamientos from './Escalamientos'
import Calendario from './Calendario'
import { isQualityOnlyProfile } from '../lib/access'

const TABS = [
  { id:'bandeja', label:'Bandeja' },
  { id:'tareas', label:'Tareas' },
  { id:'escalamientos', label:'Escalamientos' },
  { id:'calendario', label:'Calendario' },
]

const VIEW_MODES = [
  { id:'prioridad', label:'Prioridad' },
  { id:'sin_responsable', label:'Sin responsable' },
  { id:'mios', label:'Mis pendientes' },
  { id:'por_area', label:'Por área' },
]

const FILTER_ALL = 'todos'

const normalize = value => String(value || '').trim().toLowerCase()
const isHighPriority = value => ['alta', 'critica', 'crítica', 'urgente'].includes(normalize(value))
const isUnassigned = item => !String(item.owner || '').trim()

const parseDate = value => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const startOfToday = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

const daysFromToday = value => {
  const date = parseDate(value)
  if (!date) return null
  const today = startOfToday()
  date.setHours(0, 0, 0, 0)
  return Math.floor((date.getTime() - today.getTime()) / 86_400_000)
}

const isOverdue = item => {
  const delta = daysFromToday(item.date)
  return delta !== null && delta < 0
}

const isDueSoon = item => {
  const delta = daysFromToday(item.date)
  return delta !== null && delta >= 0 && delta <= 7
}

const isMine = (item, perfil) => {
  const owner = normalize(item.owner)
  return owner && owner === normalize(perfil?.nombre)
}

const priorityRank = item => {
  if (isOverdue(item)) return 0
  if (isHighPriority(item.priority)) return 1
  if (isDueSoon(item)) return 2
  return 3
}

const formatDate = value => {
  const date = parseDate(value)
  if (!date) return 'Sin fecha'
  return date.toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'2-digit' })
}

const deadlineLabel = item => {
  const delta = daysFromToday(item.date)
  if (delta === null) return 'Sin fecha'
  if (delta < 0) return `Vencido ${Math.abs(delta)}d`
  if (delta === 0) return 'Hoy'
  if (delta === 1) return 'Mañana'
  if (delta <= 7) return `${delta} días`
  return formatDate(item.date)
}

const actionLabel = item => {
  if (isUnassigned(item)) return 'Asignar'
  if (item.module === 'Compra') return 'Revisar compra'
  if (item.module === 'Mantenimiento') return 'Ver ticket'
  if (item.module === 'Escalamiento') return 'Gestionar'
  return 'Resolver'
}

const chipClassForPriority = item => {
  if (isOverdue(item) || isHighPriority(item.priority)) return 'chip-red'
  if (isDueSoon(item)) return 'chip-yellow'
  return 'chip-gray'
}

const uniqueSorted = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))

function MetricCard({ label, value, tone = 'green', onClick }) {
  const color = tone === 'red' ? 'var(--alert)' : tone === 'yellow' ? 'var(--warn)' : 'var(--phosphor)'
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass text-left p-3 rounded hover:border-green-500/30"
      style={{ borderColor:tone === 'red' ? 'rgba(255,42,42,0.28)' : tone === 'yellow' ? 'rgba(245,158,11,0.28)' : undefined }}
    >
      <div className="kpi-value" style={{ fontSize:'1.35rem', color }}>{value}</div>
      <div className="kpi-label">{label}</div>
    </button>
  )
}

function Bandeja({ onNavigate }) {
  const { allowedSedeIds, perfil, rol } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('prioridad')
  const [moduleFilter, setModuleFilter] = useState(FILTER_ALL)
  const [priorityFilter, setPriorityFilter] = useState(FILTER_ALL)
  const [query, setQuery] = useState('')

  const load = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      setItems(await getWorkQueue({ sedeIds:allowedSedeIds, perfil, rol, force }))
    } catch (err) {
      console.error(err)
      setError('No se pudo cargar la bandeja. Reintentá en unos segundos.')
    } finally {
      setLoading(false)
    }
  }, [allowedSedeIds, perfil, rol])

  useEffect(() => { load() }, [load])

  const moduleOptions = useMemo(() => uniqueSorted(items.map(item => item.module)), [items])
  const priorityOptions = useMemo(() => uniqueSorted(items.map(item => item.priority)), [items])

  const metrics = useMemo(() => ({
    total: items.length,
    critical: items.filter(item => isOverdue(item) || isHighPriority(item.priority)).length,
    unassigned: items.filter(isUnassigned).length,
    dueSoon: items.filter(isDueSoon).length,
    mine: items.filter(item => isMine(item, perfil)).length,
  }), [items, perfil])

  const filteredItems = useMemo(() => {
    const term = normalize(query)
    return items
      .filter(item => moduleFilter === FILTER_ALL || item.module === moduleFilter)
      .filter(item => priorityFilter === FILTER_ALL || item.priority === priorityFilter)
      .filter(item => {
        if (!term) return true
        return [item.title, item.site, item.owner, item.module, item.status, item.priority]
          .some(value => normalize(value).includes(term))
      })
      .filter(item => {
        if (viewMode === 'sin_responsable') return isUnassigned(item)
        if (viewMode === 'mios') return isMine(item, perfil)
        return true
      })
      .sort((a, b) => {
        if (viewMode === 'por_area') {
          const byModule = String(a.module || '').localeCompare(String(b.module || ''), 'es')
          if (byModule !== 0) return byModule
        }
        return priorityRank(a) - priorityRank(b) || new Date(a.date || 0) - new Date(b.date || 0)
      })
  }, [items, moduleFilter, priorityFilter, query, viewMode, perfil])

  const shownItems = filteredItems.slice(0, 100)

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-title font-bold" style={{ color:'var(--text)' }}>Centro de pendientes</h2>
          <p className="text-xs mt-1" style={{ color:'var(--text-dim)' }}>
            Priorizá vencidos, sin responsable y pendientes propios antes de revisar el resto.
          </p>
        </div>
        <button type="button" onClick={() => load(true)} className="btn-ghost" disabled={loading} aria-label="Actualizar bandeja">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <div className="rounded p-3 mb-3" role="alert" style={{ color:'var(--alert)', border:'1px solid rgba(255,42,42,0.25)' }}>{error}</div>}

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-2 mb-4">
        <MetricCard label="Total" value={metrics.total} onClick={() => setViewMode('prioridad')} />
        <MetricCard label="Vencidos / alta" value={metrics.critical} tone={metrics.critical ? 'red' : 'green'} onClick={() => setViewMode('prioridad')} />
        <MetricCard label="Sin responsable" value={metrics.unassigned} tone={metrics.unassigned ? 'yellow' : 'green'} onClick={() => setViewMode('sin_responsable')} />
        <MetricCard label="Próx. 7 días" value={metrics.dueSoon} onClick={() => setViewMode('prioridad')} />
        <MetricCard label="Míos" value={metrics.mine} onClick={() => setViewMode('mios')} />
      </div>

      <div className="glass rounded p-3 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {VIEW_MODES.map(mode => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setViewMode(mode.id)}
              className={viewMode === mode.id ? 'btn-primary' : 'btn-ghost'}
              style={{ fontSize:'0.62rem', padding:'0.35rem 0.65rem' }}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] gap-2">
          <label className="relative block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-dim)' }} />
            <input
              className="input-dark"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar por asunto, sede, responsable o estado..."
              style={{ paddingLeft:'2.2rem' }}
            />
          </label>
          <select className="input-dark" value={moduleFilter} onChange={event => setModuleFilter(event.target.value)}>
            <option value={FILTER_ALL}>Todas las áreas</option>
            {moduleOptions.map(module => <option key={module} value={module}>{module}</option>)}
          </select>
          <select className="input-dark" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)}>
            <option value={FILTER_ALL}>Todas las prioridades</option>
            {priorityOptions.map(priority => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </div>
      </div>

      {!loading && items.length === 0 && <p className="text-sm py-10 text-center" style={{ color:'var(--text-dim)' }}>No hay pendientes para tu alcance.</p>}

      {!loading && items.length > 0 && filteredItems.length === 0 && (
        <div className="glass rounded p-6 text-center" style={{ color:'var(--text-dim)' }}>
          No hay resultados con esos filtros.
        </div>
      )}

      {shownItems.length > 0 && (
        <div className="glass rounded overflow-hidden">
          <div className="hidden lg:grid grid-cols-[94px_150px_minmax(260px,1fr)_190px_170px_125px_132px] gap-0 px-4 py-2" style={{ borderBottom:'1px solid rgba(57,255,20,0.12)' }}>
            {['Prioridad', 'Área', 'Asunto', 'Sede', 'Responsable', 'Fecha', 'Acción'].map((label, index) => (
              <div key={label} className={`font-metric text-xs ${index === 6 ? 'text-right' : ''}`} style={{ color:'var(--phosphor)' }}>{label}</div>
            ))}
          </div>

          <div className="divide-y" style={{ borderColor:'rgba(255,255,255,0.05)' }}>
            {shownItems.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.target)}
                className="w-full text-left px-4 py-3 hover:bg-green-500/5 transition-colors"
              >
                <div className="grid grid-cols-1 lg:grid-cols-[94px_150px_minmax(260px,1fr)_190px_170px_125px_132px] gap-2 lg:gap-0 lg:items-center">
                  <div>
                    <span className={`chip ${chipClassForPriority(item)}`}>{item.priority || 'Media'}</span>
                  </div>
                  <div className="font-metric text-xs" style={{ color:'var(--phosphor)' }}>{item.module}</div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate" style={{ color:'var(--text)' }}>{item.title || 'Sin descripción'}</div>
                    <div className="flex flex-wrap gap-2 mt-1 lg:hidden text-xs" style={{ color:'var(--text-dim)' }}>
                      <span>{item.site || 'Gestión'}</span>
                      <span>{item.owner || 'Sin responsable'}</span>
                      <span>{item.status || 'Pendiente'}</span>
                    </div>
                  </div>
                  <div className="hidden lg:block text-xs truncate pr-3" style={{ color:'var(--text-dim)' }}>{item.site || 'Gestión'}</div>
                  <div className="hidden lg:block text-xs truncate pr-3" style={{ color:isUnassigned(item) ? 'var(--warn)' : 'var(--text-dim)' }}>{item.owner || 'Sin responsable'}</div>
                  <div className="hidden lg:flex items-center gap-1 text-xs" style={{ color:isOverdue(item) ? 'var(--alert)' : 'var(--text-dim)' }}>
                    {isOverdue(item) && <AlertTriangle size={12} />}
                    {deadlineLabel(item)}
                  </div>
                  <div className="hidden lg:flex justify-end">
                    <span className="btn-ghost" style={{ fontSize:'0.6rem', padding:'0.25rem 0.45rem' }}>{actionLabel(item)}</span>
                  </div>
                </div>
                <div className="mt-2 flex lg:hidden items-center justify-between gap-2">
                  <span className="text-xs" style={{ color:isOverdue(item) ? 'var(--alert)' : 'var(--text-dim)' }}>{deadlineLabel(item)}</span>
                  <span className="btn-ghost" style={{ fontSize:'0.6rem', padding:'0.25rem 0.45rem' }}>{actionLabel(item)}</span>
                </div>
              </button>
            ))}
          </div>

          {filteredItems.length > shownItems.length && (
            <div className="px-4 py-3 text-xs text-center" style={{ color:'var(--text-dim)', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              Mostrando {shownItems.length} de {filteredItems.length}. Usá filtros para acotar la bandeja.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PendientesHub({ onNavigate }) {
  const { perfil } = useAuth()
  const isQualityOnly = isQualityOnlyProfile(perfil)
  const [activeTab, setActiveTab] = useState('bandeja')
  const tabs = isQualityOnly ? TABS.filter(tab => tab.id !== 'escalamientos') : TABS
  const visibleTab = tabs.some(tab => tab.id === activeTab) ? activeTab : 'bandeja'

  return (
    <WorkspaceTabs
      title="Pendientes"
      subtitle={isQualityOnly ? 'Bandeja acotada a tareas propias y de Calidad' : 'Centro operativo para tareas, escalamientos, mantenimiento y compras'}
      tabs={tabs}
      activeTab={visibleTab}
      onTabChange={setActiveTab}
    >
      {visibleTab === 'bandeja' && <Bandeja onNavigate={onNavigate} />}
      {visibleTab === 'tareas' && <Tareas onNavigate={onNavigate} />}
      {!isQualityOnly && visibleTab === 'escalamientos' && <Escalamientos onNavigate={onNavigate} />}
      {visibleTab === 'calendario' && <Calendario />}
    </WorkspaceTabs>
  )
}
