import { useState } from 'react'
import MobileHome from './MobileHome'
import MobileReporte from './MobileReporte'
import MobileTareas from './MobileTareas'
import MobileSedes from './MobileSedes'
import MobileEscalamientos from './MobileEscalamientos'
import MobileChecklist from './MobileChecklist'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import PushNotificationControl from '../components/PushNotificationControl'
import NotificationCenter from '../components/NotificationCenter'

const NAV = [
  { key: 'home',          label: 'Inicio',    icon: '⌂' },
  { key: 'tareas',        label: 'Tareas',    icon: '✓' },
  { key: 'sedes',         label: 'Sedes',     icon: '⊞' },
  { key: 'escalamientos', label: 'Escalam.',  icon: '⚠' },
  { key: 'checklist',     label: 'Checklist', icon: '☑' },
  { key: 'perfil',        label: 'Perfil',    icon: '◎' },
]

export default function MobileApp() {
  const { perfil, rol, can } = useAuth()
  const canReport = can('bitacora', 'report') || ['admin','editor','grupo','encargado'].includes(rol)
  const canUseChecklist = rol !== 'consultor'
  const [tab, setTab] = useState('home')
  const [screen, setScreen] = useState('main') // 'main' | 'reporte' | 'checklist'

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
          onBack={() => setScreen('main')}
          onSuccess={() => { setScreen('main'); setTab('home') }}
        />
      )
    }
    if (tab === 'home')          return <MobileHome onNuevoReporte={canReport ? () => setScreen('reporte') : null} />
    if (tab === 'tareas')        return <MobileTareas />
    if (tab === 'sedes')         return <MobileSedes />
    if (tab === 'escalamientos') return <MobileEscalamientos />
    if (tab === 'checklist')     return <MobileChecklist onBack={() => setTab('home')} />
    if (tab === 'perfil')        return <MobilePerfil perfil={perfil} onLogout={handleLogout} />
    return null
  }

  return (
    <div style={{
      width: '100vw', height: '100dvh',
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* FK header strip */}
      <div style={{
        padding: '0.6rem 1rem',
        background: 'var(--surface)',
        borderBottom: '1px solid rgba(57,255,20,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#F97316', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.02em' }}>FLY</span>
          <span style={{ color: 'var(--text)', fontWeight: 800, fontSize: '0.85rem' }}>KITCHEN</span>
          <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem', marginLeft: 4 }}>· Bitacora In Situ</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <NotificationCenter />
          <span style={{
            background: 'rgba(57,255,20,0.1)', color: 'var(--phosphor)',
            fontSize: '0.6rem', padding: '0.15rem 0.4rem', borderRadius: 3,
            fontWeight: 700, letterSpacing: '0.06em'
          }}>
            {perfil?.rol?.toUpperCase() || 'FK'}
          </span>
          {/* Boton reporte rapido en header */}
          {screen === 'main' && canReport && (
            <button onClick={() => setScreen('reporte')}
              style={{
                background: 'var(--phosphor)', color: '#0A0A0E',
                border: 'none', borderRadius: 6, cursor: 'pointer',
                fontSize: '0.65rem', fontWeight: 800, padding: '0.3rem 0.6rem'
              }}>
              + Reporte
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {renderContent()}
      </div>

      {/* Bottom nav */}
      {screen === 'main' && (
        <nav style={{
          background: 'var(--surface)',
          borderTop: '1px solid rgba(57,255,20,0.1)',
          display: 'flex',
          padding: '0.4rem 0 calc(0.4rem + env(safe-area-inset-bottom))',
        }}>
          {NAV.filter(n => canUseChecklist || n.key !== 'checklist').map(n => (
            <button key={n.key} onClick={() => setTab(n.key)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '0.15rem', background: 'none', border: 'none', cursor: 'pointer',
                padding: '0.35rem 0',
              }}>
              <span style={{
                fontSize: '1rem', lineHeight: 1,
                color: tab === n.key ? (n.key === 'escalamientos' ? '#F97316' : 'var(--phosphor)') : 'var(--text-dim)',
                transition: 'color 0.15s'
              }}>{n.icon}</span>
              <span style={{
                fontSize: '0.55rem', letterSpacing: '0.03em',
                color: tab === n.key ? (n.key === 'escalamientos' ? '#F97316' : 'var(--phosphor)') : 'var(--text-dim)',
                fontWeight: tab === n.key ? 700 : 400,
              }}>{n.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}

function MobilePerfil({ perfil, onLogout }) {
  return (
    <div style={{ padding: '1.5rem 1rem', overflowY: 'auto', height: '100%' }}>
      <h1 style={{ color: 'var(--text)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Mi Perfil</h1>

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
      </div>

      <div style={{ marginBottom:'1rem' }}>
        <PushNotificationControl />
      </div>

      <button onClick={onLogout}
        style={{
          width: '100%', padding: '0.9rem', borderRadius: 8,
          background: 'rgba(255,42,42,0.1)', color: '#FF2A2A',
          fontWeight: 600, fontSize: '0.9rem', border: '1px solid rgba(255,42,42,0.2)',
          cursor: 'pointer'
        }}>
        Cerrar Sesion
      </button>
    </div>
  )
}
