process.on('uncaughtException', e => { console.error(e.message, e.where || '', e.position || ''); process.exit(1) })
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

await db.exec('reset role');
await db.exec("create role authenticator; alter table bitacora.perfiles add column sede_ids integer[], add column must_change_password boolean default false; alter table bitacora.perfiles add constraint perfiles_rol_check check(rol in ('admin','consultor')); alter table bitacora.perfiles enable row level security; create policy fixture_profile on bitacora.perfiles for select to authenticated using (true);");
await db.exec(await readFile(new URL('../supabase/security/seguridad_porteria_REVIEW.sql',import.meta.url),'utf8'));
const guard='00000000-0000-0000-0000-000000000010';
await db.query("insert into auth.users values($1)",[guard]);
await db.query("insert into bitacora.perfiles(id,rol,activo,sede_ids) values($1,'seguridad',true,array[24])",[guard]);
await login(admin);
const previous=(await db.query('select id from equipo.credenciales_personal order by created_at desc limit 1')).rows[0].id;
await rpc('select * from public.emitir_credencial_multisede($1,$2,$3,$4)',[person,previous,{area:'production',autorizacion_confirmada:true,autorizacion_responsable:'Responsable',autorizacion_motivo:'Prueba aislada'},[sector]]);
await db.exec('reset role');
const credential=(await db.query("select * from equipo.credenciales_personal where estado='activa' limit 1")).rows[0];
const operate=async(action,site=24,values={})=>(await db.query('select public.seguridad_operar($1,$2,$3) as result',[action,site,values])).rows[0].result;
await login(reader);
await assert.rejects(()=>operate('listar'),/exclusivo/);
await login(guard);
assert.equal((await operate('sedes',null)).length,1);
await assert.rejects(()=>operate('listar',25),/Sede no autorizada/);
assert.ok((await operate('acompanantes',24,{sector})).some(p=>p.id===person));
await assert.rejects(()=>db.query('select public.entregar_pase_acompanado(null,null,null,null,null,null,null)'),/permission denied/);
const first=await operate('escanear',24,{tipo:'credencial',token:credential.token});
assert.equal(first.primera_entrega,true);
const second=await operate('escanear',24,{tipo:'credencial',token:credential.token});
assert.equal(second.primera_entrega,false);assert.equal(second.entregada_at,first.entregada_at);
const visitInput={visitante:'Visita aislada',dni:'30123456',dni_recibido:true,induccion:true,autorizacion:true,sector,acompanante:person,hasta:until};
await assert.rejects(()=>operate('entregar',24,{...visitInput,dni_recibido:false}),/DNI/);
await assert.rejects(()=>operate('entregar',24,{...visitInput,dni:'abc'}),/DNI/);
await assert.rejects(()=>operate('entregar',24,{...visitInput,autorizacion:false}),/acompañante/);
const issued=await operate('entregar',24,visitInput);
assert.ok((await operate('listar')).entregas.some(e=>e.id===issued.id&&e.dni_pendiente));
await assert.rejects(()=>operate('devolver',24,{entrega:issued.id,pase_recibido:true,dni_devuelto:false}),/DNI/);
assert.equal((await operate('devolver',24,{entrega:issued.id,pase_recibido:true,dni_devuelto:true})).cerrada,true);
await assert.rejects(()=>operate('devolver',24,{entrega:issued.id,pase_recibido:true,dni_devuelto:true}),/cerrada/);
await db.exec("set request.path='/rpc/seguridad_operar'");await db.query('select public.seguridad_pre_request()');
await db.exec("set request.path='/v_personas'");await assert.rejects(()=>db.query('select public.seguridad_pre_request()'),/sólo tiene acceso/);
await assert.rejects(()=>db.query('select * from equipo.seguridad_documentos'),/permission denied/);
assert.equal((await db.query('select * from equipo.pases_acompanados')).rows.length,0);
const own=(await db.query('select public.obtener_perfil_sesion() as p')).rows[0].p;assert.equal(own.id,guard);
await login(admin);await db.query('select * from public.acompanantes_pase($1)',[sector]);
await db.exec('reset role');
assert.equal((await db.query('select * from equipo.credencial_entregas')).rows.length,1);
assert.equal((await db.query('select * from equipo.seguridad_documentos where entrega_id=$1',[issued.id])).rows[0].devuelto_por,guard);
await db.query('update equipo.credenciales_personal set estado=$1',['anulada']);await login(guard);
assert.equal((await operate('escanear',24,{tipo:'credencial',token:credential.token})).estado,'anulada');
await db.exec('reset role');await db.query('update bitacora.perfiles set activo=false where id=$1',[guard]);await login(guard);
await assert.rejects(()=>operate('sedes',null),/exclusivo/);
await db.exec('set role anon');await assert.rejects(()=>operate('sedes',null),/permission denied/);
await db.close();console.log('Seguridad: aislamiento por rol/sede, primer escaneo idempotente, DNI obligatorio y devolución, errores y revocación OK');
