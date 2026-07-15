const CLOSED_TICKET_STATES = new Set(['resuelto', 'rechazado', 'cerrado'])

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function findOwnMaintenanceResponsible(perfil, responsables = []) {
  const email = normalize(perfil?.email)
  if (email) {
    const byEmail = responsables.find(r => normalize(r.email) === email)
    if (byEmail) return byEmail
  }

  const nombre = normalize(perfil?.nombre)
  if (!nombre) return null
  return responsables.find(r => normalize(r.nombre) === nombre) || null
}

export function enrichMobileTickets(tickets = [], sedes = [], activos = []) {
  const sedesById = new Map(sedes.map(s => [String(s.id), s.nombre]))
  const activosById = new Map(activos.map(a => [String(a.id), a.nombre]))

  return tickets.map(ticket => ({
    ...ticket,
    sede: ticket.sede || sedesById.get(String(ticket.sede_id)) || null,
    activo_nombre: ticket.activo_nombre || activosById.get(String(ticket.activo_id)) || null,
  }))
}

export function isClosedMaintenanceTicket(ticket) {
  return CLOSED_TICKET_STATES.has(String(ticket?.estado || '').toLowerCase())
}

export function sortMobileMaintenanceWork(tickets = []) {
  const priority = { critica: 0, alta: 1, media: 2, baja: 3 }
  return [...tickets].sort((a, b) => {
    const closedDelta = Number(isClosedMaintenanceTicket(a)) - Number(isClosedMaintenanceTicket(b))
    if (closedDelta) return closedDelta

    const priorityDelta = (priority[String(a.prioridad).toLowerCase()] ?? 9) -
      (priority[String(b.prioridad).toLowerCase()] ?? 9)
    if (priorityDelta) return priorityDelta

    const dateA = a.fecha_limite ? new Date(a.fecha_limite).getTime() : Number.MAX_SAFE_INTEGER
    const dateB = b.fecha_limite ? new Date(b.fecha_limite).getTime() : Number.MAX_SAFE_INTEGER
    if (dateA !== dateB) return dateA - dateB

    return Number(a.numero || 0) - Number(b.numero || 0)
  })
}
