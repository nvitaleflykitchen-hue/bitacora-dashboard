-- REVIEW ONLY: requiere confirmacion explicita antes de aplicar.
-- Proyecto autorizado: mixyhfdlzjarvszinytk (cerdova-db).

create table if not exists equipo.vacaciones (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references equipo.personas(id),
  periodo smallint not null default extract(year from current_date)::smallint,
  fecha_desde date not null,
  fecha_hasta date not null,
  dias_solicitados integer generated always as ((fecha_hasta - fecha_desde) + 1) stored,
  estado text not null default 'solicitado' check (estado in ('borrador','solicitado','aprobado','rechazado','cancelado','utilizado')),
  reemplazo_persona_id uuid references equipo.personas(id),
  observaciones text,
  motivo_decision text,
  solicitado_por uuid references auth.users(id) default auth.uid(),
  aprobado_por uuid references auth.users(id),
  aprobado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vacaciones_fechas_ck check (fecha_hasta >= fecha_desde),
  constraint vacaciones_periodo_ck check (periodo between 2020 and 2100),
  constraint vacaciones_reemplazo_ck check (reemplazo_persona_id is null or reemplazo_persona_id <> persona_id)
);

create index if not exists vacaciones_persona_idx on equipo.vacaciones(persona_id);
create index if not exists vacaciones_fechas_idx on equipo.vacaciones(fecha_desde, fecha_hasta);
create index if not exists vacaciones_estado_idx on equipo.vacaciones(estado);

alter table equipo.vacaciones enable row level security;

grant select, insert, update on equipo.vacaciones to authenticated;

drop policy if exists vacaciones_staff_select on equipo.vacaciones;
create policy vacaciones_staff_select on equipo.vacaciones
for select to authenticated
using (
  exists (
    select 1
    from bitacora.perfiles p
    join equipo.personas persona on persona.id = vacaciones.persona_id
    where p.id = (select auth.uid()) and p.activo = true
      and (
        p.rol in ('admin','editor','consultor')
        or persona.perfil_id = p.id
        or (p.rol = 'grupo' and exists (
          select 1 from bitacora.sedes s
          where s.grupo_id = p.grupo_id and s.id = any(persona.sede_ids)
        ))
        or (p.rol in ('encargado','sede') and persona.sede_ids && coalesce(p.sede_ids, '{}'::integer[]))
      )
  )
);

drop policy if exists vacaciones_staff_insert on equipo.vacaciones;
create policy vacaciones_staff_insert on equipo.vacaciones
for insert to authenticated
with check (
  solicitado_por = (select auth.uid())
  and estado in ('borrador','solicitado')
  and exists (
    select 1
    from bitacora.perfiles p
    join equipo.personas persona on persona.id = vacaciones.persona_id
    where p.id = (select auth.uid()) and p.activo = true
      and (
        p.rol in ('admin','editor')
        or persona.perfil_id = p.id
        or (p.rol = 'grupo' and exists (
          select 1 from bitacora.sedes s
          where s.grupo_id = p.grupo_id and s.id = any(persona.sede_ids)
        ))
        or (p.rol in ('encargado','sede') and persona.sede_ids && coalesce(p.sede_ids, '{}'::integer[]))
      )
  )
);

drop policy if exists vacaciones_staff_update on equipo.vacaciones;
create policy vacaciones_staff_update on equipo.vacaciones
for update to authenticated
using (
  exists (
    select 1
    from bitacora.perfiles p
    join equipo.personas persona on persona.id = vacaciones.persona_id
    where p.id = (select auth.uid()) and p.activo = true
      and (
        p.rol in ('admin','editor')
        or (p.rol = 'grupo' and exists (
          select 1 from bitacora.sedes s
          where s.grupo_id = p.grupo_id and s.id = any(persona.sede_ids)
        ))
        or (p.rol in ('encargado','sede') and persona.sede_ids && coalesce(p.sede_ids, '{}'::integer[]))
      )
  )
)
with check (
  exists (
    select 1
    from bitacora.perfiles p
    join equipo.personas persona on persona.id = vacaciones.persona_id
    where p.id = (select auth.uid()) and p.activo = true
      and (
        p.rol in ('admin','editor')
        or (p.rol = 'grupo' and exists (
          select 1 from bitacora.sedes s
          where s.grupo_id = p.grupo_id and s.id = any(persona.sede_ids)
        ))
        or (p.rol in ('encargado','sede') and persona.sede_ids && coalesce(p.sede_ids, '{}'::integer[]))
      )
  )
);

comment on table equipo.vacaciones is 'Solicitudes, aprobaciones y coberturas de vacaciones del personal.';
