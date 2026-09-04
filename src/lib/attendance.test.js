import { describe, expect, it } from 'vitest'
import { attendanceEventLabel, attendanceStatus } from './attendance'

describe('Fly Marcación', () => {
  it('presenta los tipos de evento en español', () => {
    expect(attendanceEventLabel('CLOCK_IN')).toBe('Ingreso')
    expect(attendanceEventLabel('CLOCK_OUT')).toBe('Egreso')
  })

  it('no presenta una revisión pendiente como validada', () => {
    expect(attendanceStatus('PENDING_REVIEW').label).toBe('Pendiente de validación')
    expect(attendanceStatus('VALIDATED').label).toBe('Validada')
  })
})

