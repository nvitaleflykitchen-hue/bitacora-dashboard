export const DESTINOS = { tarea: 'tarea_id', compra: 'compra_id', ticket: 'ticket_id', persona: 'persona_id' }
export function destinoCorreo(message, suggested = false) {
  const prefix = suggested ? 'sugerido_' : ''
  if (message?.[`${prefix}plan_id`]) return message[`${prefix}plan_id`]
  for (const [kind, column] of Object.entries(DESTINOS)) {
    if (message?.[prefix + column] != null) return `${kind}:${message[prefix + column]}`
  }
  return ''
}
export function camposDestino(key) {
  const fields = { plan_id: null, tarea_id: null, compra_id: null, ticket_id: null, persona_id: null }
  if (!key) return fields
  const parts = String(key).split(':')
  if (parts.length === 1) fields.plan_id = key
  else {
    const [kind, id] = parts
    if (parts.length !== 2 || !DESTINOS[kind] || !id) throw new Error('Destino de correo inválido')
    if (!['ticket', 'persona'].includes(kind) && !/^\d+$/.test(id)) throw new Error('Destino de correo inválido')
    fields[DESTINOS[kind]] = ['ticket', 'persona'].includes(kind) ? id : Number(id)
  }
  return fields
}
