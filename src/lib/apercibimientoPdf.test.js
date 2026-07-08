import { describe, expect, it } from 'vitest'
import {
  apercibimientoFilename,
  createApercibimientoPdf,
  formatApercibimientoDate,
} from './apercibimientoPdf'

describe('apercibimientoPdf', () => {
  it('formatea la fecha sin conversión de zona horaria', () => {
    expect(formatApercibimientoDate('2026-07-02')).toBe('02/07/2026')
  })

  it('crea un nombre de archivo seguro', () => {
    expect(
      apercibimientoFilename({ nombre: 'Nair', apellido: 'Trád' }, '2026-07-02')
    ).toBe('apercibimiento-trad-nair-2026-07-02.pdf')
  })

  it('genera un PDF de una página', () => {
    const pdf = createApercibimientoPdf(
      { nombre: 'Nair', apellido: 'Trad', dni: '30111222', legajo: 'FK-123' },
      { fecha: '2026-07-02', motivo: 'Incumplimiento informado por la supervisión.' }
    )
    expect(pdf.getNumberOfPages()).toBe(1)
    expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(4_000)
  })
})
