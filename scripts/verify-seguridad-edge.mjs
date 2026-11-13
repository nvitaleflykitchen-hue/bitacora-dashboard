// Contrato de la función Edge con clientes simulados. No conecta a producción.
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
let handler, rpcCalls=[], signedCalls=[], allow=true, authValid=true, path='person/fixture.jpg', storageFails=false
const source=await readFile(new URL('../supabase/functions/seguridad-escanear/index.ts',import.meta.url),'utf8')
const createClient=(_url,key)=>key==='anon' ? {
 auth:{getUser:async()=>({data:{user:authValid?{id:'guard'}:null},error:null})},
 rpc:async(name,params)=>{rpcCalls.push({name,params});return allow?{data:{estado:'activa',foto_path:path,nombre:'Fixture'},error:null}:{data:null,error:{code:'42501',message:'Sede no autorizada.'}}},
} : {storage:{from:bucket=>({createSignedUrl:async(p,ttl)=>{signedCalls.push({bucket,path:p,ttl});if(storageFails)throw Error('network');return {data:{signedUrl:'https://example.com/signed'},error:null}}})}}
new Function('Deno','createClient',source.replace(/^import[^\r\n]*\r?\n/,'').replace('body: unknown','body').replaceAll("get('SUPABASE_URL')!","get('SUPABASE_URL')").replaceAll("get('SUPABASE_ANON_KEY')!","get('SUPABASE_ANON_KEY')").replaceAll("get('SUPABASE_SERVICE_ROLE_KEY')!","get('SUPABASE_SERVICE_ROLE_KEY')"))({
 env:{get:key=>({SUPABASE_URL:'https://example.com',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'})[key]},
 serve:fn=>{handler=fn},
},createClient)
const token='00000000-0000-0000-0000-000000000001'
const request=(auth='Bearer fixture',input={sede:24,tipo:'credencial',token})=>handler(new Request('https://example.com',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify(input)}))
assert.equal((await request('')).status,401)
authValid=false;assert.equal((await request()).status,401);authValid=true
assert.equal((await request('Bearer fixture',{sede:24,tipo:'credencial',token:'wrong'})).status,400)
allow=false;assert.equal((await request()).status,403);assert.equal(signedCalls.length,0);allow=true
let response=await request()
assert.equal(response.status,200)
assert.equal(response.headers.get('Cache-Control'),'no-store')
let value=await response.json();assert.equal(value.foto_url,'https://example.com/signed');assert.equal(value.foto_path,undefined)
assert.deepEqual(signedCalls[0],{bucket:'fotos-personal',path:'person/fixture.jpg',ttl:300})
assert.deepEqual(rpcCalls.at(-1),{name:'seguridad_operar',params:{p_accion:'escanear',p_sede:24,p_datos:{tipo:'credencial',token}}})
path='https://untrusted.example/image';value=await(await request()).json();assert.equal(value.foto_error,true);assert.equal(signedCalls.length,1)
path='person/fixture.jpg';storageFails=true;value=await(await request()).json();assert.equal(value.estado,'activa');assert.equal(value.foto_error,true)
console.log('PASS Edge Seguridad: sesión, rol/sede, QR, ruta del servidor, URL temporal y fallo de foto sin perder resultado.')
