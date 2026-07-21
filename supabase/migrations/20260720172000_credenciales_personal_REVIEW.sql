-- REQUIERE APROBACION EXPLICITA: crea tabla, grants y politicas RLS.
create table if not exists equipo.credenciales_personal (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references equipo.personas(id) on delete restrict,
  token uuid not null default gen_random_uuid() unique,
  estado text not null default 'activa'
    check (estado in ('borrador','activa','vencida','anulada','extraviada')),
  fecha_emision date not null default current_date,
  fecha_vencimiento date not null default (current_date + interval '2 years')::date,
  sede_nombre text not null default 'Administracion Central',
  puesto_impreso text,
  area_impresa text,
  emitida_por uuid references auth.users(id) on delete set null,
  motivo_anulacion text,
  anulada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fecha_vencimiento > fecha_emision)
);

create unique index if not exists credencial_activa_por_persona
  on equipo.credenciales_personal(persona_id)
  where estado = 'activa';
create index if not exists credenciales_vencimiento_idx
  on equipo.credenciales_personal(fecha_vencimiento);

alter table equipo.credenciales_personal enable row level security;
revoke all on equipo.credenciales_personal from anon, authenticated;
grant select, insert, update on equipo.credenciales_personal to authenticated;

drop policy if exists credenciales_admin_select on equipo.credenciales_personal;
create policy credenciales_admin_select on equipo.credenciales_personal
  for select to authenticated
  using (exists (
    select 1 from bitacora.perfiles p
    where p.id = (select auth.uid()) and p.rol = 'admin' and p.activo = true
  ));

drop policy if exists credenciales_admin_insert on equipo.credenciales_personal;
create policy credenciales_admin_insert on equipo.credenciales_personal
  for insert to authenticated
  with check (
    emitida_por = (select auth.uid()) and exists (
      select 1 from bitacora.perfiles p
      where p.id = (select auth.uid()) and p.rol = 'admin' and p.activo = true
    )
  );

drop policy if exists credenciales_admin_update on equipo.credenciales_personal;
create policy credenciales_admin_update on equipo.credenciales_personal
  for update to authenticated
  using (exists (
    select 1 from bitacora.perfiles p
    where p.id = (select auth.uid()) and p.rol = 'admin' and p.activo = true
  ))
  with check (exists (
    select 1 from bitacora.perfiles p
    where p.id = (select auth.uid()) and p.rol = 'admin' and p.activo = true
  ));

create or replace function public.verificar_credencial(p_token uuid)
returns table (
  estado text,
  nombre text,
  puesto text,
  empresa text,
  fecha_vencimiento date
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    case
      when c.estado = 'activa' and c.fecha_vencimiento < current_date then 'vencida'
      else c.estado
    end,
    trim(concat_ws(' ', p.nombre, p.apellido)),
    coalesce(c.puesto_impreso, p.puesto, 'Sin puesto informado'),
    'Fly Kitchen S.A.'::text,
    c.fecha_vencimiento
  from equipo.credenciales_personal c
  join equipo.personas p on p.id = c.persona_id
  where c.token = p_token
  limit 1;
$$;

revoke all on function public.verificar_credencial(uuid) from public;
grant execute on function public.verificar_credencial(uuid) to anon, authenticated;
