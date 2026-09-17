export const DESTINOS = {
  tarea: 'tarea_id',
  compra: 'compra_id',
  ticket: 'ticket_id',
  persona: 'persona_id',
  sede: 'sede_id',
  vehiculo: 'vehiculo_id',
  idproyecto: 'id_proyecto_id',
}
export function destinoCorreo(message, suggested = false) {
  const prefix = suggested ? 'sugerido_' : ''
  if (message?.[`${prefix}plan_id`]) return message[`${prefix}plan_id`]
  for (const [kind, column] of Object.entries(DESTINOS)) {
    if (message?.[prefix + column] != null) return `${kind}:${message[prefix + column]}`
  }
  return ''
}
export function camposDestino(key) {
  const fields = {
    plan_id: null,
    tarea_id: null,
    compra_id: null,
    ticket_id: null,
    persona_id: null,
    sede_id: null,
    vehiculo_id: null,
    id_proyecto_id: null,
  }
  if (!key) return fields
  const parts = String(key).split(':')
  if (parts.length === 1) fields.plan_id = key
  else {
    const [kind, id] = parts
    if (parts.length !== 2 || !DESTINOS[kind] || !id) throw new Error('Destino de correo inválido')
    const numeric = ['tarea', 'compra', 'sede'].includes(kind)
    if (numeric && !/^\d+$/.test(id)) throw new Error('Destino de correo inválido')
    fields[DESTINOS[kind]] = numeric ? Number(id) : id
  }
  return fields
}
