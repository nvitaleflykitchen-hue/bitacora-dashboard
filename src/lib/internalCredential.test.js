import {it,expect,vi,afterEach} from 'vitest'
import {getInternalCredential} from './credenciales'
import {supabase} from './supabase'
vi.mock('./supabase',()=>({supabase:{rpc:vi.fn()}}))
afterEach(()=>vi.resetAllMocks())
it('consulta sectores vigentes sólo después de autorizar la ficha interna',async()=>{
 supabase.rpc.mockResolvedValueOnce({data:{scope:'sede'}}).mockResolvedValueOnce({data:[{estado:'activa',sectores_autorizados:[{id:'s',codigo:'Vd'}]}]})
 const data=await getInternalCredential('token')
 expect(data.currentAccess.sectores_autorizados[0].codigo).toBe('Vd')
 expect(supabase.rpc.mock.calls.map(c=>c[0])).toEqual(['obtener_credencial_interna','verificar_credencial_multisede'])
})
it('no intenta obtener detalles internos sin permiso',async()=>{
 supabase.rpc.mockResolvedValue({error:new Error('Sin permiso')})
 await expect(getInternalCredential('token')).rejects.toThrow('Sin permiso')
 expect(supabase.rpc).toHaveBeenCalledTimes(1)
})
it('informa fallo de verificación sin usar autorizaciones históricas',async()=>{
 supabase.rpc.mockResolvedValueOnce({data:{scope:'sede'}}).mockResolvedValueOnce({error:new Error('red')})
 expect(await getInternalCredential('token')).toMatchObject({accessError:true,currentAccess:null})
})
