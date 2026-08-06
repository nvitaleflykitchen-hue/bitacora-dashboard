import { describe, expect, it } from 'vitest'
import { operationalStateLabel, operationalStateMeta } from './operationalStates'

describe('diccionario transversal de estados', () => {
  it.each([
    ['abierto', 'pending'],
    ['En gestión', 'in_progress'],
    ['en_progreso', 'in_progress'],
    ['Bloqueada', 'blocked'],
    ['Observado', 'observed'],
    ['Verificada', 'completed'],
    ['Rechazado', 'cancelled'],
  ])('normaliza %s como %s', (raw, expected) => {
    expect(operationalStateMeta(raw).key).toBe(expected)
  })

  it('puede conservar la etapa interna como contexto secundario', () => {
    expect(operationalStateLabel('En compra', { includeStage:true })).toBe('En curso · En compra')
    expect(operationalStateLabel('Pendiente', { includeStage:true })).toBe('Pendiente')
  })

  it('no inventa equivalencias para estados desconocidos', () => {
    expect(operationalStateLabel('En auditoría')).toBe('En auditoría')
  })
})

