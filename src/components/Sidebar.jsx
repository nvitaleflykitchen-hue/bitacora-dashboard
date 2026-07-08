import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import PushNotificationControl from './PushNotificationControl'
import NotificationCenter from './NotificationCenter'
import { getNavSection, getPrimaryNav, isQualityOnlyProfile } from '../lib/access'
import {
  LayoutDashboard, Building2, AlertTriangle,
  Wrench, Users, Menu, X, LogOut, KeyRound,
  Users2, ShoppingCart, Shield, ClipboardCheck, Megaphone, Plus, Truck,
} from 'lucide-react'

function SectionLabel({ children }) {
  return (
    <div className="px-3 pt-4 pb-1">
      <span className="font-metric text-xs tracking-widest"
        style={{ color:'rgba(57,255,20,0.35)', fontSize:'0.58rem', letterSpacing:'0.12em' }}>
        {children}
      </span>
    </div>
  )
}

function NavItem({ id, label, icon: Icon, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`nav-item w-full text-left ${active ? 'active' : ''}`}
    >
      <Icon size={13} style={{ flexShrink:0 }} />
      <span>{label}</span>
    </button>
  )
}

function ChangePasswordModal({ onClose }) {
  const [newPw, setNewPw]     = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [ok, setOk]           = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (newPw.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (newPw !== confirm) return setError('Las contraseñas no coinciden.')
    setLoading(true); setError(null)
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPw })
      if (err) throw err
      setOk(true)
      setTimeout(onClose, 1800)
    } catch (err) {
      setError(err.message || 'Error al cambiar la contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex:60 }}>
      <div className="glass fade-in w-full max-w-sm"
        style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.15)', borderRadius:4, padding:'1.5rem' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <KeyRound size={14} style={{ color:'var(--phosphor)' }} />
            <h2 className="font-title font-bold" style={{ color:'var(--text)', fontSize:'0.9rem' }}>
              Cambiar Contraseña
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding:'0.2rem 0.4rem' }}>
            <X size={13} />
          </button>
        </div>
        {ok ? (
          <div className="text-center py-4">
            <p style={{ color:'var(--phosphor)', fontSize:'0.82rem' }}>✓ Contraseña actualizada</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="font-metric block mb-1" style={{ color:'var(--text-dim)', fontSize:'0.65rem' }}>
                NUEVA CONTRASEÑA
              </label>
              <input type="password" className="input-dark w-full" placeholder="Mínimo 6 caracteres"
                value={newPw} onChange={e => setNewPw(e.target.value)} />
            </div>
            <div>
              <label className="font-metric block mb-1" style={{ color:'var(--text-dim)', fontSize:'0.65rem' }}>
                CONFIRMAR CONTRASEÑA
              </label>
              <input type="password" className="input-dark w-full" placeholder="Repetí la contraseña"
                value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            {error && (
              <p style={{ color:'var(--alert)', fontSize:'0.68rem' }}>{error}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading ? 'Guardando...' : 'Cambiar'}
              </button>
              <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function Sidebar({ activeView, onNavigate, onNuevoReporte }) {
  const { perfil, rol, isAdmin, signOut } = useAuth()
  const isQualityOnly = isQualityOnlyProfile(perfil)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showPwModal, setShowPwModal] = useState(false)

  const nav = (id) => { onNavigate(id); setMobileOpen(false) }
  const abrirReporte = () => { onNuevoReporte(); setMobileOpen(false) }
  const iconByName = {
    home: LayoutDashboard,
    announcement: Megaphone,
    pending: ClipboardCheck,
    sites: Building2,
    purchases: ShoppingCart,
    maintenance: Wrench,
    fleet: Truck,
    quality: Shield,
    team: Users2,
  }
  const primaryNav = getPrimaryNav(rol, perfil)
  const activeSection = getNavSection(activeView)

  const sidebarContent = (
    <div className="flex flex-col h-full" style={{ background:'var(--surface)' }}>
      {/* Header */}
      <div className="px-4 py-4" style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
        <p className="font-title font-bold text-sm" style={{ color:'var(--phosphor)', lineHeight:1.2 }}>
          Bitácora
        </p>
        <p className="font-metric" style={{ fontSize:'0.58rem', color:'rgba(57,255,20,0.45)', letterSpacing:'0.08em' }}>
          IN SITU · FK
        </p>
      </div>

      {/* Nuevo Reporte — acceso directo de escritorio (antes solo disponible angostando la ventana) */}
      {onNuevoReporte && (
        <div className="px-2 pt-3">
          <button onClick={abrirReporte} className="w-full" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            background: 'var(--phosphor)', color: '#0A0A0E', border: 'none', borderRadius: 6,
            padding: '0.55rem 0', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
          }}>
            <Plus size={14} /> Nuevo Reporte
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">

        <SectionLabel>MI TRABAJO</SectionLabel>
        {primaryNav.map(item => (
          <NavItem
            key={item.id}
            id={item.id}
            label={item.label}
            icon={iconByName[item.icon] || AlertTriangle}
            active={activeSection === item.id}
            onClick={nav}
          />
        ))}

        {isAdmin && (
          <>
            <SectionLabel>ADMIN</SectionLabel>
            <NavItem id="usuarios"  label="Usuarios"     icon={Users}  active={activeView==='usuarios'}  onClick={nav} />
            <NavItem id="auditoria" label="Trazabilidad" icon={Shield} active={activeView==='auditoria'} onClick={nav} />
          </>
        )}

      </nav>

      {/* Footer */}
      <div style={{ borderTop:'1px solid rgba(57,255,20,0.08)', padding:'0.75rem 1rem' }}>
        {showPwModal && <ChangePasswordModal onClose={() => setShowPwModal(false)} />}
        <div className="flex items-center justify-between">
          <button onClick={() => setShowPwModal(true)} className="min-w-0 text-left"
            style={{ background:'none', border:'none', cursor:'pointer', padding:0 }}
            title="Cambiar contraseña">
            <p className="text-xs font-medium truncate" style={{ color:'var(--text)' }}>
              {perfil?.nombre || '—'}
            </p>
            <p className="font-metric" style={{ fontSize:'0.6rem', color:'var(--phosphor)', opacity:0.7 }}>
              {rol} · cambiar contraseña
            </p>
          </button>
          <div className="flex items-center gap-1 ml-2">
            {!isQualityOnly && <NotificationCenter onNavigate={onNavigate}/>}
            {!isQualityOnly && <PushNotificationControl compact />}
            <button onClick={() => setShowPwModal(true)} title="Cambiar contraseña"
              className="btn-ghost" style={{ padding:'0.3rem' }}>
              <KeyRound size={12} />
            </button>
            <button onClick={signOut} title="Cerrar sesion"
              className="btn-ghost" style={{ padding:'0.3rem' }}>
              <LogOut size={13} />
            </button>
          </div>
        </div>
        <p className="font-metric mt-1.5" style={{ fontSize:'0.52rem', color:'rgba(57,255,20,0.2)', letterSpacing:'0.1em' }}>
          v2.0 · KITCHEN-OS
        </p>
      </div>
    </div>
  )

  return (
    <>
      <button
        onClick={() => setMobileOpen(o => !o)}
        className="md:hidden fixed top-3 left-3 z-40 p-2 rounded"
        style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.2)' }}>
        {mobileOpen ? <X size={16} style={{ color:'var(--phosphor)' }} /> : <Menu size={16} style={{ color:'var(--phosphor)' }} />}
      </button>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/60" onClick={() => setMobileOpen(false)} />
      )}

      <aside className="hidden md:flex flex-col w-52 flex-shrink-0">
        {sidebarContent}
      </aside>

      <aside className={`md:hidden fixed top-0 left-0 h-full w-52 z-40 flex flex-col
        transform transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </aside>
    </>
  )
}
