// Prueba aislada en Postgres WASM. Nunca conecta a Supabase.
// node scripts/verify-credential-migration.mjs <ruta-al-paquete-pglite/dist/index.js>
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const {PGlite}=await import(pathToFileURL(process.argv[2]).href)
const db=new PGlite()
const admin='00000000-0000-0000-0000-000000000001'
const reader='00000000-0000-0000-0000-000000000002'
const person='00000000-0000-0000-0000-000000000003'
await db.exec(`
create role anon; create role authenticated;
create schema auth; create schema bitacora; create schema equipo;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key);
create table bitacora.perfiles(id uuid primary key,rol text,activo boolean);
create table bitacora.sedes(id integer primary key,nombre text,activa boolean default true);
create table equipo.personas(id uuid primary key,nombre text,apellido text,puesto text,telefono text,email text,activo boolean,foto_url text,functional_area text,
 constraint personas_functional_area_check check(functional_area in ('operations','logistics','quality','maintenance','administration','hr')));
insert into auth.users values('${admin}'),('${reader}');
insert into bitacora.perfiles values('${admin}','admin',true),('${reader}','consultor',true);
insert into bitacora.sedes values(24,'Planta de Producción Córdoba',true),(25,'Rosario',true);
insert into equipo.personas values('${person}','Persona','Ficticia','Operario',null,null,true,'fixture.jpg','operations');
grant usage on schema auth,bitacora,equipo to authenticated,anon;
grant select on bitacora.perfiles,bitacora.sedes to authenticated;
grant select,update on equipo.personas to authenticated;
`)
for(const file of ['20260720172000_credenciales_personal_REVIEW.sql','20260720185500_credenciales_contacto_opcional_REVIEW.sql','20260720200000_credenciales_grupo_sanguineo.sql','20260720213000_credencial_encuadre_foto.sql','20261014180409_credenciales_multisede_REVIEW.sql']) {
  await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'))
}
await db.exec("insert into equipo.credencial_sectores(sede_id,codigo,nombre,clasificacion) values(25,'04','Depósito Rosario','Operativo');")
const catalog=(await db.query("select id,sede_id from equipo.credencial_sectores where codigo='04' order by sede_id")).rows
assert.equal(catalog.length,2)
const login=async id=>{await db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${id}'`)}
await login(admin)
const issue=async(previous,ids,confirmed=true)=> (await db.query('select * from public.emitir_credencial_multisede($1,$2,$3,$4)',[
  person,previous,{area:'airports',autorizacion_confirmada:confirmed},ids,
])).rows[0]
await assert.rejects(()=>issue(null,[catalog[0].id],false),/Confirme/)
const first=await issue(null,catalog.map(s=>s.id))
assert.equal(first.sectores_autorizados.length,2)
assert.deepEqual(first.sectores_autorizados.map(s=>s.sede_id),[24,25])
await assert.rejects(()=>issue(first.id,['00000000-0000-0000-0000-000000000099']),/Sector inexistente/)
assert.equal((await db.query('select estado from equipo.credenciales_personal where id=$1',[first.id])).rows[0].estado,'activa')
await assert.rejects(()=>issue(first.id,[catalog[0].id,catalog[0].id]),/duplicado/)
await assert.rejects(()=>db.query("update equipo.credenciales_personal set sectores_autorizados='[]' where id=$1",[first.id]),/reemitir/)
const second=await issue(first.id,[])
await assert.rejects(()=>issue(first.id,[]),/credencial cambió/)
assert.equal(second.sectores_autorizados.length,0)
await login(reader)
assert.equal((await db.query('select * from equipo.credencial_sectores')).rows.length,0)
await assert.rejects(()=>issue(second.id,[]),/administradores/)
await db.exec('reset role;set role anon')
await assert.rejects(()=>db.query('select * from equipo.credencial_sectores'),/permission denied/)
await assert.rejects(()=>issue(second.id,[]),/permission denied/)
const verify=async token=>(await db.query('select * from public.verificar_credencial_multisede($1)',[token])).rows[0]
assert.equal((await verify(first.token)).estado,'anulada')
assert.equal((await verify(first.token)).sectores_autorizados.length,0)
assert.equal((await verify(second.token)).estado,'activa')
await login(admin)
const third=await issue(second.id,catalog.map(s=>s.id))
await db.exec(`reset role;update equipo.credencial_sectores set activo=false where sede_id=25;set role anon`)
assert.deepEqual((await verify(third.token)).sectores_autorizados.map(s=>s.sede_id),[24])
await db.exec(`reset role;update equipo.personas set activo=false where id='${person}';set role anon`)
assert.equal((await verify(third.token)).estado,'anulada')
assert.equal((await verify(third.token)).sectores_autorizados.length,0)
await db.exec(`reset role;update equipo.personas set activo=true where id='${person}'`)
await login(admin)
await db.query("update equipo.credenciales_personal set estado='extraviada' where id=$1",[third.id])
await assert.rejects(()=>db.query("update equipo.credenciales_personal set estado='activa' where id=$1",[third.id]),/reactivarse/)
await db.exec('reset role;set role anon')
assert.equal((await verify(third.token)).estado,'extraviada')
assert.equal((await verify(third.token)).sectores_autorizados.length,0)
assert.equal(await verify('00000000-0000-0000-0000-000000000099'),undefined)
await db.exec(`reset role;insert into equipo.credenciales_personal(persona_id,fecha_emision,fecha_vencimiento)
  values('${person}',current_date-interval '3 years',current_date-1)`)
const expired=(await db.query("select token from equipo.credenciales_personal where estado='activa'")).rows[0]
await db.exec('set role anon')
assert.equal((await verify(expired.token)).estado,'vencida')
assert.equal((await db.query('select estado from public.verificar_credencial($1)',[expired.token])).rows[0].estado,'vencida')
await db.close()
console.log('PASS: SQL, RLS admin/consultor/anon, atomicidad, concurrencia optimista, multisede, baja, sector inactivo, extravío, vencimiento y QR anterior. Sin datos de producción.')
