-- REVISAR Y AUTORIZAR antes de aplicar. Proyecto: mixyhfdlzjarvszinytk exclusivamente.
-- Reemplaza SOLO sede 24. Conserva históricos y no asigna accesos automáticamente.
begin;
alter table equipo.credencial_sectores
 add column numero integer,
 add column simbolo text,
 add column grupo text,
 add column color text not null default '#334155',
 add column tipo text not null default 'sector' check(tipo in ('sector','condicion')),
 add column version_matriz integer not null default 1,
 add constraint sector_numero_valido check(numero is null or numero between 1 and 999),
 add constraint sector_simbolo_valido check(simbolo is null or simbolo ~ '^[A-Z][a-z]$'),
 add constraint sector_color_valido check(color ~ '^#[0-9A-Fa-f]{6}$'),
 add constraint sector_matriz_completo check(version_matriz<2 or tipo='condicion' or (numero is not null and simbolo is not null and nullif(trim(grupo),'') is not null));
-- Sustituye únicamente el CHECK del código; conserva el identificador y las claves únicas.
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='equipo.credencial_sectores'::regclass and contype='c' and pg_get_constraintdef(oid) like '%codigo%' loop
 execute format('alter table equipo.credencial_sectores drop constraint %I',c.conname);
 end loop;
end $$;
alter table equipo.credencial_sectores add constraint sector_codigo_formato check(codigo ~ '^([0-9]{2}|[A-Z]|[0-9]{2,3}-[A-Z][a-z]|TOTAL)$');
create unique index sector_numero_sede on equipo.credencial_sectores(sede_id,numero) where numero is not null;
create unique index sector_simbolo_sede on equipo.credencial_sectores(sede_id,lower(simbolo)) where simbolo is not null;
create unique index sector_nombre_matriz_sede on equipo.credencial_sectores(sede_id,lower(trim(nombre))) where version_matriz=2;
update equipo.credencial_sectores set tipo='condicion' where codigo='Z';
update equipo.credencial_sectores set activo=false where sede_id=24;
insert into equipo.credencial_sectores(sede_id,codigo,numero,simbolo,nombre,grupo,color,clasificacion,zra,version_matriz)
select 24,lpad(n::text,2,'0')||'-'||s,n,s,nombre,grupo,color,case when n=18 then 'Restringido' else 'General' end,n=18,2 from (values
(1,'Of','Oficinas','Administración','#475569'),(2,'Rp','Recepción','Administración','#475569'),
(3,'Ve','Vestuarios','Servicios al personal','#6D28D9'),
(4,'Vd','Verdulería','Preparación y producción','#166534'),(5,'Ca','Carnicería','Preparación y producción','#166534'),
(6,'Cc','Cocina caliente','Producción','#9A3412'),(7,'Pa','Pastelería','Producción','#9A3412'),
(8,'Dp','Depósito','Almacenamiento','#0F766E'),
(9,'En','Sala de envasado','Envasado y armado','#1D4ED8'),(10,'Ar','Armado','Envasado y armado','#1D4ED8'),
(11,'La','Lavadero','Higiene y sanitización','#0E7490'),(12,'Li','Sector limpieza','Higiene y sanitización','#0E7490'),
(13,'Pf','Playón frontal','Logística exterior','#854D0E'),(14,'Pp','Playón posterior','Logística exterior','#854D0E'),(15,'Cd','Carga y descarga','Logística exterior','#854D0E'),
(16,'Ci','Patio de cisternas','Instalaciones técnicas','#4B5563'),(17,'Ge','Grupo electrógeno','Instalaciones técnicas','#4B5563'),
(18,'Ae','Sala de Líneas Aéreas','Operación aeroportuaria','#991B1B')) v(n,s,nombre,grupo,color);
insert into equipo.credencial_sectores(sede_id,codigo,nombre,clasificacion,zra,tipo,version_matriz)
values(24,'TOTAL','Acceso total a la sede','Acceso total',true,'condicion',2);

-- Historial de eventos, no segunda fuente de permisos. Solo lo escriben triggers.
create table equipo.credencial_eventos (
 id bigint generated always as identity primary key,
 credencial_id uuid references equipo.credenciales_personal(id),
 persona_id uuid references equipo.personas(id),
 sector_id uuid references equipo.credencial_sectores(id),
 actor_id uuid references auth.users(id),
 operacion text not null,
 detalle jsonb not null,
 created_at timestamptz not null default now()
);
alter table equipo.credencial_eventos enable row level security;
revoke all on equipo.credencial_eventos from public,anon,authenticated;
grant select on equipo.credencial_eventos to authenticated;
create policy eventos_admin_read on equipo.credencial_eventos for select to authenticated using(exists(select 1 from bitacora.perfiles p where p.id=auth.uid() and p.activo and p.rol='admin'));

