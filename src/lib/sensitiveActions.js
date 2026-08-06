import { confirmar } from './feedback'

const LABELS = {
  eliminar: { title:'Eliminar', confirm:'Eliminar', danger:true },
  anular: { title:'Anular', confirm:'Anular', danger:true },
  rechazar: { title:'Rechazar', confirm:'Rechazar', danger:true },
  cerrar: { title:'Cerrar', confirm:'Cerrar', danger:false },
  descartar: { title:'Descartar cambios', confirm:'Descartar', danger:true },
}

export function sensitiveActionConfig({ action, subject, consequence, recovery, confirmText, title }) {
  const preset = LABELS[action]
  if (!preset) throw new Error(`Acción sensible desconocida: ${action}`)
  return {
    titulo: title || `${preset.title}${subject ? ` ${subject}` : ''}`,
    mensaje: `¿Querés continuar${subject ? ` con ${subject}` : ''}?`,
    consecuencia: consequence,
    recuperacion: recovery || 'Esta acción no se puede deshacer desde la aplicación.',
    confirmText: confirmText || preset.confirm,
    cancelText: 'Volver',
    peligro: preset.danger,
  }
}

export const confirmarAccionSensible = options => confirmar(sensitiveActionConfig(options))

