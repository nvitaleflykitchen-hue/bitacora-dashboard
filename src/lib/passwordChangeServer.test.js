// @vitest-environment node
import {it,expect,vi} from 'vitest'
import {createPasswordChangeHandler} from '../../supabase/functions/cambiar-clave-obligatoria/handler.mjs'
function fixture({valid=true,active=true,authOk=true,complete=true}={}){
 const updates=[],filters=[]
 const chain={select:()=>chain,eq:(...args)=>{filters.push(args);return chain},is:()=>chain,single:async()=>({data:{id:'real-user',activo:active,must_change_password:true,updated_at:'2026-01-01'}}),update:values=>{updates.push(values);return chain},maybeSingle:async()=>({data:complete?{id:'real-user'}:null})}
 const admin={auth:{getUser:async()=>({data:{user:valid?{id:'real-user'}:null}})},schema:()=>({from:()=>chain})}
 const fetchImpl=vi.fn(async()=>({ok:authOk}))
 const handler=createPasswordChangeHandler({admin,url:'https://example.invalid',anonKey:'public-test',fetchImpl})
 const request=()=>handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({password:'Example-only-12345',user_id:'someone-else'})}))
 return {updates,filters,fetchImpl,request}
}
it('usa la cuenta verificada, cambia Auth antes de quitar la obligación y compara versión',async()=>{
 const f=fixture();expect((await f.request()).status).toBe(200)
 expect(f.filters.filter(([k])=>k==='id').every(([,v])=>v==='real-user')).toBe(true)
 expect(f.filters).toContainEqual(['updated_at','2026-01-01'])
 expect(f.updates[0].must_change_password).toBe(false)
 expect(f.fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer test')
})
it.each([{valid:false,status:401},{active:false,status:403},{authOk:false,status:400}])('no habilita cuentas cuando falla la validación: %j',async options=>{
 const f=fixture(options);expect((await f.request()).status).toBe(options.status);expect(f.updates).toHaveLength(0)
})
it('no informa éxito si hubo un reset administrativo concurrente',async()=>{
 expect((await fixture({complete:false}).request()).status).toBe(409)
})
