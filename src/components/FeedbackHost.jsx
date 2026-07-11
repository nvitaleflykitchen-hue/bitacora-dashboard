import { useState, useEffect, useCallback, useRef } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Info, X as XIcon } from 'lucide-react'
import { useBackHandler } from '../lib/backStack'

// Host único de toasts y modal de confirmación (ver src/lib/feedback.js).
// Montado una sola vez en App.jsx — cubre desktop, mobile y LoginPage.

const ICONO = {
  ok:    <CheckCircle2 size={15} style={{ color: 'var(--phosphor)', flexShrink: 0 }} />,
  error: <XCircle size={15} style={{ color: 'var(--alert)', flexShrink: 0 }} />,
  warn:  <AlertTriangle size={15} style={{ color: 'var(--warn)', flexShrink: 0 }} />,
  info:  <Info size={15} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />,
}

const BORDE = {
  ok:    'rgba(57,255,20,0.35)',
  error: 'rgba(255,90,90,0.45)',
  warn:  'rgba(245,158,11,0.45)',
  info:  'var(--line)',
}

export default function FeedbackHost() {
  const [toasts, setToasts] = useState([])
  const [confirmData, setConfirmData] = useState(null)
  const timersRef = useRef({})

  const quitar = useCallback(id => {
    setToasts(ts => ts.filter(t => t.id !== id))
    clearTimeout(timersRef.current[id])
    delete timersRef.current[id]
  }, [])

  useEffect(() => {
    const onToast = e => {
      const t = e.detail
      setToasts(ts => [...ts.slice(-3), t]) // máx 4 visibles
      const dur = t.duracion ?? (t.tipo === 'error' ? 6000 : 4000)
      timersRef.current[t.id] = setTimeout(() => quitar(t.id), dur)
    }
    const onConfirm = e => setConfirmData(e.detail)
    window.addEventListener('app:toast', onToast)
    window.addEventListener('app:confirm', onConfirm)
    const timers = timersRef.current
    return () => {
      window.removeEventListener('app:toast', onToast)
      window.removeEventListener('app:confirm', onConfirm)
      Object.values(timers).forEach(clearTimeout)
    }
  }, [quitar])

  const [inputValue, setInputValue] = useState('')
  useEffect(() => { if (confirmData) setInputValue('') }, [confirmData])

  const responder = ok => {
    if (confirmData?.input) {
      confirmData?.resolve?.(ok ? inputValue.trim() : null)
    } else {
      confirmData?.resolve?.(ok)
    }
    setConfirmData(null)
  }

  // Atrás del celular sobre un modal de confirmación = cancelar
  useBackHandler(() => responder(false), !!confirmData)

  return (
    <>
      {/* Toasts */}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)', right: 16,
          display: 'flex', flexDirection: 'column', gap: 8, zIndex: 200, maxWidth: 'min(92vw, 380px)',
        }}>
          {toasts.map(t => (
            <div key={t.id} className="fade-in" role="status" style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              background: 'var(--surface)', border: `1px solid ${BORDE[t.tipo] || BORDE.info}`,
              borderRadius: 'var(--r, 2px)', padding: '0.6rem 0.75rem',
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            }}>
              {ICONO[t.tipo] || ICONO.info}
              <p className="font-metric" style={{ color: 'var(--text)', fontSize: '0.72rem', lineHeight: 1.45, margin: 0, flex: 1 }}>
                {t.mensaje}
              </p>
              <button onClick={() => quitar(t.id)} className="btn-ghost" aria-label="Cerrar"
                style={{ padding: '0.1rem 0.25rem', lineHeight: 0 }}>
                <XIcon size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Confirmación */}
      {confirmData && (
        <div className="modal-overlay" style={{ zIndex: 210 }} onClick={() => responder(false)}>
          <div className="glass rounded p-5 w-full fade-in" onClick={e => e.stopPropagation()} style={{
            maxWidth: 400, background: 'var(--surface)',
            border: `1px solid ${confirmData.peligro ? 'rgba(255,90,90,0.35)' : 'rgba(57,255,20,0.15)'}`,
            borderRadius: 4,
          }}>
            <div className="flex items-start gap-2.5 mb-3">
              {confirmData.peligro
                ? <AlertTriangle size={16} style={{ color: 'var(--alert)', flexShrink: 0, marginTop: 2 }} />
                : <Info size={16} style={{ color: 'var(--phosphor)', flexShrink: 0, marginTop: 2 }} />}
              <div>
                {confirmData.titulo && (
                  <h2 className="font-title font-bold mb-1" style={{ color: 'var(--text)', fontSize: '0.9rem' }}>
                    {confirmData.titulo}
                  </h2>
                )}
                <p className="font-metric" style={{ color: 'var(--text-dim)', fontSize: '0.75rem', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-line' }}>
                  {confirmData.mensaje}
                </p>
              </div>
            </div>
            {confirmData.input && (
              <textarea autoFocus rows={3} className="input-dark w-full mb-3"
                placeholder={confirmData.placeholder || ''}
                value={inputValue} onChange={e => setInputValue(e.target.value)}
                style={{ fontSize: '0.78rem', resize: 'vertical' }} />
            )}
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => responder(false)} className="btn-ghost" autoFocus={!confirmData.input}>
                {confirmData.cancelText || 'Cancelar'}
              </button>
              <button onClick={() => responder(true)} className="btn-primary" disabled={confirmData.input && !inputValue.trim()}
                style={confirmData.peligro ? { background: 'var(--alert)', borderColor: 'var(--alert)', color: '#fff' } : undefined}>
                {confirmData.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
