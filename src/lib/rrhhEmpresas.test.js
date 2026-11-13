import {expect,it,vi} from 'vitest'
import {filterRrhhPeople,saveRrhhPerson} from './rrhhEmpresas'
const mock=vi.hoisted(()=>({update:vi.fn(),eq:vi.fn(),select:vi.fn()}))
vi.mock('./supabase',()=>({supabase:{schema:()=>({from:()=>({update:mock.update})})}}))
it('combines company, unit, status and accent insensitive search',()=>{
 const data={personas:[{nombre:'Nicolás',empresa_id:'drill',unidad_ids:['u1'],activo:true},{nombre:'Nicolás',empresa_id:'tempura',unidad_ids:['u2'],activo:false}]}
 expect(filterRrhhPeople(data,'drill','u1','nicolas','activos')).toHaveLength(1)
 expect(filterRrhhPeople(data,'todas','','nicolas','todos')).toHaveLength(2)
 expect(filterRrhhPeople(data,'tempura','','','activos')).toHaveLength(0)
})
it('uses the original revision and never writes UI metadata or login attributes',async()=>{
 const q={eq:mock.eq,select:mock.select};mock.update.mockReturnValue(q);mock.eq.mockReturnValue(q);mock.select.mockResolvedValue({data:[],error:null})
 await expect(saveRrhhPerson({id:'p1',empresa_id:'drill',unidad_id:'u1',nombre:'Persona',dni:'30.000.002',actualizado_at:'revision-1',perfil_id:'login',origen:'rrhh'})).rejects.toThrow('No se guardó')
 expect(mock.eq).toHaveBeenCalledWith('actualizado_at','revision-1')
 const payload=mock.update.mock.calls[0][0];expect(payload.dni).toBe('30000002');expect(payload).not.toHaveProperty('perfil_id');expect(payload).not.toHaveProperty('origen')
})
