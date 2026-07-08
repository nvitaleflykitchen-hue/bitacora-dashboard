import { describe, expect, it } from 'vitest'
import {
  getOperationalOrigin,
  nextTaskState,
  REPORT_ACTIVITY_LEVELS,
  REPORT_TURNS,
  TASK_STATES,
} from './operationalDomains'

describe('operational domains shared by desktop and mobile', () => {
  it('matches the report constraints in PostgreSQL', () => {
    expect(REPORT_TURNS).toEqual(['Apertura', 'Cierre', 'Único'])
    expect(REPORT_ACTIVITY_LEVELS).toEqual(['Bajo', 'Normal', 'Pico'])
  })

  it('matches the task workflow used by desktop', () => {
    expect(TASK_STATES).toEqual(['Pendiente', 'En proceso', 'Resuelto', 'Cancelado'])
    expect(nextTaskState('Pendiente')).toBe('En proceso')
    expect(nextTaskState('En proceso')).toBe('Resuelto')
    expect(nextTaskState('Resuelto')).toBe('Resuelto')
  })

  it('uses the actual operational group and has a sede-type fallback', () => {
    expect(getOperationalOrigin({ grupos:{ nombre:'Aeropuertos' }, tipo:'Aeropuerto' })).toBe('Aeropuertos')
    expect(getOperationalOrigin({ tipo:'Hospital' })).toBe('Hospitales')
    expect(getOperationalOrigin({ tipo:'Universidad' })).toBe('Educación')
    expect(getOperationalOrigin({ grupos:{ nombre:'Restaurantes' }, tipo:'Otro' })).toBe('Restaurantes')
  })
})
