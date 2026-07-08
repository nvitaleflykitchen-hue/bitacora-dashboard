import { useState, useEffect } from 'react'
import { ClipboardCheck, Building2, ShoppingCart, Wrench, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { ROLE_LABELS } from '../lib/access'
import DashboardGlobal from './DashboardGlobal'
import SedeEncargadoView from './SedeEncargadoView'
import { getDirectorio } from '../lib/queries'

const MODULO_ORDER = ['rrhh', 'mantenimiento', 'flota', 'compras', 'calidad', 'emergencias']
const MODULO_LABEL = { rrhh:'RRHH', mantenimiento:'Mantenimiento', flota:'Flota', compras:'Compras', calidad:'Calidad', emergencias:'Emergencias' }

const ACTIONS = [
  { id:'pendientes', label:'Ver pendientes', help:'Lo que requiere atención', icon:ClipboardCheck },
  { id:'sedesHub', label:'Ir a sedes', help:'Estado y fichas de unidad', icon:Building2 },
  { id:'requerimientos', label:'Compras', help:'Solicitudes y seguimiento', icon:ShoppingCart },
  { id:'mantenimientoHub', label:'Mantenimiento', help:'Tickets, activos y preventivos', icon:Wrench },
]

// Íconos SVG compactos para los botones de acción
function IconPhone() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 11.5 19.79 19.79 0 010 2.82 2 2 0 011.77.64h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L5.91 8.09a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
    </svg>
  )
}
function IconWA() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  )
}

function ContactChip({ c }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'var(--surface)',
      border: '1px solid rgba(57,255,20,0.07)',
      borderRadius: 7, padding: '0.55rem 0.75rem',
      minWidth: 0,
    }}>
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>{c.icono}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {c.nombre}
        </p>
        <p style={{ color: 'var(--phosphor)', fontFamily: 'monospace', fontSize: '0.65rem', opacity: 0.75 }}>
          {c.telefono}
        </p>
      </div>
      {/* Botones de acción */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <a
          href={`tel:+${c.tel}`}
          title="Llamar"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 26, borderRadius: 5,
            background: 'rgba(57,255,20,0.1)',
            border: '1px solid rgba(57,255,20,0.2)',
            color: 'var(--phosphor)', textDecoration: 'none',
          }}
        >
          <IconPhone />
        </a>
        {c.wa && (
          <a
            href={`https://wa.me/${c.wa}`}
            target="_blank"
            rel="noopener noreferrer"
            title="WhatsApp"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 5,
              background: 'rgba(37,211,102,0.09)',
              border: '1px solid rgba(37,211,102,0.22)',
              color: '#25d366', textDecoration: 'none',
            }}
          >
            <IconWA />
          </a>
        )}
      </div>
    </div>
  )
}

function ContactosSection() {
  const [open, setOpen] = useState(true)
  const [allContactos, setAllContactos] = useState([])

  useEffect(() => {
    getDirectorio().then(data => setAllContactos(data || [])).catch(() => {})
  }, [])

  // Agrupar por módulo, solo módulos con datos
  const byModulo = {}
  for (const c of allContactos) {
    if (!byModulo[c.modulo]) byModulo[c.modulo] = []
    byModulo[c.modulo].push(c)
  }
  const sections = MODULO_ORDER.filter(k => byModulo[k]?.length > 0)

  if (sections.length === 0) return null

  return (
    <div className="px-4 md:px-6 pb-2">
      {/* Header colapsable */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '0.5rem 0', marginBottom: open ? '0.75rem' : 0, width: '100%',
        }}
      >
        <span style={{ color: 'var(--phosphor)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'var(--font-metric, monospace)' }}>
          📞 CONTACTOS RÁPIDOS
        </span>
        {open
          ? <ChevronUp size={12} style={{ color: 'var(--text-dim)', marginLeft: 'auto' }} />
          : <ChevronDown size={12} style={{ color: 'var(--text-dim)', marginLeft: 'auto' }} />
        }
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {sections.map(key => (
            <div key={key}>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.58rem', letterSpacing: '0.1em', fontFamily: 'var(--font-metric, monospace)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                {MODULO_LABEL[key] || key}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.4rem' }}>
                {byModulo[key].map(c => (
                  <ContactChip key={c.id || c.nombre} c={c} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function InicioRol({ onNavigate, onOpenSearch }) {
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
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="input-dark w-full mt-4 flex items-center gap-2 text-left"
            style={{ minHeight:42, color:'var(--text-dim)' }}
          >
            <Search size={15} style={{ color:'var(--phosphor)', flexShrink:0 }} />
            <span className="flex-1">Buscar en toda la aplicación...</span>
            <kbd className="hidden md:inline-block" style={{ fontSize:'0.62rem', opacity:0.65 }}>Ctrl K</kbd>
          </button>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4 mb-5">
          {ACTIONS.map(({ id, label, help, icon:Icon }) => (
            <button key={id} type="button" onClick={() => onNavigate(id)} className="glass rounded p-3 text-left">
              <Icon size={16} style={{ color:'var(--phosphor)' }} />
              <p className="text-sm font-semibold mt-2" style={{ color:'var(--text)' }}>{label}</p>
              <p className="text-xs mt-1" style={{ color:'var(--text-dim)' }}>{help}</p>
            </button>
          ))}
        </div>
      </section>
      <ContactosSection />
      <Dashboard onNavigate={onNavigate} />
    </div>
  )
}
