// @vitest-environment node
// Isolated Postgres engine: no production connection or records.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, it, expect } from 'vitest'
let pg, template, form
const admin='00000000-0000-0000-0000-000000000001', limited='00000000-0000-0000-0000-000000000002'
const person='00000000-0000-0000-0000-000000000011', other='00000000-0000-0000-0000-000000000012'
const variables={fecha:'2026-10-10',desde:'08:00',hasta:'18:00',sectores:'1, 3',tareas:'Servicio',empresa:'Empresa de prueba'}
const login=async id=>pg.query("select set_config('test.user',$1,false)",[id])
const save=(id=null,version=0,sede=1,ids=[person])=>pg.query('select to_jsonb(bitacora.fp_save($1,$2,$3,$4,$5::uuid[],null,$6)) as f',[id,version,template,sede,ids,variables])
beforeAll(async()=>{
 pg=new PGlite()
 await pg.exec(`create schema auth; create schema bitacora; create schema equipo; create schema storage;
 create role anon; create role authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
 create table auth.users(id uuid primary key);
 create table bitacora.perfiles(id uuid primary key,rol text,activo boolean,nombre text,sede_ids integer[],grupo_id integer);
 create table bitacora.sedes(id integer primary key,nombre text,grupo_id integer,tipo text);
 create table equipo.personas(id uuid primary key,nombre text,apellido text,dni text,legajo text,puesto text,sede_ids integer[],activo boolean,credencial_aeroportuaria_numero text,credencial_aeroportuaria_vencimiento date);
 create table equipo.persona_encuadres(persona_id uuid,puesto_cct_id uuid,fecha_desde date,fecha_hasta date,es_principal boolean);
 create table equipo.puestos_cct(id uuid,nombre text);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);
 alter table storage.objects enable row level security;
 grant usage on schema auth,bitacora,storage to authenticated,anon;
 grant select,insert,update,delete on storage.objects to authenticated;
 insert into auth.users values('${admin}'),('${limited}');
 insert into bitacora.perfiles values('${admin}','admin',true,'Admin',array[1],null),('${limited}','encargado',true,'Encargado',array[1],null);
 insert into bitacora.sedes values(1,'Sede Uno',1,'Aeropuerto'),(2,'Sede Dos',2,'Hospital');
 insert into equipo.personas values('${person}','Ana','Prueba','12345678','100','Operador',array[1],true,'123','2027-01-01'),('${other}','Otra','Prueba','23456789','200','Operador',array[2],true,null,null);`)
 await pg.exec(readFileSync(new URL('../../supabase/migrations/20261003235333_formularios_permisos_review.sql',import.meta.url),'utf8'))
 await login(admin);await pg.exec('set role authenticated')
 template=(await pg.query("select bitacora.fp_context() as c")).rows[0].c.plantillas.find(t=>t.tipo==='ppa_auto').id
},60000)
afterAll(async()=>{await pg?.close()})
it('isolates sites and denies direct reads and anonymous RPC access',async()=>{
 await login(limited)
 const c=(await pg.query('select bitacora.fp_context() as c')).rows[0].c
 expect(c.sedes.map(s=>s.id)).toEqual([1]);expect(c.personas.map(p=>p.id)).toEqual([person])
 await expect(save(null,0,2,[other])).rejects.toThrow('Sin permiso')
 await expect(pg.query('select * from bitacora.fp_formularios')).rejects.toThrow('permission denied')
 await pg.exec('reset role; set role anon');await expect(pg.query('select bitacora.fp_context()')).rejects.toThrow('permission denied')
 await pg.exec('reset role; set role authenticated');await login(admin)
})
it('persists structured snapshots and rejects stale drafts',async()=>{
 form=(await save()).rows[0].f
 expect(form.datos.personas[0].dni).toBe('12345678')
 form=(await save(form.id,form.version)).rows[0].f
 await expect(save(form.id,1)).rejects.toThrow('borrador cambió')
 await expect(save(form.id,null)).rejects.toThrow('borrador cambió')
})
it('requires private PDF upload before generation; freezes finalized documents',async()=>{
 const path=`${form.id}/00000000-0000-0000-0000-000000000099.pdf`
 const transition=()=>pg.query("select to_jsonb(bitacora.fp_transition($1,$2,'generado',$3,'[]')) as f",[form.id,form.version,path])
 await expect(transition()).rejects.toThrow('Primero debe guardarse')
 await pg.query('insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)',['formularios-permisos',path,admin])
 form=(await transition()).rows[0].f
 expect(form.estado).toBe('generado');expect(form.archivo).toBe(path)
 await expect(save(form.id,form.version)).rejects.toThrow('borrador cambió')
 expect((await pg.query('select * from storage.objects')).rows).toHaveLength(1)
 expect((await pg.query('delete from storage.objects returning *')).rows).toHaveLength(0)
 await expect(pg.query('insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)',['formularios-permisos',`${form.id}/00000000-0000-0000-0000-000000000098.pdf`,admin])).rejects.toThrow('row-level security')
 await login(limited);await expect(pg.query("select bitacora.fp_role_save('encargado',array['plantillas'])")).rejects.toThrow('administrador');await login(admin)
})
it('enforces state order, records actors and keeps old template versions',async()=>{
 await expect(pg.query("select bitacora.fp_transition($1,$2,'presentado')",[form.id,form.version])).rejects.toThrow('Transición')
 form=(await pg.query("select to_jsonb(bitacora.fp_transition($1,$2,'firmado')) as f",[form.id,form.version])).rows[0].f
 form=(await pg.query("select to_jsonb(bitacora.fp_transition($1,$2,'presentado')) as f",[form.id,form.version])).rows[0].f
 expect(form.firmado_at).toBeTruthy();expect(form.presentado_at).toBeTruthy()
 await pg.query("select bitacora.fp_template_version('ppa_auto','Versión nueva','Nueva instrucción')")
 const stored=(await pg.query('select * from bitacora.fp_list(null)')).rows[0]
 expect(stored.plantilla.version).toBe(1)
 const history=(await pg.query('select * from bitacora.fp_history($1)',[form.id])).rows
 expect(history.length).toBeGreaterThanOrEqual(5);expect(history.every(h=>h.actor_id===admin)).toBe(true)
})
it('excludes hospitals even for admin and requires explicit supervisor designation',async()=>{
 await expect(save(null,0,2,[other])).rejects.toThrow('Sin permiso')
 const editor='00000000-0000-0000-0000-000000000003'
 await pg.exec(`reset role; insert into auth.users values('${editor}'); insert into bitacora.perfiles values('${editor}','editor',true,'Supervisor de prueba',array[1],null); set role authenticated;`)
 await login(editor)
 expect((await pg.query('select bitacora.fp_available(null) as allowed')).rows[0].allowed).toBe(false)
 await expect(pg.query('select bitacora.fp_supervisor_save($1,true)',[editor])).rejects.toThrow('administrador')
 await login(admin);await pg.query('select bitacora.fp_supervisor_save($1,true)',[editor]);await login(editor)
 expect((await pg.query('select bitacora.fp_available(null) as allowed')).rows[0].allowed).toBe(true)
 await expect(save(null,0,2,[other])).rejects.toThrow('Sin permiso')
 await login(admin);await pg.query('select bitacora.fp_supervisor_save($1,false)',[editor]);await login(editor)
 expect((await pg.query('select bitacora.fp_available(null) as allowed')).rows[0].allowed).toBe(false)
 await login(admin)
})
