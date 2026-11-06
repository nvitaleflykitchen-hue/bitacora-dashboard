import { supabase } from './supabase'
export async function seguridadRpc(accion, sede = null, datos = {}) {
  const { data, error } = await supabase.rpc('seguridad_operar', { p_accion: accion, p_sede: sede ? Number(sede) : null, p_datos: datos })
  if (error) throw error
  return data
}
export function parseSeguridadQr(raw) {
  try {
    const url = new URL(String(raw).trim())
    if (!['https:', 'http:'].includes(url.protocol)) return null
    for (const tipo of ['credencial', 'pase']) {
      const token = url.searchParams.get(tipo)
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token || '')) return { tipo, token }
    }
  } catch { /* Not a QR URL. */ }
  return null
}
