import {beforeEach,it,expect,vi} from 'vitest'
import {verifiedChecklistAuthor} from './checklistAuthor'
const m=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn()}))
vi.mock('./supabase',()=>({supabase:{auth:{getUser:m.getUser},rpc:m.rpc}}))
beforeEach(()=>vi.resetAllMocks())
it('rechaza el perfil de Pablo cuando la sesión corresponde a otro usuario',async()=>{
 m.getUser.mockResolvedValue({data:{user:{id:'juan'}}})
 await expect(verifiedChecklistAuthor({id:'pablo'})).rejects.toThrow('La cuenta cambió')
 expect(m.rpc).not.toHaveBeenCalled()
})
it('toma el nombre vigente del servidor, no el nombre almacenado en el formulario',async()=>{
 m.getUser.mockResolvedValue({data:{user:{id:'juan'}}})
 m.rpc.mockResolvedValue({data:{id:'juan',nombre:'Juan Pérez',activo:true}})
 expect(await verifiedChecklistAuthor({id:'juan',nombre:'Pablo'})).toEqual({id:'juan',nombre:'Juan Pérez'})
})
it('rechaza un segundo cambio de cuenta durante la verificación',async()=>{
 m.getUser.mockResolvedValue({data:{user:{id:'juan'}}})
 m.rpc.mockResolvedValue({data:{id:'pablo',nombre:'Pablo',activo:true}})
 await expect(verifiedChecklistAuthor({id:'juan'})).rejects.toThrow('No se pudo verificar')
})
