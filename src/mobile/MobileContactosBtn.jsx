import { useState, useEffect } from 'react'
import { Phone, X } from 'lucide-react'
import { getDirectorio } from '../lib/queries'

/**
 * Botón + bottom-sheet de contactos rápidos para mobile.
 * Props:
 *   modulo — 'calidad' | 'mantenimiento' | 'compras' | 'flota' | 'rrhh'
 *   label  — texto del botón (default: "Contactos")
 */
export default function MobileContactosBtn({ modulo, label = 'Contactos' }) {
  const [open, setOpen] = useState(false)
  const [contactos, setContactos] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!open || loaded) return
    getDirectorio(modulo)
      .then(data => { setContactos(data || []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [open, loaded, modulo])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(57,255,20,0.08)',
          border: '1px solid rgba(57,255,20,0.2)',
          borderRadius: 6, padding: '0.3rem 0.65rem',
          color: 'var(--phosphor)', fontSize: '0.62rem', fontWeight: 700,
          cursor: 'pointer', letterSpacing: '0.03em',
        }}
      >
        <Phone size={10} /> {label}
      </button>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 60, display: 'flex', alignItems: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}
        >
          <div style={{
            background: 'var(--surface)', width: '100%',
            borderRadius: '14px 14px 0 0', padding: '1.1rem 1rem 1.5rem',
            maxHeight: '70vh', display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexShrink: 0 }}>
              <p style={{ color: 'var(--phosphor)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                📞 Contactos · {modulo}
              </p>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', padding: 0 }}>
                <X size={16} />
              </button>
            </div>

            {/* Contenido */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {!loaded && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--phosphor)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                </div>
              )}

              {loaded && contactos.length === 0 && (
                <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center', padding: '1.5rem 0' }}>
                  Sin contactos cargados para este módulo.
                </p>
              )}

              {loaded && contactos.map(c => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.7rem',
                  padding: '0.65rem 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <span style={{ fontSize: '1.25rem', flexShrink: 0, width: 28, textAlign: 'center' }}>{c.icono}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.83rem' }}>{c.nombre}</p>
                    {c.descripcion && <p style={{ color: 'var(--text-dim)', fontSize: '0.65rem', marginTop: 1, lineHeight: 1.3 }}>{c.descripcion}</p>}
                    <p style={{ color: 'var(--phosphor)', fontFamily: 'monospace', fontSize: '0.7rem', marginTop: 2, opacity: 0.8 }}>{c.telefono}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <a href={`tel:+${c.tel}`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.25)', color: 'var(--phosphor)', borderRadius: 8, textDecoration: 'none', fontSize: '0.9rem' }}>
                      📞
                    </a>
                    {c.wa && (
                      <a href={`https://wa.me/${c.wa}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', color: '#25d366', borderRadius: 8, textDecoration: 'none', fontSize: '0.9rem' }}>
                        💬
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, background: 'rgba(99,179,237,0.08)', border: '1px solid rgba(99,179,237,0.25)', color: '#63b3ed', borderRadius: 8, textDecoration: 'none', fontSize: '0.9rem' }}>
                        📧
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  )
}
