// @vitest-environment node
import {readFileSync} from 'node:fs'
import {it,expect} from 'vitest'
async function run({role='admin',last=null,authFails=false}={}){
 let handler,updates=[],events=[]
 const chain={
  select:()=>chain,eq:(key,value)=>{chain.target=value;return chain},
  single:async()=>({data:chain.target==='admin'?{rol:role,activo:true}:{id:'target',email:'target@example.invalid',rol:'operario',activo:true,must_change_password:false}}),
  update:value=>{updates.push(value);events.push('flag');return chain},
 }
 const db={from:()=>chain,rpc:()=>({single:async()=>({data:{activo:true,perfil_id:'target'}})})}
 const admin={schema:()=>db,auth:{getUser:async()=>({data:{user:{id:'admin'}}}),admin:{getUserById:async()=>({data:{user:{id:'target',email:'target@example.invalid',last_sign_in_at:last}}}),updateUserById:async()=>{events.push('password');return {error:authFails?new Error('fixture'):null}}}}}
 const source=readFileSync(new URL('../../supabase/functions/prepare-temporary-password/index.ts',import.meta.url),'utf8').replace(/^import[^\n]*\n/,'').replace('data: unknown','data').replaceAll("get('SUPABASE_URL')!","get('SUPABASE_URL')").replaceAll("get('SUPABASE_SERVICE_ROLE_KEY')!","get('SUPABASE_SERVICE_ROLE_KEY')")
 new Function('Deno','createClient',source)({env:{get:()=> 'fixture'},serve:f=>{handler=f}},()=>admin)
 const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer fixture'},body:JSON.stringify({persona_id:'person',user_id:'target',password:'Test-example-only-12345'})}))
 return {status:response.status,updates,events}
}
it('reafirma la obligación después del reset y renueva su marca temporal',async()=>{
 const r=await run();expect(r.status).toBe(200);expect(r.events).toEqual(['flag','password','flag'])
 expect(r.updates.every(u=>u.must_change_password===true&&typeof u.updated_at==='string')).toBe(true)
})
it('no restablece cuentas usadas durante los últimos 90 días',async()=>{
 const r=await run({last:new Date().toISOString()});expect(r.status).toBe(409);expect(r.updates).toHaveLength(0)
})
it('mantiene la obligación si Auth no confirma el cambio',async()=>{
 const r=await run({authFails:true});expect(r.status).toBe(400);expect(r.updates).toHaveLength(1);expect(r.updates[0].must_change_password).toBe(true)
})
it('rechaza al operador antes de tocar la cuenta objetivo',async()=>{
 const r=await run({role:'operario'});expect(r.status).toBe(403);expect(r.updates).toHaveLength(0)
})
