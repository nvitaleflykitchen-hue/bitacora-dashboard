-- SOLO mixyhfdlzjarvszinytk. PENDIENTE DE APROBACIÓN (GRANT/RLS).
-- No asigna permisos ni reemite credenciales. Conserva instantáneas históricas.
begin;
do $$ begin
 if not exists(select 1 from bitacora.sedes where id=24 and nombre='Planta de Producción Córdoba')
 or not exists(select 1 from bitacora.sedes where id=21 and nombre='Aeropuerto de Córdoba') then
 raise exception 'Las sedes no coinciden con el piloto aprobado'; end if;
end $$;
alter table equipo.credencial_sectores drop constraint credencial_sectores_codigo_check;
alter table equipo.credencial_sectores add constraint credencial_sectores_codigo_check check(codigo ~ '^([0-9]{2}|[ABCDGHIJKLMZ]|[A-Z][a-z]|FA)$');
alter table equipo.credencial_sectores
 add column tipo text not null default 'sector' check(tipo in ('sector','permiso')),
 add column estado_fisico text not null default 'existente' check(estado_fisico in ('existente','reconversion','integracion','proyectado','suspendido','no_aplica')),
 add column habilitado_ingreso boolean not null default false,
 add column acta_habilitacion text,
 add constraint sector_ingreso_estado check(not habilitado_ingreso or (tipo='sector' and estado_fisico='existente')),
 add constraint permiso_fa_tipo check((tipo='permiso')=(codigo='FA'));
-- El catálogo anterior deja de conceder ingreso; sus filas e instantáneas no se borran.
update equipo.credencial_sectores set activo=false where sede_id in(21,24);
insert into equipo.credencial_sectores(sede_id,codigo,nombre,clasificacion,zra,tipo,estado_fisico,habilitado_ingreso) values
(24,'Of','Oficinas','No restringido',false,'sector','existente',true),
(24,'Rp','Recepción','No restringido',false,'sector','existente',true),
(24,'Ve','Vestuarios','No restringido',false,'sector','existente',true),
(24,'Vd','Verdulería','No restringido',false,'sector','existente',true),
(24,'Ca','Carnicería','No restringido',false,'sector','existente',true),
(24,'Cc','Cocina caliente','No restringido',false,'sector','existente',true),
(24,'Pa','Pastelería','No restringido',false,'sector','existente',true),
(24,'Dp','Depósito general','No restringido',false,'sector','existente',true),
(24,'En','Sala de envasado','No restringido',false,'sector','existente',true),
(24,'Ar','Armado general','No restringido',false,'sector','existente',true),
(24,'La','Lavadero','No restringido',false,'sector','existente',true),
(24,'Li','Sector limpieza','Restringido',true,'sector','existente',true),
(24,'Pf','Playón frontal','No restringido',false,'sector','existente',true),
(24,'Pp','Playón posterior / carga aeroportuaria','Restringido',true,'sector','reconversion',false),
(24,'Cd','Carga y descarga general','No restringido',false,'sector','existente',true),
(24,'Ci','Patio de cisternas','Restringido',true,'sector','existente',true),
(24,'Ge','Grupo electrógeno','Restringido',true,'sector','existente',true),
(24,'Ae','Sala de Líneas Aéreas / armado aeroportuario','Restringido',true,'sector','integracion',false),
(24,'Da','Depósito de Líneas Aéreas','Restringido',true,'sector','proyectado',false),
(21,'Pp','Playón posterior / carga aeroportuaria','Restringido',true,'sector','reconversion',false),
(21,'Ae','Sala de Líneas Aéreas / armado aeroportuario','Restringido',true,'sector','integracion',false),
(21,'Da','Depósito de Líneas Aéreas','Restringido',true,'sector','proyectado',false),
(24,'FA','Acceso total por sede','Permiso maestro',true,'permiso','no_aplica',false),
(21,'FA','Acceso total por sede','Permiso maestro',true,'permiso','no_aplica',false);
alter table equipo.credenciales_personal
 add column autorizacion_responsable text,
 add column autorizacion_motivo text,
 add column fa_vencimiento date;

