-- Anulacion controlada de documentos del historial de personal.
-- El registro y sus adjuntos se conservan: no existe DELETE fisico en este flujo.

alter table equipo.historial_personal
  add column if not exists anulada boolean not null default false,
  add column if not exists anulada_at timestamptz,
  add column if not exists anulada_por uuid references auth.users(id),
  add column if not exists anulacion_motivo text,
  add column if not exists anulacion_solicitud_id uuid;

create table if not exists equipo.solicitudes_anulacion_historial (
  id uuid primary key default gen_random_uuid(),
  historial_id uuid not null references equipo.historial_personal(id),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'autorizada', 'rechazada')),
  motivo text not null check (length(trim(motivo)) >= 10),
  solicitado_por uuid not null references auth.users(id),
  solicitado_at timestamptz not null default now(),
  revisado_por uuid references auth.users(id),
  revisado_at timestamptz,
  resolucion_motivo text,
  constraint solicitudes_anulacion_revision_distinta
    check (revisado_por is null or revisado_por <> solicitado_por)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'historial_personal_anulacion_solicitud_fk'
      and conrelid = 'equipo.historial_personal'::regclass
  ) then
    alter table equipo.historial_personal
      add constraint historial_personal_anulacion_solicitud_fk
      foreign key (anulacion_solicitud_id)
      references equipo.solicitudes_anulacion_historial(id);
  end if;
end;
$$;

create unique index if not exists solicitudes_anulacion_historial_pendiente_uniq
  on equipo.solicitudes_anulacion_historial(historial_id)
  where estado = 'pendiente';

create index if not exists solicitudes_anulacion_historial_estado_idx
  on equipo.solicitudes_anulacion_historial(estado, solicitado_at desc);

alter table equipo.solicitudes_anulacion_historial enable row level security;

revoke all on table equipo.solicitudes_anulacion_historial from anon, authenticated;
grant select on table equipo.solicitudes_anulacion_historial to authenticated;

drop policy if exists solicitudes_anulacion_select on equipo.solicitudes_anulacion_historial;
create policy solicitudes_anulacion_select
on equipo.solicitudes_anulacion_historial
for select
to authenticated
using (
  solicitado_por = (select auth.uid())
  or exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and p.activo = true
      and p.rol = 'admin'
  )
);

