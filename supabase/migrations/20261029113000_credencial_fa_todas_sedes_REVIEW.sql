-- Proyecto exclusivo: mixyhfdlzjarvszinytk. REQUIERE aprobación explícita por GRANT/RLS.
-- Habilita la opción para cinco personas; NO emite ni modifica credenciales existentes.
begin;
alter table equipo.credenciales_personal add column fa_todas_sedes boolean not null default false;
create table equipo.credencial_fa_multisede_personas (
 id uuid primary key references equipo.personas(id),
 activo boolean not null default true,
 motivo text not null
);
alter table equipo.credencial_fa_multisede_personas enable row level security;
revoke all on equipo.credencial_fa_multisede_personas from public,anon,authenticated;
grant select on equipo.credencial_fa_multisede_personas to authenticated;
create policy fa_multisede_lectura_admin on equipo.credencial_fa_multisede_personas for select to authenticated
 using(exists(select 1 from bitacora.perfiles p where p.id=(select auth.uid()) and p.rol='admin' and p.activo));
create trigger auditar_fa_multisede after insert or update or delete on equipo.credencial_fa_multisede_personas
 for each row execute function equipo.auditar_accesos_v11();
-- IDs verificados por nombre el 29/10/2026. No modifica sede_ids ni departamento.
insert into equipo.credencial_fa_multisede_personas(id,motivo) values
 ('0dc0d9e0-ee94-4b94-a021-fa1bc191ece8','Pablo Augusto Fernandez: opción FA multisede solicitada por administración'),
 ('1d44ec86-aca3-4df8-b6f8-bd7e834a6c98','Nicolas Abel Luis Vitale: opción FA multisede solicitada por administración'),
 ('b50ec994-df8e-4d47-af36-43ddb496069b','Romina Veronica Rodriguez Gsponer: opción FA multisede solicitada por administración'),
 ('6e8785bb-0434-40a8-86e9-0dbc0f423a00','Debora Noemi Andrea Rodriguez: opción FA multisede solicitada por administración'),
 ('30347324-14e6-4aa2-9dbf-0d7c051651ef','Emilia Milich: opción FA multisede solicitada por administración');

CREATE OR REPLACE FUNCTION equipo.validar_sectores_credencial()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare esperado jsonb; cantidad integer;
begin
 if TG_OP='UPDATE' then
  if new.fa_todas_sedes is distinct from old.fa_todas_sedes
  or new.sectores_autorizados is distinct from old.sectores_autorizados
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
 if cantidad=0 and not new.fa_todas_sedes then return new; end if;
 if auth.uid() is null or not exists(select 1 from bitacora.perfiles where id=auth.uid() and rol='admin' and activo)
 then raise exception 'Sólo administradores activos pueden autorizar accesos.'; end if;
 if not new.autorizacion_confirmada or length(trim(coalesce(new.autorizacion_responsable,'')))<3 then raise exception 'Seleccione el responsable y confirme la autorización nominal.'; end if;
 new.emitida_por=auth.uid();
 if new.fa_todas_sedes then
  if cantidad<>0 then raise exception 'FA en todas las sedes no admite sectores individuales.'; end if;
  if not exists(select 1 from equipo.credencial_fa_multisede_personas e join equipo.personas p on p.id=e.id
    where e.id=new.persona_id and e.activo and p.activo)
  then raise exception 'Esta persona no está habilitada para FA en todas las sedes.'; end if;
  if new.fa_vencimiento is null or new.fa_vencimiento<current_date or new.fa_vencimiento>new.fecha_vencimiento
  then raise exception 'FA requiere una vigencia entre hoy y el vencimiento de la credencial.'; end if;
  return new;
 end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.emitir_credencial_multisede(p_persona_id uuid, p_anterior_id uuid, p_datos jsonb, p_sector_ids uuid[])
 RETURNS equipo.credenciales_personal
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
    emitida_por,compartir_telefono,compartir_email,grupo_sanguineo,foto_pos_x,foto_pos_y,foto_zoom,sectores_autorizados,autorizacion_confirmada,autorizacion_responsable,autorizacion_motivo,fa_vencimiento,fa_todas_sedes)
  values(p_persona_id,'activa',current_date,(current_date+interval '2 years')::date,
    coalesce(nullif(p_datos->>'sede_nombre',''),'Administración Central'),persona.puesto,p_datos->>'area',auth.uid(),
    coalesce((p_datos->>'compartir_telefono')::boolean,false),coalesce((p_datos->>'compartir_email')::boolean,false),
    nullif(p_datos->>'grupo_sanguineo',''),coalesce((p_datos->>'foto_pos_x')::numeric,50),
    coalesce((p_datos->>'foto_pos_y')::numeric,50),coalesce((p_datos->>'foto_zoom')::numeric,1),sectores,true,nullif(trim(p_datos->>'autorizacion_responsable'),''),nullif(trim(p_datos->>'autorizacion_motivo'),''),nullif(p_datos->>'fa_vencimiento','')::date,coalesce((p_datos->>'fa_todas_sedes')::boolean,false))
  returning * into resultado;
  return resultado;
