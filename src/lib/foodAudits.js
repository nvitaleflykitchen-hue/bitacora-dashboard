import { db } from './supabase'
import { getAdjuntos, uploadAdjunto, addAdjuntoLink } from './adjuntos'

export const auditDate = row => row.fecha_auditoria || row.fecha_programada || ''
export const auditSeriesKey = row => `${row.sede_id}:${(row.organismo_auditor || 'Sin organismo').trim().toLowerCase()}`
export function auditEvolution(rows, siteId, organism, year = '') {
  return rows.filter(row => ['Finalizada', 'Cerrada'].includes(row.estado)
    && String(row.sede_id) === String(siteId)
    && (row.organismo_auditor || 'Sin organismo') === organism
    && (!year || auditDate(row).startsWith(String(year))))
    .sort((a, b) => auditDate(a).localeCompare(auditDate(b)) || String(a.codigo).localeCompare(String(b.codigo)))
    .map(row => ({ ...row, fecha: auditDate(row), score: row.porcentaje_cumplimiento == null ? null : Number(row.porcentaje_cumplimiento) }))
}
export function auditDelta(rows) {
  const scored = rows.filter(row => row.score != null && Number.isFinite(row.score))
  return scored.length < 2 ? null : Math.round((scored.at(-1).score - scored.at(-2).score) * 10) / 10
}
export function validateAuditDraft(draft, allowedIds) {
  if (!draft.sede_id || (Array.isArray(allowedIds) && !allowedIds.some(id => String(id) === String(draft.sede_id)))) throw new Error('Seleccioná una sede autorizada.')
  if (!draft.organismo_auditor?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(draft.fecha_auditoria || '')) throw new Error('Completá organismo y fecha de auditoría.')
  if (draft.porcentaje_cumplimiento === '' || draft.porcentaje_cumplimiento == null || !Number.isFinite(Number(draft.porcentaje_cumplimiento)) || Number(draft.porcentaje_cumplimiento) < 0 || Number(draft.porcentaje_cumplimiento) > 100) throw new Error('El cumplimiento debe estar entre 0 y 100.')
}
export async function listFoodAudits(siteIds) {
  if (Array.isArray(siteIds) && !siteIds.length) return []
  const rows = []
  for (let from = 0; ; from += 500) {
    let query = db().from('auditorias_internas').select('*, sedes(id,nombre), auditoria_hallazgos(*)')
      .eq('tipo_auditoria', 'Calidad e Inocuidad').eq('origen', 'Externa').order('id').range(from, from + 499)
    if (siteIds?.length) query = query.in('sede_id', siteIds)
    const { data, error } = await query
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < 500) return rows
  }
}
export async function saveFoodAudit({ draft, file, userId, userName, allowedIds }) {
  validateAuditDraft(draft, allowedIds)
  if (!userId) throw new Error('Iniciá sesión para cargar la auditoría.')
  let { data: existing, error: readError } = await db().from('auditorias_internas').select('*').eq('id', draft.id).maybeSingle()
  if (readError) throw readError
  if (existing) { validateAuditDraft(existing, allowedIds); draft = existing }
  if (existing && existing.estado !== 'Borrador') throw new Error('Esta auditoría ya fue publicada. Actualizá la lista.')
  if (!existing) {
    const { data: duplicates, error } = await db().from('auditorias_internas').select('id').eq('sede_id', Number(draft.sede_id)).eq('fecha_auditoria', draft.fecha_auditoria).eq('tipo_auditoria', 'Calidad e Inocuidad').eq('origen', 'Externa').ilike('organismo_auditor', draft.organismo_auditor.trim()).neq('estado', 'Cancelada')
    if (error) throw error
    if (duplicates?.length) throw new Error('Ya existe una auditoría de esa sede, organismo y fecha. Revisá el historial para evitar duplicarla.')
    if (!file || !/\.pdf$/i.test(file.name) || file.size === 0 || file.size > 15 * 1024 * 1024) throw new Error('Seleccioná el PDF original (hasta 15 MB).')
    const { error: insertError } = await db().from('auditorias_internas').insert({
      id:draft.id, codigo:`FK-EXT-${draft.id}`, sede_id:Number(draft.sede_id),
      tipo_auditoria:'Calidad e Inocuidad', origen:'Externa', estado:'Borrador', created_by:userId,
      organismo_auditor:draft.organismo_auditor.trim(), fecha_auditoria:draft.fecha_auditoria,
      porcentaje_cumplimiento:Number(draft.porcentaje_cumplimiento), resumen:draft.resumen?.trim() || null,
    })
    if (insertError) throw insertError
    existing = { id:draft.id }
  }
  let attachments = await getAdjuntos('auditoria_informe', existing.id)
  let pdf = attachments.find(row => row.mime_type === 'application/pdf' || /\.pdf$/i.test(row.nombre))
  if (!pdf) {
    if (!file || !/\.pdf$/i.test(file.name) || file.size === 0 || file.size > 15 * 1024 * 1024) throw new Error('El borrador está guardado. Adjuntá un PDF de hasta 15 MB para completar la carga.')
    pdf = await uploadAdjunto('auditoria_informe', existing.id, file, userName)
  }
  const library = await getAdjuntos('sede_biblioteca', draft.sede_id)
  if (!library.some(row => row.url === pdf.url)) await addAdjuntoLink('sede_biblioteca', draft.sede_id, { url:pdf.url, nombre:pdf.nombre, descripcion:`Auditoría ${draft.fecha_auditoria}`, uploadedBy:userName })
  const { error } = await db().from('auditorias_internas').update({ estado:'Finalizada' }).eq('id', existing.id).eq('estado', 'Borrador').select('id').single()
  if (error) throw error
  return existing.id
}
