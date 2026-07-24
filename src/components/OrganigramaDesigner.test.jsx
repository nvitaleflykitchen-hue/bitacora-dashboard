import { describe, expect, it } from 'vitest'
import { autoLayout, mergeRequiredStructure, wouldCreateCycle } from './OrganigramaDesigner'

const nodes = ['a','b','c'].map(id => ({ id, position:{ x:0, y:0 }, data:{} }))
const edges = [
  { id:'a-b', source:'a', target:'b' },
  { id:'b-c', source:'b', target:'c' },
]

describe('OrganigramaDesigner', () => {
  it('impide dependencias circulares y conexiones sobre la misma tarjeta', () => {
    expect(wouldCreateCycle({ source:'c', target:'a' }, nodes, edges)).toBe(true)
    expect(wouldCreateCycle({ source:'a', target:'a' }, nodes, edges)).toBe(true)
    expect(wouldCreateCycle({ source:'a', target:'c' }, nodes, [])).toBe(false)
  })

  it('ordena la jerarquía en niveles verticales', () => {
    const arranged = autoLayout(nodes, edges)
    const byId = Object.fromEntries(arranged.map(node => [node.id, node.position]))
    expect(byId.a.y).toBe(0)
    expect(byId.b.y).toBe(180)
    expect(byId.c.y).toBe(360)
  })

  it('incorpora nodos estructurales sin reemplazar el diseño publicado', () => {
    const published = {
      nodes:[{ id:'person', position:{ x:99, y:77 }, data:{ label:'Persona' } }],
      edges:[],
    }
    const merged = mergeRequiredStructure(
      published,
      [{ id:'person', required:true }, { id:'unit', label:'Hospitales', required:true }],
      [{ id:'person-unit', source:'person', target:'unit', required:true }]
    )

    expect(merged.nodes).toHaveLength(2)
    expect(merged.nodes.find(node => node.id === 'person').position).toEqual({ x:99, y:77 })
    expect(merged.nodes.find(node => node.id === 'unit').data.label).toBe('Hospitales')
    expect(merged.edges.map(edge => edge.id)).toEqual(['person-unit'])
  })
})
