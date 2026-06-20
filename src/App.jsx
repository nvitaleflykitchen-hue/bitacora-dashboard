import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import MobileApp from './mobile/MobileApp'
import LoginPage from './components/LoginPage'
import CambiarContrasena from './components/CambiarContrasena'
import Sidebar from './components/Sidebar'
import DashboardGlobal from './views/DashboardGlobal'
import PorSede from './views/PorSede'
import Escalamientos from './views/Escalamientos'
import Calendario from './views/Calendario'
import NoConformidades from './views/NoConformidades'
import CAPA from './views/CAPA'
import Indicadores from './views/Indicadores'
import Tareas from './views/Tareas'
import Usuarios from './views/Usuarios'
import MntDashboard   from './views/mantenimiento/MntDashboard'
import MntTickets     from './views/mantenimiento/MntTickets'
import MntActivos     from './views/mantenimiento/MntActivos'
import MntPlanes      from './views/mantenimiento/MntPlanes'
import MntProveedores from './views/mantenimiento/MntProveedores'
import MntMatafuegos  from './views/mantenimiento/MntMatafuegos'
import MntInsumos     from './views/mantenimiento/MntInsumos'
import MntKanban      from './views/mantenimiento/MntKanban'
import MntResponsables from './views/mantenimiento/MntResponsables'
import MntVehiculos  from './views/mantenimiento/MntVehiculos'
import MntFlotaGestion from './views/mantenimiento/MntFlotaGestion'
import SedeResponsables from './views/SedeResponsables'
import Requerimientos   from './views/Requerimientos'
import QRActivoView    from './views/mantenimiento/QRActivoView'
import AuditoriaView  from './views/mantenimiento/AuditoriaView'
import SedeFicha           from './views/SedeFicha'
import EquipoView          from './views/EquipoView'
import SedeEncargadoView   from './views/SedeEncargadoView'
import AlertaBanner   from './components/AlertaBanner'
import GlobalSearch   from './components/GlobalSearch'
import { useEscalamientosAlert } from './hooks/useEscalamientosAlert'

const ALL_VIEWS = {
  dashboard:       DashboardGlobal,
  sede:            PorSede,
  escalamientos:   Escalamientos,
  calendario:      Calendario,
  noConformidades: NoConformidades,
  capa:            CAPA,
  indicadores:     Indicadores,
  tareas:          Tareas,
  usuarios:        Usuarios,
  mntDashboard:    MntDashboard,
  mntTickets:      MntTickets,
  mntActivos:      MntActivos,
  mntPlanes:       MntPlanes,
  mntProveedores:  MntProveedores,
  mntMatafuegos:   MntMatafuegos,
  mntInsumos:      MntInsumos,
  mntKanban:       MntKanban,
  mntResponsables: MntResponsables,
  mntVehiculos:    MntVehiculos,
  flotaGestion:    MntFlotaGestion,
  sedeResponsables: SedeResponsables,
  requerimientos:   Requerimientos,
  qrActivo:         QRActivoView,
  sedeFicha:        SedeFicha,
  equipo:           EquipoView,
  auditoria:        AuditoriaView,
  sedeEncargado:    SedeEncargadoView,
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return isMobile
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background:'var(--abyss)' }}>
      <div className="scanline" />
      <div className="text-center space-y-4">
        <div className="w-10 h-10 rounded-full border-2 mx-auto animate-spin"
          style={{ borderColor:'var(--phosphor)', borderTopColor:'transparent' }} />
        <p className="font-metric text-xs tracking-widest" style={{ color:'rgba(57,255,20,0.5)' }}>
          INICIANDO SISTEMA...
        </p>
      </div>
    </div>
  )
}

function AppInner() {
  const { user, perfil, rol, isAdmin, allowedSedeIds, loading } = useAuth()
  const [qrActivoId, setQrActivoId] = useState(() => new URLSearchParams(window.location.search).get('id'))
  const [showSearch, setShowSearch] = useState(false)
  const [activeView, setActiveView] = useState(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('scan') === 'activo' && p.get('id')) return 'qrActivo'
    const requestedView = p.get('view')
    return requestedView && ALL_VIEWS[requestedView] ? requestedView : 'dashboard'
  })

  // Auto-redirect encargado/sede a su vista dedicada
  useEffect(() => {
    if (!loading && user && ['encargado', 'sede'].includes(rol) && activeView === 'dashboard') {
      setActiveView('sedeEncargado')
    }
  }, [loading, user, rol])

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('scan') === 'activo' && p.get('id')) setQrActivoId(p.get('id'))
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(s => !s)
      }
      if (e.key === 'Escape') setShowSearch(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const isMobile = useIsMobile()

  // Notificaciones browser para escalamientos Pendientes sin gestionar
  useEscalamientosAlert({ sedeIds: allowedSedeIds, enabled: !loading && !!user && !isMobile })

  if (loading) return <LoadingScreen />
  if (!user)   return <LoginPage />
  if (perfil?.must_change_password) return <CambiarContrasena />
  if (activeView === 'qrActivo' && isMobile) {
    return <QRActivoView activoId={qrActivoId} onNavigate={setActiveView} />
  }
  if (isMobile) return <MobileApp />

  const navigate = (view) => {
    if (view === 'usuarios' && !isAdmin) return
    setActiveView(view)
  }

  const ActiveView = ALL_VIEWS[activeView] || DashboardGlobal

  return (
    <div className="flex h-screen overflow-hidden" style={{ background:'var(--abyss)' }}>
      <div className="scanline" />
      <Sidebar activeView={activeView} onNavigate={navigate} />
      <main className="flex-1 flex flex-col overflow-hidden pt-12 md:pt-0">
        <AlertaBanner onNavigate={navigate} />
        {showSearch && (
          <GlobalSearch onNavigate={navigate} onClose={() => setShowSearch(false)} />
        )}
        {activeView === 'qrActivo'
          ? <QRActivoView activoId={qrActivoId} onNavigate={navigate} />
          : <ActiveView onNavigate={navigate} />
        }
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
