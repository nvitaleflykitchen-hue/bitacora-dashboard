import { describe, expect, it } from 'vitest'
import { buildGestionScorecards } from './gestionKpis'

describe('buildGestionScorecards', () => {
  it('calcula global y por sede con ponderación sobre dimensiones aplicables', () => {
    const result = buildGestionScorecards({
      desde:'2026-08-03', hasta:'2026-08-07',
      sedes:[{id:1,nombre:'Sede A'},{id:2,nombre:'Sede B'}],
      data:{
        operacion:[
          {sede_id:1,fecha_reporte:'2026-08-03T10:00:00Z'},
          {sede_id:1,fecha_reporte:'2026-08-04T10:00:00Z'},
        ],
        gestion:[{sede_id:1,estado:'Resuelto',fecha_limite:'2026-08-05'}],
        mantenimiento:[], compras:[], escalamientos:[],
        flota:{activos:[],novedades:[]},
        calidad:{nc:[],capa:[],auditorias:[]},
      },
    })
    expect(result.bySede).toHaveLength(2)
    expect(result.bySede[0].dimensions.find(item => item.id === 'compromiso').score).toBe(40)
    expect(result.bySede[1].dimensions.find(item => item.id === 'compromiso').score).toBe(0)
    expect(result.global.volume).toBe(3)
  })

  it('marca sin dato las dimensiones sin denominador', () => {
    const result = buildGestionScorecards({
      desde:'2026-08-01', hasta:'2026-08-02', sedes:[],
      data:{operacion:[],gestion:[],mantenimiento:[],compras:[],escalamientos:[],flota:{activos:[],novedades:[]},calidad:{nc:[],capa:[],auditorias:[]}},
    })
    expect(result.global.dimensions.find(item => item.id === 'documentacion').score).toBeNull()
  })
})
