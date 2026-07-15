import { describe, expect, it } from 'vitest'
import { agruparNovedadesPorPersona, resumirNovedadesPersonal } from './personalNovedadesReportPdf'

describe('informe de novedades por persona', () => {
  it('resume categorías, estados y personas sin duplicarlas', () => {
    const resumen = resumirNovedadesPersonal([
      { persona_nombre:'Ana', categoria:'Ausentismo', estado:'Abierto' },
      { persona_nombre:'Ana', categoria:'Ausentismo', estado:'Resuelto' },
      { persona_nombre:'Luis', categoria:'Conducta', estado:'Abierto' },
    ])
    expect(resumen.categorias).toEqual({ Ausentismo:2, Conducta:1 })
    expect(resumen.estados).toEqual({ Abierto:2, Resuelto:1 })
    expect([...resumen.personas]).toEqual(['Ana','Luis'])
  })

  it('asigna una novedad a cada persona mencionada e ignora acentos', () => {
    const personas = [
      { id:'1', nombre:'José', apellido:'Verón' },
      { id:'2', nombre:'Gianni', apellido:'Scialfa' },
    ]
    const modulos = [{ id:18, descripcion:'Se apercibió a Jose Veron y a Gianni Scialfa.', fecha_reporte:'2026-07-07' }]
    const resultado = agruparNovedadesPorPersona({ personas, modulos })
    expect(resultado.grupos).toHaveLength(2)
    expect(resultado.grupos.every(grupo => grupo.items.length === 1)).toBe(true)
    expect(resultado.sinAsignar).toHaveLength(0)
  })

  it('deja separada una novedad que no identifica a nadie', () => {
    const resultado = agruparNovedadesPorPersona({
      personas:[{ id:'1', nombre:'Ana', apellido:'Pérez' }],
      modulos:[{ id:20, descripcion:'Se reorganizó el personal del turno.' }],
    })
    expect(resultado.grupos).toHaveLength(0)
    expect(resultado.sinAsignar).toHaveLength(1)
  })
})
