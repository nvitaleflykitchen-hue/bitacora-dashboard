import { useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * Modal — patrón único de overlay + panel para toda la app.
 *
 * Antes cada modal reimplementaba su propio overlay inline con distinto
 * ancho, radio, blur y z-index (50/60/70). Este componente los unifica.
 *
 * Uso:
 *   <Modal open={show} onClose={() => setShow(false)} title="Nuevo ticket" maxWidth={520}>
 *     ...contenido...
 *   </Modal>
 *
 * - Cierra con Escape y con click en el overlay.
 * - `title` opcional dibuja el encabezado con botón de cierre.
 */
export default function Modal({ open, onClose, title, children, maxWidth = 480 }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel fade-in"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {title ? (
          <div className="card__header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
            <span className="card__title">{title}</span>
            <button onClick={onClose} className="btn-ghost" style={{ padding: '0.25rem 0.4rem' }} aria-label="Cerrar">
              <X size={13} />
            </button>
          </div>
        ) : null}
        <div style={{ padding: '1.25rem' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
