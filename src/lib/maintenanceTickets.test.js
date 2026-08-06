import { describe, expect, it } from 'vitest'
import {
  filterMaintenanceAssets,
  filterMaintenanceTickets,
  isVehicleTicket,
} from './maintenanceTickets'

const assets = [
  { id: 1, nombre: 'Horno', tipo: 'EQUIPO' },
  { id: 2, nombre: 'LIFAN', tipo: 'VEHICULO' },
]

describe('separación de tickets de Mantenimiento y Flota', () => {
  it('reconoce categorías históricas de vehículos aunque cambien acentos o mayúsculas', () => {
    expect(isVehicleTicket({ categoria: 'Vehiculos' })).toBe(true)
    expect(isVehicleTicket({ categoria: 'VEHÍCULO' })).toBe(true)
    expect(isVehicleTicket({ categoria: 'Flota' })).toBe(true)
  })

  it('reconoce un ticket vehicular por el tipo de su activo', () => {
    expect(isVehicleTicket({ activo_id: '2' }, assets)).toBe(true)
    expect(isVehicleTicket({ activo_id: 1 }, assets)).toBe(false)
  })

  it('deja en Mantenimiento sólo tickets y activos no vehiculares', () => {
    const tickets = [
      { id: 'equipo', categoria: 'Equipos', activo_id: 1 },
      { id: 'vehiculo-categoria', categoria: 'Vehiculos' },
      { id: 'vehiculo-activo', activo_id: 2 },
      { id: 'general', categoria: null, activo_id: null },
    ]

    expect(filterMaintenanceTickets(tickets, assets).map(item => item.id)).toEqual(['equipo', 'general'])
    expect(filterMaintenanceAssets(assets).map(item => item.id)).toEqual([1])
  })
})
