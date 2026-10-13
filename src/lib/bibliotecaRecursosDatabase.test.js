// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, it, expect } from 'vitest'
let pg
const uid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`
const login=async n=>{await pg.exec('reset role');await pg.query("select set_config('test.uid',$1,false)",[uid(n)]);await pg.exec('set role authenticated')}
beforeAll(async()=>{
 pg=new PGlite()
 await pg.exec(`create schema auth;create schema bitacora;create schema storage;create role anon;create role authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table auth.users(id uuid primary key);
 create table bitacora.perfiles(id uuid,activo boolean,rol text,grupo_id integer,sede_ids integer[]);
 create table bitacora.grupos(id integer primary key,nombre text);
 create table bitacora.sedes(id integer,grupo_id integer);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema auth,bitacora,storage to anon,authenticated;
 grant all on storage.objects to anon,authenticated;
 create policy legacy_wide on storage.objects for all to public using(true) with check(true);
 insert into auth.users values('${uid(1)}'),('${uid(2)}'),('${uid(3)}');
 insert into bitacora.grupos values(3,'Aeropuertos'),(2,'Hospitales');
 insert into bitacora.sedes values(21,3),(22,2);
 insert into bitacora.perfiles values('${uid(1)}',true,'admin',null,'{}'),('${uid(2)}',true,'encargado',null,'{21}'),('${uid(3)}',true,'grupo',2,'{}');`)
 await pg.exec(readFileSync('supabase/migrations/20261013190000_biblioteca_recursos_REVIEW.sql','utf8').replace(/^\uFEFF/,''))
 await login(1)
 await pg.query("insert into storage.objects(bucket_id,name) values('biblioteca-recursos',$1)",[`${uid(1)}/${uid(99)}.pdf`])
 await pg.query("insert into bitacora.biblioteca_recursos(titulo,grupo_id,archivo_path) values('Manual',3,$1)",[`${uid(1)}/${uid(99)}.pdf`])
},60000)
afterAll(async()=>{await pg?.close()})
it('allows assigned airport users, blocks other groups and writes by non-admins',async()=>{
 await login(2)
 expect((await pg.query('select * from bitacora.biblioteca_recursos')).rows).toHaveLength(1)
 expect((await pg.query("select * from storage.objects where bucket_id='biblioteca-recursos'")).rows).toHaveLength(1)
 await expect(pg.query("insert into bitacora.biblioteca_recursos(titulo,url) values('No','https://example.com')")).rejects.toThrow()
 await login(3)
 expect((await pg.query('select * from bitacora.biblioteca_recursos')).rows).toHaveLength(0)
 expect((await pg.query("select * from storage.objects where bucket_id='biblioteca-recursos'")).rows).toHaveLength(0)
 await expect(pg.query("insert into storage.objects(bucket_id,name) values('biblioteca-recursos','no.pdf')")).rejects.toThrow()
})
it('changing audience and archiving revoke file visibility',async()=>{
 await login(1);await pg.exec('update bitacora.biblioteca_recursos set grupo_id=2')
 await login(2);expect((await pg.query('select * from storage.objects')).rows).toHaveLength(0)
 await login(3);expect((await pg.query('select * from storage.objects')).rows).toHaveLength(1)
 await login(1);await pg.exec('update bitacora.biblioteca_recursos set activo=false')
 await login(3);expect((await pg.query('select * from storage.objects')).rows).toHaveLength(0)
})
it('denies anonymous records and files despite permissive legacy storage policies',async()=>{
 await pg.exec('reset role');await pg.query("select set_config('test.uid','',false)");await pg.exec('set role anon')
 await expect(pg.query('select * from bitacora.biblioteca_recursos')).rejects.toThrow()
 // Anonymous access may fail at helper ACL before returning an empty set. Both deny access.
 let rows=[];try {rows=(await pg.query("select * from storage.objects where bucket_id='biblioteca-recursos'")).rows} catch(e){expect(e.message).toMatch(/permission denied/)}
 expect(rows).toHaveLength(0)
})
