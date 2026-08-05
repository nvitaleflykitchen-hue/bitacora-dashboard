import { useState } from 'react'
import { ClipboardCheck, ClipboardList, Users, Wrench, BarChart3, Megaphone, Phone, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'
import MobileCapa from './MobileCapa'
import MobilePersonal from './MobilePersonal'
import MobileMantenimiento from './MobileMantenimiento'
import MobileIndicadores from './MobileIndicadores'
import MobileTablon from './MobileTablon'
import MobileContactos from './MobileContactos'
import MobileActualizaciones from './MobileActualizaciones'
import MobileEscalamientos from './MobileEscalamientos'
import MobileChecklist from './MobileChecklist'
import MobileRequerimientos from './MobileRequerimientos'
import { useAuth } from '../lib/auth'
import { canAccessView } from '../lib/access'
import MobileFlota from './MobileFlota'
import { useBackHandler } from '../lib/backStack'
import AuditoriasInternas from '../views/AuditoriasInternas'

const MODULES = [
  { key:'escalamientos', label:'Escalamientos', sub:'Casos que requieren seguimiento', icon:ClipboardCheck, ready:true, view:'escalamientos', group:'Trabajo diario' },
  { key:'checklist', label:'Checklist', sub:'Controles operativos de la sede', icon:ClipboardList, ready:true, view:'inicio', group:'Trabajo diario' },
  { key:'compras', label:'Compras', sub:'Requerimientos y seguimiento', icon:ClipboardList, ready:true, view:'requerimientos', group:'Trabajo diario' },
  { key: 'calidad',       label: 'Calidad',       sub: 'CAPA / No Conformidades',         icon: ClipboardList, ready: true,  view: 'calidadHub' },
  { key: 'auditorias',    label: 'Auditorías internas', sub: 'Relevamiento, fotos y hallazgos', icon: ClipboardCheck, ready: true, view: 'calidadHub' },
  { key: 'personal',      label: 'Personal',      sub: 'Equipo / RRHH',                    icon: Users,         ready: true,  view: 'equipo' },
  { key: 'mantenimiento', label: 'Mantenimiento', sub: 'Activos, insumos, matafuegos',     icon: Wrench,        ready: true,  view: 'mantenimientoHub' },
  { key: 'indicadores',   label: 'Indicadores',   sub: 'Dashboard / Calendario',           icon: BarChart3,     ready: true,  view: 'calendario' },
  { key: 'flota',         label: 'Flota',         sub: 'Vehículos y documentación',        icon: Wrench,        ready: true,  view: 'flotaHub' },
  { key: 'tablon',        label: 'Tablón',        sub: 'Anuncios operativos',               icon: Megaphone,     ready: true,  view: 'tablon' },
  { key: 'actualizaciones', label: 'Actualizaciones', sub: 'Versiones y nuevas funciones',  icon: Sparkles,      ready: true,  view: 'actualizaciones' },
  { key: 'contactos',     label: 'Directorio',    sub: 'Teléfonos importantes',            icon: Phone,         ready: true,  view: 'inicio' },
]

const MODULE_GROUPS = ['Trabajo diario', 'Gestión', 'Información']
const moduleGroup = key => {
  if (['escalamientos','checklist','compras'].includes(key)) return 'Trabajo diario'
  if (['tablon','actualizaciones','contactos'].includes(key)) return 'Información'
  return 'Gestión'
}

function ModuleCard({ mod, onOpen }) {
  const Icon = mod.icon
  return (
    <button
      onClick={() => mod.ready && onOpen(mod.key)}
      disabled={!mod.ready}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '0.85rem',
        background: 'var(--surface)', borderRadius: 10, padding: '1rem',
        marginBottom: '0.75rem', border: 'none', textAlign: 'left',
        opacity: mod.ready ? 1 : 0.55, cursor: mod.ready ? 'pointer' : 'default',
      }}>
      <div style={{
        width: 38, height: 38, borderRadius: 8, flexShrink: 0,
        background: 'rgba(57,255,20,0.1)', color: 'var(--phosphor)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.85rem' }}>{mod.label}</p>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem', marginTop: 2 }}>{mod.sub}</p>
      </div>
      {mod.ready ? (
        <ChevronRight size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
      ) : (
        <span style={{
          fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-dim)',
          background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.4rem', borderRadius: 6,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>Próximamente</span>
      )}
    </button>
  )
}

export default function MobileMas({ initialModule = null }) {
  const { rol, perfil } = useAuth()
  const [active, setActive] = useState(initialModule)
  useBackHandler(() => setActive(null), !!active)
  const visibleModules = MODULES.filter(m =>
    canAccessView(rol, m.view, perfil) &&
    (m.key !== 'checklist' || rol !== 'consultor') &&
    (rol !== 'mnt_editor' || ['mantenimiento', 'actualizaciones', 'contactos'].includes(m.key))
  )

  if (active) {
    const mod = visibleModules.find(m => m.key === active)
    if (!mod) {
      return (
        <div className="mobile-scroll" style={{ padding: '1.25rem 1rem 1rem', height: '100%' }}>
          <button
            onClick={() => setActive(null)}
            style={{ background: 'none', border: 'none', color: 'var(--phosphor)', fontSize: '0.75rem', fontWeight: 600, padding: 0, marginBottom: '1rem' }}>
            ← Más
          </button>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Sin acceso a este módulo.</p>
        </div>
      )
    }
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <button
          onClick={() => setActive(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
            color: 'var(--phosphor)', fontSize: '0.75rem', fontWeight: 600,
            padding: '0.75rem 1rem 0', flexShrink: 0,
          }}>
          <ChevronLeft size={15} /> Más
        </button>
        <div style={{ flex: 1, minHeight: 0 }}>
          {mod.key === 'calidad' && <MobileCapa />}
          {mod.key === 'auditorias' && <div className="mobile-scroll" style={{height:'100%',overflowY:'auto',padding:'1rem'}}><AuditoriasInternas /></div>}
          {mod.key === 'personal' && <MobilePersonal />}
          {mod.key === 'mantenimiento' && <MobileMantenimiento />}
          {mod.key === 'indicadores' && <MobileIndicadores />}
          {mod.key === 'flota' && <MobileFlota />}
          {mod.key === 'tablon' && <MobileTablon />}
          {mod.key === 'actualizaciones' && <MobileActualizaciones />}
          {mod.key === 'contactos' && <MobileContactos />}
          {mod.key === 'escalamientos' && <MobileEscalamientos />}
          {mod.key === 'checklist' && <MobileChecklist onBack={() => setActive(null)} />}
          {mod.key === 'compras' && <MobileRequerimientos />}
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-scroll" style={{ padding: '1.25rem 1rem 1rem', height: '100%' }}>
      <h1 style={{ color: 'var(--text)', fontSize: '1.3rem', fontWeight: 700, marginBottom: '1rem' }}>Más</h1>
      {visibleModules.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No hay módulos adicionales para tu rol.</p>
      ) : (
        MODULE_GROUPS.map(group => {
          const modules = visibleModules.filter(mod => moduleGroup(mod.key) === group)
          if (!modules.length) return null
          const headingId = `mobile-more-${group.replace(/\s+/g, '-').toLowerCase()}`
          return (
            <section key={group} aria-labelledby={headingId}>
              <h2 id={headingId} style={{ color:'var(--phosphor)', fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.08em', margin:'1rem 0 0.55rem' }}>{group}</h2>
              {modules.map(mod => <ModuleCard key={mod.key} mod={mod} onOpen={setActive} />)}
            </section>
          )
        })
      )}
    </div>
  )
}
