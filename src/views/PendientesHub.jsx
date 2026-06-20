import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { getWorkQueue } from '../lib/workQueue'
import WorkspaceTabs from '../components/WorkspaceTabs'
import Tareas from './Tareas'
import Escalamientos from './Escalamientos'

const TABS = [
  { id:'bandeja', label:'Bandeja' },
  { id:'tareas', label:'Tareas' },
  { id:'escalamientos', label:'Escalamientos' },
]

function Bandeja({ onNavigate }) {
  const { allowedSedeIds, perfil, rol } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (force = false) => {
    setLoading(true); setError(null)
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

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-title font-bold" style={{ color:'var(--text)' }}>Qué requiere atención</h2>
          <p className="text-xs mt-1" style={{ color:'var(--text-dim)' }}>{items.length} pendientes ordenados por prioridad y fecha</p>
        </div>
        <button type="button" onClick={() => load(true)} className="btn-ghost" disabled={loading} aria-label="Actualizar bandeja">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <div className="rounded p-3 mb-3" role="alert" style={{ color:'var(--alert)', border:'1px solid rgba(255,42,42,0.25)' }}>{error}</div>}
      {!loading && items.length === 0 && <p className="text-sm py-10 text-center" style={{ color:'var(--text-dim)' }}>No hay pendientes para tu alcance.</p>}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {items.slice(0, 60).map(item => (
          <button key={item.id} type="button" onClick={() => onNavigate(item.target)}
            className="glass text-left rounded p-4 hover:border-green-500/30"
            style={{ borderLeft:`3px solid ${['alta','critica','crítica'].includes(String(item.priority || '').toLowerCase()) ? 'var(--alert)' : 'var(--warn)'}` }}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="font-metric text-xs" style={{ color:'var(--phosphor)' }}>{item.module}</span>
              <span className="chip chip-gray" style={{ fontSize:'0.58rem' }}>{item.status || 'Pendiente'}</span>
            </div>
            <p className="text-sm font-semibold line-clamp-2" style={{ color:'var(--text)' }}>{item.title || 'Sin descripción'}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs" style={{ color:'var(--text-dim)' }}>
              <span>{item.site || 'Gestión'}</span>
              {item.owner && <span>{item.owner}</span>}
              {item.priority && <span>Prioridad: {item.priority}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function PendientesHub({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('bandeja')

  return (
    <WorkspaceTabs title="Pendientes" subtitle="Una sola bandeja para tareas, escalamientos, mantenimiento y compras" tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'bandeja' && <Bandeja onNavigate={onNavigate} />}
      {activeTab === 'tareas' && <Tareas onNavigate={onNavigate} />}
      {activeTab === 'escalamientos' && <Escalamientos onNavigate={onNavigate} />}
    </WorkspaceTabs>
  )
}
