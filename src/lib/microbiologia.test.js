import { describe, expect, it } from 'vitest'
import { buildMicroStats, classifyMicroResult, parseMicroValue } from './microbiologia'

describe('microbiologia', () => {
  it('interpreta valores cuantitativos y cualitativos', () => {
    expect(parseMicroValue('< 10 UFC/g')).toBe(10)
    expect(parseMicroValue('Ausencia en 25 g')).toBe(0)
    expect(parseMicroValue('Presencia')).toBe(Number.POSITIVE_INFINITY)
  })

  it('clasifica límites y ensayos de ausencia', () => {
    expect(classifyMicroResult('ecoli', '3')).toBe('cumple')
    expect(classifyMicroResult('ecoli', '9')).toBe('observado')
    expect(classifyMicroResult('ecoli', '15')).toBe('no_cumple')
    expect(classifyMicroResult('salmonella', 'Ausencia')).toBe('cumple')
    expect(classifyMicroResult('salmonella', 'Presencia')).toBe('no_cumple')
  })

  it('consolida el tablero', () => {
    const stats = buildMicroStats([
      { parametro:'E. coli', estado:'cumple' },
      { parametro:'E. coli', estado:'observado' },
      { parametro:'Salmonella', estado:'no_cumple' },
      { parametro:'Salmonella', estado:'cumple' },
    ])
    expect(stats).toMatchObject({ total:4, cumple:2, observado:1, noCumple:1, cumplimiento:50 })
    expect(stats.porParametro[0]).toMatchObject({ parametro:'Salmonella', noCumple:1 })
  })
})