-- Amplía los CHECK existentes sin permitir la nueva acción en otros módulos.
alter table bitacora.perfil_permisos drop constraint perfil_permisos_accion_check;
alter table bitacora.perfil_permisos add constraint perfil_permisos_accion_check check(accion in ('request','manage','supervise','invoice','receive','report','manage_all','manage_sector_access'));
alter table bitacora.perfil_permisos drop constraint perfil_permisos_scope_check;
alter table bitacora.perfil_permisos add constraint perfil_permisos_scope_check check((modulo='compras' and accion in ('request','manage','supervise','invoice','receive')) or (modulo='personal' and accion in ('report','manage_sector_access')) or (modulo='mantenimiento' and accion='manage_all'));

-- Reutiliza las facultades individuales existentes. No concede ninguna por defecto.
create function equipo.puede_gestionar_sectores(p_persona uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from bitacora.perfiles p where p.id=auth.uid() and p.activo and (
 p.rol='admin' or (exists(select 1 from bitacora.perfil_permisos f where f.perfil_id=p.id and f.modulo='personal' and f.accion='manage_sector_access' and f.activo)
 and exists(select 1 from equipo.personas e where e.id=p_persona and cardinality(e.sede_ids)>0 and e.sede_ids <@ coalesce(p.sede_ids,'{}'::integer[])))))
$$;
revoke all on function equipo.puede_gestionar_sectores(uuid) from public,anon;
grant execute on function equipo.puede_gestionar_sectores(uuid) to authenticated;
create policy credenciales_gestor_select on equipo.credenciales_personal for select to authenticated using(equipo.puede_gestionar_sectores(persona_id));
create policy credenciales_gestor_insert on equipo.credenciales_personal for insert to authenticated with check(emitida_por=auth.uid() and equipo.puede_gestionar_sectores(persona_id));
create policy credenciales_gestor_update on equipo.credenciales_personal for update to authenticated using(equipo.puede_gestionar_sectores(persona_id)) with check(equipo.puede_gestionar_sectores(persona_id));
create policy sectores_gestor_select on equipo.credencial_sectores for select to authenticated using(exists(select 1 from bitacora.perfiles p join bitacora.perfil_permisos f on f.perfil_id=p.id where p.id=auth.uid() and p.activo and f.activo and f.modulo='personal' and f.accion='manage_sector_access' and sede_id=any(p.sede_ids)));
grant insert,update on equipo.credencial_sectores to authenticated;
create policy sectores_admin_insert on equipo.credencial_sectores for insert to authenticated with check(exists(select 1 from bitacora.perfiles p where p.id=auth.uid() and p.activo and p.rol='admin'));
create policy sectores_admin_update on equipo.credencial_sectores for update to authenticated using(exists(select 1 from bitacora.perfiles p where p.id=auth.uid() and p.activo and p.rol='admin')) with check(exists(select 1 from bitacora.perfiles p where p.id=auth.uid() and p.activo and p.rol='admin'));

create function equipo.validar_identidad_sector() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' and (new.id,new.sede_id,new.codigo,new.numero,new.simbolo,new.tipo,new.version_matriz) is distinct from (old.id,old.sede_id,old.codigo,old.numero,old.simbolo,old.tipo,old.version_matriz) then raise exception 'La identidad de un sector es inmutable. Cree un nuevo sector.'; end if;
 if new.version_matriz=2 and new.tipo='sector' and new.codigo <> lpad(new.numero::text,greatest(2,length(new.numero::text)),'0')||'-'||new.simbolo then raise exception 'Código incompatible con número y símbolo.'; end if;
 return new;
end $$;
create trigger validar_identidad_sector before insert or update on equipo.credencial_sectores for each row execute function equipo.validar_identidad_sector();

