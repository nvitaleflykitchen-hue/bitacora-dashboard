-- Aprobada y aplicada en producción el 2026-07-26.
-- Extensión 1:1 para datos personales y laborales sensibles.
-- No modifica equipo.personas ni importa datos por sí sola.

create table if not exists equipo.importaciones_personal (
  id uuid primary key default gen_random_uuid(),
  archivo_nombre text not null,
  archivo_sha256 text not null unique,
  total_filas integer not null check (total_filas >= 0),
  coincidencias_seguras integer not null default 0 check (coincidencias_seguras >= 0),
  filas_revisadas integer not null default 0 check (filas_revisadas >= 0),
  filas_ignoradas integer not null default 0 check (filas_ignoradas >= 0),
  conflictos integer not null default 0 check (conflictos >= 0),
  estado text not null default 'analizado'
    check (estado in ('analizado', 'aplicado', 'revertido')),
  resumen jsonb not null default '{}'::jsonb,
  creado_por uuid references auth.users(id) on delete set null,
  creado_at timestamptz not null default now()
);

comment on table equipo.importaciones_personal is
  'Auditoría de lotes usados para enriquecer fichas existentes. No crea personas.';

create table if not exists equipo.persona_rrhh (
  persona_id uuid primary key
    references equipo.personas(id) on delete restrict,
  fecha_nacimiento date,
  estado_civil text,
  telefono_emergencia text,
  parentesco_emergencia text,
  calle text,
  numeracion text,
  barrio text,
  localidad text,
  movilidad text,
  fotografia_credencial_fuente text,
  talle_pantalon text,
  talle_superior text,
  talle_abrigo text,
  talle_calzado text,
  convenio text,
  carga_horaria_mensual numeric(7,2)
    check (carga_horaria_mensual is null or carga_horaria_mensual >= 0),
  categoria_codigo text,
  categoria_nombre text,
  fecha_antiguedad date,
  fecha_egreso date,
  centro_codigo text,
  centro_descripcion text,
  sindicato text,
  liquidacion_empresa_4 text,
  tarea_empresa_4 text,
  lugar_trabajo_declarado text,
  puesto_declarado text,
  area_declarada text,
  cantidad_registros_personales integer
    check (cantidad_registros_personales is null or cantidad_registros_personales >= 0),
  criterios_coincidencia text,
  fuentes_consolidadas text,
  observaciones text,
  importacion_id uuid
    references equipo.importaciones_personal(id) on delete restrict,
  fuente_fila integer check (fuente_fila is null or fuente_fila >= 2),
  creado_por uuid references auth.users(id) on delete set null,
  actualizado_por uuid references auth.users(id) on delete set null,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);

comment on table equipo.persona_rrhh is
  'Datos sensibles de RR. HH. separados de la ficha operativa. Acceso exclusivo de administradores.';

create index if not exists importaciones_personal_creado_por_idx
  on equipo.importaciones_personal (creado_por);
create index if not exists persona_rrhh_importacion_id_idx
  on equipo.persona_rrhh (importacion_id);
create index if not exists persona_rrhh_creado_por_idx
  on equipo.persona_rrhh (creado_por);
create index if not exists persona_rrhh_actualizado_por_idx
  on equipo.persona_rrhh (actualizado_por);

alter table equipo.importaciones_personal enable row level security;
alter table equipo.persona_rrhh enable row level security;

drop policy if exists importaciones_personal_admin_select
  on equipo.importaciones_personal;
create policy importaciones_personal_admin_select
  on equipo.importaciones_personal
  for select
  to authenticated
  using (
    exists (
      select 1
      from bitacora.perfiles p
      where p.id = (select auth.uid())
        and p.activo is true
        and p.rol = 'admin'
    )
  );

drop policy if exists importaciones_personal_admin_insert
  on equipo.importaciones_personal;
create policy importaciones_personal_admin_insert
  on equipo.importaciones_personal
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from bitacora.perfiles p
      where p.id = (select auth.uid())
        and p.activo is true
        and p.rol = 'admin'
    )
  );

drop policy if exists importaciones_personal_admin_update
  on equipo.importaciones_personal;
create policy importaciones_personal_admin_update
  on equipo.importaciones_personal
  for update
  to authenticated
  using (
    exists (
      select 1
      from bitacora.perfiles p
      where p.id = (select auth.uid())
        and p.activo is true
        and p.rol = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from bitacora.perfiles p
      where p.id = (select auth.uid())
        and p.activo is true
        and p.rol = 'admin'
    )
  );

drop policy if exists persona_rrhh_admin_select on equipo.persona_rrhh;
create policy persona_rrhh_admin_select
  on equipo.persona_rrhh
  for select
  to authenticated
  using (
    exists (
      select 1
      from bitacora.perfiles p
      where p.id = (select auth.uid())
        and p.activo is true
        and p.rol = 'admin'
    )
  );

drop policy if exists persona_rrhh_admin_insert on equipo.persona_rrhh;
create policy persona_rrhh_admin_insert
  on equipo.persona_rrhh
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from bitacora.perfiles p
      where p.id = (select auth.uid())
        and p.activo is true
        and p.rol = 'admin'
    )
  );

drop policy if exists persona_rrhh_admin_update on equipo.persona_rrhh;
create policy persona_rrhh_admin_update
  on equipo.persona_rrhh
  for update
  to authenticated
  using (
    exists (
      select 1
      from bitacora.perfiles p
      where p.id = (select auth.uid())
        and p.activo is true
        and p.rol = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from bitacora.perfiles p
      where p.id = (select auth.uid())
        and p.activo is true
        and p.rol = 'admin'
    )
  );

revoke all on table equipo.importaciones_personal from anon;
revoke all on table equipo.persona_rrhh from anon;
revoke all on table equipo.importaciones_personal from authenticated;
revoke all on table equipo.persona_rrhh from authenticated;

grant select, insert, update
  on table equipo.importaciones_personal
  to authenticated;
grant select, insert, update
  on table equipo.persona_rrhh
  to authenticated;
