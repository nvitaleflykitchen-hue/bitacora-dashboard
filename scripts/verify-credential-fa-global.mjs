// Prueba aislada en Postgres WASM. Nunca conecta a Supabase.
// node scripts/verify-credential-migration.mjs <ruta-al-paquete-pglite/dist/index.js>
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const {PGlite}=await import(pathToFileURL(process.argv[2]).href)
const db=new PGlite()
const admin='00000000-0000-0000-0000-000000000001'
const reader='00000000-0000-0000-0000-000000000002'
const person='0dc0d9e0-ee94-4b94-a021-fa1bc191ece8'
await db.exec(`
create role anon; create role authenticated;
create schema auth; create schema bitacora; create schema equipo;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key);
create table bitacora.perfiles(id uuid primary key,rol text,activo boolean);
create table bitacora.sedes(id integer primary key,nombre text,activa boolean default true);
create table equipo.personas(id uuid primary key,nombre text,apellido text,puesto text,telefono text,email text,activo boolean,foto_url text,functional_area text,sede_ids integer[] default array[21,24],
 constraint personas_functional_area_check check(functional_area in ('operations','logistics','quality','maintenance','administration','hr')));
insert into auth.users values('${admin}'),('${reader}');
insert into bitacora.perfiles values('${admin}','admin',true),('${reader}','consultor',true);
insert into bitacora.sedes values(24,'Planta de Producción Córdoba',true),(25,'Rosario',true);
insert into equipo.personas(id,nombre,apellido,puesto,telefono,email,activo,foto_url,functional_area) values('${person}','Persona','Ficticia','Operario',null,null,true,'fixture.jpg','operations');
grant usage on schema auth,bitacora,equipo to authenticated,anon;
grant select on bitacora.perfiles,bitacora.sedes to authenticated;
grant select,update on equipo.personas to authenticated;
`)
for(const file of ['20260720172000_credenciales_personal_REVIEW.sql','20260720185500_credenciales_contacto_opcional_REVIEW.sql','20260720200000_credenciales_grupo_sanguineo.sql','20260720213000_credencial_encuadre_foto.sql','20261014180409_credenciales_multisede_REVIEW.sql']) {
  await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'))
}

await db.exec("insert into bitacora.sedes values(21,'Aeropuerto de Córdoba',true)")
for(const file of ['20261016095311_credenciales_sectores_letras_z.sql','20261023223632_sectores_accesos_v11_cordoba.sql']) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'))

await db.exec("update equipo.personas set sede_ids=array[30] where id='"+person+"'")
for(const id of ['1d44ec86-aca3-4df8-b6f8-bd7e834a6c98','b50ec994-df8e-4d47-af36-43ddb496069b','6e8785bb-0434-40a8-86e9-0dbc0f423a00','30347324-14e6-4aa2-9dbf-0d7c051651ef',reader]) {
 await db.query("insert into equipo.personas(id,nombre,apellido,activo,foto_url,sede_ids) values($1,'Fixture','Central',true,'fixture.jpg',null)",[id])
}
for(const file of ['20261026143659_credencial_observacion_opcional.sql','20261029113000_credencial_fa_todas_sedes_REVIEW.sql']) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'))
const login=async uid=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${uid}'`)
const expiry=(await db.query("select (current_date+30)::text as d")).rows[0].d
const datos={area:'operations',autorizacion_confirmada:true,autorizacion_responsable:'Responsable de prueba',fa_vencimiento:expiry,fa_todas_sedes:true}
const issue=async(previous=null,extra={},who=person,ids=[])=>(await db.query('select * from public.emitir_credencial_multisede($1,$2,$3,$4)',[who,previous,{...datos,...extra},ids])).rows[0]
const verify=async token=>(await db.query('select * from public.verificar_credencial_multisede($1)',[token])).rows[0]
await login(admin)
assert.equal((await db.query('select count(*)::int as n from equipo.credencial_fa_multisede_personas')).rows[0].n,5)
await assert.rejects(()=>issue(null,{fa_vencimiento:null}),/vigencia/)
await assert.rejects(()=>issue(null,{autorizacion_responsable:''}),/responsable/)
await assert.rejects(()=>issue(null,{},reader),/no está habilitada/)
const sector=(await db.query("select id from equipo.credencial_sectores where activo and codigo='Of'")).rows[0].id
await assert.rejects(()=>issue(null,{},person,[sector]),/no admite/)
const c=await issue()
assert.equal(c.fa_todas_sedes,true)
assert.deepEqual(c.sectores_autorizados,[])
assert.deepEqual((await db.query('select sede_ids from equipo.personas where id=$1',[person])).rows[0].sede_ids,[30])
await db.exec('reset role;set role anon')
let access=(await verify(c.token)).sectores_autorizados
assert.equal(access.filter(s=>s.tipo==='permiso').length,3)
assert.equal(access.filter(s=>s.tipo==='sector').length,16)
assert.ok(!access.some(s=>s.tipo==='sector'&&['Ae','Pp','Da'].includes(s.codigo)))
await assert.rejects(()=>db.query('select * from equipo.credencial_fa_multisede_personas'),/permission denied/)
await login(reader)
assert.equal((await db.query('select * from equipo.credencial_fa_multisede_personas')).rows.length,0)
await assert.rejects(()=>issue(c.id),/administradores/)
await login(admin)
await assert.rejects(()=>db.query("update equipo.credencial_fa_multisede_personas set activo=false"),/permission denied/)
await assert.rejects(()=>db.query("update equipo.credenciales_personal set fa_todas_sedes=false where id=$1",[c.id]),/reemitir/)
await db.exec("reset role;insert into bitacora.sedes values(99,'Nueva activa',true),(100,'Inactiva',false);set role anon")
assert.equal((await verify(c.token)).sectores_autorizados.filter(s=>s.tipo==='permiso').length,4)
await db.exec(`reset role;update equipo.credencial_fa_multisede_personas set activo=false where id='${person}';set role anon`)
assert.equal((await verify(c.token)).sectores_autorizados.length,0)
await db.exec(`reset role;update equipo.credencial_fa_multisede_personas set activo=true where id='${person}';
 alter table equipo.credenciales_personal disable trigger validar_sectores_credencial;
 update equipo.credenciales_personal set fa_vencimiento=current_date-1 where id='${c.id}';
 alter table equipo.credenciales_personal enable trigger validar_sectores_credencial;set role anon`)
assert.equal((await verify(c.token)).sectores_autorizados.length,0)
await login(admin)
const c2=await issue(c.id)
assert.equal((await verify(c.token)).estado,'anulada')
await db.exec(`reset role;update equipo.personas set activo=false where id='${person}';set role anon`)
assert.equal((await verify(c2.token)).estado,'anulada')
assert.equal((await verify(c2.token)).sectores_autorizados.length,0)
await db.exec(`reset role;update equipo.personas set activo=true where id='${person}'`)
await login(admin)
const c3=await issue(c2.id,{fa_todas_sedes:false})
assert.equal((await verify(c2.token)).sectores_autorizados.length,0)
assert.equal((await verify(c3.token)).sectores_autorizados.length,0)
assert.ok((await db.query("select count(*)::int n from equipo.credencial_accesos_auditoria where entidad='credencial_fa_multisede_personas'")).rows[0].n>=7)
await db.close()
console.log('PASS FA global: cinco elegibles, autorización nominal, todas las sedes activas, sin cambio de pertenencia, vencimiento, revocación, RLS, auditoría y áreas no habilitadas. Base aislada.')
