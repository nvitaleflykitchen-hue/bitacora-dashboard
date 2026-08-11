-- Fase 2 de Equipo -> Horarios.
-- Define la necesidad operativa por sede antes de asignar personas.

create table equipo.horario_sectores (
  id uuid primary key default gen_random_uuid(),
  sede_id integer not null references bitacora.sedes(id) on delete restrict,
  nombre text not null check (char_length(btrim(nombre)) between 2 and 80),
  descripcion text,
  orden smallint not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (sede_id, nombre)
);

create table equipo.horario_turnos (
  id uuid primary key default gen_random_uuid(),
  sede_id integer not null references bitacora.sedes(id) on delete restrict,
  nombre text not null check (char_length(btrim(nombre)) between 2 and 80),
  hora_desde time not null,
  hora_hasta time not null,
  tolerancia_minutos smallint not null default 0 check (tolerancia_minutos between 0 and 180),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  check (hora_desde <> hora_hasta),
  unique (sede_id, nombre),
  unique (sede_id, hora_desde, hora_hasta)
);

create table equipo.horario_plantillas (
  id uuid primary key default gen_random_uuid(),
  sede_id integer not null references bitacora.sedes(id) on delete restrict,
  nombre text not null check (char_length(btrim(nombre)) between 2 and 120),
  estado text not null default 'borrador' check (estado in ('borrador', 'activa', 'archivada')),
  vigencia_desde date,
  vigencia_hasta date,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  check (vigencia_hasta is null or vigencia_desde is not null),
  check (vigencia_hasta is null or vigencia_hasta >= vigencia_desde),
  unique (sede_id, nombre)
);

create table equipo.horario_necesidades (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references equipo.horario_plantillas(id) on delete cascade,
  sede_id integer not null references bitacora.sedes(id) on delete restrict,
  sector_id uuid not null references equipo.horario_sectores(id) on delete restrict,
  turno_id uuid not null references equipo.horario_turnos(id) on delete restrict,
  rol_operativo_id uuid not null references equipo.roles_operativos(id) on delete restrict,
  dia_semana smallint not null check (dia_semana between 1 and 7),
  cantidad_requerida smallint not null default 1 check (cantidad_requerida between 1 and 200),
  observaciones text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (plantilla_id, sector_id, turno_id, rol_operativo_id, dia_semana)
);

create index horario_sectores_sede_activo_idx on equipo.horario_sectores (sede_id, activo, orden);
create index horario_turnos_sede_activo_idx on equipo.horario_turnos (sede_id, activo, hora_desde);
create index horario_plantillas_sede_estado_idx on equipo.horario_plantillas (sede_id, estado);
create unique index horario_plantillas_activa_sede_uidx on equipo.horario_plantillas (sede_id) where estado = 'activa';
create index horario_necesidades_plantilla_dia_idx on equipo.horario_necesidades (plantilla_id, dia_semana) where activo;
create index horario_necesidades_sede_idx on equipo.horario_necesidades (sede_id) where activo;
create index horario_necesidades_sector_idx on equipo.horario_necesidades (sector_id);
create index horario_necesidades_turno_idx on equipo.horario_necesidades (turno_id);
create index horario_necesidades_rol_idx on equipo.horario_necesidades (rol_operativo_id);

create trigger horario_sectores_touch_updated_at before update on equipo.horario_sectores
for each row execute function equipo.touch_updated_at();
create trigger horario_turnos_touch_updated_at before update on equipo.horario_turnos
for each row execute function equipo.touch_updated_at();
create trigger horario_plantillas_touch_updated_at before update on equipo.horario_plantillas
for each row execute function equipo.touch_updated_at();
create trigger horario_necesidades_touch_updated_at before update on equipo.horario_necesidades
for each row execute function equipo.touch_updated_at();

alter table equipo.horario_sectores enable row level security;
alter table equipo.horario_turnos enable row level security;
alter table equipo.horario_plantillas enable row level security;
alter table equipo.horario_necesidades enable row level security;

