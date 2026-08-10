import { db } from './supabase'

export async function getCompromisoTarea(tareaId) {
  const { data, error } = await db().from('compromisos')
    .select('*')
    .eq('origen_tipo', 'tarea')
    .eq('origen_id', String(tareaId))
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getCompromisoEventos(compromisoId) {
  if (!compromisoId) return []
  const { data, error } = await db().from('compromiso_eventos')
    .select('*')
    .eq('compromiso_id', compromisoId)
    .order('created_at', { ascending:false })
  if (error) throw error
  return data || []
}

export async function registrarAvanceCompromiso(id, detalle) {
  const { data, error } = await db().rpc('registrar_avance_compromiso', { p_compromiso_id:id, p_detalle:detalle })
  if (error) throw error
  return data
}

export async function informarBloqueoCompromiso(id, motivo) {
  const { data, error } = await db().rpc('informar_bloqueo_compromiso', { p_compromiso_id:id, p_motivo:motivo })
  if (error) throw error
  return data
}

export async function registrarEvidenciaCompromiso(id, detalle) {
  const { data, error } = await db().rpc('registrar_evidencia_compromiso', { p_compromiso_id:id, p_detalle:detalle })
  if (error) throw error
  return data
}

export async function getMisCompromisos() {
  const { data, error } = await db().from('compromisos').select('*').order('fecha_objetivo')
  if (error) throw error
  return data || []
}
