import { describe, expect, it } from 'vitest'
import { vehiculoEstadoFromDb, vehiculoEstadoToDb } from './vehiculoTicketState'

describe('estado de tickets vehiculares', () => {
  it('muestra el legado aprobado como bloqueado', () => {
    expect(vehiculoEstadoFromDb('aprobado')).toBe('bloqueado')
  })

  it('persiste bloqueado con el valor compatible actual', () => {
    expect(vehiculoEstadoToDb('bloqueado')).toBe('aprobado')
  })

  it('no altera otros estados', () => {
    expect(vehiculoEstadoFromDb('resuelto')).toBe('resuelto')
    expect(vehiculoEstadoToDb('en progreso')).toBe('en progreso')
  })
})
