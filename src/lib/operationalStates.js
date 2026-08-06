const normalize = value => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')

export const OPERATIONAL_STATES = {
  pending: { label:'Pendiente', chip:'chip-gray', color:'#9CA3AF' },
  in_progress: { label:'En curso', chip:'chip-blue', color:'#60A5FA' },
  blocked: { label:'Bloqueado', chip:'chip-red', color:'#FF5050' },
  observed: { label:'Observado', chip:'chip-yellow', color:'#F59E0B' },
  completed: { label:'Finalizado', chip:'chip-green', color:'#39FF14' },
  cancelled: { label:'Cancelado', chip:'chip-gray', color:'#6B7280' },
  unknown: { label:'Sin estado', chip:'chip-gray', color:'#6B7280' },
}

const ALIASES = new Map([
  ...['nuevo','nueva','abierto','abierta','pendiente','solicitado','solicitada','sin aceptar'].map(value => [value, 'pending']),
  ...['en progreso','en curso','en gestion','en ejecucion','aprobado','aprobada','aceptado','aceptada','enviado','enviada','en compra','recibido','recibida','delegado','delegada'].map(value => [value, 'in_progress']),
  ...['bloqueado','bloqueada','esperando','en espera','detenido','detenida'].map(value => [value, 'blocked']),
  ...['observado','observada','requiere correccion','requiere revision','no apto','no apta'].map(value => [value, 'observed']),
  ...['resuelto','resuelta','cumplido','cumplida','completado','completada','verificado','verificada','cerrado','cerrada','finalizado','finalizada'].map(value => [value, 'completed']),
  ...['cancelado','cancelada','anulado','anulada','descartado','descartada','rechazado','rechazada','inactivo','inactiva','baja'].map(value => [value, 'cancelled']),
])

export function operationalStateMeta(value) {
  const normalized = normalize(value)
  const key = ALIASES.get(normalized) || 'unknown'
  const base = OPERATIONAL_STATES[key]
  return { ...base, key, raw:String(value || '').trim(), normalized }
}

export function operationalStateLabel(value, { includeStage = false } = {}) {
  const meta = operationalStateMeta(value)
  if (meta.key === 'unknown') return meta.raw || meta.label
  if (!includeStage || normalize(meta.label) === meta.normalized) return meta.label
  return `${meta.label} · ${meta.raw.replace(/_/g, ' ')}`
}