-- Auditoría de emisiones/revocaciones y de cambios del catálogo, sólo lectura admin.
create table equipo.credencial_accesos_auditoria (
 id uuid primary key default gen_random_uuid(), fecha timestamptz not null default now(),
 ejecutor uuid, accion text not null, entidad text not null, entidad_id uuid not null,
 sede_ids integer[] not null, anterior jsonb, posterior jsonb
);
alter table equipo.credencial_accesos_auditoria enable row level security;
revoke all on equipo.credencial_accesos_auditoria from public,anon,authenticated;
grant select on equipo.credencial_accesos_auditoria to authenticated;
create policy accesos_auditoria_admin on equipo.credencial_accesos_auditoria for select to authenticated
 using(exists(select 1 from bitacora.perfiles p where p.id=(select auth.uid()) and p.rol='admin' and p.activo));
create function equipo.auditar_accesos_v11() returns trigger language plpgsql security definer set search_path='' as $$
declare antes jsonb; despues jsonb; sedes integer[];
begin
 if TG_OP<>'INSERT' then antes=to_jsonb(old); end if;
 if TG_OP<>'DELETE' then despues=to_jsonb(new); end if;
 if TG_TABLE_NAME='credencial_sectores' then
  sedes=array[coalesce(new.sede_id,old.sede_id)];
 else
  select coalesce(array_agg(distinct (v->>'sede_id')::integer),'{}'::integer[]) into sedes
  from jsonb_array_elements(coalesce(antes->'sectores_autorizados','[]') || coalesce(despues->'sectores_autorizados','[]')) v;
  -- No copiar token, datos de contacto ni fotografía a la auditoría.
  antes=antes-'token'-'compartir_telefono'-'compartir_email'-'grupo_sanguineo';
  despues=despues-'token'-'compartir_telefono'-'compartir_email'-'grupo_sanguineo';
 end if;
 insert into equipo.credencial_accesos_auditoria(ejecutor,accion,entidad,entidad_id,sede_ids,anterior,posterior)
 values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(new.id,old.id),sedes,antes,despues);
 return coalesce(new,old);
end $$;
revoke all on function equipo.auditar_accesos_v11() from public,anon,authenticated;
create trigger auditar_accesos_v11 after insert or update or delete on equipo.credenciales_personal for each row execute function equipo.auditar_accesos_v11();
create trigger auditar_catalogo_v11 after insert or update or delete on equipo.credencial_sectores for each row execute function equipo.auditar_accesos_v11();

-- La puesta en servicio debe tener referencia documental; el catálogo no es escribible por la API.
create function equipo.validar_habilitacion_sector_v11() returns trigger language plpgsql set search_path='' as $$
begin
 if new.habilitado_ingreso and not old.habilitado_ingreso and length(trim(coalesce(new.acta_habilitacion,'')))<5
 then raise exception 'Registre el acta de puesta en servicio antes de habilitar el ingreso.'; end if;
 return new;
end $$;
revoke all on function equipo.validar_habilitacion_sector_v11() from public,anon,authenticated;
create trigger validar_habilitacion_sector_v11 before update on equipo.credencial_sectores
 for each row execute function equipo.validar_habilitacion_sector_v11();
insert into equipo.credencial_accesos_auditoria(ejecutor,accion,entidad,entidad_id,sede_ids,posterior)
 select auth.uid(),'CONFIGURACION_V11','credencial_sectores',s.id,array[s.sede_id],to_jsonb(s)
 from equipo.credencial_sectores s where s.sede_id in(21,24);

