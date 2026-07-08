import { describe, expect, it } from 'vitest'
import { fmtFechaReporte, fmtHoraReporte, fmtFechaHoraReporte } from './dateUtils'

describe('dateUtils report timestamps', () => {
  it('muestra la fecha operativa argentina para reportes guardados en UTC', () => {
    const value = '2026-07-08T00:32:47.000Z'

    expect(fmtFechaReporte(value)).toBe('07/07/26')
    expect(fmtHoraReporte(value)).toBe('21:32')
    expect(fmtFechaHoraReporte(value)).toBe('07/07/26 21:32')
  })
})