end $function$
;

CREATE OR REPLACE FUNCTION public.verificar_credencial_multisede(p_token uuid)
 RETURNS TABLE(estado text, nombre text, puesto text, empresa text, fecha_vencimiento date, telefono text, email text, area_impresa text, sectores_autorizados jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case when not p.activo then 'anulada' when c.estado='activa' and (c.fecha_emision>current_date or c.fecha_vencimiento<current_date) then 'vencida' else c.estado end,
 trim(concat_ws(' ',p.nombre,p.apellido)),coalesce(c.puesto_impreso,p.puesto,'Sin puesto informado'),'Fly Kitchen S.A.'::text,c.fecha_vencimiento,
 case when p.activo and c.estado='activa' and current_date between c.fecha_emision and c.fecha_vencimiento and c.compartir_telefono then p.telefono end,
 case when p.activo and c.estado='activa' and current_date between c.fecha_emision and c.fecha_vencimiento and c.compartir_email then p.email end,c.area_impresa,
 case when p.activo and c.estado='activa' and current_date between c.fecha_emision and c.fecha_vencimiento then
 coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'sede_id',s.sede_id,'sede_nombre',d.nombre,'codigo',s.codigo,'nombre',s.nombre,'zra',s.zra,'tipo','sector','habilitado_ingreso',true) order by s.sede_id,s.codigo)
 from equipo.credencial_sectores s join bitacora.sedes d on d.id=s.sede_id
 where s.activo and d.activa and s.tipo='sector' and s.habilitado_ingreso and s.estado_fisico='existente'
 and (scope.fa_global or (s.sede_id=any(p.sede_ids) and exists(
 select 1 from jsonb_array_elements(c.sectores_autorizados) v
 join equipo.credencial_sectores a on a.id=(v->>'id')::uuid and a.activo and a.sede_id=s.sede_id
 where a.id=s.id or (a.tipo='permiso' and a.codigo='FA' and c.fa_vencimiento>=current_date))))), '[]'::jsonb)
 || case when scope.fa_global then
 coalesce((select jsonb_agg(jsonb_build_object('id','fa-global-'||d.id,'sede_id',d.id,'sede_nombre',d.nombre,
 'codigo','FA','nombre','Acceso completo interno a la sede','tipo','permiso','alcance','todas_sedes',
 'fa_vencimiento',c.fa_vencimiento,'zra',true) order by d.nombre)
 from bitacora.sedes d where d.activa),'[]'::jsonb) else '[]'::jsonb end
 else '[]'::jsonb end
 from equipo.credenciales_personal c join equipo.personas p on p.id=c.persona_id cross join lateral(select c.fa_todas_sedes and c.fa_vencimiento>=current_date
 and exists(select 1 from equipo.credencial_fa_multisede_personas e where e.id=p.id and e.activo) as fa_global) scope
 where c.token=p_token limit 1;
$function$
;
notify pgrst,'reload schema';
commit;