create or replace function equipo.validar_sectores_credencial() returns trigger language plpgsql set search_path='' as $$
declare esperado jsonb; cantidad integer;
begin
 if TG_OP='UPDATE' then
  if (new.sectores_autorizados,new.autorizacion_confirmada,new.area_impresa,new.persona_id,new.token,new.fecha_emision,new.fecha_vencimiento,new.emitida_por)
  is distinct from (old.sectores_autorizados,old.autorizacion_confirmada,old.area_impresa,old.persona_id,old.token,old.fecha_emision,old.fecha_vencimiento,old.emitida_por) then raise exception 'Para cambiar la autorización debe reemitir la credencial.'; end if;
  if old.estado<>'activa' and new.estado='activa' then raise exception 'Una credencial invalidada no puede reactivarse.'; end if;
  return new;
 end if;
 cantidad:=jsonb_array_length(new.sectores_autorizados);
 if cantidad=0 then return new; end if;
 if not new.autorizacion_confirmada then raise exception 'Debe confirmar la autorización individual.'; end if;
 if exists(select 1 from jsonb_array_elements(new.sectores_autorizados) v where nullif(v->>'vigente_hasta','')::date < (now() at time zone 'America/Argentina/Buenos_Aires')::date or nullif(v->>'vigente_hasta','')::date > new.fecha_vencimiento) then raise exception 'El vencimiento del permiso debe estar entre hoy y el de la credencial.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'sede_id',s.sede_id,'sede_nombre',d.nombre,'codigo',s.codigo,'nombre',s.nombre,'zra',s.zra,'numero',s.numero,'simbolo',s.simbolo,'grupo',s.grupo,'color',s.color,'tipo',s.tipo,'vigente_hasta',nullif(v->>'vigente_hasta','')) order by s.sede_id,s.numero nulls last,s.codigo),'[]'::jsonb)
 into esperado from jsonb_array_elements(new.sectores_autorizados) v join equipo.credencial_sectores s on s.id=(v->>'id')::uuid join bitacora.sedes d on d.id=s.sede_id
 where s.activo and d.activa and (s.version_matriz=2 or s.codigo ~ '^[ABCDGHIJKLMZ]$')
 and exists(select 1 from equipo.personas p where p.id=new.persona_id and s.sede_id=any(p.sede_ids));
 if jsonb_array_length(esperado)<>cantidad or (select count(distinct v->>'id') from jsonb_array_elements(esperado) v)<>cantidad then raise exception 'Sector inexistente, duplicado, inactivo o ajeno a la sede de la persona.'; end if;
 if exists(select 1 from jsonb_array_elements(esperado) v group by v->>'sede_id' having bool_or(v->>'tipo'='condicion') and count(*)>1) then raise exception 'Seleccione acceso total o sectores individuales por sede.'; end if;
 new.sectores_autorizados:=esperado;
 return new;
end $$;

create function equipo.auditar_sectores() returns trigger language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 if TG_TABLE_NAME='credencial_sectores' then
  insert into equipo.credencial_eventos(sector_id,actor_id,operacion,detalle) values(new.id,auth.uid(),case when TG_OP='INSERT' then 'sector_creado' else 'sector_actualizado' end,jsonb_build_object('antes',case when TG_OP='UPDATE' then to_jsonb(old) else null end,'despues',to_jsonb(new)));
 elsif TG_OP='INSERT' then
  for v in select * from jsonb_array_elements(new.sectores_autorizados) loop
   insert into equipo.credencial_eventos(credencial_id,persona_id,sector_id,actor_id,operacion,detalle) values(new.id,new.persona_id,(v->>'id')::uuid,auth.uid(),'autorizacion',v);
  end loop;
 elsif old.estado='activa' and new.estado<>'activa' then
  for v in select * from jsonb_array_elements(old.sectores_autorizados) loop
   insert into equipo.credencial_eventos(credencial_id,persona_id,sector_id,actor_id,operacion,detalle) values(new.id,new.persona_id,(v->>'id')::uuid,auth.uid(),'revocacion',v||jsonb_build_object('motivo',new.motivo_anulacion,'estado',new.estado));
  end loop;
 end if;
 return new;
