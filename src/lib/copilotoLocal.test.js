import { describe, expect, it } from 'vitest'
import { contextoSeguro } from './copilotoLocal'

describe('contextoSeguro del copiloto local', () => {
  it('limita la bandeja para que el modelo local responda a tiempo', () => {
    const items = Array.from({ length: 30 }, (_, index) => ({
      module:'Tarea',
      title:`Asunto ${index} ${'muy largo '.repeat(30)}`,
      status:'Pendiente',
      site:'Sede',
      owner:'Responsable',
      priority:'Alta',
      date:'2026-09-05',
      confidential:'no debe enviarse',
    }))

    const context = contextoSeguro(items)

    expect(context).toHaveLength(6)
    expect(context[0].asunto.length).toBeLessThanOrEqual(150)
    expect(context[0]).not.toHaveProperty('confidential')
  })
})
