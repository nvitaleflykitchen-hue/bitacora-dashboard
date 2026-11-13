// @vitest-environment node
import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import {beforeAll,afterAll,it,expect} from 'vitest'
let pg
const admin='00000000-0000-0000-0000-000000000001',editor='00000000-0000-0000-0000-000000000002',other='00000000-0000-0000-0000-000000000003',inactive='00000000-0000-0000-0000-000000000004'
const login=async id=>{await pg.exec('reset role');await pg.query("select set_config('test.user',$1,false)",[id]);await pg.exec('set role authenticated')}
beforeAll(async()=>{
 pg=new PGlite()
 await pg.exec(`create schema equipo;create schema bitacora;create schema auth;create role authenticated;create role anon;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
 create table bitacora.perfiles(id uuid primary key,rol text,activo boolean,must_change_password boolean default false);
 create table bitacora.sedes(id int primary key,nombre text);
 create table equipo.personas(id uuid primary key default gen_random_uuid(),dni text,duplicado_de uuid,nombre text);
 insert into bitacora.perfiles(id,rol,activo)values('${admin}','admin',true),('${editor}','editor',true),('${other}','editor',true),('${inactive}','admin',false);
 insert into bitacora.sedes values(24,'Planta Córdoba');insert into equipo.personas(dni,nombre)values('30.000.001','Flykitchen existente');
 grant usage on schema equipo,bitacora,auth to authenticated,anon;
 grant select on bitacora.perfiles,bitacora.sedes,equipo.personas to authenticated;
 grant insert,update on equipo.personas to authenticated;
 `)
 await pg.exec(readFileSync(new URL('../../supabase/migrations/20261113090000_rrhh_empresas_REVIEW.sql',import.meta.url),'utf8'))
},60000)
afterAll(async()=>pg?.close())
it('seeds only companies and Cao; preserves existing people and operational sites',async()=>{
 expect((await pg.query('select count(*)::int n from bitacora.sedes')).rows[0].n).toBe(1)
 expect((await pg.query('select count(*)::int n from equipo.personas')).rows[0].n).toBe(1)
 expect((await pg.query('select count(*)::int n from equipo.rrhh_colaboradores')).rows[0].n).toBe(0)
 expect((await pg.query('select id from equipo.rrhh_empresas order by id')).rows.map(r=>r.id)).toEqual(['drill','flykitchen','tempura'])
})
it('denies anonymous, unassigned editors and inactive administrators',async()=>{
 await pg.exec('set role anon')
 await expect(pg.query('select * from equipo.rrhh_colaboradores')).rejects.toThrow(/permission denied/i)
 for(const id of [other,inactive]){await login(id);expect((await pg.query('select * from equipo.rrhh_empresas')).rows).toEqual([])}
 await expect(pg.query("insert into equipo.rrhh_unidades(empresa_id,nombre)values('drill','No autorizado')")).rejects.toThrow(/row-level security/i)
})
it('only admins can assign central editors; ordinary editors cannot self-enrol',async()=>{
 await login(other)
 await expect(pg.query('insert into equipo.rrhh_operadores(perfil_id)values($1)',[other])).rejects.toThrow(/row-level security/i)
 await login(admin);await pg.query('insert into equipo.rrhh_operadores(perfil_id)values($1)',[editor])
 await login(editor);expect((await pg.query('select * from equipo.rrhh_empresas')).rows).toHaveLength(3)
 await pg.exec("insert into equipo.rrhh_unidades(empresa_id,nombre)values('drill','Unidad Drill')")
})
let personId,drillId,caoId
it('requires a unit of the same company and prevents duplicated DNI across both registries',async()=>{
 await login(editor)
 const units=(await pg.query('select * from equipo.rrhh_unidades')).rows
 drillId=units.find(u=>u.empresa_id==='drill').id;caoId=units.find(u=>u.empresa_id==='tempura').id
 const insert=(company,unit,dni)=>pg.query("insert into equipo.rrhh_colaboradores(empresa_id,unidad_id,nombre,dni,motivo_cambio)values($1,$2,'Nueva persona',$3,'Alta inicial') returning id",[company,unit,dni])
 await expect(insert('drill',caoId,'30000002')).rejects.toThrow()
 await expect(insert('drill',drillId,'30000001')).rejects.toThrow(/FlyKitchen/)
 personId=(await insert('drill',drillId,'30000002')).rows[0].id
 await expect(insert('tempura',caoId,'30000002')).rejects.toThrow(/unique/i)
 await expect(pg.query("insert into equipo.personas(dni,nombre)values('30.000.002','Duplicado FK')")).rejects.toThrow(/otra empresa/)
 expect((await pg.query('select count(*)::int n from bitacora.sedes')).rows[0].n).toBe(1)
})
it('records a transfer with one current company and immutable history',async()=>{
 await login(editor)
 await pg.query("update equipo.rrhh_colaboradores set empresa_id='tempura',unidad_id=$1,motivo_cambio='Traslado acordado' where id=$2",[caoId,personId])
 const current=(await pg.query('select * from equipo.rrhh_colaboradores where id=$1',[personId])).rows[0]
 expect(current.empresa_id).toBe('tempura')
 const events=(await pg.query("select * from equipo.rrhh_auditoria where entidad='rrhh_colaboradores' and registro_id=$1 order by id",[personId])).rows
 expect(events).toHaveLength(2);expect(events[1].antes.empresa_id).toBe('drill');expect(events[1].despues.empresa_id).toBe('tempura');expect(events[1].actor_id).toBe(editor)
 await expect(pg.query('delete from equipo.rrhh_auditoria')).rejects.toThrow(/permission denied/i)
 await expect(pg.query("update equipo.rrhh_auditoria set accion='CAMBIADO'")).rejects.toThrow(/permission denied/i)
 await expect(pg.query('delete from equipo.rrhh_colaboradores')).rejects.toThrow(/permission denied/i)
})
it('rejects empty reasons, inactive unit assignments and moving RRHH units into FlyKitchen',async()=>{
 await login(editor)
 await expect(pg.query("update equipo.rrhh_colaboradores set motivo_cambio='' where id=$1",[personId])).rejects.toThrow()
 await pg.query('update equipo.rrhh_unidades set activa=false where id=$1',[drillId])
 await expect(pg.query("update equipo.rrhh_colaboradores set empresa_id='drill',unidad_id=$1,motivo_cambio='Otro traslado' where id=$2",[drillId,personId])).rejects.toThrow(/unidad activa/)
 await expect(pg.query("insert into equipo.rrhh_unidades(empresa_id,nombre)values('flykitchen','Nueva operativa')")).rejects.toThrow()
})
it('removes access immediately when central membership is disabled',async()=>{
 await login(admin);await pg.query('update equipo.rrhh_operadores set activo=false where perfil_id=$1',[editor])
 await login(editor);expect((await pg.query('select * from equipo.rrhh_colaboradores')).rows).toHaveLength(0)
 await expect(pg.query("insert into equipo.rrhh_unidades(empresa_id,nombre)values('tempura','No autorizado')")).rejects.toThrow(/row-level security/i)
})
it('does not block account removal and retains the author of previous changes',async()=>{
 await pg.exec('reset role');await pg.query('delete from bitacora.perfiles where id=$1',[editor])
 expect((await pg.query('select * from equipo.rrhh_operadores where perfil_id=$1',[editor])).rows).toHaveLength(0)
 expect((await pg.query('select creado_por from equipo.rrhh_colaboradores where id=$1',[personId])).rows[0].creado_por).toBe(editor)
 expect((await pg.query("select * from equipo.rrhh_auditoria where entidad='rrhh_operadores' and accion='DELETE'")).rows).toHaveLength(1)
})
