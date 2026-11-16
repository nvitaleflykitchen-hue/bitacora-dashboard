// @vitest-environment node
// Postgres WASM aislado. Nunca conecta a producción.
import { beforeAll,afterAll,it,expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { AIRPORT_VEHICLES,AIRPORT_ITEMS } from './airportChecklist'
const admin='00000000-0000-4000-8000-000000000001',op='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003',peer='00000000-0000-4000-8000-000000000004',locked='00000000-0000-4000-8000-000000000005'
const check='00000000-0000-4000-8000-000000000100',vehicle=AIRPORT_VEHICLES[0].id
let db
const login=id=>db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`)
const answers=()=>Object.fromEntries(AIRPORT_ITEMS.map(i=>[i.id,'ok']))
const save=(id=check,asset=vehicle,turno='mañana',km=100,resp=answers(),obs='')=>db.query('select public.aero_checklist_guardar($1,$2,$3,$4,$5,$6,$7) as result',[id,asset,turno,km,'1/2',resp,obs])
beforeAll(async()=>{
  db=new PGlite()
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema bitacora;create schema mantenimiento;create schema storage;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create table bitacora.perfiles(id uuid primary key,nombre text,rol text,activo boolean default true,must_change_password boolean default false,sede_ids integer[],grupo_id integer);
  create table bitacora.sedes(id bigint primary key,grupo_id integer);
  create table mantenimiento.activos(id uuid primary key,nombre text,codigo_interno text,tipo text default 'VEHICULO',sede_id bigint,sede_nombre text,estado text,km_actual integer);
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
  grant usage on schema public,auth,mantenimiento,storage to authenticated,anon;grant all on storage.objects to authenticated,anon;
  create policy legacy_broad on storage.objects for all to public using(true) with check(true);
  insert into bitacora.perfiles(id,nombre,rol,sede_ids,must_change_password) values('${admin}','Admin','admin',null,false),('${op}','Operario','operario',array[21],false),('${other}','Otra sede','operario',array[24],false),('${peer}','Colega','operario',array[21],false),('${locked}','Clave pendiente','operario',array[21],true);
  insert into bitacora.sedes values(21,1),(24,2);`)
  for(const v of AIRPORT_VEHICLES)await db.query("insert into mantenimiento.activos values($1,$2,$3,'VEHICULO',21,'Aeropuerto Córdoba','en_reparacion',50)",[v.id,v.model,v.plate])
  await db.exec(readFileSync(new URL('../../supabase/security/checklist_aeropuertos_REVIEW.sql',import.meta.url),'utf8'))
},30000)
afterAll(async()=>{await db?.close()})
it('rechaza cuentas inactivas y limita consultor a lectura',async()=>{
  await db.exec(`reset role;update bitacora.perfiles set activo=false where id='${peer}'`)
  await login(peer)
  expect((await db.query('select public.aero_checklist_vehiculos() as v')).rows[0].v).toEqual([])
  await expect(save()).rejects.toThrow(/sin acceso/)
  await db.exec(`reset role;update bitacora.perfiles set activo=true,rol='consultor' where id='${peer}'`)
  await login(peer)
  const vehicles=(await db.query('select public.aero_checklist_vehiculos() as v')).rows[0].v
  expect(vehicles).toHaveLength(4)
  expect(vehicles.every(v=>v.puede_controlar===false)).toBe(true)
  await expect(save()).rejects.toThrow(/solo lectura/)
  await db.exec(`reset role;update bitacora.perfiles set rol='operario' where id='${peer}'`)
})
it('impide anon, cuenta con clave pendiente y otra sede',async()=>{
  await db.exec('set role anon')
  await expect(db.query('select public.aero_checklist_vehiculos()')).rejects.toThrow(/permission denied/)
  for(const user of [other,locked]){await login(user);expect((await db.query('select public.aero_checklist_vehiculos() as v')).rows[0].v).toEqual([]);await expect(save()).rejects.toThrow(/sin acceso/)}
  await login(op)
  expect((await db.query('select public.aero_checklist_vehiculos() as v')).rows[0].v).toHaveLength(4)
  await expect(save(check,'00000000-0000-4000-8000-000000000099')).rejects.toThrow(/no asignado/)
})
it('valida controles antes de persistir y no permite insertar directamente',async()=>{
  await login(op)
  await expect(save(check,vehicle,'mañana',49)).rejects.toThrow(/última lectura/)
  await expect(save(check,vehicle,'mañana',100,{})).rejects.toThrow(/16 controles/)
  await expect(save(check,vehicle,'mañana',100,{...answers(),luces:'na'},'No corresponde')).rejects.toThrow(/inválida/)
  await expect(save(check,vehicle,'mañana',100,{...answers(),luces:'nc'})).rejects.toThrow(/Describí/)
  await expect(db.query('select * from mantenimiento.checklists_aeropuerto')).rejects.toThrow(/permission denied/)
})
it('permite en reparación, registra autor real, reintenta sin duplicar y conserva estado',async()=>{
  await login(op)
  const first=(await save()).rows[0].result
  expect(first.creado_por).toBe(op);expect(first.responsable).toBe('Operario');expect(first.resultado).toBe('sin_novedades')
  expect((await save()).rows[0].result.id).toBe(check)
  await expect(save('00000000-0000-4000-8000-000000000101')).rejects.toThrow(/ya tiene un control/)
  await expect(save(check,vehicle,'tarde')).rejects.toThrow(/Identificador usado/)
  await db.exec('reset role')
  expect((await db.query('select estado from mantenimiento.activos where id=$1',[vehicle])).rows[0].estado).toBe('en_reparacion')
  await login(other);await expect(db.query('select public.aero_checklist_historial($1)',[vehicle])).rejects.toThrow(/sin acceso/)
  await login(op);expect((await db.query('select public.aero_checklist_historial($1) as h',[vehicle])).rows[0].h).toHaveLength(1)
})
it('protege fotos incluso si existen políticas amplias previas',async()=>{
  const path=`${op}/${check}/foto.jpg`
  await login(other);await expect(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['checklist-aeropuerto-fotos',path])).rejects.toThrow(/row-level security/)
  await login(peer);await expect(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['checklist-aeropuerto-fotos',path])).rejects.toThrow(/row-level security/)
  await login(op);await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['checklist-aeropuerto-fotos',path])
  await db.query("insert into storage.objects(bucket_id,name) values('otro-bucket','no-modificar')")
  await db.exec('reset role;set role anon;select set_config(\'request.jwt.claim.sub\',\'\',false)')
  expect((await db.query("select * from storage.objects where bucket_id='checklist-aeropuerto-fotos'")).rows).toHaveLength(0)
  expect((await db.query("select * from storage.objects where bucket_id='otro-bucket'")).rows).toHaveLength(1)
  await login(peer);expect((await db.query("select * from storage.objects where bucket_id='checklist-aeropuerto-fotos'")).rows).toHaveLength(1)
  await login(op);await db.query("delete from storage.objects where bucket_id='checklist-aeropuerto-fotos'")
  expect((await db.query("select * from storage.objects where bucket_id='checklist-aeropuerto-fotos'")).rows).toHaveLength(1)
})
