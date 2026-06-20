import { describe, expect, it } from 'vitest'
import { normalizeWorkItems } from './workQueue'

describe('bandeja unificada', () => {
  it('excluye entidades cerradas y prioriza casos altos', () => {
    const result = normalizeWorkItems({
      tareas:[{ id:1, titulo:'Normal', estado:'Pendiente', prioridad:'Media' }],
      tickets:[
        { id:'a', descripcion:'Crítico', estado:'abierto', prioridad:'critica' },
        { id:'b', descripcion:'Cerrado', estado:'resuelto', prioridad:'alta' },
      ],
      compras:[{ id:2, descripcion:'Entregada', estado:'Cumplido', urgencia:'alta' }],
    })

    expect(result.map(item => item.title)).toEqual(['Crítico', 'Normal'])
  })
})
