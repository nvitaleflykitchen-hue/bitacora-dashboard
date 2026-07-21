import { describe, expect, it } from 'vitest'
import { normalizeWorkItems } from './workQueue'

describe('bandeja unificada', () => {
  it('excluye entidades cerradas y prioriza casos altos', () => {
    const result = normalizeWorkItems({
      tareas:[{ id:1, titulo:'Normal', estado:'Pendiente', prioridad:'Media' }],
      capas:[{ id:9, descripcion:'Corregir proceso', estado:'Pendiente', responsable:'Miguel', responsable_id:'u1', prioridad:'Alta' }],
      tickets:[
        { id:'a', descripcion:'Crítico', estado:'abierto', prioridad:'critica' },
        { id:'b', descripcion:'Cerrado', estado:'resuelto', prioridad:'alta' },
      ],
      compras:[{ id:2, descripcion:'Entregada', estado:'Cumplido', urgencia:'alta' }],
    })

    expect(result.map(item => item.title)).toEqual(['Corregir proceso', 'Crítico', 'Normal'])
    expect(result[0]).toMatchObject({ module:'CAPA', ownerId:'u1', target:'capa' })
  })

  it('separa los planes de gestión de las CAPA de Calidad', () => {
    const [item] = normalizeWorkItems({
      capas:[{
        id:10, descripcion:'Estandarizar escalas', estado:'Pendiente',
        responsable:'Miguel', responsable_id:'u1', prioridad:'Media',
        auditoria_codigo:'FK-GEST-ESCALAS-2026-06-19',
      }],
    })

    expect(item).toMatchObject({ module:'Proyecto', target:'proyectosGestion' })
  })
})
