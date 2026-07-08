import { describe, expect, it } from 'vitest'
import { buildComedoresMetricas } from './comedoresMetricas'

describe('buildComedoresMetricas', () => {
  it('calcula producido, servido, sobrante y porcentajes por comedor', () => {
    const result = buildComedoresMetricas([
      {
        id: 1,
        sede_id: 10,
        sede_nombre: 'Comedor Central',
        fecha_reporte: '2026-06-30T12:00:00Z',
        turno: 'Mañana',
        sedes: { id: 10, nombre: 'Comedor Central', tipo: 'Comedor' },
        op1_producidos: 100,
        op1_servidos: 80,
        op1_sobrante: 20,
        op2_producidos: 50,
        op2_servidos: 45,
        op2_sobrante: 5,
        vegetariano_producidos: 10,
        vegetariano_servidos: 8,
        vegetariano_sobrante: 2,
        ensalada_producidos: 30,
        ensalada_sobrante: 5,
        postre_producidos: 20,
        postre_sobrante: 4,
      },
    ])

    expect(result.global.producido).toBe(210)
    expect(result.global.servido).toBe(174)
    expect(result.global.sobrante).toBe(36)
    expect(result.global.pctSobrante).toBe(17.1)
    expect(result.global.comedores).toBe(1)
    expect(result.porSede[0]).toMatchObject({
      sedeNombre: 'Comedor Central',
      producido: 210,
      servido: 174,
      sobrante: 36,
      pctSobrante: 17.1,
    })
  })

  it('infiere sobrante cuando producido es mayor que servido y no vino sobrante cargado', () => {
    const result = buildComedoresMetricas([
      {
        id: 2,
        sede_id: 20,
        sede_nombre: 'Comedor Ferreyra',
        fecha_reporte: '2026-06-30T15:00:00Z',
        turno: 'Único',
        sedes: { id: 20, nombre: 'Comedor Ferreyra', tipo: 'Comedor' },
        op1_producidos: 78,
        op1_servidos: 41,
        op1_sobrante: 0,
      },
    ])

    expect(result.global.producido).toBe(78)
    expect(result.global.servido).toBe(41)
    expect(result.global.sobrante).toBe(37)
    expect(result.global.pctSobrante).toBe(47.4)
  })
})
