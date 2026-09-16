import { describe, expect, it } from 'vitest'
import { camposDestino, destinoCorreo } from './correoDestinos'

describe('destinos de correo', () => {
  it('serializa la asociación a una persona sin perder los otros destinos', () => {
    expect(camposDestino('persona:8fa6af41-bb3d-4fd0-a22f-fdd486f57848')).toEqual({
      plan_id: null, tarea_id: null, compra_id: null, ticket_id: null,
      persona_id: '8fa6af41-bb3d-4fd0-a22f-fdd486f57848',
    })
    expect(destinoCorreo({ persona_id: '8fa6af41-bb3d-4fd0-a22f-fdd486f57848' })).toBe('persona:8fa6af41-bb3d-4fd0-a22f-fdd486f57848')
  })
})
