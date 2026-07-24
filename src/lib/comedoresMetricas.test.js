import { describe, expect, it } from 'vitest'
import { buildComedoresMetricas, getRacionValues, RACION_CATEGORIAS } from './comedoresMetricas'

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
    expect(result.global.sinDiscriminar).toBe(36)
    expect(result.global.reutilizable).toBe(0)
    expect(result.global.descarte).toBe(0)
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
    expect(result.global.sinDiscriminar).toBe(37)
  })

  it('discrimina reutilizable y descarte sin reinterpretar el total histórico', () => {
    const result = buildComedoresMetricas([
      {
        id: 3,
        sede_id: 30,
        sede_nombre: 'Comedor Norte',
        fecha_reporte: '2026-07-17T15:00:00Z',
        turno: 'Tarde',
        sedes: { id: 30, nombre: 'Comedor Norte', tipo: 'Comedor' },
        op1_producidos: 100,
        op1_servidos: 80,
        op1_sobrante: 20,
        op1_sobrante_reutilizable: 12,
        op1_sobrante_descarte: 8,
      },
    ])

    expect(result.global).toMatchObject({
      producido: 100,
      servido: 80,
      sobrante: 20,
      reutilizable: 12,
      descarte: 8,
      sinDiscriminar: 0,
      pctDescarte: 8,
      pctReutilizado: 60,
    })
    expect(result.movimientos[0].categorias.op1).toMatchObject({
      sobrante: 20,
      reutilizable: 12,
      descarte: 8,
      sinDiscriminar: 0,
    })
  })
  it('usa en el detalle la misma inferencia de servido que en el listado', () => {
    const registro = {
      op1_producidos: 165,
      op1_servidos: 165,
      op2_producidos: 30,
      op2_servidos: 30,
      vegetariano_producidos: 22,
      vegetariano_servidos: 20,
      vegetariano_sobrante_descarte: 2,
      ensalada_producidos: 5,
      postre_producidos: 100,
      postre_sobrante_reutilizable: 10,
    }

    const detalle = RACION_CATEGORIAS.map(cat => getRacionValues(cat, registro))
    const servidoDetalle = detalle.reduce((total, item) => total + item.servido, 0)
    const metricas = buildComedoresMetricas([{
      ...registro,
      id: 4,
      sede_id: 40,
      sede_nombre: 'Comedor Central Plaza',
      fecha_reporte: '2026-07-23T18:35:00Z',
      turno: 'Único',
    }])

    expect(detalle[3].servido).toBe(5)
    expect(detalle[4].servido).toBe(90)
    expect(servidoDetalle).toBe(310)
    expect(metricas.movimientos[0].servido).toBe(servidoDetalle)
  })

  it('no pierde producción cuando servido quedó en cero y el sobrante fue discriminado', () => {
    const registro = {
      op1_producidos: 70,
      op1_servidos: 0,
      op1_sobrante_reutilizable: 0,
      op1_sobrante_descarte: 0,
      vegetariano_producidos: 10,
      vegetariano_servidos: 6,
      vegetariano_sobrante_reutilizable: 4,
      vegetariano_sobrante_descarte: 0,
      postre_producidos: 80,
      postre_sobrante_reutilizable: 73,
      postre_sobrante_descarte: 7,
    }

    const metricas = buildComedoresMetricas([{
      ...registro,
      id: 5,
      sede_id: 50,
      sede_nombre: 'Comedor Quilmes',
      fecha_reporte: '2026-07-23T19:27:00Z',
      turno: 'Único',
    }])

    expect(metricas.movimientos[0]).toMatchObject({
      producido: 160,
      servido: 76,
      sobrante: 84,
    })
    expect(metricas.movimientos[0].producido).toBe(
      metricas.movimientos[0].servido + metricas.movimientos[0].sobrante,
    )
  })
})
