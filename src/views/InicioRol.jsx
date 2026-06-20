import { ClipboardCheck, Building2, ShoppingCart, Wrench } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { ROLE_LABELS } from '../lib/access'
import DashboardGlobal from './DashboardGlobal'
import SedeEncargadoView from './SedeEncargadoView'

const ACTIONS = [
  { id:'pendientes', label:'Ver pendientes', help:'Lo que requiere atención', icon:ClipboardCheck },
  { id:'sedesHub', label:'Ir a sedes', help:'Estado y fichas de unidad', icon:Building2 },
  { id:'requerimientos', label:'Compras', help:'Solicitudes y seguimiento', icon:ShoppingCart },
  { id:'mantenimientoHub', label:'Mantenimiento', help:'Tickets, activos y preventivos', icon:Wrench },
]

export default function InicioRol({ onNavigate }) {
  const { rol, perfil } = useAuth()
  const isTerritorial = ['encargado','sede'].includes(rol)
  const Dashboard = isTerritorial ? SedeEncargadoView : DashboardGlobal

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <section className="px-4 md:px-6 pt-5 pb-2">
        <p className="font-metric text-xs" style={{ color:'var(--phosphor)' }}>{ROLE_LABELS[rol] || rol}</p>
        <h1 className="font-title text-xl font-bold mt-1" style={{ color:'var(--text)' }}>
          Hola, {perfil?.nombre?.split(' ')[0] || 'equipo'}
        </h1>
        <p className="text-sm mt-1" style={{ color:'var(--text-dim)' }}>Empezá por lo que necesita resolución hoy.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
          {ACTIONS.map(({ id, label, help, icon:Icon }) => (
            <button key={id} type="button" onClick={() => onNavigate(id)} className="glass rounded p-3 text-left">
              <Icon size={16} style={{ color:'var(--phosphor)' }} />
              <p className="text-sm font-semibold mt-2" style={{ color:'var(--text)' }}>{label}</p>
              <p className="text-xs mt-1" style={{ color:'var(--text-dim)' }}>{help}</p>
            </button>
          ))}
        </div>
      </section>
      <Dashboard onNavigate={onNavigate} />
    </div>
  )
}
