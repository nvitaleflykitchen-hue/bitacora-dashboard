import { describe, expect, it } from 'vitest'
import { autoLayout, wouldCreateCycle } from './OrganigramaDesigner'

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
})