create or replace function equipo.validar_sectores_credencial() returns trigger language plpgsql set search_path='' as $$
declare esperado jsonb; cantidad integer;
begin
 if TG_OP='UPDATE' then
  if new.sectores_autorizados is distinct from old.sectores_autorizados
  or new.autorizacion_confirmada is distinct from old.autorizacion_confirmada
  or new.autorizacion_responsable is distinct from old.autorizacion_responsable
  or new.autorizacion_motivo is distinct from old.autorizacion_motivo
  or new.fa_vencimiento is distinct from old.fa_vencimiento
  or new.area_impresa is distinct from old.area_impresa
  or new.persona_id is distinct from old.persona_id or new.token is distinct from old.token
  or new.fecha_emision is distinct from old.fecha_emision or new.fecha_vencimiento is distinct from old.fecha_vencimiento
  or new.emitida_por is distinct from old.emitida_por then raise exception 'Para cambiar la autorización debe reemitir la credencial.'; end if;
  if old.estado<>'activa' and new.estado='activa' then raise exception 'Una credencial invalidada no puede reactivarse.'; end if;
  return new;
 end if;
 cantidad=jsonb_array_length(new.sectores_autorizados);
 if cantidad=0 then return new; end if;
 if auth.uid() is null or not exists(select 1 from bitacora.perfiles where id=auth.uid() and rol='admin' and activo)
 then raise exception 'Sólo administradores activos pueden autorizar accesos.'; end if;
 if not new.autorizacion_confirmada or length(trim(coalesce(new.autorizacion_responsable,'')))<3
 or length(trim(coalesce(new.autorizacion_motivo,'')))<5 then raise exception 'Complete responsable y motivo de autorización nominal.'; end if;
 new.emitida_por=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'sede_id',s.sede_id,'sede_nombre',d.nombre,
 'codigo',s.codigo,'nombre',s.nombre,'zra',s.zra,'tipo',s.tipo,'estado_fisico',s.estado_fisico,'habilitado_ingreso',s.habilitado_ingreso)
 order by s.sede_id,s.codigo),'[]') into esperado
 from equipo.credencial_sectores s join bitacora.sedes d on d.id=s.sede_id
 join equipo.personas p on p.id=new.persona_id
 where s.activo and d.activa and s.sede_id in(21,24) and s.sede_id=any(p.sede_ids)
 and s.codigo ~ '^([A-Z][a-z]|FA)$'
 and s.id in(select (v->>'id')::uuid from jsonb_array_elements(new.sectores_autorizados) v);
 if jsonb_array_length(esperado)<>cantidad then raise exception 'Sector inexistente, duplicado, anterior o fuera de las sedes asignadas.'; end if;
 if exists(select 1 from jsonb_array_elements(esperado) v group by v->>'sede_id' having bool_or(v->>'codigo'='FA') and count(*)>1)
 then raise exception 'Seleccione FA o sectores individuales por sede.'; end if;
 if exists(select 1 from jsonb_array_elements(esperado) v where v->>'codigo'='FA') then
  if new.fa_vencimiento is null or new.fa_vencimiento<current_date or new.fa_vencimiento>new.fecha_vencimiento
  then raise exception 'FA requiere una vigencia entre hoy y el vencimiento de la credencial.'; end if;
 else new.fa_vencimiento=null; end if;
 new.sectores_autorizados=esperado;
 return new;
