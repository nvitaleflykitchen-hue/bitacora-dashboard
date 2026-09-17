import { describe, expect, it } from 'vitest'
import { correoEntityPlanId } from './CorreosEntidad'

describe('CorreosEntidad', () => {
  it.each([
    ['tarea', 7, 'tarea:7'],
    ['requerimiento', 8, 'compra:8'],
    ['ticket', 'ticket-1', 'ticket:ticket-1'],
    ['sede', 4, 'sede:4'],
    ['persona', 'persona-1', 'persona:persona-1'],
    ['vehiculo', 'vehiculo-1', 'vehiculo:vehiculo-1'],
    ['id_proyecto', 'proyecto-1', 'idproyecto:proyecto-1'],
  ])('construye el filtro de %s', (entityType, entityId, expected) => {
    expect(correoEntityPlanId(entityType, entityId)).toBe(expected)
  })

  it('omite tipos que todavía no tienen vínculo de correo', () => {
    expect(correoEntityPlanId('documentacion_item', 'doc-1')).toBeNull()
  })
})
