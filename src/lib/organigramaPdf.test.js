import { beforeEach, describe, expect, it, vi } from 'vitest'

const pdfMocks = vi.hoisted(() => ({
  save:vi.fn(),
  addImage:vi.fn(),
  html2canvas:vi.fn(async () => ({ width:1600, height:900, toDataURL:() => 'data:image/png;base64,mock' })),
}))

vi.mock('html2canvas', () => ({ default:pdfMocks.html2canvas }))
vi.mock('jspdf', () => ({
  jsPDF:class {
    internal = { pageSize:{ getWidth:() => 297, getHeight:() => 210 } }
    setFillColor() {}
    rect() {}
    setTextColor() {}
    setFont() {}
    setFontSize() {}
    text() {}
    addImage(...args) { pdfMocks.addImage(...args) }
    save(...args) { pdfMocks.save(...args) }
  },
}))

import { exportOrganigramaPdf, organigramaPdfFilename } from './organigramaPdf'

describe('organigramaPdfFilename', () => {
  beforeEach(() => vi.clearAllMocks())

  it('genera un nombre de archivo estable y sin acentos', () => {
    expect(organigramaPdfFilename('Planta de Producción Córdoba')).toBe('organigrama-planta-de-produccion-cordoba.pdf')
    expect(organigramaPdfFilename('')).toBe('organigrama-general.pdf')
  })

  it('captura el paño y descarga un PDF apaisado', async () => {
    const element = document.createElement('main')
    await exportOrganigramaPdf({ element, name:'Hospitales' })

    expect(pdfMocks.html2canvas).toHaveBeenCalledWith(element, expect.objectContaining({ scale:2, backgroundColor:'#ffffff', onclone:expect.any(Function) }))
    expect(pdfMocks.addImage).toHaveBeenCalled()
    expect(pdfMocks.save).toHaveBeenCalledWith('organigrama-hospitales.pdf')
  })
})
