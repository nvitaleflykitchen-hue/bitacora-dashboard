import { describe, expect, it } from 'vitest'
import { agruparRecibidosPorSede, buildRetiroMessage } from './comprasEntrega'

describe('comprasEntrega', () => {
  it('agrupa solamente recibidos todavía no asignados a una entrega', () => {
    const grupos = agruparRecibidosPorSede([
      { id:1, estado:'Recibido', sede_id:7, descripcion:'Zunchos' },
      { id:2, estado:'Recibido', sede_id:7, descripcion:'Prolongador' },
      { id:3, estado:'Cumplido', sede_id:7 },
      { id:4, estado:'Recibido', sede_id:8, entrega_id:'x' },
    ])
    expect(grupos).toHaveLength(1)
    expect(grupos[0].requerimientos.map(r => r.id)).toEqual([1, 2])
  })

  it('arma un único mensaje con todos los artículos', () => {
    const texto = buildRetiroMessage({ sedeNombre:'Córdoba', responsableNombre:'Ana', requerimientos:[{ cantidad:3, unidad_medida:'u.', descripcion:'Zunchos' }] })
    expect(texto).toContain('Hola Ana')
    expect(texto).toContain('3 u. — Zunchos')
  })
})
