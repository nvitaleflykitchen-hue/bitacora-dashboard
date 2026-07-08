import { useRef, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'

// Pull-to-refresh global: envuelve el contenido de la pestaña activa en
// MobileApp. Al tirar hacia abajo desde el tope, remonta la vista (todas
// las vistas mobile recargan sus datos al montarse).
const UMBRAL = 70

export default function PullToRefresh({ onRefresh, children }) {
  const startY = useRef(null)
  const pulling = useRef(false)
  const [delta, setDelta] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const scrollTopOf = el => {
    // busca el contenedor scrolleable más cercano hacia arriba
    let n = el
    while (n && n !== document.body) {
      if (n.scrollHeight > n.clientHeight + 2) return n.scrollTop
      n = n.parentElement
    }
    return 0
  }

  const onTouchStart = useCallback(e => {
    if (refreshing) return
    if (scrollTopOf(e.target) > 0) { startY.current = null; return }
    startY.current = e.touches[0].clientY
    pulling.current = false
  }, [refreshing])

  const onTouchMove = useCallback(e => {
    if (startY.current === null || refreshing) return
    const d = e.touches[0].clientY - startY.current
    if (d > 8) {
      pulling.current = true
      setDelta(Math.min(d, UMBRAL * 1.6))
    }
  }, [refreshing])

  const onTouchEnd = useCallback(() => {
    if (pulling.current && delta >= UMBRAL) {
      setRefreshing(true)
      Promise.resolve(onRefresh?.()).finally(() => {
        setTimeout(() => { setRefreshing(false); setDelta(0) }, 350)
      })
    } else {
      setDelta(0)
    }
    startY.current = null
    pulling.current = false
  }, [delta, onRefresh])

  const visible = delta > 12 || refreshing
  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {visible && (
        <div style={{
          position: 'absolute', top: 6, left: 0, right: 0, display: 'flex', justifyContent: 'center',
          zIndex: 30, pointerEvents: 'none',
        }}>
          <span style={{
            background: 'var(--surface)', border: '1px solid rgba(57,255,20,0.25)', borderRadius: 20,
            padding: '0.3rem 0.7rem', display: 'flex', alignItems: 'center', gap: 6,
            color: 'var(--phosphor)', fontSize: '0.62rem', fontWeight: 700,
          }}>
            <RefreshCw size={11} style={{
              transform: refreshing ? undefined : `rotate(${delta * 3}deg)`,
              animation: refreshing ? 'spin 0.8s linear infinite' : undefined,
            }} />
            {refreshing ? 'Actualizando...' : delta >= UMBRAL ? 'Soltá para actualizar' : 'Tirá para actualizar'}
          </span>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}
