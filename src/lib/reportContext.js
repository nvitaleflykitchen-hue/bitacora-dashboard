const TYPES = new Set(['activo', 'vehiculo', 'sede', 'persona'])
const clean = value => String(value || '').trim().slice(0, 160)

export function normalizeReportContext(value) {
  if (!value || !TYPES.has(value.type)) return null
  const id = clean(value.id)
  const sedeId = clean(value.sedeId)
  if (!id || !sedeId) return null
  return {
    type: value.type,
    id,
    sedeId,
    label: clean(value.label) || 'Entidad seleccionada',
    sedeLabel: clean(value.sedeLabel),
    returnView: clean(value.returnView),
    returnModule: clean(value.returnModule),
  }
}

export const reportContextDraftKey = context => context
  ? `${context.type}-${context.id}-${context.sedeId}`
  : 'general'
