import { describe, expect, it } from 'vitest'
import { fleetTicketEmailHref, fleetTicketMessage, fleetTicketWhatsappHref } from './fleetTicketSharing'

const ticket = { id:42, numero:17, activo_nombre:'Mercedes ATEGO - AH172MY', descripcion:'La caja quedó elevada al ingresar al depósito.', prioridad:'alta', estado:'abierto', sede:'Aeropuerto de Córdoba', created_at:'2026-09-17T12:00:00Z' }

describe('compartir tickets de Flota', () => {
  it('incluye el problema completo y un enlace directo a cada ticket seleccionado', () => {
    const message = fleetTicketMessage([ticket, { ...ticket, id:43, numero:18, descripcion:'Falla el levanta vidrios.' }], 'Santiago', 'https://bitacora-dashboard.vercel.app/')
    expect(message).toContain('Hola Santiago')
    expect(message).toContain('La caja quedó elevada al ingresar al depósito.')
    expect(message).toContain('Falla el levanta vidrios.')
    expect(message).toContain('targetType=ticket&targetId=42')
    expect(message).toContain('targetType=ticket&targetId=43')
  })

  it('dirige WhatsApp y correo al contacto seleccionado con el contenido codificado', () => {
    const contact = { wa:'+54 9 3516 46-1211', email:'flota@example.com' }
    const message = fleetTicketMessage([ticket])
    expect(fleetTicketWhatsappHref(contact, message)).toContain('https://wa.me/5493516461211?text=')
    expect(decodeURIComponent(fleetTicketWhatsappHref(contact, message).split('text=')[1])).toContain(ticket.descripcion)
    expect(fleetTicketEmailHref(contact, [ticket], message)).toContain('mailto:flota%40example.com?subject=')
    expect(fleetTicketWhatsappHref({}, message)).toBe('')
    expect(fleetTicketEmailHref({}, [ticket], message)).toBe('')
  })
})
