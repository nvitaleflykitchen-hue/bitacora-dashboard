import { useState, useEffect } from 'react'
import { HELP_MODULES } from '../data/helpContent'

/* ── Print styles ──────────────────────────────────────────────────────────
   Se inyectan en <head> al montar el panel y se eliminan al desmontarlo.
   Cuando el usuario imprime (Ctrl+P o botón "Imprimir"), se muestra el
   manual completo en modo lectura, ignorando el resto de la app.
────────────────────────────────────────────────────────────────────────── */
const PRINT_CSS = `
@media print {
  body > * { display: none !important; }
  #help-print-root { display: block !important; }
  #help-print-root { font-family: Arial, sans-serif; color: #111; }
  .help-print-module { page-break-inside: avoid; margin-bottom: 2rem; }
  .help-print-module h2 { font-size: 1.15rem; font-weight: 700; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 0.5rem; }
  .help-print-section { margin-bottom: 1rem; }
  .help-print-section h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 4px; }
  .help-print-section p { font-size: 0.82rem; margin: 2px 0; line-height: 1.5; }
}
@media screen {
  #help-print-root { display: none !important; }
}
`

function injectPrintStyles() {
  const el = document.createElement('style')
  el.id = 'help-print-styles'
  el.textContent = PRINT_CSS
  document.head.appendChild(el)
  return () => el.remove()
}

/* ── PrintRoot: nodo oculto que contiene el manual completo para imprimir ── */
function PrintRoot() {
  return (
    <div id="help-print-root">
      <h1 style={{ fontSize:'1.4rem', marginBottom:'0.25rem' }}>Manual de Uso — Bitácora</h1>
      <p style={{ fontSize:'0.78rem', color:'#555', marginBottom:'2rem' }}>
        Sistema de operaciones · {new Date().toLocaleDateString('es-AR', { year:'numeric', month:'long' })}
      </p>
      {HELP_MODULES.map(mod => (
        <div key={mod.id} className="help-print-module">
          <h2>{mod.icon} {mod.label}</h2>
          <p style={{ fontSize:'0.82rem', color:'#555', marginBottom:'0.6rem', fontStyle:'italic' }}>{mod.intro}</p>
          {mod.sections.map((sec, i) => (
            <div key={i} className="help-print-section">
              <h3>{sec.title}</h3>
              {sec.body.map((line, j) => <p key={j}>{line}</p>)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/* ── Panel principal ────────────────────────────────────────────────────── */
export default function HelpPanel({ onClose }) {
  const [activeModule, setActiveModule] = useState(HELP_MODULES[0].id)

  useEffect(() => {
    // Inyectar CSS de impresión mientras el panel esté montado
    const cleanup = injectPrintStyles()
    // Cerrar con Escape
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { cleanup(); window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const mod = HELP_MODULES.find(m => m.id === activeModule) || HELP_MODULES[0]

  return (
    <>
      {/* Overlay semitransparente */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 80,
          background: 'rgba(0,0,0,0.45)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 81,
          width: 'min(700px, 92vw)',
          background: 'var(--surface)',
          borderLeft: '1px solid rgba(57,255,20,0.1)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
          animation: 'slideInRight 0.22s ease',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid rgba(57,255,20,0.08)',
          flexShrink: 0,
        }}>
          <div>
            <p style={{ color: 'var(--phosphor)', fontWeight: 800, fontSize: '0.95rem', fontFamily: 'var(--font-title, inherit)' }}>
              📖 Manual de Uso
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.62rem', marginTop: 2 }}>
              Central de ayuda · Bitácora
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => window.print()}
              title="Imprimir manual completo"
              style={{
                background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.2)',
                color: 'var(--phosphor)', borderRadius: 3, padding: '0.4rem 0.85rem',
                fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: 5,
              }}
            >
              🖨️ Imprimir
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: 'var(--text-dim)',
                cursor: 'pointer', fontSize: '1.1rem', padding: '0.2rem 0.4rem',
              }}
              title="Cerrar (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body: nav + contenido */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Nav lateral de módulos */}
          <nav style={{
            width: 170, flexShrink: 0,
            borderRight: '1px solid rgba(57,255,20,0.06)',
            overflowY: 'auto', padding: '0.75rem 0',
          }}>
            {HELP_MODULES.map(m => (
              <button
                key={m.id}
                onClick={() => setActiveModule(m.id)}
                style={{
                  width: '100%', textAlign: 'left', background: 'none',
                  border: 'none', cursor: 'pointer',
                  padding: '0.55rem 1rem',
                  color: activeModule === m.id ? 'var(--phosphor)' : 'var(--text-dim)',
                  fontSize: '0.75rem', fontWeight: activeModule === m.id ? 700 : 400,
                  borderLeft: activeModule === m.id
                    ? '2px solid var(--phosphor)'
                    : '2px solid transparent',
                  display: 'flex', alignItems: 'center', gap: 7,
                  transition: 'color 0.12s',
                }}
              >
                <span style={{ fontSize: '0.85rem' }}>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </nav>

          {/* Contenido del módulo activo */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.75rem' }}>
            <h2 style={{
              color: 'var(--text)', fontWeight: 800, fontSize: '1.15rem',
              marginBottom: '0.35rem',
            }}>
              {mod.icon} {mod.label}
            </h2>
            <p style={{
              color: 'var(--text-dim)', fontSize: '0.78rem', marginBottom: '1.5rem',
              lineHeight: 1.6, fontStyle: 'italic',
            }}>
              {mod.intro}
            </p>

            {mod.sections.map((sec, i) => (
              <div key={i} style={{ marginBottom: '1.75rem' }}>
                <h3 style={{
                  color: 'var(--phosphor)', fontWeight: 700, fontSize: '0.82rem',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  marginBottom: '0.6rem',
                  paddingBottom: '0.35rem',
                  borderBottom: '1px solid rgba(57,255,20,0.08)',
                }}>
                  {sec.title}
                </h3>
                {sec.body.map((line, j) => (
                  <p key={j} style={{
                    color: 'var(--text)', fontSize: '0.82rem',
                    lineHeight: 1.7, marginBottom: '0.4rem',
                  }}>
                    {line}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid rgba(57,255,20,0.06)',
          padding: '0.6rem 1.25rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.6rem' }}>
            {HELP_MODULES.length} módulos · Presioná Esc para cerrar
          </p>
          <p style={{ color: 'rgba(57,255,20,0.25)', fontSize: '0.6rem' }}>
            Bitácora · v2.0
          </p>
        </div>
      </div>

      {/* Nodo de impresión (oculto en pantalla, visible al imprimir) */}
      <PrintRoot />

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}
