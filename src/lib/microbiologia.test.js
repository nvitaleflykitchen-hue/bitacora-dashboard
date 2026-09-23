import { describe, expect, it } from 'vitest'
import { buildMicroStats } from './microbiologia'

describe('control microbiológico', () => {
  it('incluye resultados históricos y excluye los anulados de los indicadores', () => {
    const rows = [
      { estado:'cumple', source_project:'bioguard:legacy', anulado_en:null },
      { estado:'no_cumple', source_project:'fly-gestion', anulado_en:null },
      { estado:'observado', source_project:'fly-gestion', anulado_en:'2026-09-22T12:00:00Z' },
    ]
    expect(buildMicroStats(rows)).toEqual({ total:2, cumple:1, observado:0, noCumple:1 })
  })
})
