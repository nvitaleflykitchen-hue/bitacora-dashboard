// @vitest-environment node
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
import {it,expect} from 'vitest'
const person='00000000-0000-0000-0000-000000000001', other='00000000-0000-0000-0000-000000000002'
const car='00000000-0000-0000-0000-000000000003', foreign='00000000-0000-0000-0000-000000000004'
it('protege autor y sede en servidor, históricos y cambio obligatorio sin abrir permisos al servicio',async()=>{
 const db=new PGlite()
 try{
  await db.exec(`
   create role anon; create role authenticated; create role service_role bypassrls;
   create schema auth; create schema bitacora; create schema bitacora_private; create schema equipo; create schema mantenimiento;
   create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create table bitacora.perfiles(id uuid primary key,nombre text,email text,activo boolean,rol text,sede_ids int[],grupo_id int,must_change_password boolean,updated_at timestamptz);
   create table bitacora.sedes(id int,grupo_id int);
   create table bitacora.perfil_permisos(perfil_id uuid,modulo text,accion text,activo boolean);
   create function bitacora_private.is_bitacora_admin() returns boolean language sql as $$ select exists(select 1 from bitacora.perfiles where id=auth.uid() and rol='admin' and activo) $$;
   create function equipo.es_cuenta_seguridad() returns boolean language sql as $$ select false $$;
   create table mantenimiento.activos(id uuid primary key,nombre text,tipo text,estado text,sede_id int,sede_nombre text,sede text);
   create table mantenimiento.visitas_activo(id int generated always as identity,activo_id uuid,observacion text,created_by uuid,visitante text,fecha timestamptz,tipo_visita text);
   insert into bitacora.perfiles values('${person}','Autor real','a@example.invalid',true,'operario','{21}',null,false,now());
   insert into bitacora.perfiles values('${other}','Admin','admin@example.invalid',true,'admin','{}',null,false,now());
   insert into mantenimiento.activos values('${car}','Auto','VEHICULO','en_reparacion',21,'Sede 21',null),('${foreign}','Otro','VEHICULO','operativo',24,'Otra sede',null);
   grant usage on schema public,auth,bitacora,mantenimiento to authenticated,service_role;
   grant all on all tables in schema bitacora,mantenimiento to authenticated,service_role;
   grant usage on all sequences in schema mantenimiento to authenticated;
  `)
  await db.exec(readFileSync(new URL('../../sql_auditoria_identidad_REVIEW.sql',import.meta.url),'utf8'))
  await db.exec('create trigger protect_profile_security_fields before update on bitacora.perfiles for each row execute function bitacora_private.protect_profile_security_fields();')
  const responses=Object.fromEntries(['balizas','frenos','luces','tablero','aceite','rampa','neumaticos','agua','combustible','matafuego'].map(k=>[k,'ok']))
  const payload={respuestas:responses,km:10,conductor:'Falso',autor_id:other,sede_id:24,created_at:'2000-01-01'}
  const save=(vehicle=car,data=payload)=>db.query('insert into mantenimiento.visitas_activo(activo_id,observacion,created_by) values($1,$2,$3) returning *',[vehicle,'CHECKLIST_VEHICULO::'+JSON.stringify(data),other])
  await db.exec(`select set_config('request.jwt.claim.sub','${person}',false);set role authenticated;`)
  const first=(await save()).rows[0]
  expect(first.created_by).toBe(person)
  expect(first.visitante).toBe('Autor real')
  expect(JSON.parse(first.observacion.split('::')[1]).sede_id).toBe(21)
  await save() // Multiple distinct controls on the same day remain allowed.
  await expect(save(foreign)).rejects.toThrow('fuera de las sedes')
  await expect(save(car,{respuestas:{}})).rejects.toThrow('diez controles')
  await expect(db.exec("update mantenimiento.visitas_activo set observacion='ocultar' where id=1")).rejects.toThrow('histórico')
  await expect(db.exec('delete from mantenimiento.visitas_activo where id=1')).rejects.toThrow('histórico')
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${other}',false); update bitacora.perfiles set must_change_password=true where id='${person}'; select set_config('request.jwt.claim.sub','${person}',false); set role authenticated`)
  await expect(db.exec(`update bitacora.perfiles set must_change_password=false where id='${person}'`)).rejects.toThrow('servidor')
  await expect(save()).rejects.toThrow('Cuenta no autorizada')
  await db.exec("select set_config('request.path','/rpc/otra_operacion',false)")
  await expect(db.query('select public.seguridad_pre_request()')).rejects.toThrow('contraseña')
  await db.exec("select set_config('request.path','/rpc/obtener_perfil_sesion',false)")
  await db.query('select public.seguridad_pre_request()')
  await db.exec("reset role; select set_config('request.jwt.claim.sub','',false); set role service_role")
  await db.exec('update bitacora.perfiles set must_change_password=false,updated_at=now()')
  await expect(db.exec("update bitacora.perfiles set rol='admin'")).rejects.toThrow('No autorizado')
 }finally{await db.close()}
},30000)
