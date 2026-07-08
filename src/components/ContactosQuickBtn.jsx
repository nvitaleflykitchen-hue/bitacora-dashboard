import { useState, useEffect, useRef } from 'react'
import { getDirectorio } from '../lib/queries'

const IcoPhone = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 11.5 19.79 19.79 0 010 2.82 2 2 0 011.77.64h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L5.91 8.09a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
const IcoWA   = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
const IcoMail = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>

/**
 * Botón flotante en el header del hub que muestra un popover
 * con los contactos rápidos del módulo.
 *
 * Props:
 *   modulo — 'rrhh' | 'mantenimiento' | 'flota' | 'emergencias'
 */
export default function ContactosQuickBtn({ modulo }) {
  const [open, setOpen] = useState(false)
  const [contactos, setContactos] = useState([])
  const [loaded, setLoaded] = useState(false)
  const ref = useRef()

  // Carga lazy — solo cuando se abre por primera vez
  useEffect(() => {
    if (!open || loaded) return
    getDirectorio(modulo)
      .then(data => { setContactos(data || []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [open, loaded, modulo])

  // Cierra al hacer click fuera
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Contactos rápidos"
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: open ? 'rgba(57,255,20,0.14)' : 'rgba(57,255,20,0.06)',
          border: `1px solid ${open ? 'rgba(57,255,20,0.4)' : 'rgba(57,255,20,0.18)'}`,
          borderRadius: 6, padding: '0.32rem 0.65rem',
          color: 'var(--phosphor)', fontSize: '0.65rem', fontWeight: 700,
          cursor: 'pointer', letterSpacing: '0.04em', fontFamily: 'var(--font-metric, monospace)',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        📞 CONTACTOS
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'var(--surface)',
          border: '1px solid rgba(57,255,20,0.15)',
          borderRadius: 10, padding: '0.85rem',
          width: 280, zIndex: 999,
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        }}>
          <p style={{ color: 'rgba(57,255,20,0.5)', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-metric, monospace)', marginBottom: '0.65rem' }}>
            Contactos rápidos
          </p>

          {!loaded && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--phosphor)', borderTopColor: 'transparent', animation: 'cqb-spin 0.8s linear infinite' }} />
            </div>
          )}

          {loaded && contactos.length === 0 && (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', textAlign: 'center', padding: '0.5rem 0' }}>
              Sin contactos cargados
            </p>
          )}

          {loaded && contactos.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '0.5rem 0',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <span style={{ fontSize: '1rem', flexShrink: 0, width: 22, textAlign: 'center' }}>{c.icono}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</p>
                <p style={{ color: 'var(--phosphor)', fontFamily: 'monospace', fontSize: '0.62rem', opacity: 0.7 }}>{c.telefono}</p>
              </div>
              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                <a href={`tel:+${c.tel}`} title="Llamar"
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', width:26, height:26, background:'rgba(57,255,20,0.1)', border:'1px solid rgba(57,255,20,0.2)', color:'var(--phosphor)', borderRadius:4, textDecoration:'none' }}>
                  <IcoPhone />
                </a>
                {c.wa && (
                  <a href={`https://wa.me/${c.wa}`} target="_blank" rel="noopener noreferrer" title="WhatsApp"
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', width:26, height:26, background:'rgba(37,211,102,0.08)', border:'1px solid rgba(37,211,102,0.2)', color:'#25d366', borderRadius:4, textDecoration:'none' }}>
                    <IcoWA />
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} title="Email"
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', width:26, height:26, background:'rgba(99,179,237,0.08)', border:'1px solid rgba(99,179,237,0.2)', color:'#63b3ed', borderRadius:4, textDecoration:'none' }}>
                    <IcoMail />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes cqb-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
