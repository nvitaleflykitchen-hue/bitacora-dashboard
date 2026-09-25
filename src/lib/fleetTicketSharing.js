import { whatsappDigits } from './phoneUtils'
import { writeAppRoute } from './navigationRoutes'

const clean = value => String(value ?? '').trim()

export function fleetTicketMessage(tickets, recipientName = '', appOrigin = '') {
  const selected = tickets.filter(ticket => ticket?.id)
  if (!selected.length) return ''
  const greeting = recipientName ? `Hola ${recipientName},` : 'Hola,'
  const intro = selected.length === 1
    ? 'Te comparto este ticket de mantenimiento de vehículos para seguimiento:'
    : `Te comparto ${selected.length} tickets de mantenimiento de vehículos para seguimiento:`
  const blocks = selected.map(ticket => {
    const number = clean(ticket.numero || ticket.id)
    const lines = [
      `Ticket #${number} · ${clean(ticket.activo_nombre) || 'Vehículo sin identificar'}`,
      `Problema: ${clean(ticket.descripcion) || 'Sin descripción'}`,
      `Prioridad: ${clean(ticket.prioridad).toUpperCase() || 'SIN DEFINIR'} · Estado: ${clean(ticket.estado) || 'Sin definir'}`,
      ticket.sede ? `Sede: ${clean(ticket.sede)}` : '',
      ticket.created_at ? `Reportado: ${new Date(ticket.created_at).toLocaleDateString('es-AR')}` : '',
      ticket.fecha_limite ? `Fecha límite: ${new Date(ticket.fecha_limite).toLocaleDateString('es-AR', { timeZone:'UTC' })}` : '',
      ticket.responsable ? `Responsable / taller: ${clean(ticket.responsable)}` : '',
      appOrigin ? `Abrir: ${writeAppRoute(appOrigin, 'flotaHub', { type:'ticket', id:ticket.id })}` : '',
    ]
    return lines.filter(Boolean).join('\n')
  })
  return [greeting, '', intro, '', blocks.join('\n\n'), '', 'Fly Gestión · Flota'].join('\n')
}

export function fleetTicketWhatsappHref(contact, message) {
  const digits = whatsappDigits(contact?.wa || contact?.telefono)
  return digits && message ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : ''
}

export function fleetTicketEmailHref(contact, tickets, message) {
  const email = clean(contact?.email)
  if (!email || !message || !tickets.length) return ''
  const subject = tickets.length === 1
    ? `Flota · Ticket #${tickets[0].numero || tickets[0].id} · ${tickets[0].activo_nombre || 'Vehículo'}`
    : `Flota · ${tickets.length} tickets de mantenimiento de vehículos`
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
}