end $$;
create or replace function public.emitir_credencial_multisede(p_persona_id uuid,p_anterior_id uuid,p_datos jsonb,p_sector_ids uuid[])
returns equipo.credenciales_personal language plpgsql security invoker set search_path='' as $$
declare persona equipo.personas; anterior uuid; resultado equipo.credenciales_personal; sectores jsonb;
begin
  if auth.uid() is null or not exists (select 1 from bitacora.perfiles p where p.id=auth.uid() and p.rol='admin' and p.activo) then
    raise exception 'Sólo administradores activos pueden emitir credenciales.';
  end if;
  -- Bloqueo por persona y comparación optimista: dos administradores no se pisan.
  select * into strict persona from equipo.personas where id=p_persona_id for update;
  if not persona.activo or persona.foto_url is null then raise exception 'La persona debe estar activa y tener fotografía.'; end if;
  select id into anterior from equipo.credenciales_personal where persona_id=p_persona_id order by created_at desc,id desc limit 1;
  if anterior is distinct from p_anterior_id then raise exception 'La credencial cambió. Cierre y vuelva a abrir la ficha.'; end if;
  if coalesce(p_datos->>'area','') not in ('operations','logistics','quality','maintenance','administration','hr','production','airports','warehouse') then
    raise exception 'Departamento inválido.';
  end if;
  if coalesce((p_datos->>'autorizacion_confirmada')::boolean,false) is not true then raise exception 'Confirme la autorización individual antes de emitir.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id)),'[]'::jsonb) into sectores from unnest(p_sector_ids) id;
  update equipo.credenciales_personal set estado='anulada',motivo_anulacion='Reemplazada por una nueva emisión',anulada_at=now(),updated_at=now()
    where persona_id=p_persona_id and estado='activa';
  insert into equipo.credenciales_personal(persona_id,estado,fecha_emision,fecha_vencimiento,sede_nombre,puesto_impreso,area_impresa,
    emitida_por,compartir_telefono,compartir_email,grupo_sanguineo,foto_pos_x,foto_pos_y,foto_zoom,sectores_autorizados,autorizacion_confirmada,autorizacion_responsable,autorizacion_motivo,fa_vencimiento)
  values(p_persona_id,'activa',current_date,(current_date+interval '2 years')::date,
    coalesce(nullif(p_datos->>'sede_nombre',''),'Administración Central'),persona.puesto,p_datos->>'area',auth.uid(),
    coalesce((p_datos->>'compartir_telefono')::boolean,false),coalesce((p_datos->>'compartir_email')::boolean,false),
    nullif(p_datos->>'grupo_sanguineo',''),coalesce((p_datos->>'foto_pos_x')::numeric,50),
    coalesce((p_datos->>'foto_pos_y')::numeric,50),coalesce((p_datos->>'foto_zoom')::numeric,1),sectores,true,nullif(trim(p_datos->>'autorizacion_responsable'),''),nullif(trim(p_datos->>'autorizacion_motivo'),''),nullif(p_datos->>'fa_vencimiento','')::date)
  returning * into resultado;
  return resultado;
end $$;
create or replace function public.verificar_credencial_multisede(p_token uuid)
returns table(estado text,nombre text,puesto text,empresa text,fecha_vencimiento date,telefono text,email text,area_impresa text,sectores_autorizados jsonb)
language sql stable security definer set search_path='' as $$
 select case when not p.activo then 'anulada' when c.estado='activa' and (c.fecha_emision>current_date or c.fecha_vencimiento<current_date) then 'vencida' else c.estado end,
 trim(concat_ws(' ',p.nombre,p.apellido)),coalesce(c.puesto_impreso,p.puesto,'Sin puesto informado'),'Fly Kitchen S.A.'::text,c.fecha_vencimiento,
 case when p.activo and c.estado='activa' and current_date between c.fecha_emision and c.fecha_vencimiento and c.compartir_telefono then p.telefono end,
 case when p.activo and c.estado='activa' and current_date between c.fecha_emision and c.fecha_vencimiento and c.compartir_email then p.email end,c.area_impresa,
 case when p.activo and c.estado='activa' and current_date between c.fecha_emision and c.fecha_vencimiento then
 coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'sede_id',s.sede_id,'sede_nombre',d.nombre,'codigo',s.codigo,'nombre',s.nombre,'zra',s.zra,'tipo','sector','habilitado_ingreso',true) order by s.sede_id,s.codigo)
 from equipo.credencial_sectores s join bitacora.sedes d on d.id=s.sede_id
 where s.activo and d.activa and s.tipo='sector' and s.habilitado_ingreso and s.estado_fisico='existente'
 and s.sede_id=any(p.sede_ids) and exists(
 select 1 from jsonb_array_elements(c.sectores_autorizados) v
 join equipo.credencial_sectores a on a.id=(v->>'id')::uuid and a.activo and a.sede_id=s.sede_id
 where a.id=s.id or (a.tipo='permiso' and a.codigo='FA' and c.fa_vencimiento>=current_date))), '[]'::jsonb)
 else '[]'::jsonb end
 from equipo.credenciales_personal c join equipo.personas p on p.id=c.persona_id where c.token=p_token limit 1;
$$;
notify pgrst,'reload schema';
commit;
