import { supabase } from './supabase'

export const DISCIPLINARY_STATUS = {
  pendiente_aprobacion: { label: 'Pendiente de aprobación', color: '#f59e0b' },
  aprobado: { label: 'Aprobado', color: '#39ff14' },
  rechazado: { label: 'Rechazado', color: '#ff5050' },
  notificado: { label: 'Notificado', color: '#50b4ff' },
  cancelado: { label: 'Cancelado', color: '#9ca3af' },
}

export function canCreateDisciplinaryRequest(rol) {
  return rol === 'admin' || rol === 'encargado'
}

export function canReviewDisciplinaryRequest(rol) {
  return rol === 'admin'
}

export function disciplinaryStatusMeta(estado) {
  return DISCIPLINARY_STATUS[estado] || { label: estado || 'Sin estado', color: '#9ca3af' }
}

export async function listDisciplinaryRequests(personaId) {
  return supabase
    .schema('equipo')
    .from('solicitudes_disciplinarias')
    .select('*')
    .eq('persona_id', personaId)
    .order('created_at', { ascending: false })
}

export async function createDisciplinaryRequest(payload) {
  return supabase
    .schema('equipo')
    .from('solicitudes_disciplinarias')
    .insert(payload)
    .select('*')
    .single()
}

export async function reviewDisciplinaryRequest(id, approved, reviewerId, observations = null) {
  return supabase
    .schema('equipo')
    .from('solicitudes_disciplinarias')
    .update({
      estado: approved ? 'aprobado' : 'rechazado',
      revisado_por: reviewerId,
      revisado_at: new Date().toISOString(),
      revision_observaciones: observations?.trim() || null,
    })
    .eq('id', id)
    .eq('estado', 'pendiente_aprobacion')
    .select('*')
    .single()
}

export async function notifyDisciplinaryRequest(id) {
  return supabase.schema('equipo').rpc('notificar_solicitud_disciplinaria', {
    p_solicitud_id: id,
  })
}
