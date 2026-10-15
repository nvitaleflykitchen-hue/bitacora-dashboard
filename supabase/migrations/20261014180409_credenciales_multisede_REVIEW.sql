-- SOLO mixyhfdlzjarvszinytk. Autorizada y aplicada el 2026-10-14 como credenciales_multisede.
-- No asigna permisos a personas ni reemite credenciales existentes.
begin;

alter table equipo.personas drop constraint personas_functional_area_check;
alter table equipo.personas add constraint personas_functional_area_check check (
  functional_area is null or functional_area in
  ('operations','logistics','quality','maintenance','administration','hr','production','airports')
);

create table equipo.credencial_sectores (
  id uuid primary key default gen_random_uuid(),
  sede_id integer not null references bitacora.sedes(id),
  codigo text not null check (codigo ~ '^[0-9]{2}$'),
  nombre text not null check (length(trim(nombre)) between 1 and 100),
  clasificacion text not null,
  zra boolean not null default false,
  activo boolean not null default true,
  unique (sede_id,codigo)
);
alter table equipo.credencial_sectores enable row level security;
revoke all on equipo.credencial_sectores from anon,authenticated;
grant select on equipo.credencial_sectores to authenticated;
create policy sectores_admin_select on equipo.credencial_sectores for select to authenticated
using (exists (select 1 from bitacora.perfiles p where p.id=(select auth.uid()) and p.rol='admin' and p.activo));

-- Resuelve la sede por nombre exacto; falla si está ausente o es ambigua.
do $$
declare sede integer;
begin
  select id into strict sede from bitacora.sedes where nombre='Planta de Producción Córdoba';
  insert into equipo.credencial_sectores(sede_id,codigo,nombre,clasificacion,zra) values
    (sede,'01','Administración y oficinas','General controlado',false),
    (sede,'02','Cocina y producción primaria','Operativo',false),
    (sede,'03','Depósitos de materias primas','Operativo',false),
    (sede,'04','Armado de catering aeroportuario','Restringido',true),
    (sede,'05','Cámaras de producto terminado y trolleys','Restringido',true),
    (sede,'06','Despacho aeroportuario y dársena','Restringido',true),
    (sede,'07','Lavado, retornos y residuos','Operativo controlado',false),
    (sede,'08','Área técnica y mantenimiento','Acceso especial',false);
end $$;

alter table equipo.credenciales_personal
  add column sectores_autorizados jsonb not null default '[]'::jsonb,
  add column autorizacion_confirmada boolean not null default false,
  add constraint sectores_autorizados_array check (jsonb_typeof(sectores_autorizados)='array');

-- La instantánea impresa se genera en el servidor, no se confía en nombres/sectores del cliente.
create function equipo.validar_sectores_credencial() returns trigger
language plpgsql security invoker set search_path='' as $$
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
  where s.activo and d.activa and s.id in (select (v->>'id')::uuid from jsonb_array_elements(new.sectores_autorizados) v);
  if jsonb_array_length(esperado)<>cantidad then raise exception 'Sector inexistente, duplicado o inactivo.'; end if;
  new.sectores_autorizados := esperado;
  return new;
end $$;
revoke all on function equipo.validar_sectores_credencial() from public;
create trigger validar_sectores_credencial before insert or update on equipo.credenciales_personal
for each row execute function equipo.validar_sectores_credencial();

create function public.emitir_credencial_multisede(p_persona_id uuid,p_anterior_id uuid,p_datos jsonb,p_sector_ids uuid[])
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
  if coalesce(p_datos->>'area','') not in ('operations','logistics','quality','maintenance','administration','hr','production','airports') then
    raise exception 'Departamento inválido.';
  end if;
  if coalesce((p_datos->>'autorizacion_confirmada')::boolean,false) is not true then raise exception 'Confirme la autorización individual antes de emitir.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id)),'[]'::jsonb) into sectores from unnest(p_sector_ids) id;
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
end $$;
revoke all on function public.emitir_credencial_multisede(uuid,uuid,jsonb,uuid[]) from public,anon;
grant execute on function public.emitir_credencial_multisede(uuid,uuid,jsonb,uuid[]) to authenticated;

-- API pública acotada al token aleatorio del QR. No expone DNI, foto ni aprobador.
create function public.verificar_credencial_multisede(p_token uuid)
returns table(estado text,nombre text,puesto text,empresa text,fecha_vencimiento date,telefono text,email text,area_impresa text,sectores_autorizados jsonb)
language sql stable security definer set search_path='' as $$
  select case when not p.activo then 'anulada'
    when c.estado='activa' and (c.fecha_vencimiento<current_date or c.fecha_emision>current_date) then 'vencida' else c.estado end,
    trim(concat_ws(' ',p.nombre,p.apellido)),coalesce(c.puesto_impreso,p.puesto,'Sin puesto informado'),'Fly Kitchen S.A.'::text,c.fecha_vencimiento,
    case when p.activo and c.estado='activa' and c.fecha_vencimiento>=current_date and c.compartir_telefono then p.telefono end,
    case when p.activo and c.estado='activa' and c.fecha_vencimiento>=current_date and c.compartir_email then p.email end,c.area_impresa,
    case when p.activo and c.estado='activa' and c.fecha_emision<=current_date and c.fecha_vencimiento>=current_date then
      coalesce((select jsonb_agg(v order by v->>'sede_nombre',v->>'codigo') from jsonb_array_elements(c.sectores_autorizados) v
        join equipo.credencial_sectores s on s.id=(v->>'id')::uuid and s.activo
        join bitacora.sedes d on d.id=s.sede_id and d.activa),'[]'::jsonb)
    else '[]'::jsonb end
  from equipo.credenciales_personal c join equipo.personas p on p.id=c.persona_id where c.token=p_token limit 1;
$$;
revoke all on function public.verificar_credencial_multisede(uuid) from public;
grant execute on function public.verificar_credencial_multisede(uuid) to anon,authenticated;

-- Conserva la firma del QR anterior y aplica también el bloqueo por baja.
create or replace function public.verificar_credencial(p_token uuid)
returns table(estado text,nombre text,puesto text,empresa text,fecha_vencimiento date,telefono text,email text)
language sql stable security definer set search_path='' as $$
  select v.estado,v.nombre,v.puesto,v.empresa,v.fecha_vencimiento,v.telefono,v.email
  from public.verificar_credencial_multisede(p_token) v;
$$;
notify pgrst,'reload schema';
commit;
