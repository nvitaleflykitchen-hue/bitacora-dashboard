// PostgreSQL aislado en memoria. Nunca se conecta a Supabase.
// npm install --prefix .codex-tmp/email-verify @electric-sql/pglite@0.3.14
import { PGlite } from '../../.codex-tmp/email-verify/node_modules/@electric-sql/pglite/dist/index.js'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const db = new PGlite()
const owner = '626b2a44-be84-4b3e-a03f-505eaf9d195e'
const other = '00000000-0000-0000-0000-000000000002'
const reader = '00000000-0000-0000-0000-000000000003'
const box = 'a6bba28b-a681-4e24-b25f-c3bcaf9d33bf'
const mail = '00000000-0000-0000-0000-000000000004'
const plan = '00000000-0000-0000-0000-000000000005'
const person = '00000000-0000-0000-0000-000000000006'
const hiddenPerson = '00000000-0000-0000-0000-000000000007'
await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role bypassrls;
  create schema auth;
  create schema bitacora;
  create schema bitacora_private;
  create schema storage;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create table auth.users(id uuid primary key);
  insert into auth.users values('${owner}'),('${other}'),('${reader}');
  create table bitacora.capa_planes(id uuid primary key, auditoria_codigo text);
  insert into bitacora.capa_planes values('${plan}','FK-GEST-TEST');
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
  create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
  grant usage on schema auth,bitacora,storage to anon,authenticated,service_role;
  grant select on bitacora.capa_planes,storage.objects to authenticated;
`)
await db.exec(readFileSync('supabase/security/correo_evidencias_REVIEW.sql','utf8'))
await db.exec(`
  insert into bitacora.correos(id,buzon_id,carpeta,sha256,asunto,remitente,original_path)
  values('${mail}','${box}','INBOX',repeat('a',64),'Presupuesto','Proveedor','${box}/${mail}/original.eml');
  insert into storage.objects(bucket_id,name) values('correos-evidencias','${box}/${mail}/original.eml');
  insert into bitacora.correo_buzon_miembros values('${box}','${reader}',false);
`)
async function asUser(id) {
  await db.exec(`reset role; set request.jwt.claim.sub='${id}'; set role authenticated`)
}
async function count(table) { return (await db.query(`select count(*)::int as n from ${table}`)).rows[0].n }
await asUser(other)
assert.equal(await count('bitacora.correos'), 0, 'Usuario ajeno no ve correos')
assert.equal(await count('storage.objects'), 0, 'Usuario ajeno no ve originales')
assert.equal(await count('bitacora.correo_historial'), 0, 'Usuario ajeno no ve historial')
await assert.rejects(db.exec(`insert into bitacora.correo_buzon_miembros values('${box}','${other}',true)`), /permission denied/)
await asUser(reader)
assert.equal(await count('bitacora.correos'), 1)
assert.equal((await db.query(`update bitacora.correos set estado='ignorado' where id='${mail}' returning id`)).rows.length, 0, 'Lector no puede revisar')
await asUser(owner)
assert.equal(await count('bitacora.correos'), 1)
assert.equal(await count('storage.objects'), 1)
await assert.rejects(db.exec(`update bitacora.correos set cuerpo='alterado' where id='${mail}'`), /permission denied/)
await db.exec(`update bitacora.correos set estado='vinculado',plan_id='${plan}' where id='${mail}'`)
assert.equal(await count('bitacora.correo_historial'), 2, 'Asociación queda auditada')
const event = (await db.query('select * from bitacora.correo_historial order by id desc limit 1')).rows[0]
assert.equal(event.actor_id, owner)
assert.equal(event.despues.plan_id, plan)
await db.exec(`update bitacora.correos set estado='pendiente',plan_id=null where id='${mail}'`)
assert.equal(await count('bitacora.correo_historial'), 3, 'Corrección queda auditada')
await assert.rejects(db.exec(`delete from bitacora.correos where id='${mail}'`), /permission denied/)
await db.exec('reset role; set role anon')
await assert.rejects(db.exec('select * from bitacora.correos'), /permission denied/)
await db.exec('reset role')
assert.equal((await db.query('select public from storage.buckets')).rows[0].public, false)
await db.exec(`
 create schema mantenimiento;
 create schema equipo;
 create table bitacora.tareas(id integer primary key, visible boolean);
 create table bitacora.requerimientos(id integer primary key, visible boolean);
 create table mantenimiento.tickets(id uuid primary key, visible boolean);
 create table equipo.personas(id uuid primary key, visible boolean);
 insert into bitacora.tareas values(1,true),(2,false);
 insert into bitacora.requerimientos values(1,true);
 insert into mantenimiento.tickets values('${plan}',true);
 insert into equipo.personas values('${person}',true),('${hiddenPerson}',false);
 grant usage on schema mantenimiento,equipo to authenticated;
 grant select on bitacora.tareas,bitacora.requerimientos,mantenimiento.tickets,equipo.personas to authenticated;
 alter table bitacora.tareas enable row level security;
 create policy visible_tarea on bitacora.tareas for select to authenticated using(visible);
 alter table equipo.personas enable row level security;
 create policy visible_persona on equipo.personas for select to authenticated using(visible);
`)
await db.exec(readFileSync('supabase/security/correo_destinos_REVIEW.sql','utf8'))
await db.exec(readFileSync('supabase/security/correo_personas_REVIEW.sql','utf8'))
await asUser(owner)
await assert.rejects(db.exec(`update bitacora.correos set tarea_id=2,estado='vinculado' where id='${mail}'`), /row-level security/)
for (const [column,value] of [['tarea_id','1'],['compra_id','1'],['ticket_id',`'${plan}'`]]) {
 await db.exec(`update bitacora.correos set plan_id=null,tarea_id=null,compra_id=null,ticket_id=null,estado='pendiente' where id='${mail}'`)
 await db.exec(`update bitacora.correos set ${column}=${value},estado='vinculado' where id='${mail}'`)
 const event=(await db.query('select despues from bitacora.correo_historial order by id desc limit 1')).rows[0]
 assert.ok(event.despues[column])
}
await assert.rejects(db.exec(`update bitacora.correos set tarea_id=1 where id='${mail}'`), /correos_destino_check/)
await assert.rejects(db.exec(`update bitacora.correos set sugerido_tarea_id=1 where id='${mail}'`), /permission denied/)
await db.exec(`update bitacora.correos set persona_id='${person}' where id='${mail}'`)
assert.equal((await db.query('select despues from bitacora.correo_historial order by id desc limit 1')).rows[0].despues.persona_id, person)
await assert.rejects(db.exec(`update bitacora.correos set persona_id='${hiddenPerson}' where id='${mail}'`), /row-level security/)
await assert.rejects(db.exec(`update bitacora.correos set sugerido_persona_id='${person}' where id='${mail}'`), /permission denied/)
await asUser(reader)
assert.equal((await db.query(`update bitacora.correos set tarea_id=1,ticket_id=null where id='${mail}' returning id`)).rows.length,0)
assert.equal((await db.query(`update bitacora.correos set persona_id='${person}' where id='${mail}' returning id`)).rows.length,0)
await asUser(other)
assert.equal(await count('bitacora.correos'),0)
await db.exec('reset role')
await db.close()
console.log('OK: destinos, personas, RLS de gestión, revisión restringida, originales y auditoría verificados en PostgreSQL aislado.')