create or replace function public.solicitar_anulacion_historial(
  p_historial_id uuid,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = public, bitacora, equipo, pg_catalog
as $$
declare
  v_solicitud_id uuid;
  v_rol text;
begin
  if auth.uid() is null then
    raise exception 'Sesion requerida';
  end if;

  select p.rol into v_rol
  from bitacora.perfiles p
  where p.id = auth.uid() and p.activo = true;

  if v_rol is null or v_rol not in ('admin', 'editor', 'grupo', 'encargado') then
    raise exception 'No tiene permiso para solicitar la anulacion';
  end if;

  if length(trim(coalesce(p_motivo, ''))) < 10 then
    raise exception 'El motivo debe tener al menos 10 caracteres';
  end if;

  perform 1
  from equipo.historial_personal h
  join equipo.personas per on per.id = h.persona_id
  join bitacora.perfiles p on p.id = auth.uid() and p.activo = true
  where h.id = p_historial_id
    and h.anulada = false
    and (
      p.rol in ('admin', 'editor')
      or (
        p.rol = 'grupo'
        and p.grupo_id is not null
        and exists (
          select 1 from bitacora.sedes s
          where s.grupo_id = p.grupo_id
            and s.id = any(per.sede_ids)
        )
      )
      or (
        p.rol = 'encargado'
        and per.sede_ids && coalesce(p.sede_ids, '{}'::integer[])
      )
    )
  for update of h;

  if not found then
    raise exception 'El documento no existe o ya fue anulado';
  end if;

  if exists (
    select 1 from equipo.solicitudes_anulacion_historial s
    where s.historial_id = p_historial_id and s.estado = 'pendiente'
  ) then
    raise exception 'Ya existe una solicitud pendiente para este documento';
  end if;

  insert into equipo.solicitudes_anulacion_historial (
    historial_id, motivo, solicitado_por
  ) values (
    p_historial_id, trim(p_motivo), auth.uid()
  )
  returning id into v_solicitud_id;

  perform public.log_auditoria(
    'equipo.historial_personal', p_historial_id::text,
    'SOLICITUD_ANULACION', trim(p_motivo),
    'estado', 'vigente', 'pendiente_anulacion', null, null
  );

  return v_solicitud_id;
end;
$$;

create or replace function public.resolver_anulacion_historial(
  p_solicitud_id uuid,
  p_decision text,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public, bitacora, equipo, pg_catalog
as $$
declare
  v_solicitud equipo.solicitudes_anulacion_historial%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sesion requerida';
  end if;

  if not exists (
    select 1 from bitacora.perfiles p
    where p.id = auth.uid() and p.activo = true and p.rol = 'admin'
  ) then
    raise exception 'Solo un administrador puede resolver la solicitud';
  end if;

  if p_decision not in ('autorizar', 'rechazar') then
    raise exception 'Decision invalida';
  end if;

  if length(trim(coalesce(p_motivo, ''))) < 10 then
    raise exception 'La resolucion debe tener al menos 10 caracteres';
  end if;

  select * into v_solicitud
  from equipo.solicitudes_anulacion_historial
  where id = p_solicitud_id
  for update;

  if not found or v_solicitud.estado <> 'pendiente' then
    raise exception 'La solicitud no existe o ya fue resuelta';
  end if;

  if v_solicitud.solicitado_por = auth.uid() then
    raise exception 'La autorizacion debe realizarla un administrador distinto';
  end if;

  update equipo.solicitudes_anulacion_historial
  set estado = case when p_decision = 'autorizar' then 'autorizada' else 'rechazada' end,
      revisado_por = auth.uid(),
      revisado_at = now(),
      resolucion_motivo = trim(p_motivo)
  where id = p_solicitud_id;

  if p_decision = 'autorizar' then
    update equipo.historial_personal
    set anulada = true,
        anulada_at = now(),
        anulada_por = auth.uid(),
        anulacion_motivo = trim(p_motivo),
        anulacion_solicitud_id = p_solicitud_id
    where id = v_solicitud.historial_id and anulada = false;
  end if;

  perform public.log_auditoria(
    'equipo.historial_personal', v_solicitud.historial_id::text,
    case when p_decision = 'autorizar' then 'ANULACION_AUTORIZADA' else 'ANULACION_RECHAZADA' end,
    trim(p_motivo),
    'estado', 'pendiente_anulacion',
    case when p_decision = 'autorizar' then 'anulada' else 'vigente' end,
    null, null
  );
end;
$$;

revoke all on function public.solicitar_anulacion_historial(uuid, text) from public, anon;
revoke all on function public.resolver_anulacion_historial(uuid, text, text) from public, anon;
grant execute on function public.solicitar_anulacion_historial(uuid, text) to authenticated;
grant execute on function public.resolver_anulacion_historial(uuid, text, text) to authenticated;

create or replace view public.v_historial_personal
with (security_invoker = true)
as
select
  h.id,
  h.persona_id,
  h.tipo,
  h.fecha,
  h.descripcion,
  h.dias_suspension,
  h.registrado_por,
  h.created_at,
  p.nombre as persona_nombre,
  p.puesto as persona_puesto,
  h.anulada,
  h.anulada_at,
  h.anulada_por,
  h.anulacion_motivo,
  h.anulacion_solicitud_id
from equipo.historial_personal h
join equipo.personas p on p.id = h.persona_id
order by h.fecha desc;

revoke all on public.v_historial_personal from anon;
grant select on public.v_historial_personal to authenticated;
