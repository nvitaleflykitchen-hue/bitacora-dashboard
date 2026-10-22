process.on('uncaughtException', e => { console.error(e.message, e.code, e.position || '', e.where || '', e.stack?.split('\n').filter(l=>l.includes('verify-sector'))); process.exit(1) })
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

await db.exec(`
alter table equipo.personas add column sede_ids integer[] default array[24], add column perfil_id uuid;
alter table bitacora.perfiles add column sede_ids integer[] default array[24];
create table bitacora.perfil_permisos(perfil_id uuid,modulo text,accion text,activo boolean, constraint perfil_permisos_accion_check check(accion in ('report')), constraint perfil_permisos_scope_check check(modulo='personal' and accion='report'));
grant select on bitacora.perfil_permisos to authenticated;
insert into bitacora.sedes values(21,'Aeropuerto de Córdoba',true);
update equipo.personas set perfil_id='${reader}';
`)
const login=async id=>{await db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${id}'`)}
await login(admin)
const legacyId=(await db.query("select id from equipo.credencial_sectores where codigo='04'")).rows[0].id
const issue=async(previous,ids,expiry={})=> (await db.query('select * from public.emitir_credencial_multisede($1,$2,$3,$4)',[
  person,previous,{area:'operations',autorizacion_confirmada:true,sector_vigencias:expiry},ids,
])).rows[0]
const legacy=await issue(null,[legacyId])
await db.exec('reset role')
await db.exec(await readFile(new URL('../supabase/migrations/20261022162846_matriz_sectores_REVIEW.sql',import.meta.url),'utf8'))
const catalog=(await db.query("select * from equipo.credencial_sectores where sede_id=24 and activo order by numero")).rows
assert.equal(catalog.filter(s=>s.tipo==='sector').length,18)
assert.equal(catalog.filter(s=>s.tipo==='condicion').length,1)
const armed=catalog.find(s=>s.simbolo==='Ar'),air=catalog.find(s=>s.simbolo==='Ae'),total=catalog.find(s=>s.tipo==='condicion')
const verify=async token=>(await db.query('select * from public.verificar_credencial_multisede($1)',[token])).rows[0]
assert.equal((await verify(legacy.token)).sectores_autorizados.length,0)
assert.equal((await db.query('select sectores_autorizados from equipo.credenciales_personal where id=$1',[legacy.id])).rows[0].sectores_autorizados[0].codigo,'04')
await login(admin)
const first=await issue(legacy.id,[armed.id])
assert.deepEqual(first.sectores_autorizados.map(s=>s.codigo),['10-Ar'])
assert.equal((await verify(first.token)).sectores_autorizados.some(s=>s.simbolo==='Ae'),false)
await assert.rejects(()=>issue(first.id,[legacyId]),/inexistente/)
await assert.rejects(()=>issue(first.id,[armed.id,armed.id]),/duplicado/)
await assert.rejects(()=>issue(first.id,[armed.id,total.id]),/acceso total/)
await assert.rejects(()=>issue(first.id,[armed.id],{[armed.id]:'2000-01-01'}),/vencimiento/)
await assert.rejects(()=>db.query("update equipo.credencial_sectores set numero=99 where id=$1",[armed.id]),/inmutable/)
await assert.rejects(()=>db.query("insert into equipo.credencial_sectores(sede_id,codigo,numero,simbolo,nombre,grupo,version_matriz,clasificacion) values(24,'10-Xx',10,'Xx','Otra','Producción',2,'General')"),/duplicate key/)
const today=(await db.query('select current_date::text as fecha')).rows[0].fecha
const second=await issue(first.id,[air.id],{[air.id]:today})
assert.equal((await verify(second.token)).sectores_autorizados.length,1)
assert.equal((await verify(first.token)).sectores_autorizados.length,0)
assert.ok((await db.query('select * from equipo.credencial_eventos where persona_id=$1',[person])).rows.some(e=>e.operacion==='revocacion'))
await assert.rejects(()=>db.query('delete from equipo.credencial_eventos'),/permission denied/)
await login(reader)
await assert.rejects(()=>issue(second.id,[armed.id]),/facultad/)
await assert.rejects(()=>db.query("update equipo.credencial_sectores set nombre='Alterado' where id=$1 returning id",[armed.id]).then(r=>{assert.equal(r.rows.length,0);throw new Error('denied')}),/denied/)
assert.equal((await db.query('select * from equipo.credencial_eventos')).rows.length,0)
assert.equal((await db.query('select public.mis_sectores_autorizados() data')).rows[0].data.sectores_autorizados[0].codigo,'18-Ae')
await db.exec(`reset role;insert into bitacora.perfil_permisos values('${reader}','personal','manage_sector_access',true)`)
await login(reader)
const third=await issue(second.id,[armed.id])
assert.equal(third.sectores_autorizados[0].codigo,'10-Ar')
await db.exec(`reset role;update bitacora.perfiles set sede_ids=array[21] where id='${reader}'`)
await login(reader)
await assert.rejects(()=>issue(third.id,[air.id]),/facultad/)
await db.exec("reset role;set role anon")
await assert.rejects(()=>issue(third.id,[air.id]),/permission denied/)
await assert.rejects(()=>db.query('select * from equipo.credencial_sectores'),/permission denied/)
await assert.rejects(()=>db.query('select public.mis_sectores_autorizados()'),/permission denied/)
assert.equal((await verify(third.token)).sectores_autorizados[0].codigo,'10-Ar')
await db.exec('reset role')
// Simula caducidad en la base aislada sin modificar producción.
await db.exec('alter table equipo.credenciales_personal disable trigger validar_sectores_credencial')
await db.query("update equipo.credenciales_personal set sectores_autorizados=jsonb_set(sectores_autorizados,'{0,vigente_hasta}','\"2000-01-01\"') where id=$1",[third.id])
await db.exec('alter table equipo.credenciales_personal enable trigger validar_sectores_credencial')
assert.equal((await verify(third.token)).sectores_autorizados.length,0)
await db.close()
console.log('PASS: matriz 18 sectores, legado preservado/desactivado, unicidad, sin herencia, temporalidad, revocación, auditoría, admin/delegado/propio/anon. Base aislada.')


