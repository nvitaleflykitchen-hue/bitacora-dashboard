import {describe,expect,it} from 'vitest'
import {buildExecutiveBriefing} from './executiveBriefing'

describe('briefing ejecutivo diario',()=>{
  it('detecta responsables a empujar, cumplimiento y sedes sin activos',()=>{
    const result=buildExecutiveBriefing({
      today:new Date('2026-09-05T12:00:00'), profileIds:['boss'],
      sites:[{id:1,nombre:'Hospital Norte'},{id:2,nombre:'Aeropuerto Sur'}],
      people:[{id:10,nombre:'Ana',sede_ids:[1]},{id:11,nombre:'Luis',sede_ids:[2]}],
      documents:[{entity_type:'persona',entity_id:'11',codigo:'carnet_manipulador',estado:'vigente'}],
      tasks:[{estado:'Pendiente',creado_por:'boss',responsable_id:'worker',responsable:'María',titulo:'Completar legajos',fecha_limite:'2026-09-04'}],
      assets:[{id:1,sede_id:1}], tickets:[],requirements:[],capas:[],
    })
    expect(result.peopleToPush[0]).toMatchObject({name:'María',overdue:1})
    expect(result.compliance).toEqual(expect.arrayContaining([
      expect.objectContaining({person:'Ana',missing:['Carnet manipulador']}),
      expect.objectContaining({person:'Luis',missing:['Credencial PSA']}),
    ]))
    expect(result.sitesWithoutAssets).toEqual(['Aeropuerto Sur'])
  })
})
