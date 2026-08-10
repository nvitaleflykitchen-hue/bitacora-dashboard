import { describe, expect, it } from 'vitest'
import { deriveTrialResult } from './idTrialOutcome'

describe('deriveTrialResult', () => {
  it('usa la opinión mayoritaria', () => {
    expect(deriveTrialResult([
      { opinion:'Aprobado' },
      { opinion:'Aprobado' },
      { opinion:'Repetir prueba' },
    ])).toBe('Aprobado')
  })

  it('resuelve empates con el criterio más conservador', () => {
    expect(deriveTrialResult([
      { opinion:'Aprobado' },
      { opinion:'Aprobado con ajustes' },
    ])).toBe('Aprobado con ajustes')
  })

  it('pide repetir si todavía no hay opiniones', () => {
    expect(deriveTrialResult([])).toBe('Repetir prueba')
  })
})
