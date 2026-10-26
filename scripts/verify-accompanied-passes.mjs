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

await db.exec(await readFile(new URL('../supabase/migrations/20261026164321_pases_acompanados.sql',import.meta.url),'utf8'))
const catalog=(await db.query('select * from equipo.credencial_sectores where activo')).rows
const sector=catalog.find(s=>s.codigo==='Vd'&&s.sede_id===24).id
const future=catalog.find(s=>s.codigo==='Da'&&s.sede_id===24).id
const borrower='00000000-0000-0000-0000-000000000004'
await db.query("insert into equipo.personas(id,nombre,activo) values($1,'Operario temporal',true)",[borrower])
const cards=(await db.query("select * from equipo.pases_acompanados order by codigo")).rows
assert.equal(cards.length,5)
const login=uid=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${uid}'`)
const rpc=(sql,args=[])=>db.query(sql,args)
const verify=async token=>(await rpc('select public.verificar_pase_acompanado($1) as v',[token])).rows[0].v
const until=new Date(Date.now()+3600000).toISOString()
const deliver=(card,visitor=null,employee=borrower,esc=person,sec=sector)=>rpc('select public.entregar_pase_acompanado($1,$2,$3,$4,$5,$6,$7) as id',[card,employee,visitor,null,esc,sec,until])
await login(reader)
assert.equal((await rpc('select * from equipo.pases_acompanados')).rows.length,0)
await assert.rejects(()=>deliver(cards[0].id),/administradores/)
await login(admin)
await assert.rejects(()=>deliver(cards[0].id),/acceso vigente/)
await rpc('select * from public.emitir_credencial_multisede($1,null,$2,$3)',[person,{area:'production',autorizacion_confirmada:true,autorizacion_responsable:'Responsable',autorizacion_motivo:'Prueba aislada'},[sector]])
await assert.rejects(()=>deliver(cards[0].id,null,person),/sí misma/)
await assert.rejects(()=>deliver(cards[0].id,null,borrower,person,future),/acceso vigente/)
const delivery=(await deliver(cards[0].id)).rows[0].id
assert.equal((await verify(cards[0].token)).vigente,true)
await assert.rejects(()=>deliver(cards[0].id),/devolución/)
await assert.rejects(()=>rpc('delete from equipo.pase_entregas'),/permission denied/)
await rpc('select public.cerrar_pase_acompanado($1,false)',[delivery])
assert.equal((await verify(cards[0].token)).vigente,false)
await deliver(cards[0].id)
const visit=(await deliver(null,'Visita Ficticia',null)).rows[0].id
const visitCard=(await rpc('select p.* from equipo.pases_acompanados p join equipo.pase_entregas e on e.pase_id=p.id where e.id=$1',[visit])).rows[0]
assert.equal((await verify(visitCard.token)).vigente,true)
await rpc('select public.cerrar_pase_acompanado($1,true)',[visit])
assert.equal((await verify(visitCard.token)).estado,'anulado')
await db.exec('reset role')
await rpc('update equipo.credencial_sectores set habilitado_ingreso=false where id=$1',[sector])
assert.equal((await verify(cards[0].token)).vigente,false)
await rpc("update equipo.credencial_sectores set habilitado_ingreso=true,acta_habilitacion='Prueba aislada de rehabilitación' where id=$1",[sector])
await rpc('update equipo.personas set activo=false where id=$1',[borrower])
assert.equal((await verify(cards[0].token)).vigente,false)
await rpc('update equipo.personas set activo=true where id=$1',[borrower])
await rpc("update equipo.pase_entregas set desde=now()-interval '2 hours',hasta=now()-interval '1 hour' where pase_id=$1 and devuelto_at is null",[cards[0].id])
assert.equal((await verify(cards[0].token)).estado,'vencido')
await rpc("update equipo.pase_entregas set hasta=now()+interval '1 hour' where pase_id=$1 and devuelto_at is null",[cards[0].id])
await rpc("update equipo.credenciales_personal set estado='anulada'")
assert.equal((await verify(cards[0].token)).vigente,false)
await db.exec('set role anon')
await assert.rejects(()=>rpc('select * from equipo.pase_entregas'),/permission denied/)
assert.equal((await verify(cards[0].token)).vigente,false)
await db.close()
console.log('Pases: cinco unidades, RLS, nominación, acompañante vigente, sector, devolución, reutilización, visita, extravío y revocación OK')
