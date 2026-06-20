import { lazy, Suspense, useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import LoginPage from './components/LoginPage'
import CambiarContrasena from './components/CambiarContrasena'
import Sidebar from './components/Sidebar'
import AlertaBanner   from './components/AlertaBanner'
import GlobalSearch   from './components/GlobalSearch'
import { useEscalamientosAlert } from './hooks/useEscalamientosAlert'
import { canAccessView, getDefaultView } from './lib/access'

const MobileApp = lazy(() => import('./mobile/MobileApp'))
const InicioRol = lazy(() => import('./views/InicioRol'))
const PendientesHub = lazy(() => import('./views/PendientesHub'))
const SedesHub = lazy(() => import('./views/SedesHub'))
const MantenimientoHub = lazy(() => import('./views/MantenimientoHub'))
const CalidadHub = lazy(() => import('./views/CalidadHub'))
const DashboardGlobal = lazy(() => import('./views/DashboardGlobal'))
const PorSede = lazy(() => import('./views/PorSede'))
const Escalamientos = lazy(() => import('./views/Escalamientos'))
const Calendario = lazy(() => import('./views/Calendario'))
const NoConformidades = lazy(() => import('./views/NoConformidades'))
const CAPA = lazy(() => import('./views/CAPA'))
const Indicadores = lazy(() => import('./views/Indicadores'))
const Tareas = lazy(() => import('./views/Tareas'))
const Usuarios = lazy(() => import('./views/Usuarios'))
const MntDashboard = lazy(() => import('./views/mantenimiento/MntDashboard'))
const MntTickets = lazy(() => import('./views/mantenimiento/MntTickets'))
const MntActivos = lazy(() => import('./views/mantenimiento/MntActivos'))
const MntPlanes = lazy(() => import('./views/mantenimiento/MntPlanes'))
const MntProveedores = lazy(() => import('./views/mantenimiento/MntProveedores'))
const MntMatafuegos = lazy(() => import('./views/mantenimiento/MntMatafuegos'))
const MntInsumos = lazy(() => import('./views/mantenimiento/MntInsumos'))
const MntKanban = lazy(() => import('./views/mantenimiento/MntKanban'))
const MntResponsables = lazy(() => import('./views/mantenimiento/MntResponsables'))
const MntVehiculos = lazy(() => import('./views/mantenimiento/MntVehiculos'))
const MntFlotaGestion = lazy(() => import('./views/mantenimiento/MntFlotaGestion'))
const SedeResponsables = lazy(() => import('./views/SedeResponsables'))
const Requerimientos = lazy(() => import('./views/Requerimientos'))
const QRActivoView = lazy(() => import('./views/mantenimiento/QRActivoView'))
const AuditoriaView = lazy(() => import('./views/mantenimiento/AuditoriaView'))
const SedeFicha = lazy(() => import('./views/SedeFicha'))
const EquipoView = lazy(() => import('./views/EquipoView'))
const SedeEncargadoView = lazy(() => import('./views/SedeEncargadoView'))

const ALL_VIEWS = {
  inicio:          InicioRol,
  pendientes:     PendientesHub,
  sedesHub:        SedesHub,
  mantenimientoHub: MantenimientoHub,
  calidadHub:      CalidadHub,
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

function AccessBlocked({ onSignOut }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background:'var(--abyss)' }}>
      <div className="glass max-w-md rounded p-6 text-center">
        <h1 className="font-title font-bold" style={{ color:'var(--alert)' }}>Acceso pendiente de configuración</h1>
        <p className="text-sm mt-3" style={{ color:'var(--text-dim)', lineHeight:1.6 }}>
          Tu perfil no tiene una sede o grupo asignado, o está inactivo. Un administrador debe completar la configuración antes de continuar.
        </p>
        <button type="button" onClick={onSignOut} className="btn-ghost mt-5">Cerrar sesión</button>
      </div>
    </div>
  )
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

function ViewLoading() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor:'var(--phosphor)', borderTopColor:'transparent' }} />
    </div>
  )
}

function AppInner() {
  const { user, perfil, rol, allowedSedeIds, accessBlocked, loading, signOut } = useAuth()
  const [qrActivoId, setQrActivoId] = useState(() => new URLSearchParams(window.location.search).get('id'))
  const [showSearch, setShowSearch] = useState(false)
  const [activeView, setActiveView] = useState(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('scan') === 'activo' && p.get('id')) return 'qrActivo'
    const requestedView = p.get('view')
    return requestedView && ALL_VIEWS[requestedView] ? requestedView : 'inicio'
  })

  // Bloquear rutas directas que no correspondan al rol actual.
  useEffect(() => {
    if (!loading && user && activeView !== 'qrActivo' && !canAccessView(rol, activeView)) {
      setActiveView(getDefaultView(rol) || 'inicio')
    }
  }, [loading, user, rol, activeView])

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
  useEscalamientosAlert({ sedeIds: allowedSedeIds, enabled: !loading && !!user && !accessBlocked && !isMobile })

  if (loading) return <LoadingScreen />
  if (!user)   return <LoginPage />
  if (accessBlocked) return <AccessBlocked onSignOut={signOut} />
  if (perfil?.must_change_password) return <CambiarContrasena />
  if (activeView === 'qrActivo' && isMobile) {
    return <Suspense fallback={<LoadingScreen />}><QRActivoView activoId={qrActivoId} onNavigate={setActiveView} /></Suspense>
  }
  if (isMobile) return <Suspense fallback={<LoadingScreen />}><MobileApp /></Suspense>

  const navigate = (view) => {
    if (!ALL_VIEWS[view] || !canAccessView(rol, view)) return
    setActiveView(view)
    const url = new URL(window.location.href)
    url.search = ''
    url.searchParams.set('view', view)
    window.history.replaceState({}, '', url)
  }

  const ActiveView = ALL_VIEWS[activeView] || InicioRol

  return (
    <div className="flex h-screen overflow-hidden" style={{ background:'var(--abyss)' }}>
      <div className="scanline" />
      <Sidebar activeView={activeView} onNavigate={navigate} />
      <main className="flex-1 flex flex-col overflow-hidden pt-12 md:pt-0">
        <AlertaBanner onNavigate={navigate} />
        {showSearch && (
          <GlobalSearch onNavigate={navigate} onClose={() => setShowSearch(false)} />
        )}
        <Suspense fallback={<ViewLoading />}>
          {activeView === 'qrActivo'
            ? <QRActivoView activoId={qrActivoId} onNavigate={navigate} />
            : <ActiveView onNavigate={navigate} />
          }
        </Suspense>
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
