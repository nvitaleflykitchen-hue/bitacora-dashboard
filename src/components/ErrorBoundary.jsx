import { Component } from 'react'

// Barrera global de errores de render: sin esto, cualquier excepción en un
// componente deja la pantalla en blanco sin explicación. Montada en main.jsx.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', background: 'var(--abyss, #0A0A0E)', padding: '2rem', textAlign: 'center',
      }}>
        <p style={{ color: '#39FF14', fontFamily: 'monospace', fontSize: '2rem', marginBottom: '1rem' }}>⚠</p>
        <p style={{ color: '#E5E7EB', fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Algo salió mal en esta pantalla
        </p>
        <p style={{ color: '#A9B1BE', fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: 420, lineHeight: 1.6, marginBottom: '1.5rem' }}>
          El error quedó registrado en la consola. Recargá la página para seguir trabajando; si vuelve a pasar, avisá qué estabas haciendo.
        </p>
        <button onClick={() => window.location.reload()} style={{
          background: '#39FF14', color: '#0A0A0E', border: 'none', borderRadius: 3,
          padding: '0.7rem 1.5rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'monospace',
        }}>
          RECARGAR
        </button>
      </div>
    )
  }
}
