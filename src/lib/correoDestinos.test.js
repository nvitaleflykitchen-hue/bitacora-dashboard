import { describe, expect, it } from 'vitest'
import { camposDestino, destinoCorreo, personasCorreo } from './correoDestinos'

describe('destinos de correo', () => {
  it('serializa la asociación a una persona sin perder los otros destinos', () => {
    expect(camposDestino('persona:8fa6af41-bb3d-4fd0-a22f-fdd486f57848')).toEqual({
      plan_id: null, tarea_id: null, compra_id: null, ticket_id: null,
      persona_id: '8fa6af41-bb3d-4fd0-a22f-fdd486f57848',
      grupo_id: null, sede_id: null, vehiculo_id: null, id_proyecto_id: null,
    })
    expect(destinoCorreo({ persona_id: '8fa6af41-bb3d-4fd0-a22f-fdd486f57848' })).toBe('persona:8fa6af41-bb3d-4fd0-a22f-fdd486f57848')
  })

  it.each([
    ['grupo:3', 'grupo_id', 3],
    ['sede:17', 'sede_id', 17],
    ['vehiculo:8fa6af41-bb3d-4fd0-a22f-fdd486f57848', 'vehiculo_id', '8fa6af41-bb3d-4fd0-a22f-fdd486f57848'],
    ['idproyecto:9ca6af41-bb3d-4fd0-a22f-fdd486f57849', 'id_proyecto_id', '9ca6af41-bb3d-4fd0-a22f-fdd486f57849'],
  ])('serializa %s en su columna exclusiva', (key, column, value) => {
    const fields = camposDestino(key)
    expect(fields[column]).toBe(value)
    expect(Object.values(fields).filter(item => item != null)).toEqual([value])
    expect(destinoCorreo({ [column]: value })).toBe(key)
  })

  it('reúne la persona principal y las adicionales sin duplicados', () => {
    expect(personasCorreo({ persona_id:'p1', persona_ids:['p1','p2'] })).toEqual(['persona:p1','persona:p2'])
    expect(personasCorreo({ sugerido_persona_id:'p3' }, true)).toEqual(['persona:p3'])
  })
})
