import { lazy, Suspense, useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import FeedbackHost from './components/FeedbackHost'
import LoginPage from './components/LoginPage'
import CambiarContrasena from './components/CambiarContrasena'
import Sidebar from './components/Sidebar'
import AlertaBanner   from './components/AlertaBanner'
import GlobalSearch   from './components/GlobalSearch'
import { useEscalamientosAlert } from './hooks/useEscalamientosAlert'
import { canAccessView, getDefaultView, isComprasOnlyProfile, isQualityOnlyProfile } from './lib/access'
import HelpPanel from './components/HelpPanel'

const MobileApp = lazy(() => import('./mobile/MobileApp'))
const MobileReporte = lazy(() => import('./mobile/MobileReporte'))
const InicioRol = lazy(() => import('./views/InicioRol'))
const Tablon = lazy(() => import('./views/Tablon'))
const PendientesHub = lazy(() => import('./views/PendientesHub'))
const SedesHub = lazy(() => import('./views/SedesHub'))
const MantenimientoHub = lazy(() => import('./views/MantenimientoHub'))
const FlotaHub = lazy(() => import('./views/FlotaHub'))
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
const VuelosPlantilla = lazy(() => import('./views/VuelosPlantilla'))
const EquipoView = lazy(() => import('./views/EquipoView'))
const SedeEncargadoView = lazy(() => import('./views/SedeEncargadoView'))

const ALL_VIEWS = {
  inicio:          InicioRol,
  tablon:          Tablon,
  pendientes:     PendientesHub,
  sedesHub:        SedesHub,
  mantenimientoHub: MantenimientoHub,
  flotaHub:        FlotaHub,
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
  vuelosPlantilla:  VuelosPlantilla,
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

function AuthStartupError({ message, onRetry, onSignOut }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background:'var(--abyss)' }}>
      <div className="glass max-w-md rounded p-6 text-center">
        <h1 className="font-title font-bold" style={{ color:'var(--warn)' }}>No se pudo iniciar la app</h1>
        <p className="text-sm mt-3" style={{ color:'var(--text-dim)', lineHeight:1.6 }}>
          La sesión o el perfil tardaron demasiado en responder. Esto suele pasar por conexión inestable, caché de la PWA o una llamada de Supabase colgada.
        </p>
        {message && (
          <p className="font-metric text-xs mt-3" style={{ color:'var(--text-dim)', wordBreak:'break-word' }}>
            {message}
          </p>
        )}
        <div className="flex items-center justify-center gap-2 mt-5">
          <button type="button" onClick={onRetry} className="btn-primary">Reintentar</button>
          <button type="button" onClick={onSignOut} className="btn-ghost">Cerrar sesión</button>
        </div>
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
  const { user, perfil, rol, allowedSedeIds, accessBlocked, authError, loading, signOut, can } = useAuth()
  const isQualityOnly = isQualityOnlyProfile(perfil)
  const isComprasOnly = isComprasOnlyProfile(perfil)
  // 'operario': rol mobile-only, sin acceso a escritorio sin importar el ancho de pantalla.
  const forceMobile = rol === 'operario'
  const [qrActivoId, setQrActivoId] = useState(() => new URLSearchParams(window.location.search).get('id'))
  const [showSearch, setShowSearch] = useState(false)
  const [showReporte, setShowReporte] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [navigationTarget, setNavigationTarget] = useState(() => {
    const p = new URLSearchParams(window.location.search)
    return p.get('targetType') || p.get('targetId')
      ? { type:p.get('targetType'), id:p.get('targetId'), sedeId:p.get('targetSedeId') }
      : null
  })
  const [activeView, setActiveView] = useState(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('scan') === 'activo' && p.get('id')) return 'qrActivo'
    const requestedView = p.get('view')
    return requestedView && ALL_VIEWS[requestedView] ? requestedView : 'inicio'
  })

  // Bloquear rutas directas que no correspondan al rol actual.
  useEffect(() => {
    if (!loading && user && activeView !== 'qrActivo' && !canAccessView(rol, activeView, perfil)) {
      setActiveView(getDefaultView(rol, perfil) || 'inicio')
    }
  }, [loading, user, rol, perfil, activeView])

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('scan') === 'activo' && p.get('id')) setQrActivoId(p.get('id'))
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        if (isQualityOnly || isComprasOnly) return
        setShowSearch(s => !s)
      }
      if (e.key === 'Escape') setShowSearch(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isQualityOnly, isComprasOnly])

  const isMobile = useIsMobile()

  // Notificaciones browser para escalamientos Pendientes sin gestionar
  useEscalamientosAlert({ sedeIds: allowedSedeIds, enabled: !loading && !!user && !accessBlocked && !isMobile && !isQualityOnly && !isComprasOnly })

  if (loading) return <LoadingScreen />
  if (authError) return <AuthStartupError message={authError} onRetry={() => window.location.reload()} onSignOut={signOut} />
  if (!user)   return <LoginPage />
  if (accessBlocked) return <AccessBlocked onSignOut={signOut} />
  if (perfil?.must_change_password) return <CambiarContrasena />
  if (activeView === 'qrActivo' && isMobile) {
    return <Suspense fallback={<LoadingScreen />}><QRActivoView activoId={qrActivoId} onNavigate={setActiveView} /></Suspense>
  }
  // Escape a escritorio: admin/editor pueden forzar la versión completa desde
  // el celular (Mi Perfil → "Usar versión de escritorio"). operario nunca.
  const desktopForzado = ['admin', 'editor'].includes(rol) && localStorage.getItem('bd.forceDesktop') === '1'
  if ((isMobile || forceMobile) && !(desktopForzado && !forceMobile)) return <Suspense fallback={<LoadingScreen />}><MobileApp /></Suspense>

  const navigate = (view, target = null) => {
    if (!ALL_VIEWS[view] || !canAccessView(rol, view, perfil)) return
    setActiveView(view)
    setNavigationTarget(target)
    const url = new URL(window.location.href)
    url.search = ''
    url.searchParams.set('view', view)
    if (target?.type) {
      url.searchParams.set('targetType', target.type || '')
    }
    if (target?.id) {
      url.searchParams.set('targetId', target.id)
      if (target.sedeId) url.searchParams.set('targetSedeId', target.sedeId)
    }
    window.history.replaceState({}, '', url)
  }

  const ActiveView = ALL_VIEWS[activeView] || InicioRol
  const canReport = !isQualityOnly && !isComprasOnly && (can('bitacora', 'report') || ['admin','editor','grupo','encargado'].includes(rol))

  return (
    <div className="flex h-screen overflow-hidden" style={{ background:'var(--abyss)' }}>
      <div className="scanline" />
      <Sidebar activeView={activeView} onNavigate={navigate} onNuevoReporte={canReport ? () => setShowReporte(true) : null} />
      <main className="flex-1 flex flex-col overflow-hidden pt-12 md:pt-0">
        <AlertaBanner onNavigate={navigate} />
        {showSearch && !isQualityOnly && !isComprasOnly && (
          <GlobalSearch onNavigate={navigate} onClose={() => setShowSearch(false)} />
        )}
        <Suspense fallback={<ViewLoading />}>
          {activeView === 'qrActivo'
            ? <QRActivoView activoId={qrActivoId} onNavigate={navigate} />
            : <ActiveView
                onNavigate={navigate}
                onOpenSearch={!isQualityOnly && !isComprasOnly ? () => setShowSearch(true) : null}
                focusId={navigationTarget?.id || null}
                focusType={navigationTarget?.type || null}
                focusSedeId={navigationTarget?.sedeId || null}
              />
          }
        </Suspense>
      </main>

      {/* Botón flotante de ayuda */}
      <button
        onClick={() => setShowHelp(h => !h)}
        title="Manual de uso / Central de ayuda"
        style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 75,
          width: 40, height: 40, borderRadius: '50%',
          background: showHelp ? 'var(--phosphor)' : 'var(--surface)',
          border: '1px solid rgba(57,255,20,0.35)',
          color: showHelp ? '#0A0A0E' : 'var(--phosphor)',
          fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        ?
      </button>

      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

      {/* Modal "Nuevo Reporte" desde escritorio — reusa el mismo form que la vista mobile,
          montado en un contenedor angosto para no romper su estilado pensado para celular. */}
      {showReporte && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 70,
            background: 'rgba(0,0,0,0.84)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '2rem',
          }}
          onClick={() => setShowReporte(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(480px, 100%)', height: 'min(880px, 100%)',
              background: 'var(--abyss)', borderRadius: 12, overflow: 'hidden',
              border: '1px solid rgba(57,255,20,0.28)',
              boxShadow: '0 28px 90px rgba(0,0,0,0.9)',
            }}
          >
            <Suspense fallback={<ViewLoading />}>
              <MobileReporte
                onBack={() => setShowReporte(false)}
                onSuccess={() => setShowReporte(false)}
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
      <FeedbackHost />
    </AuthProvider>
  )
}
