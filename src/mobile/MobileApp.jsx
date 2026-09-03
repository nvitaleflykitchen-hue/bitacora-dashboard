import { lazy, Suspense, useState, useEffect, useMemo } from 'react'
import MobileHome from './MobileHome'
import PullToRefresh from './PullToRefresh'
import GlobalSearch from '../components/GlobalSearch'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import PushNotificationControl from '../components/PushNotificationControl'
import NotificationCenter from '../components/NotificationCenter'
import { canAccessView, isComprasOnlyProfile, isQualityOnlyProfile, isSafetyOnlyProfile } from '../lib/access'
import { User, ShoppingCart } from 'lucide-react'
import { initBackNavigation, useBackHandler } from '../lib/backStack'
import WhatsNewModal from '../components/WhatsNewModal'
import { APP_NAME, APP_VERSION, hasSeenLatestRelease } from '../data/releases'
import usePersistedState from '../hooks/usePersistedState'
import { mobileDestinationForView } from '../lib/navigationRoutes'
import AssetQrScannerModal from '../components/AssetQrScannerModal'
import { parseInternalQrValue } from '../lib/assetQrScan'
import { getPersonaIdByCredentialToken } from '../lib/credenciales'
import { toast } from '../lib/feedback'
import { newScanEventId } from '../lib/assetScans'

const MobileReporte = lazy(() => import('./MobileReporte'))
const MobileTareas = lazy(() => import('./MobileTareas'))
const MobileSedes = lazy(() => import('./MobileSedes'))
const MobileEscalamientos = lazy(() => import('./MobileEscalamientos'))
const MobileChecklist = lazy(() => import('./MobileChecklist'))
const MobileTickets = lazy(() => import('./MobileTickets'))
const MobileRequerimientos = lazy(() => import('./MobileRequerimientos'))
const MobileMas = lazy(() => import('./MobileMas'))

const MobileLoading = () => <div style={{ minHeight:180, display:'grid', placeItems:'center', color:'var(--text-dim)', fontSize:'.8rem' }}>Cargando sección…</div>

const NAV = [
  { key: 'home',          label: 'Inicio',    icon: '⌂' },
  { key: 'tareas',        label: 'Tareas',    icon: '✓' },
  { key: 'sedes',         label: 'Sedes',     icon: '⊞' },
  { key: 'escalamientos', label: 'Alertas',   icon: '⚠' },
  { key: 'checklist',     label: 'Checklist', icon: '☑' },
  { key: 'tickets',       label: 'Tickets',   icon: '🔧' },
  { key: 'compras',       label: 'Compras',   icon: '🛒' },
  { key: 'mas',           label: 'Más',       icon: '☰' },
]

