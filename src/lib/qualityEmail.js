import { supabase } from './supabase'

export async function sendQualityEscalationEmail({ ncId, escalamientoId }) {
  if (!ncId || !escalamientoId) {
    throw new Error('Faltan datos para enviar la notificación a Calidad.')
  }

  const { data, error } = await supabase.functions.invoke('send-quality-email', {
    body: {
      nc_id: ncId,
      escalamiento_id: escalamientoId,
    },
  })

  if (error) {
    let message = error.message || 'No se pudo enviar el correo a Calidad.'
    try {
      const details = await error.context?.json()
      if (details?.error) message = details.error
    } catch {
      // La respuesta puede no contener un cuerpo JSON.
    }
    throw new Error(message)
  }

  if (data?.error) throw new Error(data.error)
  return data
}
