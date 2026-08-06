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
  it('evita duplicar un escalamiento cuando ya tiene un ticket operativo vinculado', () => {
    const result = normalizeWorkItems({
      escalamientos:[{ id:7, descripcion:'Falla del horno', estado:'Pendiente' }],
      tickets:[{ id:12, descripcion:'Reparar horno', estado:'abierto', escalamiento_id:7 }],
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id:'ticket-12', entityId:12, entityType:'ticket', linkedEscalamientoId:7,
    })
  })

  it('conserva identificadores para abrir el registro exacto desde la bandeja', () => {
    const [item] = normalizeWorkItems({
      tareas:[{ id:33, titulo:'Confirmar entrega', estado:'Pendiente', sede_id:5 }],
    })

    expect(item).toMatchObject({ entityId:33, entityType:'tarea', sedeId:5, target:'tareas' })
  })
})
