import { describe, expect, it } from 'vitest'
import { fmtFecha, fmtFechaLarga, fmtFechaReporte, fmtHoraReporte, fmtFechaHoraReporte } from './dateUtils'

describe('dateUtils date-only values', () => {
  it('mantiene el día exacto de una fecha ISO sin hora', () => {
    expect(fmtFecha('2026-09-25')).toBe('25/09/26')
    expect(fmtFechaLarga('2026-10-25')).toBe('25/10/2026')
  })
})

describe('dateUtils report timestamps', () => {
  it('muestra la fecha operativa argentina para reportes guardados en UTC', () => {
    const value = '2026-07-08T00:32:47.000Z'

    expect(fmtFechaReporte(value)).toBe('07/07/26')
    expect(fmtHoraReporte(value)).toBe('21:32')
    expect(fmtFechaHoraReporte(value)).toBe('07/07/26 21:32')
  })
})
