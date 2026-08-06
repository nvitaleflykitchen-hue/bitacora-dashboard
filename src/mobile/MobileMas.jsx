import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { BarChart3, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList, Megaphone, Phone, Sparkles, Star, Users, Wrench } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { canAccessView } from '../lib/access'
import { useBackHandler } from '../lib/backStack'
import { clearMobileRecents, loadMobileShortcuts, recordMobileRecent, saveMobileShortcuts, toggleMobileFavorite } from '../lib/mobileShortcuts'

const MobileCapa = lazy(() => import('./MobileCapa'))
const MobilePersonal = lazy(() => import('./MobilePersonal'))
const MobileMantenimiento = lazy(() => import('./MobileMantenimiento'))
const MobileIndicadores = lazy(() => import('./MobileIndicadores'))
const MobileTablon = lazy(() => import('./MobileTablon'))
const MobileContactos = lazy(() => import('./MobileContactos'))
const MobileActualizaciones = lazy(() => import('./MobileActualizaciones'))
const MobileEscalamientos = lazy(() => import('./MobileEscalamientos'))
const MobileChecklist = lazy(() => import('./MobileChecklist'))
const MobileRequerimientos = lazy(() => import('./MobileRequerimientos'))
const MobileFlota = lazy(() => import('./MobileFlota'))
const AuditoriasInternas = lazy(() => import('../views/AuditoriasInternas'))

const MODULES = [
  { key:'escalamientos', label:'Escalamientos', sub:'Casos que requieren seguimiento', icon:ClipboardCheck, view:'escalamientos' },
  { key:'checklist', label:'Checklist', sub:'Controles operativos de la sede', icon:ClipboardList, view:'inicio' },
  { key:'compras', label:'Compras', sub:'Requerimientos y seguimiento', icon:ClipboardList, view:'requerimientos' },
  { key:'calidad', label:'Calidad', sub:'CAPA y no conformidades', icon:ClipboardList, view:'calidadHub' },
  { key:'auditorias', label:'Auditorías internas', sub:'Relevamiento, fotos y hallazgos', icon:ClipboardCheck, view:'calidadHub' },
  { key:'personal', label:'Personal', sub:'Equipo y Recursos Humanos', icon:Users, view:'equipo' },
  { key:'mantenimiento', label:'Mantenimiento', sub:'Activos, insumos y matafuegos', icon:Wrench, view:'mantenimientoHub' },
  { key:'indicadores', label:'Indicadores', sub:'Panel y calendario', icon:BarChart3, view:'calendario' },
  { key:'flota', label:'Flota', sub:'Vehículos y documentación', icon:Wrench, view:'flotaHub' },
  { key:'tablon', label:'Tablón', sub:'Anuncios operativos', icon:Megaphone, view:'tablon' },
  { key:'actualizaciones', label:'Actualizaciones', sub:'Versiones y nuevas funciones', icon:Sparkles, view:'actualizaciones' },
  { key:'contactos', label:'Directorio', sub:'Teléfonos importantes', icon:Phone, view:'inicio' },
]

const MODULE_GROUPS = ['Trabajo diario', 'Gestión', 'Información y cuenta']
const moduleGroup = key => {
  if (['escalamientos', 'checklist', 'compras'].includes(key)) return 'Trabajo diario'
  if (['tablon', 'actualizaciones', 'contactos'].includes(key)) return 'Información y cuenta'
  return 'Gestión'
}

