import { describe, expect, it } from 'vitest'
import { seleccionInicialCorreo } from './correoBrowix'

const message = { asunto: 'Solicitud Laboral 44837 | Browix', cuerpo: 'Empleado: ZALAZAR, MIRTHA CLIDIA\nLegajo: 400026\nPersonal de cobertura: Jose Luis Veron', estado: 'pendiente', sugerido_persona_id: 'wrong', sugerido_vehiculo_id: 'v1' }
const person = { id: 'persona:m1', nombre: 'Mirtha Clidia', apellido: 'Zalazar', titulo: 'Mirtha Clidia Zalazar' }

describe('Empleado de solicitud Browix', () => {
  it('prioriza el empleado explícito sobre aprendizaje y otras sugerencias', () => {
    expect(seleccionInicialCorreo(message, [person])).toMatchObject({ selected: '', people: ['persona:m1'] })
  })
  it('tolera acentos, espacios, mayúsculas y prefijos de respuesta', () => {
    expect(seleccionInicialCorreo({ ...message, asunto: 'RE: Solicitud Laboral 22 | BROWIX', cuerpo: 'Empleado:  ZALÁZAR,   MIRTHA CLIDIA\r\nLegajo: 400026' }, [person]).people).toEqual(['persona:m1'])
  })
  it.each(['Empleado: ZALAZAR, MIRTHA', 'Personal de cobertura: ZALAZAR, MIRTHA CLIDIA', '', 'Empleado: ZALAZAR, MIRTHA CLIDIA\nEmpleado: OTRA, PERSONA'])('no adivina con información insuficiente: %s', cuerpo => {
    expect(seleccionInicialCorreo({ ...message, cuerpo }, [person]).people).toEqual([])
  })
  it('no selecciona entre homónimos', () => {
    expect(seleccionInicialCorreo(message, [person, { ...person, id: 'persona:m2' }]).people).toEqual([])
  })
  it('conserva asociaciones confirmadas', () => {
    expect(seleccionInicialCorreo({ ...message, persona_ids: ['saved'], compra_id: 7 }, [person])).toMatchObject({ selected: 'compra:7', people: ['persona:saved'] })
  })
  it('mantiene las sugerencias habituales fuera de Browix', () => {
    expect(seleccionInicialCorreo({ ...message, asunto: 'Otra solicitud' }, [person])).toMatchObject({ selected: '', people: ['persona:wrong'] })
  })
})
