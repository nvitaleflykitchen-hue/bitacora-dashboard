import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, X, RefreshCw, Bell, ChevronRight } from 'lucide-react'
import { getAlertas, autoEscalarTickets } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { canAccessView, isComprasOnlyProfile, isQualityOnlyProfile } from '../lib/access'
import usePersistedState from '../hooks/usePersistedState'
import { groupOperationalAlerts } from '../lib/alertGroups'

const NIVEL_STYLE = {
  critico:     { bg: 'rgba(255,42,42,0.08)',  border: 'rgba(255,42,42,0.35)',  color: '#ff5050', dot: '#ff2a2a' },
  advertencia: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.35)', color: '#f59e0b', dot: '#f59e0b' },
  info:        { bg: 'rgba(80,180,255,0.08)', border: 'rgba(80,180,255,0.25)', color: '#50b4ff', dot: '#50b4ff' },
}

const REFRESH_MS = 5 * 60 * 1000 // 5 minutos

export default function AlertaBanner({ onNavigate }) {
  const { rol, perfil } = useAuth()
  const isQualityOnly = isQualityOnlyProfile(perfil)
  const isComprasOnly = isComprasOnlyProfile(perfil)
  const [alertas, setAlertas]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [dismissed, setDismissed]       = useState([])  // ids descartados en esta sesión
  const [lastRefresh, setLastRefresh]   = useState(null)
  const [collapsed, setCollapsed]       = usePersistedState(`alertas.colapsadas.${perfil?.id || rol || 'usuario'}`, true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const data = await getAlertas()
    setAlertas(data)
    setLastRefresh(new Date())
    setLoading(false)
    // Auto-escalate critical unassigned tickets on first load
    if (!isQualityOnly && !isComprasOnly) autoEscalarTickets().catch(() => {})
  }, [isQualityOnly, isComprasOnly])

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, REFRESH_MS)
    return () => clearInterval(t)
  }, [cargar])

  const visibles = alertas.filter(a => !dismissed.includes(a.id) && canAccessView(rol, a.navegarA, perfil))
  const criticas = visibles.filter(a => a.nivel === 'critico')
  const advertencias = visibles.filter(a => a.nivel === 'advertencia')
  const informativas = visibles.filter(a => a.nivel === 'info')
  const grupos = groupOperationalAlerts(visibles)

  // Si no hay nada que mostrar, no renderizar
  if (!loading && visibles.length === 0) return null

  // Banner colapsado — solo mostrar conteo de críticas
  if (collapsed) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          background: criticas.length > 0 ? 'rgba(255,42,42,0.08)' : 'rgba(245,158,11,0.06)',
          borderBottom: `1px solid ${criticas.length > 0 ? 'rgba(255,42,42,0.2)' : 'rgba(245,158,11,0.2)'}`,
          padding: '0.25rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexShrink: 0,
        }}
      >
        <Bell size={11} style={{ color: criticas.length > 0 ? '#ff5050' : '#f59e0b' }} />
        <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: criticas.length > 0 ? '#ff5050' : '#f59e0b', letterSpacing: '0.06em' }}>
          {loading ? 'ACTUALIZANDO...' : `${visibles.length} ALERTA${visibles.length > 1 ? 'S' : ''} ACTIVA${visibles.length > 1 ? 'S' : ''}`}
        </span>
        {!loading && criticas.length > 0 && <span style={{ fontSize:'0.58rem', color:'#ff5050' }}>{criticas.length} crítica{criticas.length !== 1 ? 's' : ''}</span>}
        {!loading && advertencias.length > 0 && <span style={{ fontSize:'0.58rem', color:'#f59e0b' }}>{advertencias.length} aviso{advertencias.length !== 1 ? 's' : ''}</span>}
        {!loading && informativas.length > 0 && <span style={{ fontSize:'0.58rem', color:'#50b4ff' }}>{informativas.length} informativa{informativas.length !== 1 ? 's' : ''}</span>}
        <button type="button" onClick={() => setCollapsed(false)} aria-expanded="false" style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4, background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'0.6rem' }}>
          Ver alertas <ChevronRight size={10}/>
        </button>
      </div>
    )
  }

  return (
    <div role="region" aria-label="Alertas operativas" aria-busy={loading} style={{
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
          grupos.map(grupo => {
            const s = NIVEL_STYLE[grupo.nivel] || NIVEL_STYLE.info
            return (
              <button
                key={grupo.id}
                onClick={() => onNavigate?.(grupo.navegarA)}
                title={grupo.items.map(item => item.mensaje).join(' · ')}
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
                  animation: grupo.nivel === 'critico' ? 'pulse-green 1.5s infinite' : 'none',
                }} />
                <span style={{
                  fontFamily: 'Roboto Mono, monospace',
                  fontSize: '0.6rem',
                  color: s.color,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}>
                  {grupo.label} · {grupo.total}
                </span>
                {grupo.items.length > 1 && <span style={{ fontSize:'0.54rem', color:s.color, opacity:.7 }}>{grupo.items.length} tipos</span>}
                <ChevronRight size={8} style={{ color: s.color, opacity: 0.6 }} />
              </button>
            )
          })
        )}
      </div>

      {/* Controles derecha */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
        {lastRefresh && (
          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'rgba(107,114,128,0.5)', letterSpacing: '0.04em' }}>
            {lastRefresh.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button
          onClick={cargar}
          disabled={loading}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', color: 'var(--text-dim)', opacity: loading ? 0.4 : 0.7 }}
          title="Actualizar alertas"
          aria-label="Actualizar alertas"
        >
          <RefreshCw size={10} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
        <button
          onClick={() => setCollapsed(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', color: 'var(--text-dim)', opacity: 0.7 }}
          title="Minimizar"
          aria-label="Minimizar alertas"
        >
          <X size={11} />
        </button>
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}
