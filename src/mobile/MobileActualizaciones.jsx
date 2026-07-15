import ReleaseNotes from '../components/ReleaseNotes'
import { APP_NAME, APP_VERSION } from '../data/releases'

export default function MobileActualizaciones() {
  return (
    <div className="mobile-scroll" style={{ padding: '1rem', height: '100%' }}>
      <p className="font-metric" style={{ color: 'var(--phosphor)', fontSize: '0.62rem' }}>{APP_NAME.toUpperCase()} · V{APP_VERSION}</p>
      <h1 style={{ color: 'var(--text)', fontSize: '1.25rem', fontWeight: 800, margin: '4px 0 6px' }}>Actualizaciones</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginBottom: '1rem' }}>Nuevas funciones y cambios de uso. Los avisos operativos están en el Tablón.</p>
      <ReleaseNotes compact />
    </div>
  )
}
