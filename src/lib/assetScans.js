import { supabase } from './supabase'

export const LOCATION_TIMEOUT_MS = 10000

export function newScanEventId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function requestScanLocation({ geolocation = globalThis.navigator?.geolocation } = {}) {
  if (!geolocation?.getCurrentPosition) {
    return Promise.resolve({ estado:'no_disponible', latitud:null, longitud:null, precision:null })
  }

  return new Promise(resolve => {
    geolocation.getCurrentPosition(
      position => resolve({
        estado:'obtenida',
        latitud:position.coords.latitude,
        longitud:position.coords.longitude,
        precision:position.coords.accuracy,
      }),
      error => {
        const estados = { 1:'denegada', 2:'no_disponible', 3:'timeout' }
        resolve({ estado:estados[error?.code] || 'error', latitud:null, longitud:null, precision:null })
      },
      { enableHighAccuracy:true, timeout:LOCATION_TIMEOUT_MS, maximumAge:60000 },
    )
  })
}

export async function registerAssetScan({ activoId, eventId, contexto = 'qr_interno', location }) {
  const { data, error } = await supabase.rpc('registrar_escaneo_activo', {
    p_activo_id:activoId,
    p_evento_cliente:eventId,
    p_latitud:location?.latitud ?? null,
    p_longitud:location?.longitud ?? null,
    p_precision_metros:location?.precision ?? null,
    p_estado_ubicacion:location?.estado || 'no_solicitada',
    p_contexto:contexto,
  })
  if (error) throw error
  return data?.[0] || null
}

export async function listAssetScans(activoId, limit = 20) {
  const { data, error } = await supabase.rpc('listar_escaneos_activo', {
    p_activo_id:activoId,
    p_limite:limit,
  })
  if (error) throw error
  return data || []
}

export function mapsUrl(scan) {
  if (!Number.isFinite(scan?.latitud) || !Number.isFinite(scan?.longitud)) return null
  return `https://www.google.com/maps?q=${scan.latitud},${scan.longitud}`
}

export function locationSummary(scan) {
  if (scan?.estado_ubicacion === 'obtenida') {
    const accuracy = Number.isFinite(scan.precision_metros) ? ` · ±${Math.round(scan.precision_metros)} m` : ''
    return `Ubicación registrada${accuracy}`
  }
  const labels = {
    denegada:'Ubicación no compartida',
    no_disponible:'Ubicación no disponible',
    timeout:'La ubicación no respondió a tiempo',
    error:'No se pudo obtener la ubicación',
    no_solicitada:'Ubicación no solicitada',
  }
  return labels[scan?.estado_ubicacion] || 'Ubicación no disponible'
}