-- Lectura: respeta el mismo alcance territorial utilizado por Equipo.
create policy horario_sectores_staff_select on equipo.horario_sectores
for select to authenticated using (
  exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and (
    p.rol in ('admin','editor','consultor')
    or (p.rol = 'grupo' and exists (select 1 from bitacora.sedes s where s.id = horario_sectores.sede_id and s.grupo_id = p.grupo_id))
    or (p.rol in ('encargado','sede') and horario_sectores.sede_id = any(coalesce(p.sede_ids, '{}')))
  ))
);
create policy horario_turnos_staff_select on equipo.horario_turnos
for select to authenticated using (
  exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and (
    p.rol in ('admin','editor','consultor')
    or (p.rol = 'grupo' and exists (select 1 from bitacora.sedes s where s.id = horario_turnos.sede_id and s.grupo_id = p.grupo_id))
    or (p.rol in ('encargado','sede') and horario_turnos.sede_id = any(coalesce(p.sede_ids, '{}')))
  ))
);
create policy horario_plantillas_staff_select on equipo.horario_plantillas
for select to authenticated using (
  exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and (
    p.rol in ('admin','editor','consultor')
    or (p.rol = 'grupo' and exists (select 1 from bitacora.sedes s where s.id = horario_plantillas.sede_id and s.grupo_id = p.grupo_id))
    or (p.rol in ('encargado','sede') and horario_plantillas.sede_id = any(coalesce(p.sede_ids, '{}')))
  ))
);
create policy horario_necesidades_staff_select on equipo.horario_necesidades
for select to authenticated using (
  exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and (
    p.rol in ('admin','editor','consultor')
    or (p.rol = 'grupo' and exists (select 1 from bitacora.sedes s where s.id = horario_necesidades.sede_id and s.grupo_id = p.grupo_id))
    or (p.rol in ('encargado','sede') and horario_necesidades.sede_id = any(coalesce(p.sede_ids, '{}')))
  ))
);

-- Escritura: administración/editor o responsables con alcance sobre la sede.
create policy horario_sectores_staff_write on equipo.horario_sectores
for all to authenticated
using (exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and (
  p.rol in ('admin','editor') or (p.rol = 'grupo' and exists (select 1 from bitacora.sedes s where s.id = horario_sectores.sede_id and s.grupo_id = p.grupo_id))
  or (p.rol in ('encargado','sede') and horario_sectores.sede_id = any(coalesce(p.sede_ids, '{}')))
)))
with check (exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and (
  p.rol in ('admin','editor') or (p.rol = 'grupo' and exists (select 1 from bitacora.sedes s where s.id = horario_sectores.sede_id and s.grupo_id = p.grupo_id))
  or (p.rol in ('encargado','sede') and horario_sectores.sede_id = any(coalesce(p.sede_ids, '{}')))
)));
create policy horario_turnos_staff_write on equipo.horario_turnos
for all to authenticated
using (exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and (
  p.rol in ('admin','editor') or (p.rol = 'grupo' and exists (select 1 from bitacora.sedes s where s.id = horario_turnos.sede_id and s.grupo_id = p.grupo_id))
  or (p.rol in ('encargado','sede') and horario_turnos.sede_id = any(coalesce(p.sede_ids, '{}')))
)))
with check (exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and (
  p.rol in ('admin','editor') or (p.rol = 'grupo' and exists (select 1 from bitacora.sedes s where s.id = horario_turnos.sede_id and s.grupo_id = p.grupo_id))
  or (p.rol in ('encargado','sede') and horario_turnos.sede_id = any(coalesce(p.sede_ids, '{}')))
)));
create policy horario_plantillas_staff_write on equipo.horario_plantillas
for all to authenticated
using (exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and (
  p.rol in ('admin','editor') or (p.rol = 'grupo' and exists (select 1 from bitacora.sedes s where s.id = horario_plantillas.sede_id and s.grupo_id = p.grupo_id))
  or (p.rol in ('encargado','sede') and horario_plantillas.sede_id = any(coalesce(p.sede_ids, '{}')))
)))
with check (exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and (
  p.rol in ('admin','editor') or (p.rol = 'grupo' and exists (select 1 from bitacora.sedes s where s.id = horario_plantillas.sede_id and s.grupo_id = p.grupo_id))
  or (p.rol in ('encargado','sede') and horario_plantillas.sede_id = any(coalesce(p.sede_ids, '{}')))
)));
create policy horario_necesidades_staff_write on equipo.horario_necesidades
for all to authenticated
using (exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and (
  p.rol in ('admin','editor') or (p.rol = 'grupo' and exists (select 1 from bitacora.sedes s where s.id = horario_necesidades.sede_id and s.grupo_id = p.grupo_id))
  or (p.rol in ('encargado','sede') and horario_necesidades.sede_id = any(coalesce(p.sede_ids, '{}')))
)))
with check (exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and (
  p.rol in ('admin','editor') or (p.rol = 'grupo' and exists (select 1 from bitacora.sedes s where s.id = horario_necesidades.sede_id and s.grupo_id = p.grupo_id))
  or (p.rol in ('encargado','sede') and horario_necesidades.sede_id = any(coalesce(p.sede_ids, '{}')))
)));

grant select, insert, update on
  equipo.horario_sectores,
  equipo.horario_turnos,
  equipo.horario_plantillas,
  equipo.horario_necesidades
to authenticated;

comment on table equipo.horario_sectores is 'Sectores operativos configurables por sede para planificar dotación.';
comment on table equipo.horario_turnos is 'Franjas horarias por sede; hora_hasta menor a hora_desde representa cruce de medianoche.';
comment on table equipo.horario_plantillas is 'Versiones de la necesidad de cobertura por sede.';
comment on table equipo.horario_necesidades is 'Cantidad de posiciones requeridas por día, sector, turno y rol Fly.';
