-- Proyecto: mixyhfdlzjarvszinytk. Catálogo aprobado por el usuario el 16/10/2026.
-- No modifica GRANT/RLS ni emisiones existentes. Los códigos numéricos se conservan
-- para validar las credenciales históricas, pero no pueden usarse en nuevas emisiones.
begin;
alter table equipo.credencial_sectores drop constraint credencial_sectores_codigo_check;
alter table equipo.credencial_sectores add constraint credencial_sectores_codigo_check
check (codigo ~ '^([0-9]{2}|[ABCDGHIJKLMZ])$');

do $catalogo$
declare aeropuerto integer; planta integer;
begin
 select id into strict aeropuerto from bitacora.sedes where nombre='Aeropuerto de Córdoba';
 select id into strict planta from bitacora.sedes where nombre='Planta de Producción Córdoba';
 insert into equipo.credencial_sectores(sede_id,codigo,nombre,clasificacion,zra)
 select sede,codigo,nombre,clasificacion,zra from unnest(array[aeropuerto,planta]) sede
 cross join (values
 ('A','Administración y oficinas','General controlado',false),
 ('B','Cocina y producción primaria','Operativo',false),
 ('C','Depósitos de materias primas','Operativo',false),
 ('D','Armado de catering aeroportuario, cámaras de producto terminado y trolleys','Restringido',true),
 ('G','Despacho aeroportuario y dársena','Restringido',true),
 ('H','Lavado, retornos y residuos','Operativo controlado',false),
 ('I','Área técnica y mantenimiento','Acceso especial',false),
 ('Z','Acceso total a los sectores de esta sede, incluido ZRA','Acceso total',true)
 ) as catalogo(codigo,nombre,clasificacion,zra);
 insert into equipo.credencial_sectores(sede_id,codigo,nombre,clasificacion,zra) values
 (planta,'J','Armado fábricas','Producción',false),
 (planta,'K','Cocina caliente','Producción',false),
 (planta,'L','Carnicería','Producción',false),
 (planta,'M','Pastelería','Producción',false);
end $catalogo$;

create or replace function equipo.validar_sectores_credencial()
returns trigger language plpgsql set search_path='' as $function$
declare esperado jsonb; cantidad integer;
begin
 if TG_OP='UPDATE' then
  if new.sectores_autorizados is distinct from old.sectores_autorizados
   or new.autorizacion_confirmada is distinct from old.autorizacion_confirmada
   or new.area_impresa is distinct from old.area_impresa
   or new.persona_id is distinct from old.persona_id
   or new.token is distinct from old.token
   or new.fecha_emision is distinct from old.fecha_emision
   or new.fecha_vencimiento is distinct from old.fecha_vencimiento
   or new.emitida_por is distinct from old.emitida_por then
   raise exception 'Para cambiar la autorización debe reemitir la credencial.';
  end if;
  if old.estado <> 'activa' and new.estado='activa' then
   raise exception 'Una credencial invalidada no puede reactivarse.';
  end if;
  return new;
 end if;
 cantidad := jsonb_array_length(new.sectores_autorizados);
 if cantidad=0 then return new; end if;
 if not new.autorizacion_confirmada then raise exception 'Debe confirmar la autorización individual.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'sede_id',s.sede_id,'sede_nombre',d.nombre,
 'codigo',s.codigo,'nombre',s.nombre,'zra',s.zra) order by s.sede_id,s.codigo),'[]'::jsonb)
 into esperado from equipo.credencial_sectores s join bitacora.sedes d on d.id=s.sede_id
 where s.activo and d.activa and s.codigo ~ '^[ABCDGHIJKLMZ]$'
 and s.id in (select (v->>'id')::uuid from jsonb_array_elements(new.sectores_autorizados) v);
 if jsonb_array_length(esperado)<>cantidad then raise exception 'Sector inexistente, duplicado, inactivo o del catálogo numérico anterior. Seleccione las letras y reemita.'; end if;
 if exists (
  select 1 from jsonb_array_elements(esperado) v group by v->>'sede_id'
  having bool_or(v->>'codigo'='Z') and count(*)>1
 ) then raise exception 'Z ya incluye todos los sectores de la sede. Seleccione Z o los sectores individuales.'; end if;
 new.sectores_autorizados := esperado;
 return new;
end $function$;
commit;
