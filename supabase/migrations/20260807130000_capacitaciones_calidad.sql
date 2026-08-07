-- Registro relacional de capacitaciones, asistentes y trazabilidad por sede/persona.
-- Aplicada al proyecto mixyhfdlzjarvszinytk el 2026-08-07 con autorización explícita.
begin;

create table bitacora.capacitaciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) >= 3),
  objetivo text,
  sede_id integer not null references bitacora.sedes(id),
  fecha date not null,
  hora_inicio time,
  duracion_minutos integer check (duracion_minutos is null or duracion_minutos > 0),
  instructor_nombre text not null,
  instructor_tipo text not null default 'interno' check (instructor_tipo in ('interno', 'externo')),
  instructor_area text,
  instructor_procedencia text,
  planificada boolean not null default true,
  material_entregado boolean not null default false,
  observaciones text,
  estado text not null default 'programada' check (estado in ('programada', 'realizada', 'cancelada')),
  finalizada_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table bitacora.capacitacion_asistentes (
  id uuid primary key default gen_random_uuid(),
  capacitacion_id uuid not null references bitacora.capacitaciones(id),
  persona_id uuid not null references equipo.personas(id),
  estado text not null default 'convocado' check (estado in ('convocado', 'presente', 'ausente')),
  observaciones text,
  registrado_por uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (capacitacion_id, persona_id)
);

create index capacitaciones_sede_fecha_idx on bitacora.capacitaciones (sede_id, fecha desc);
create index capacitacion_asistentes_persona_idx on bitacora.capacitacion_asistentes (persona_id, created_at desc);
create index capacitacion_asistentes_capacitacion_idx on bitacora.capacitacion_asistentes (capacitacion_id);

alter table bitacora.capacitaciones enable row level security;
alter table bitacora.capacitacion_asistentes enable row level security;

create policy capacitaciones_select on bitacora.capacitaciones for select to authenticated
using (bitacora.puede_ver_auditoria_sede(sede_id));
create policy capacitaciones_insert on bitacora.capacitaciones for insert to authenticated
with check (bitacora.puede_gestionar_auditoria_sede(sede_id));
create policy capacitaciones_update on bitacora.capacitaciones for update to authenticated
using (bitacora.puede_gestionar_auditoria_sede(sede_id))
with check (bitacora.puede_gestionar_auditoria_sede(sede_id));

create policy capacitacion_asistentes_select on bitacora.capacitacion_asistentes for select to authenticated
using (exists (select 1 from bitacora.capacitaciones c where c.id = capacitacion_id and bitacora.puede_ver_auditoria_sede(c.sede_id)));
create policy capacitacion_asistentes_insert on bitacora.capacitacion_asistentes for insert to authenticated
with check (exists (select 1 from bitacora.capacitaciones c where c.id = capacitacion_id and bitacora.puede_gestionar_auditoria_sede(c.sede_id)));
create policy capacitacion_asistentes_update on bitacora.capacitacion_asistentes for update to authenticated
using (exists (select 1 from bitacora.capacitaciones c where c.id = capacitacion_id and bitacora.puede_gestionar_auditoria_sede(c.sede_id)))
with check (exists (select 1 from bitacora.capacitaciones c where c.id = capacitacion_id and bitacora.puede_gestionar_auditoria_sede(c.sede_id)));

grant select, insert, update on bitacora.capacitaciones to authenticated;
grant select, insert, update on bitacora.capacitacion_asistentes to authenticated;

commit;
