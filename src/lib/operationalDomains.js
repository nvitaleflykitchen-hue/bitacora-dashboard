export const REPORT_TURNS = Object.freeze(['Apertura', 'Cierre', 'Único'])

export const REPORT_ACTIVITY_LEVELS = Object.freeze(['Bajo', 'Normal', 'Pico'])

export const TASK_STATES = Object.freeze(['Pendiente', 'En proceso', 'Resuelto', 'Cancelado'])

export const TASK_STATE_LABELS = Object.freeze({
  Pendiente: 'Pendiente',
  'En proceso': 'En proceso',
  Resuelto: 'Resuelto',
  Cancelado: 'Cancelado',
})

const SEDE_TYPE_TO_OPERATION_GROUP = Object.freeze({
  Aeropuerto: 'Aeropuertos',
  Comedor: 'Comedores',
  Hospital: 'Hospitales',
  Universidad: 'Educación',
  Planta: 'Otros',
  Oficina: 'Otros',
  Otro: 'Otros',
})

export function getOperationalOrigin(sede) {
  const groupName = sede?.grupos?.nombre || sede?.grupo?.nombre
  return groupName || SEDE_TYPE_TO_OPERATION_GROUP[sede?.tipo] || 'Otros'
}

export function nextTaskState(current) {
  if (current === 'Pendiente') return 'En proceso'
  if (current === 'En proceso') return 'Resuelto'
  return current
}
