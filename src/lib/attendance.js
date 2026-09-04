import { supabase } from './supabase'
import { newScanEventId, requestScanLocation } from './assetScans'

export const ATTENDANCE_STATUS = {
  VALIDATED: { label:'Validada', color:'#39FF14' },
  VALIDATED_WITH_WARNING: { label:'Validada con aviso', color:'#F59E0B' },
  PENDING_REVIEW: { label:'Pendiente de validación', color:'#F59E0B' },
  REJECTED: { label:'Rechazada', color:'#FF2A2A' },
}

export function attendanceEventLabel(type) {
  return type === 'CLOCK_OUT' ? 'Egreso' : 'Ingreso'
}

export function attendanceStatus(status) {
  return ATTENDANCE_STATUS[status] || { label:status || 'Sin estado', color:'var(--text-dim)' }
}

export async function getMyAttendance(limit = 20) {
  const { data, error } = await supabase.schema('bitacora').rpc('obtener_mi_marcacion', { p_limite:limit })
  if (error) {
    // Antes de aplicar la migración, el resto de la app debe seguir funcionando
    // y el piloto simplemente permanece oculto.
    if (error.code === 'PGRST202' || error.code === '42883') return { enabled:false }
    throw error
  }
  return data || { enabled:false }
}

export async function markMyAttendance(eventType, siteId, { geolocation } = {}) {
  if (!siteId) throw new Error('Seleccioná el lugar de trabajo.')
  const location = await requestScanLocation({ geolocation })
  if (location.estado !== 'obtenida') {
    const labels = {
      denegada:'Necesitamos permiso de ubicación para registrar la marcación.',
      timeout:'No pudimos obtener una ubicación precisa a tiempo. Volvé a intentar.',
      no_disponible:'Este dispositivo no ofrece ubicación.',
    }
    throw new Error(labels[location.estado] || 'No pudimos obtener tu ubicación.')
  }

  const now = new Date()
  const { data, error } = await supabase.schema('bitacora').rpc('registrar_mi_marcacion', {
    p_event_type:eventType,
    p_sede_id:Number(siteId),
    p_latitud:location.latitud,
    p_longitud:location.longitud,
    p_gps_accuracy_m:location.precision,
    p_client_timestamp:now.toISOString(),
    p_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    p_client_event_id:newScanEventId(),
  })
  if (error) throw error
  return data
}

