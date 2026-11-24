import { supabase } from './supabase'

export const TEMAS_COMEDOR = [
  ['a', 'Producción y servicio'], ['b', 'Cadena de frío y conservación'],
  ['c', 'Recepción y abastecimiento'], ['d', 'Stock y faltantes'],
  ['e', 'Equipos y mantenimiento'], ['f', 'Higiene y limpieza'],
  ['g', 'Personal y cobertura'], ['h', 'Atención, incidentes y otras novedades'],
]
export async function comedorApi(body) {
  const { data, error } = await supabase.functions.invoke('comedor-publico', { body })
  if (error || data?.error) throw new Error(data?.error || 'No se pudo completar la solicitud. Intentá nuevamente.')
  return data
}
export const comedorUrl = token => `${window.location.origin}/?comedor=${encodeURIComponent(token)}`
