import ReleaseNotes from '../components/ReleaseNotes'
import { APP_NAME, APP_VERSION } from '../data/releases'

export default function Actualizaciones() {
  return (
    <div style={{ padding: '1.5rem 2rem', height: '100%', overflowY: 'auto' }}>
      <header style={{ marginBottom: '1.25rem' }}>
        <p className="font-metric" style={{ color: 'var(--phosphor)', fontSize: '0.66rem', letterSpacing: '0.1em' }}>{APP_NAME.toUpperCase()} · VERSIÓN ACTUAL {APP_VERSION}</p>
        <h1 className="font-title" style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.4rem', marginTop: 4 }}>Actualizaciones del sistema</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: 6 }}>Cambios de producto, funciones nuevas e instrucciones de uso. Los avisos operativos se publican por separado en el Tablón.</p>
      </header>
      <ReleaseNotes />
    </div>
  )
}
