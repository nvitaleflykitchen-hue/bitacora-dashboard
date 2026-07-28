import { describe, expect, it } from 'vitest'
import { jsPDF } from 'jspdf'
import {
  apercibimientoFilename,
  calculateApercibimientoLayout,
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

  it('amplía el marco para un apercibimiento extenso sin invadir las firmas', () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
    const motivo = Array(40)
      .fill('Se deja constancia de la situación informada y de la normativa aplicable.')
      .join(' ')
    const layout = calculateApercibimientoLayout(doc, motivo)

    expect(layout.noticeBottom).toBeGreaterThan(419)
    expect(layout.signatureTop).toBe(layout.noticeBottom + 7)
    expect(layout.signatureTop + 159).toBeLessThanOrEqual(750)
  })

  it('continúa textos muy extensos en páginas adicionales sin recortarlos', () => {
    const motivo = Array(120)
      .fill('Se deja constancia de la situación informada y de la normativa aplicable.')
      .join(' ')
    const pdf = createApercibimientoPdf(
      { nombre: 'Virginia Edith', apellido: 'Medina', dni: '216769452', legajo: '1128' },
      { fecha: '2026-07-28', motivo }
    )
    const layoutDoc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
    const layout = calculateApercibimientoLayout(layoutDoc, motivo)

    expect(pdf.getNumberOfPages()).toBe(layout.pages.length)
    expect(layout.pages.flat().join(' ')).toBe(
      layoutDoc.splitTextToSize(motivo, 480).join(' ')
    )
  })
})
