import { describe, expect, it } from 'vitest'
import {
  enrichMobileTickets,
  findOwnMaintenanceResponsible,
  isClosedMaintenanceTicket,
  sortMobileMaintenanceWork,
} from './mobileMaintenance'

describe('mobileMaintenance', () => {
  it('encuentra al responsable por email antes que por nombre', () => {
    const responsables = [
      { id: 'otro', nombre: 'Emanuel Calderón', email: 'otro@fly.com' },
      { id: 'ema', nombre: 'Emanuel C.', email: 'emanuelcalderon637@gmail.com' },
    ]
    expect(findOwnMaintenanceResponsible({
      nombre: 'Emanuel Calderón',
      email: 'EmanuelCalderon637@gmail.com',
    }, responsables)?.id).toBe('ema')
  })

  it('completa sede y activo desde sus catálogos', () => {
    const [ticket] = enrichMobileTickets(
      [{ id: 't1', sede_id: 24, activo_id: 'a1', sede: null, activo_nombre: null }],
      [{ id: 24, nombre: 'Planta de Producción Córdoba' }],
      [{ id: 'a1', nombre: 'FREEZER celíacos' }],
    )
    expect(ticket.sede).toBe('Planta de Producción Córdoba')
    expect(ticket.activo_nombre).toBe('FREEZER celíacos')
  })

  it('ordena pendientes antes que cerrados, luego prioridad y vencimiento', () => {
    const result = sortMobileMaintenanceWork([
      { numero: 4, estado: 'resuelto', prioridad: 'critica', fecha_limite: '2026-06-01' },
      { numero: 3, estado: 'abierto', prioridad: 'media', fecha_limite: '2026-06-20' },
      { numero: 2, estado: 'abierto', prioridad: 'alta', fecha_limite: '2026-07-20' },
      { numero: 1, estado: 'abierto', prioridad: 'alta', fecha_limite: '2026-06-20' },
    ])
    expect(result.map(t => t.numero)).toEqual([1, 2, 3, 4])
    expect(isClosedMaintenanceTicket(result[3])).toBe(true)
  })
})
