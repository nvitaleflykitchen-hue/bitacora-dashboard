// Sistema de feedback unificado (toasts + confirmación) — reemplaza a
// alert()/confirm()/prompt() nativos, que rompen la estética de la app.
// API imperativa vía CustomEvent para poder usarse desde cualquier lugar
// (vistas desktop, mobile, o código no-React como queries.js).
// El render vive en src/components/FeedbackHost.jsx, montado una vez en App.

/**
 * Muestra un toast.
 * @param {string} mensaje
 * @param {'ok'|'error'|'warn'|'info'} tipo
 * @param {{duracion?: number}} opts duración en ms (default 4000; errores 6000)
 */
export function toast(mensaje, tipo = 'info', opts = {}) {
  window.dispatchEvent(new CustomEvent('app:toast', {
    detail: { id: Date.now() + Math.random(), mensaje: String(mensaje), tipo, ...opts },
  }))
}

toast.ok    = (m, o) => toast(m, 'ok', o)
toast.error = (m, o) => toast(m, 'error', o)
toast.warn  = (m, o) => toast(m, 'warn', o)

/**
 * Modal de confirmación. Devuelve Promise<boolean>.
 * @param {string|{titulo?:string, mensaje:string, confirmText?:string, cancelText?:string, peligro?:boolean}} config
 */
export function confirmar(config) {
  const detail = typeof config === 'string' ? { mensaje: config } : { ...config }
  if (detail.danger && detail.peligro == null) detail.peligro = true
  const sensitiveVerb = String(detail.confirmText || '').trim().toLowerCase().match(/^(eliminar|anular|rechazar|descartar|quitar)/)?.[1]
  if (sensitiveVerb) {
    detail.consecuencia ||= `La acción “${detail.confirmText}” se aplicará inmediatamente y quedará reflejada en el sistema.`
    detail.recuperacion ||= sensitiveVerb === 'descartar'
      ? 'Se conservará únicamente la última versión guardada o el borrador disponible.'
      : 'Si este módulo no ofrece reapertura o papelera, la acción no podrá deshacerse desde la aplicación.'
    detail.cancelText ||= 'Volver'
  }
  return new Promise(resolve => {
    detail.resolve = resolve
    window.dispatchEvent(new CustomEvent('app:confirm', { detail }))
  })
}

/**
 * Modal con campo de texto. Devuelve Promise<string|null> (null = canceló).
 * @param {{titulo?:string, mensaje:string, placeholder?:string, confirmText?:string}} config
 */
export function pedirTexto(config) {
  const detail = typeof config === 'string' ? { mensaje: config } : { ...config }
  detail.input = true
  return new Promise(resolve => {
    detail.resolve = resolve
    window.dispatchEvent(new CustomEvent('app:confirm', { detail }))
  })
}
