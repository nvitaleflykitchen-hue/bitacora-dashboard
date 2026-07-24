import { beforeEach, describe, expect, it, vi } from 'vitest'

const pdfMocks = vi.hoisted(() => ({
  save:vi.fn(),
  line:vi.fn(),
  roundedRect:vi.fn(),
}))

vi.mock('jspdf', () => ({
  jsPDF:class {
    internal = { pageSize:{ getWidth:() => 297, getHeight:() => 210 } }
    setFillColor() {}
    setDrawColor() {}
    setLineWidth() {}
    setLineDashPattern() {}
    setTextColor() {}
    setFont() {}
    setFontSize() {}
    rect() {}
    triangle() {}
    text() {}
    line(...args) { pdfMocks.line(...args) }
    roundedRect(...args) { pdfMocks.roundedRect(...args) }
    save(...args) { pdfMocks.save(...args) }
  },
}))

import {
  createOrganigramaPrintLayout,
  exportOrganigramaPdf,
  organigramaPdfFilename,
} from './organigramaPdf'

describe('organigramaPdfFilename', () => {
  beforeEach(() => vi.clearAllMocks())

  it('genera un nombre de archivo estable y sin acentos', () => {
    expect(organigramaPdfFilename('Planta de Producción Córdoba')).toBe('organigrama-planta-de-produccion-cordoba.pdf')
    expect(organigramaPdfFilename('')).toBe('organigrama-general.pdf')
  })

  it('acomoda todos los nodos dentro del área imprimible', () => {
    const result = createOrganigramaPrintLayout([
      { id:'a', position:{ x:-500, y:0 } },
      { id:'b', position:{ x:900, y:600 } },
    ])
    expect(result.nodes[0].print.x).toBeGreaterThanOrEqual(10)
    expect(result.nodes[1].print.x + result.nodes[1].print.width).toBeLessThanOrEqual(287)
    expect(result.nodes[1].print.y + result.nodes[1].print.height).toBeLessThanOrEqual(197)
  })

  it('dibuja conexiones y tarjetas como vectores antes de descargar', async () => {
    await exportOrganigramaPdf({
      name:'Hospitales',
      nodes:[
        { id:'a', position:{ x:0, y:0 }, data:{ label:'Dirección', role:'Gerencia' } },
        { id:'b', position:{ x:0, y:180 }, data:{ label:'Hospitales', role:'Unidad' } },
      ],
      edges:[{ source:'a', target:'b', data:{ relationType:'jerarquica' } }],
    })

    expect(pdfMocks.line).toHaveBeenCalled()
    expect(pdfMocks.roundedRect).toHaveBeenCalledTimes(2)
    expect(pdfMocks.save).toHaveBeenCalledWith('organigrama-hospitales.pdf')
  })
})
