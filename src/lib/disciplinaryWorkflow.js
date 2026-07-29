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

function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function suspensionPeriod(startDate, days) {
  const parsedDays = Number(days)
  const parts = String(startDate || '').split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN) || !Number.isInteger(parsedDays) || parsedDays < 1) {
    return null
  }

  const start = new Date(parts[0], parts[1] - 1, parts[2])
  const end = new Date(start)
  end.setDate(end.getDate() + parsedDays - 1)
  const returnDate = new Date(end)
  returnDate.setDate(returnDate.getDate() + 1)

  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end),
    returnDate: formatLocalDate(returnDate),
  }
}

export function isDisciplinaryReviewApplied(record, approved) {
  return record?.estado === (approved ? 'aprobado' : 'rechazado')
}

export function disciplinaryEditAuditNote(record, editedAt = new Date().toISOString()) {
  const previous = [
    `Fecha anterior: ${record?.fecha_hecho || 'sin fecha'}`,
    `Texto anterior: ${record?.hechos || 'sin texto'}`,
  ].join(' | ')
  const entry = `[${editedAt}] Edición administrativa del apercibimiento. ${previous}`
  return [record?.revision_observaciones?.trim(), entry].filter(Boolean).join('\n')
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

export async function listPersonalSuspensions(personaId) {
  return supabase
    .schema('equipo')
    .from('historial_personal')
    .select('*')
    .eq('persona_id', personaId)
    .eq('tipo', 'suspension')
    .eq('anulada', false)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
}

export async function createPersonalSuspension(payload) {
  return supabase
    .schema('equipo')
    .from('historial_personal')
    .insert({
      persona_id: payload.persona_id,
      tipo: 'suspension',
      fecha: payload.fecha,
      descripcion: payload.descripcion.trim(),
      dias_suspension: Number(payload.dias_suspension),
      registrado_por: payload.registrado_por?.trim() || null,
    })
    .select('*')
    .single()
}

export async function reviewDisciplinaryRequest(id, approved, reviewerId, observations = null) {
  const targetStatus = approved ? 'aprobado' : 'rechazado'
  const updateResult = await supabase
    .schema('equipo')
    .from('solicitudes_disciplinarias')
    .update({
      estado: targetStatus,
      revisado_por: reviewerId,
      revisado_at: new Date().toISOString(),
      revision_observaciones: observations?.trim() || null,
    })
    .eq('id', id)
    .eq('estado', 'pendiente_aprobacion')

  if (updateResult.error) return updateResult

  const verification = await supabase
    .schema('equipo')
    .from('solicitudes_disciplinarias')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (verification.error || isDisciplinaryReviewApplied(verification.data, approved)) {
    return verification
  }

  return {
    data: verification.data,
    error: {
      code: 'DISCIPLINARY_REVIEW_NOT_APPLIED',
      message: verification.data
        ? `La solicitud ya fue procesada con estado "${verification.data.estado}".`
        : 'La solicitud no existe o no está disponible para revisión.',
    },
  }
}

export async function notifyDisciplinaryRequest(id) {
  return supabase.schema('equipo').rpc('notificar_solicitud_disciplinaria', {
    p_solicitud_id: id,
  })
}

export async function updateApprovedDisciplinaryRequest(record, payload, editorId) {
  const editedAt = new Date().toISOString()
  const updateResult = await supabase
    .schema('equipo')
    .from('solicitudes_disciplinarias')
    .update({
      fecha_hecho: payload.fecha_hecho,
      hechos: payload.hechos.trim(),
      descargo_trabajador: payload.descargo_trabajador?.trim() || null,
      testigos_evidencia: payload.testigos_evidencia?.trim() || null,
      fundamento_legal: payload.fundamento_legal?.trim() || null,
      texto_propuesto: payload.texto_propuesto?.trim() || null,
      urgente: Boolean(payload.urgente),
      medida_preventiva: payload.urgente ? payload.medida_preventiva?.trim() || null : null,
      revisado_por: editorId,
      revisado_at: editedAt,
      revision_observaciones: disciplinaryEditAuditNote(record, editedAt),
    })
    .eq('id', record.id)
    .eq('estado', 'aprobado')

  if (updateResult.error) return updateResult

  const verification = await supabase
    .schema('equipo')
    .from('solicitudes_disciplinarias')
    .select('*')
    .eq('id', record.id)
    .maybeSingle()

  if (verification.error) return verification
  if (verification.data && verification.data.updated_at !== record.updated_at) return verification

  return {
    data: verification.data,
    error: {
      code: 'DISCIPLINARY_EDIT_NOT_APPLIED',
      message: 'El apercibimiento ya no está aprobado o fue modificado por otro usuario.',
    },
  }
}
