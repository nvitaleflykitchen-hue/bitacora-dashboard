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
const catalog=(await db.query('select * from equipo.credencial_sectores where activo')).rows
assert.equal(catalog.filter(s=>s.sede_id===24&&s.tipo==='sector').length,19)
assert.equal(catalog.filter(s=>s.sede_id===24&&s.tipo==='sector'&&s.zra).length,6)
assert.deepEqual(catalog.filter(s=>s.sede_id===21&&s.tipo==='sector').map(s=>s.codigo).sort(),['Ae','Da','Pp'])
const id=(site,code)=>catalog.find(s=>s.sede_id===site&&s.codigo===code).id
const login=async uid=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${uid}'`)
const expiry=(await db.query("select (current_date+30)::text as d")).rows[0].d
const datos={area:'airports',autorizacion_confirmada:true,autorizacion_responsable:'Responsable de prueba',autorizacion_motivo:'Prueba aislada',fa_vencimiento:expiry}
const issue=async(previous,ids,extra={})=>(await db.query('select * from public.emitir_credencial_multisede($1,$2,$3,$4)',[person,previous,{...datos,...extra},ids])).rows[0]
const verify=async token=>(await db.query('select * from public.verificar_credencial_multisede($1)',[token])).rows[0]
await login(admin)
await assert.rejects(()=>issue(null,[id(24,'FA')],{autorizacion_motivo:''}),/motivo/)
await assert.rejects(()=>issue(null,[id(24,'FA')],{fa_vencimiento:null}),/vigencia/)
await assert.rejects(()=>issue(null,[id(24,'FA'),id(24,'Of')]),/FA o sectores/)
const c=await issue(null,[id(24,'FA'),id(21,'Ae')])
assert.equal(c.sectores_autorizados.length,2)
assert.ok((await verify(c.token)).sectores_autorizados.every(s=>s.sede_id===24))
assert.equal((await verify(c.token)).sectores_autorizados.length,16)
// Fixture temporal aislado para comprobar un FA vencido sin esperar un día real.
await db.exec(`reset role;alter table equipo.credenciales_personal disable trigger validar_sectores_credencial;
 update equipo.credenciales_personal set fa_vencimiento=current_date-1 where id='${c.id}';
 alter table equipo.credenciales_personal enable trigger validar_sectores_credencial;set role anon`)
assert.equal((await verify(c.token)).sectores_autorizados.length,0)
await db.exec(`reset role;alter table equipo.credenciales_personal disable trigger validar_sectores_credencial;
 update equipo.credenciales_personal set fa_vencimiento=current_date+30 where id='${c.id}';
 alter table equipo.credenciales_personal enable trigger validar_sectores_credencial`)
await login(admin)

await assert.rejects(()=>db.query("update equipo.credenciales_personal set fa_vencimiento=current_date where id=$1",[c.id]),/reemitir/)
await db.exec("reset role;update equipo.credencial_sectores set habilitado_ingreso=false,estado_fisico='suspendido' where sede_id=24 and codigo='Of';set role anon")
assert.equal((await verify(c.token)).sectores_autorizados.length,15)
await db.exec('reset role')
await assert.rejects(()=>db.exec("update equipo.credencial_sectores set habilitado_ingreso=true,estado_fisico='existente' where sede_id=21 and codigo='Da'"),/acta/)
await db.exec("update equipo.credencial_sectores set habilitado_ingreso=true,estado_fisico='existente',acta_habilitacion='ACTA-FICTICIA' where sede_id=21 and codigo='Ae'")
await db.exec('set role anon')
assert.deepEqual((await verify(c.token)).sectores_autorizados.filter(s=>s.sede_id===21).map(s=>s.codigo),['Ae'])
assert.equal((await db.query('select estado from public.verificar_credencial($1)',[c.token])).rows[0].estado,'activa')
await assert.rejects(()=>db.query('select * from equipo.credencial_accesos_auditoria'),/permission denied/)
await login(reader)
assert.equal((await db.query('select * from equipo.credencial_accesos_auditoria')).rows.length,0)
await assert.rejects(()=>issue(c.id,[id(24,'Of')]),/administradores/)
await login(admin)
const revoked=await issue(c.id,[id(24,'Ar'),id(24,'Da')])
assert.deepEqual((await verify(revoked.token)).sectores_autorizados.map(s=>s.codigo),['Ar'])
assert.equal((await verify(c.token)).sectores_autorizados.length,0)
assert.ok((await db.query('select * from equipo.credencial_accesos_auditoria')).rows.length>=4)
await assert.rejects(()=>db.query('delete from equipo.credencial_accesos_auditoria'),/permission denied/)
await db.exec(`reset role;update equipo.personas set sede_ids=array[21] where id='${person}'`)
await login(admin)
assert.equal((await verify(revoked.token)).sectores_autorizados.length,0)
await assert.rejects(()=>issue(revoked.id,[id(24,'Ar')]),/sedes asignadas/)
await db.close()
console.log('PASS V1.1: 19+3 sectores, 6 restringidos, FA por sede, proyección/suspensión, revocación, auditoría RLS y pertenencia. Sin datos reales.')
