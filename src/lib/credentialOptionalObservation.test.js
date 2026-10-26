// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { it, expect } from 'vitest'
it('permite observación vacía conservando responsable y confirmación',async()=>{
 const pg=new PGlite()
 try {
 await pg.exec(`create schema equipo; create schema bitacora; create schema auth;
 create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
 create table bitacora.perfiles(id uuid,rol text,activo boolean);
 insert into bitacora.perfiles values(auth.uid(),'admin',true);
 create table bitacora.sedes(id int,nombre text,activa boolean);
 insert into bitacora.sedes values(24,'Planta',true);
 create table equipo.personas(id uuid,sede_ids int[]);
 insert into equipo.personas values(auth.uid(),array[24]);
 create table equipo.credencial_sectores(id uuid,sede_id int,codigo text,nombre text,zra boolean,tipo text,estado_fisico text,habilitado_ingreso boolean,activo boolean);
 insert into equipo.credencial_sectores values(auth.uid(),24,'Vd','Verdulería',false,'sector','existente',true,true);
 create table equipo.credenciales_personal(sectores_autorizados jsonb,autorizacion_confirmada boolean,autorizacion_responsable text,autorizacion_motivo text,fa_vencimiento date,area_impresa text,persona_id uuid,token uuid,fecha_emision date,fecha_vencimiento date,emitida_por uuid,estado text);
 `)
 await pg.exec(readFileSync(new URL('../../supabase/migrations/20261026143659_credencial_observacion_opcional.sql',import.meta.url),'utf8'))
 await pg.exec('create trigger validate before insert or update on equipo.credenciales_personal for each row execute function equipo.validar_sectores_credencial()')
 const emit=(responsable,confirmada,motivo)=>pg.query(`insert into equipo.credenciales_personal(sectores_autorizados,persona_id,autorizacion_responsable,autorizacion_confirmada,autorizacion_motivo) values(jsonb_build_array(jsonb_build_object('id',auth.uid())),auth.uid(),$1,$2,$3) returning autorizacion_motivo`,[responsable,confirmada,motivo])
 expect((await emit('Responsable',true,null)).rows[0].autorizacion_motivo).toBeNull()
 expect((await emit('Responsable',true,'OK')).rows[0].autorizacion_motivo).toBe('OK')
 await expect(emit('',true,null)).rejects.toThrow('responsable')
 await expect(emit('Responsable',false,null)).rejects.toThrow('confirme')
 } finally { await pg.close() }
},30000)