function ModuleCard({ mod, onOpen, favorite, onToggleFavorite, compact = false }) {
  const Icon = mod.icon
  return (
    <div style={{ display:'flex', alignItems:'stretch', background:'var(--surface)', borderRadius:10, marginBottom:'0.65rem', overflow:'hidden' }}>
      <button
        type="button"
        onClick={() => onOpen(mod.key)}
        style={{
          minHeight:compact ? 56 : 64, flex:1, display:'flex', alignItems:'center', gap:'0.8rem',
          background:'none', padding:compact ? '0.65rem 0.35rem 0.65rem 0.75rem' : '0.85rem 0.35rem 0.85rem 0.85rem',
          border:'none', textAlign:'left', cursor:'pointer',
        }}>
        <span style={{
          width:36, height:36, borderRadius:8, flexShrink:0, background:'rgba(57,255,20,0.1)', color:'var(--phosphor)',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}><Icon size={18} aria-hidden="true" /></span>
        <span style={{ flex:1, minWidth:0 }}>
          <span style={{ display:'block', color:'var(--text)', fontWeight:700, fontSize:'0.9rem' }}>{mod.label}</span>
          {!compact && <span style={{ display:'block', color:'var(--text-dim)', fontSize:'0.75rem', lineHeight:1.35, marginTop:3 }}>{mod.sub}</span>}
        </span>
        <ChevronRight size={18} aria-hidden="true" style={{ color:'var(--text-dim)', flexShrink:0 }} />
      </button>
      <button
        type="button"
        onClick={() => onToggleFavorite(mod.key)}
        aria-label={`${favorite ? 'Quitar' : 'Agregar'} ${mod.label} ${favorite ? 'de' : 'a'} favoritos`}
        aria-pressed={favorite}
        style={{ width:52, minWidth:52, border:'none', borderLeft:'1px solid var(--line)', background:'none', color:favorite ? '#FBBF24' : 'var(--text-dim)', cursor:'pointer', display:'grid', placeItems:'center' }}>
        <Star size={20} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
    </div>
  )
}

export default function MobileMas({ initialModule = null, userId = null, focusContext = null, onCreateNovedad = null }) {
  const { rol, perfil } = useAuth()
  const [active, setActive] = useState(initialModule)
  useBackHandler(() => setActive(null), !!active)

  const visibleModules = useMemo(() => MODULES.filter(mod =>
    canAccessView(rol, mod.view, perfil) &&
    (mod.key !== 'checklist' || rol !== 'consultor') &&
    (rol !== 'mnt_editor' || ['mantenimiento', 'actualizaciones', 'contactos'].includes(mod.key))
  ), [rol, perfil])
  const allowedKeys = useMemo(() => visibleModules.map(mod => mod.key), [visibleModules])
  const [shortcuts, setShortcuts] = useState(() => loadMobileShortcuts(userId, allowedKeys))

  useEffect(() => {
    saveMobileShortcuts(userId, shortcuts)
  }, [userId, shortcuts])

  const favoriteModules = shortcuts.favorites.map(key => visibleModules.find(mod => mod.key === key)).filter(Boolean)
  const recentModules = shortcuts.recents
    .filter(key => !shortcuts.favorites.includes(key))
    .map(key => visibleModules.find(mod => mod.key === key))
    .filter(Boolean)

  const openModule = key => {
    setShortcuts(current => recordMobileRecent(current, key))
    setActive(key)
  }
  const toggleFavorite = key => setShortcuts(current => toggleMobileFavorite(current, key))

  if (active) {
    const mod = visibleModules.find(item => item.key === active)
    if (!mod) {
      return (
        <div className="mobile-scroll" style={{ padding:'1.25rem 1rem 1rem', height:'100%' }}>
          <button type="button" onClick={() => setActive(null)} style={{ background:'none', border:'none', color:'var(--phosphor)', fontSize:'0.85rem', fontWeight:600, padding:'0 0.5rem', marginBottom:'1rem', minHeight:44 }}>
            ← Más
          </button>
          <p style={{ color:'var(--text-dim)', fontSize:'0.85rem' }}>Sin acceso a este módulo.</p>
        </div>
      )
    }
    return (
      <div style={{ height:'100%', display:'flex', flexDirection:'column', minHeight:0 }}>
        <button type="button" onClick={() => setActive(null)} style={{ display:'flex', alignItems:'center', gap:4, background:'none', border:'none', color:'var(--phosphor)', fontSize:'0.85rem', fontWeight:600, padding:'0.35rem 1rem 0', minHeight:48, flexShrink:0 }}>
          <ChevronLeft size={17} aria-hidden="true" /> Más
        </button>
        <div style={{ flex:1, minHeight:0 }}>
          <Suspense fallback={<div style={{ minHeight:160, display:'grid', placeItems:'center', color:'var(--text-dim)', fontSize:'.8rem' }}>Cargando módulo…</div>}>
          {mod.key === 'calidad' && <MobileCapa />}
          {mod.key === 'auditorias' && <div className="mobile-scroll" style={{ height:'100%', overflowY:'auto', padding:'1rem' }}><AuditoriasInternas /></div>}
          {mod.key === 'personal' && <MobilePersonal focusContext={focusContext} onCreateNovedad={onCreateNovedad} />}
          {mod.key === 'mantenimiento' && <MobileMantenimiento focusContext={focusContext} onCreateNovedad={onCreateNovedad} />}
          {mod.key === 'indicadores' && <MobileIndicadores />}
          {mod.key === 'flota' && <MobileFlota focusContext={focusContext} onCreateNovedad={onCreateNovedad} />}
          {mod.key === 'tablon' && <MobileTablon />}
          {mod.key === 'actualizaciones' && <MobileActualizaciones />}
          {mod.key === 'contactos' && <MobileContactos />}
          {mod.key === 'escalamientos' && <MobileEscalamientos />}
          {mod.key === 'checklist' && <MobileChecklist onBack={() => setActive(null)} />}
          {mod.key === 'compras' && <MobileRequerimientos />}
          </Suspense>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-scroll" style={{ padding:'1.25rem 1rem 1rem', height:'100%' }}>
      <h1 style={{ color:'var(--text)', fontSize:'1.3rem', fontWeight:700, marginBottom:'0.25rem' }}>Más</h1>
      <p style={{ color:'var(--text-dim)', fontSize:'0.8rem', lineHeight:1.45, marginBottom:'1rem' }}>Accesos adicionales organizados según tu tarea.</p>
      {visibleModules.length === 0 ? (
        <p style={{ color:'var(--text-dim)', fontSize:'0.85rem' }}>No hay módulos adicionales para tu rol.</p>
      ) : (
        <>
          <section aria-labelledby="mobile-more-favorites">
            <h2 id="mobile-more-favorites" style={{ color:'#FBBF24', fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 0.55rem' }}>Favoritos</h2>
            {favoriteModules.length ? favoriteModules.map(mod => (
              <ModuleCard key={`favorite-${mod.key}`} mod={mod} onOpen={openModule} favorite onToggleFavorite={toggleFavorite} compact />
            )) : (
              <p style={{ color:'var(--text-dim)', fontSize:'0.78rem', lineHeight:1.45, background:'var(--surface)', borderRadius:10, padding:'0.85rem', marginBottom:'0.85rem' }}>
                Tocá la estrella de un módulo para tenerlo siempre a mano.
              </p>
            )}
          </section>

          {recentModules.length > 0 && (
            <section aria-labelledby="mobile-more-recents">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.75rem', margin:'1rem 0 0.55rem' }}>
                <h2 id="mobile-more-recents" style={{ color:'var(--text-dim)', fontSize:'0.75rem', textTransform:'uppercase', letterSpacing:'0.08em' }}>Recientes</h2>
                <button type="button" onClick={() => setShortcuts(current => clearMobileRecents(current))} className="btn-ghost" style={{ minHeight:44, padding:'0.45rem 0.7rem', fontSize:'0.75rem' }}>
                  Limpiar recientes
                </button>
              </div>
              {recentModules.map(mod => (
                <ModuleCard key={`recent-${mod.key}`} mod={mod} onOpen={openModule} favorite={false} onToggleFavorite={toggleFavorite} compact />
              ))}
            </section>
          )}

          {MODULE_GROUPS.map(group => {
            const modules = visibleModules.filter(mod => moduleGroup(mod.key) === group)
            if (!modules.length) return null
            const headingId = `mobile-more-${group.replace(/\s+/g, '-').toLowerCase()}`
            return (
              <section key={group} aria-labelledby={headingId}>
                <h2 id={headingId} style={{ color:'var(--phosphor)', fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.08em', margin:'1.15rem 0 0.55rem' }}>{group}</h2>
                {modules.map(mod => (
                  <ModuleCard key={mod.key} mod={mod} onOpen={openModule} favorite={shortcuts.favorites.includes(mod.key)} onToggleFavorite={toggleFavorite} />
                ))}
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}