export default function MobileApp() {
  const { user, perfil, rol, can } = useAuth()
  const isQualityOnly = isQualityOnlyProfile(perfil)
  const isComprasOnly = isComprasOnlyProfile(perfil)
  const isSafetyOnly = isSafetyOnlyProfile(perfil)
  const isMaintenanceEditor = rol === 'mnt_editor'
  const canReport = !isQualityOnly && !isComprasOnly && !isMaintenanceEditor && (can('bitacora', 'report') || ['admin','editor','grupo','encargado'].includes(rol))
  const canUseChecklist = rol !== 'consultor'
  // 'operario': rol acotado a Inicio (Nuevo Reporte) + Checklist, nada más.
  const navAllowed = useMemo(() => isSafetyOnly
    ? new Set(['tareas', 'sedes', 'tickets', 'compras', 'mas'])
    : (isQualityOnly ? new Set(['tareas', 'tickets', 'compras', 'mas']) : (isComprasOnly ? new Set(['home', 'compras']) : (isMaintenanceEditor ? new Set(['tickets', 'sedes', 'compras', 'mas']) : (rol === 'operario' ? new Set(['home', 'checklist']) : null)))),
  [isSafetyOnly, isQualityOnly, isComprasOnly, isMaintenanceEditor, rol])
  const bottomNavAllowed = useMemo(
    () => navAllowed || new Set(['home', 'tareas', 'sedes', 'tickets', 'mas']),
    [navAllowed],
  )
  const initialTab = isMaintenanceEditor ? 'tickets' : (isSafetyOnly || isQualityOnly ? 'tareas' : (isComprasOnly ? 'compras' : 'home'))
  const [tab, setTab] = usePersistedState(`mobile.${user?.id}.tab`, initialTab, { validate:value => NAV.some(item => item.key === value) || value === 'perfil' })
  const [refreshKey, setRefreshKey] = useState(0)
  const [screen, setScreen] = useState('main') // 'main' | 'reporte' | 'checklist'
  const [showSearch, setShowSearch] = useState(false)
  const [masModule, setMasModule] = usePersistedState(`mobile.${user?.id}.masModule`, isSafetyOnly || isQualityOnly ? 'calidad' : null)
  const [showWhatsNew, setShowWhatsNew] = useState(() => user?.id ? !hasSeenLatestRelease(user.id) : false)
  const [reportContext, setReportContext] = useState(null)
  const [returnContext, setReturnContext] = useState(null)
  const [scannerOpen, setScannerOpen] = useState(false)

  const openScannedQr = async target => {
    setScannerOpen(false)
    if (target.type === 'asset') {
      if (!canAccessView(rol, 'mntActivos', perfil)) return toast.warn('No tenés permiso para abrir activos internos.')
      if (!target.id) return toast.warn('Escaneá el QR completo del activo para abrir su ficha.')
      setReturnContext({ type:'activo', id:target.id, scanEventId:newScanEventId() })
      setMasModule('mantenimiento')
      setTab('mas')
      return
    }
    if (!canAccessView(rol, 'equipo', perfil) || rol !== 'admin') {
      return toast.warn('La ficha interna de credenciales está disponible para administradores.')
    }
    try {
      const personaId = await getPersonaIdByCredentialToken(target.token)
      if (!personaId) return toast.warn('No se encontró la credencial.')
      setReturnContext({ type:'persona', id:personaId })
      setMasModule('personal')
      setTab('mas')
    } catch {
      toast.error('No se pudo abrir la credencial interna.')
    }
  }

  const openContextualReport = context => {
    setReportContext(context)
    setReturnContext(context)
    setScreen('reporte')
  }
  const closeReport = () => { setScreen('main'); setReportContext(null) }
  const finishReport = () => {
    const origin = returnContext
    setScreen('main')
    setReportContext(null)
    if (!origin) { setTab(isSafetyOnly ? 'tareas' : 'home'); return }
    if (origin.type === 'sede') setTab('sedes')
    else { setMasModule(origin.returnModule); setTab('mas') }
  }

  useEffect(() => {
    if (user?.id && !hasSeenLatestRelease(user.id)) setShowWhatsNew(true)
  }, [user?.id])
  useEffect(() => {
    if (!bottomNavAllowed.has(tab) && tab !== 'perfil') setTab(initialTab)
  }, [bottomNavAllowed, tab, initialTab, setTab])

  // Botón atrás del celular: navegar en vez de cerrar la app.
  const tabInicio = isMaintenanceEditor ? 'tickets' : (isSafetyOnly || isQualityOnly ? 'tareas' : 'home')
  useEffect(() => initBackNavigation(), [])
  useBackHandler(() => { setMasModule(null); setTab(tabInicio) }, screen === 'main' && tab !== tabInicio)
  useBackHandler(() => setScreen('main'), screen !== 'main')
  useBackHandler(() => setShowSearch(false), showSearch)

  const handleNotificationNavigate = (view) => {
    setScreen('main')
    const destination = mobileDestinationForView(view)
    if (destination.module) setMasModule(destination.module)
    setTab(destination.tab)
  }

  const handleSearchNavigate = (view) => {
    const destination = mobileDestinationForView(view)
    if (destination.module) setMasModule(destination.module)
    setTab(destination.tab)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const renderContent = () => {
    if (screen === 'checklist') {
      return (
        <MobileChecklist
          onBack={() => setScreen('main')}
        />
      )
    }
    if (screen === 'reporte') {
      return (
        <MobileReporte
          context={reportContext}
          onBack={closeReport}
          onSuccess={finishReport}
        />
      )
    }
    if (tab === 'home')          return <MobileHome onNuevoReporte={canReport ? () => setScreen('reporte') : null} onOpenSearch={!isQualityOnly && !isComprasOnly && !['operario','flota'].includes(rol) ? () => setShowSearch(true) : null} onOpenScanner={()=>setScannerOpen(true)} />
    if (tab === 'tareas')        return <MobileTareas />
    if (tab === 'sedes')         return <MobileSedes focusContext={returnContext} onCreateNovedad={canReport ? openContextualReport : null} />
    if (tab === 'escalamientos') return <MobileEscalamientos />
    if (tab === 'checklist')     return <MobileChecklist onBack={() => setTab('home')} onGoTareas={() => setTab('tareas')} />
    if (tab === 'tickets')       return <MobileTickets />
    if (tab === 'compras')       return <MobileRequerimientos />
    if (tab === 'mas')           return <MobileMas key={`${user?.id || 'anon'}-${rol}-${returnContext?.id || ''}`} initialModule={masModule} userId={user?.id} focusContext={returnContext} onCreateNovedad={canReport ? openContextualReport : null} />
    if (tab === 'perfil')        return <MobilePerfil perfil={perfil} onLogout={handleLogout} />
    return null
  }

  return (
    <div style={{
      width: '100vw', height: '100dvh',
      background: 'var(--abyss)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      minHeight: 0,
    }}>
      {/* FK header strip */}
      <div style={{
        padding: 'calc(0.6rem + env(safe-area-inset-top)) 1rem 0.6rem',
        background: 'var(--surface)',
        borderBottom: '1px solid rgba(57,255,20,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#F97316', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.02em' }}>FLY</span>
          <span style={{ color: 'var(--text)', fontWeight: 800, fontSize: '0.85rem' }}>KITCHEN</span>
          <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem', marginLeft: 4 }}>· {APP_NAME}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {!isQualityOnly && !isComprasOnly && <NotificationCenter onNavigate={handleNotificationNavigate} />}
          <button type="button" onClick={() => setTab('perfil')} aria-label="Abrir mi perfil" aria-current={tab === 'perfil' ? 'page' : undefined} style={{ background:'none', border:'none', padding:0, color:tab === 'perfil' ? 'var(--phosphor)' : 'var(--text-dim)', display:'grid', placeItems:'center', minWidth:44, minHeight:44 }}>
            <User size={20} aria-hidden="true" />
          </button>
          <span style={{
            background: 'rgba(57,255,20,0.1)', color: 'var(--phosphor)',
            fontSize: '0.6rem', padding: '0.15rem 0.4rem', borderRadius: 3,
            fontWeight: 700, letterSpacing: '0.06em'
          }}>
            {isMaintenanceEditor ? 'MANTENIMIENTO' : (perfil?.rol?.toUpperCase() || 'FK')}
          </span>
          {/* Boton reporte rapido en header */}
          {screen === 'main' && canReport && (
            <button type="button" onClick={() => setScreen('reporte')}
              style={{
                background: 'var(--phosphor)', color: '#0A0A0E',
                border: 'none', borderRadius: 6, cursor: 'pointer',
                fontSize: '0.72rem', fontWeight: 800, padding: '0.45rem 0.7rem', minHeight:44
              }}>
              + Reporte
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <PullToRefresh onRefresh={() => setRefreshKey(k => k + 1)}>
          <div key={refreshKey} style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Suspense fallback={<MobileLoading />}>{renderContent()}</Suspense>
          </div>
        </PullToRefresh>
      </div>
      {scannerOpen && (
        <AssetQrScannerModal
          onClose={()=>setScannerOpen(false)}
          onScan={openScannedQr}
          parseValue={parseInternalQrValue}
          title="Escanear QR de Fly Gestión"
          subtitle="Activos y credenciales"
          prompt="Apuntá al QR del activo o de la credencial."
          invalidMessage="El QR no corresponde a un activo ni a una credencial de Fly Gestión."
          placeholder="Pegá el enlace del QR…"
          help="La app reconoce el QR y abre su ficha interna según tus permisos."
        />
      )}

      {showSearch && !isComprasOnly && (
        <GlobalSearch mobile onNavigate={handleSearchNavigate} onClose={() => setShowSearch(false)} />
      )}

      {/* Bottom nav */}
      {screen === 'main' && (
        <nav aria-label="Navegación principal" style={{
          background: 'var(--surface)',
          borderTop: '1px solid rgba(57,255,20,0.1)',
          display: 'flex',
          padding: '0.4rem 0 calc(0.4rem + env(safe-area-inset-bottom))',
        }}>
          {NAV.filter(n => bottomNavAllowed.has(n.key) && (canUseChecklist || n.key !== 'checklist')).map(n => (
            <button type="button" key={n.key} onClick={() => { setMasModule(null); setTab(n.key) }} aria-label={n.label} aria-current={tab === n.key ? 'page' : undefined}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '0.15rem', background: 'none', border: 'none',
                cursor: 'pointer', padding: '0.35rem 0', minWidth: 0, minHeight: 52,
              }}>
              <span style={{
                fontSize: '1rem', lineHeight: 1,
                color: tab === n.key ? (n.key === 'escalamientos' ? '#F97316' : 'var(--phosphor)') : 'var(--text-dim)',
                transition: 'color 0.15s'
              }}>{n.icon}</span>
              <span style={{
                fontSize: '0.7rem', letterSpacing: '0.01em',
                color: tab === n.key ? (n.key === 'escalamientos' ? '#F97316' : 'var(--phosphor)') : 'var(--text-dim)',
                fontWeight: tab === n.key ? 700 : 400,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center'
              }}>{n.label}</span>
            </button>
          ))}
        </nav>
      )}
      {showWhatsNew && (
        <WhatsNewModal
          userId={user.id}
          onClose={() => setShowWhatsNew(false)}
          onOpenAll={() => { setMasModule('actualizaciones'); setTab('mas') }}
        />
      )}
    </div>
  )
}

function MobilePerfil({ perfil, onLogout }) {
  const actualizarAplicacion = async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(registration => registration.update()))
    }
    const url = new URL(window.location.href)
    url.searchParams.set('_update', Date.now().toString())
    window.location.replace(url.toString())
  }
  return (
    <div className="mobile-scroll" style={{ padding: '1.5rem 1rem', height: '100%' }}>
      <h1 style={{ color: 'var(--text)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Mi perfil</h1>

      <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' }}>
        <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.05rem' }}>{perfil?.nombre || '—'}</p>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: 4 }}>{perfil?.email}</p>
        {perfil?.telefono && (
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: 2 }}>{perfil.telefono}</p>
        )}
        <span style={{
          display: 'inline-block', marginTop: 10,
          background: 'rgba(57,255,20,0.1)', color: 'var(--phosphor)',
          fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: 4, fontWeight: 700
        }}>
          {perfil?.rol}
        </span>
        <p style={{ color:'var(--text-dim)', fontSize:'0.68rem', marginTop:12 }}>{APP_NAME} · versión {APP_VERSION}</p>
      </div>

      <button onClick={actualizarAplicacion}
        style={{
          width:'100%', padding:'0.85rem', borderRadius:8, marginBottom:'0.75rem',
          background:'rgba(96,165,250,0.08)', color:'#60a5fa', fontWeight:600,
          fontSize:'0.85rem', border:'1px solid rgba(96,165,250,0.22)', cursor:'pointer'
        }}>
        Actualizar aplicación
      </button>

      <div style={{ marginBottom:'1rem' }}>
        <PushNotificationControl />
      </div>

      {['admin', 'editor'].includes(perfil?.rol) && (
        <button
          onClick={() => { localStorage.setItem('bd.forceDesktop', '1'); window.location.reload() }}
          style={{
            width: '100%', padding: '0.9rem', borderRadius: 8, marginBottom: '0.75rem',
            background: 'rgba(57,255,20,0.08)', color: 'var(--phosphor)',
            fontWeight: 600, fontSize: '0.9rem', border: '1px solid rgba(57,255,20,0.2)',
            cursor: 'pointer'
          }}>
          Usar versión de escritorio
        </button>
      )}

      <button onClick={onLogout}
        style={{
          width: '100%', padding: '0.9rem', borderRadius: 8,
          background: 'rgba(255,42,42,0.1)', color: '#FF2A2A',
          fontWeight: 600, fontSize: '0.9rem', border: '1px solid rgba(255,42,42,0.2)',
          cursor: 'pointer'
        }}>
        Cerrar sesión
      </button>
    </div>
  )
}