end $$;
revoke all on function equipo.auditar_sectores() from public,anon,authenticated;
create trigger auditar_sectores after insert or update on equipo.credencial_sectores for each row execute function equipo.auditar_sectores();
create trigger auditar_autorizaciones after insert or update on equipo.credenciales_personal for each row execute function equipo.auditar_sectores();
CREATE OR REPLACE FUNCTION public.emitir_credencial_multisede(p_persona_id uuid, p_anterior_id uuid, p_datos jsonb, p_sector_ids uuid[])
 RETURNS equipo.credenciales_personal
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare persona equipo.personas; anterior uuid; resultado equipo.credenciales_personal; sectores jsonb;
begin
  if not equipo.puede_gestionar_sectores(p_persona_id) then
    raise exception 'No tiene facultad para gestionar los accesos de esta persona.';
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
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'vigente_hasta',p_datos->'sector_vigencias'->>id::text)),'[]'::jsonb) into sectores from unnest(p_sector_ids) id;
  update equipo.credenciales_personal set estado='anulada',motivo_anulacion='Reemplazada por una nueva emisión',anulada_at=now(),updated_at=now()
    where persona_id=p_persona_id and estado='activa';
  insert into equipo.credenciales_personal(persona_id,estado,fecha_emision,fecha_vencimiento,sede_nombre,puesto_impreso,area_impresa,
    emitida_por,compartir_telefono,compartir_email,grupo_sanguineo,foto_pos_x,foto_pos_y,foto_zoom,sectores_autorizados,autorizacion_confirmada)
  values(p_persona_id,'activa',current_date,(current_date+interval '2 years')::date,
    coalesce(nullif(p_datos->>'sede_nombre',''),'Administración Central'),persona.puesto,p_datos->>'area',auth.uid(),
    coalesce((p_datos->>'compartir_telefono')::boolean,false),coalesce((p_datos->>'compartir_email')::boolean,false),
    nullif(p_datos->>'grupo_sanguineo',''),coalesce((p_datos->>'foto_pos_x')::numeric,50),
    coalesce((p_datos->>'foto_pos_y')::numeric,50),coalesce((p_datos->>'foto_zoom')::numeric,1),sectores,true)
  returning * into resultado;
  return resultado;
end $function$;

CREATE OR REPLACE FUNCTION public.verificar_credencial_multisede(p_token uuid)
 RETURNS TABLE(estado text, nombre text, puesto text, empresa text, fecha_vencimiento date, telefono text, email text, area_impresa text, sectores_autorizados jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case when not p.activo then 'anulada'
    when c.estado='activa' and (c.fecha_vencimiento<current_date or c.fecha_emision>current_date) then 'vencida' else c.estado end,
    trim(concat_ws(' ',p.nombre,p.apellido)),coalesce(c.puesto_impreso,p.puesto,'Sin puesto informado'),'Fly Kitchen S.A.'::text,c.fecha_vencimiento,
    case when p.activo and c.estado='activa' and c.fecha_vencimiento>=current_date and c.compartir_telefono then p.telefono end,
    case when p.activo and c.estado='activa' and c.fecha_vencimiento>=current_date and c.compartir_email then p.email end,c.area_impresa,
    case when p.activo and c.estado='activa' and c.fecha_emision<=current_date and c.fecha_vencimiento>=current_date then
      coalesce((select jsonb_agg(v || jsonb_build_object('nombre',s.nombre,'zra',s.zra,'color',s.color) order by v->>'sede_nombre',v->>'codigo') from jsonb_array_elements(c.sectores_autorizados) v
        join equipo.credencial_sectores s on s.id=(v->>'id')::uuid and s.activo
        join bitacora.sedes d on d.id=s.sede_id and d.activa where nullif(v->>'vigente_hasta','') is null or (v->>'vigente_hasta')::date>=(now() at time zone 'America/Argentina/Buenos_Aires')::date),'[]'::jsonb)
    else '[]'::jsonb end
  from equipo.credenciales_personal c join equipo.personas p on p.id=c.persona_id where c.token=p_token limit 1;
$function$;


create function public.mis_sectores_autorizados() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select to_jsonb(v) from equipo.credenciales_personal c join equipo.personas p on p.id=c.persona_id
 cross join lateral public.verificar_credencial_multisede(c.token) v
 where p.perfil_id=auth.uid() and auth.uid() is not null and exists(select 1 from bitacora.perfiles f where f.id=auth.uid() and f.activo) order by c.created_at desc,c.id desc limit 1),'{}'::jsonb)
$$;
revoke all on function public.mis_sectores_autorizados() from public,anon;
grant execute on function public.mis_sectores_autorizados() to authenticated;
insert into equipo.credencial_eventos(credencial_id,persona_id,sector_id,actor_id,operacion,detalle)
select c.id,c.persona_id,s.id,auth.uid(),'revocacion_catalogo',v||jsonb_build_object('motivo','Reemplazo solicitado de matriz Planta Córdoba; sin conversión automática')
from equipo.credenciales_personal c cross join lateral jsonb_array_elements(c.sectores_autorizados) v join equipo.credencial_sectores s on s.id=(v->>'id')::uuid
where c.estado='activa' and s.sede_id=24 and s.version_matriz=1;
notify pgrst,'reload schema';
commit;



