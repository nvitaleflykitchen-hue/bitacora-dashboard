import { CalendarDays, Check, Image, Sparkles, Users, Wrench } from 'lucide-react'
import { RELEASES } from '../data/releases'

const SECTION_STYLE = {
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(57,255,20,0.08)',
  borderRadius: 6,
  padding: '0.9rem 1rem',
}

function Section({ icon: Icon, title, children }) {
  return (
    <section style={SECTION_STYLE}>
      <h3 style={{ color: 'var(--phosphor)', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.55rem' }}>
        <Icon size={13} /> {title}
      </h3>
      <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', lineHeight: 1.55 }}>{children}</div>
    </section>
  )
}

export function ReleaseCard({ release, compact = false }) {
  return (
    <article style={{ background: 'var(--surface)', border: '1px solid rgba(57,255,20,0.12)', borderRadius: 8, padding: compact ? '1rem' : '1.25rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <p className="font-metric" style={{ color: 'var(--phosphor)', fontSize: '0.68rem', letterSpacing: '0.08em' }}>VERSIÓN {release.version}</p>
          <h2 style={{ color: 'var(--text)', fontSize: compact ? '1rem' : '1.15rem', fontWeight: 800, marginTop: 3 }}>{release.title}</h2>
        </div>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
          <CalendarDays size={13} /> {new Date(`${release.date}T12:00:00`).toLocaleDateString('es-AR')}
        </span>
      </header>

      <div style={{ display: 'grid', gap: '0.65rem' }}>
        <Section icon={Sparkles} title="Funciones incorporadas o modificadas">
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>{release.functions.map(item => <li key={item} style={{ marginBottom: 3 }}>{item}</li>)}</ul>
        </Section>
        <Section icon={Wrench} title="Qué problema resuelve"><p>{release.problem}</p></Section>
        <Section icon={Users} title="Áreas o usuarios afectados"><p>{release.affectedUsers}</p></Section>
        <Section icon={Check} title="Cómo se usa"><p>{release.usage}</p></Section>
        {(release.examples?.length > 0 || release.screenshots?.length > 0) && (
          <Section icon={Image} title="Capturas o ejemplos">
            {release.examples?.length > 0 && <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>{release.examples.map(item => <li key={item}>{item}</li>)}</ul>}
            {release.screenshots?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: release.examples?.length ? 10 : 0 }}>
                {release.screenshots.map(item => <img key={item.src} src={item.src} alt={item.alt} style={{ width: 220, maxWidth: '100%', borderRadius: 4 }} />)}
              </div>
            )}
          </Section>
        )}
      </div>
    </article>
  )
}

export default function ReleaseNotes({ compact = false }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{RELEASES.map(release => <ReleaseCard key={release.version} release={release} compact={compact} />)}</div>
}
