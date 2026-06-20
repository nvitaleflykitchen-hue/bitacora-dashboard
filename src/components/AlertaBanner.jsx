import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, X, RefreshCw, Bell, ChevronRight } from 'lucide-react'
import { getAlertas, autoEscalarTickets } from '../lib/queries'

const NIVEL_STYLE = {
  critico:     { bg: 'rgba(255,42,42,0.08)',  border: 'rgba(255,42,42,0.35)',  color: '#ff5050', dot: '#ff2a2a' },
  advertencia: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.35)', color: '#f59e0b', dot: '#f59e0b' },
  info:        { bg: 'rgba(80,180,255,0.08)', border: 'rgba(80,180,255,0.25)', color: '#50b4ff', dot: '#50b4ff' },
}

const REFRESH_MS = 5 * 60 * 1000 // 5 minutos

export default function AlertaBanner({ onNavigate }) {
  const [alertas, setAlertas]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [dismissed, setDismissed]       = useState([])  // ids descartados en esta sesión
  const [lastRefresh, setLastRefresh]   = useState(null)
  const [collapsed, setCollapsed]       = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const data = await getAlertas()
    setAlertas(data)
    setLastRefresh(new Date())
    setLoading(false)
    // Auto-escalate critical unassigned tickets on first load
    autoEscalarTickets().catch(() => {})
  }, [])

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, REFRESH_MS)
    return () => clearInterval(t)
  }, [cargar])

  const visibles = alertas.filter(a => !dismissed.includes(a.id))
  const criticas = visibles.filter(a => a.nivel === 'critico')

  // Si no hay nada que mostrar, no renderizar
  if (!loading && visibles.length === 0) return null

  // Banner colapsado — solo mostrar conteo de críticas
  if (collapsed) {
    return (
      <div
        style={{
          background: criticas.length > 0 ? 'rgba(255,42,42,0.08)' : 'rgba(245,158,11,0.06)',
          borderBottom: `1px solid ${criticas.length > 0 ? 'rgba(255,42,42,0.2)' : 'rgba(245,158,11,0.2)'}`,
          padding: '0.25rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        onClick={() => setCollapsed(false)}
      >
        <Bell size={11} style={{ color: criticas.length > 0 ? '#ff5050' : '#f59e0b' }} />
        <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: criticas.length > 0 ? '#ff5050' : '#f59e0b', letterSpacing: '0.06em' }}>
          {loading ? 'ACTUALIZANDO...' : `${visibles.length} ALERTA${visibles.length > 1 ? 'S' : ''} ACTIVA${visibles.length > 1 ? 'S' : ''}`}
        </span>
        <ChevronRight size={10} style={{ color: 'var(--text-dim)' }} />
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--surface)',
      borderBottom: '1px solid rgba(255,42,42,0.15)',
      padding: '0.4rem 0.75rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      flexShrink: 0,
      flexWrap: 'wrap',
      minHeight: '36px',
    }}>
      {/* Ícono */}
      <AlertTriangle size={12} style={{ color: criticas.length > 0 ? '#ff2a2a' : '#f59e0b', flexShrink: 0 }} />

      {/* Pills de alertas */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
        {loading && alertas.length === 0 ? (
          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'var(--text-dim)' }}>
            VERIFICANDO ALERTAS...
          </span>
        ) : (
          visibles.map(alerta => {
            const s = NIVEL_STYLE[alerta.nivel] || NIVEL_STYLE.info
            return (
              <button
                key={alerta.id}
                onClick={() => onNavigate?.(alerta.navegarA)}
                style={{
                  background: s.bg,
                  border: `1px solid ${s.border}`,
                  borderRadius: '2px',
                  padding: '0.15rem 0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <span style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  background: s.dot, flexShrink: 0,
                  boxShadow: `0 0 4px ${s.dot}`,
                  animation: alerta.nivel === 'critico' ? 'pulse-green 1.5s infinite' : 'none',
                }} />
                <span style={{
                  fontFamily: 'Roboto Mono, monospace',
                  fontSize: '0.6rem',
                  color: s.color,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}>
                  {alerta.mensaje}
                </span>
                <ChevronRight size={8} style={{ color: s.color, opacity: 0.6 }} />
              </button>
            )
          })
        )}
      </div>

      {/* Controles derecha */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
        {lastRefresh && (
          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.52rem', color: 'rgba(107,114,128,0.5)', letterSpacing: '0.04em' }}>
            {lastRefresh.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button
          onClick={cargar}
          disabled={loading}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', color: 'var(--text-dim)', opacity: loading ? 0.4 : 0.7 }}
          title="Actualizar alertas"
        >
          <RefreshCw size={10} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
        <button
          onClick={() => setCollapsed(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', color: 'var(--text-dim)', opacity: 0.7 }}
          title="Minimizar"
        >
          <X size={11} />
        </button>
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}
