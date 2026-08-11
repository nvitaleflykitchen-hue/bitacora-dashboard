-- Fase 1 del modelo Equipo -> Horarios.
-- Separa puesto convencional, rol operativo y asignacion de la persona.

create table if not exists equipo.puestos_cct (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  nivel smallint not null check (nivel between 0 and 7),
  area text,
  descripcion text,
  responsabilidades text[] not null default '{}',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists equipo.roles_operativos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  area text,
  sede_id integer references bitacora.sedes(id) on delete restrict,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique nulls not distinct (nombre, sede_id)
);

create table if not exists equipo.rol_puesto_equivalencias (
  id uuid primary key default gen_random_uuid(),
  rol_operativo_id uuid not null references equipo.roles_operativos(id) on delete cascade,
  puesto_cct_id uuid not null references equipo.puestos_cct(id) on delete restrict,
  estado text not null default 'propuesta'
    check (estado in ('propuesta', 'confirmada', 'descartada')),
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (rol_operativo_id, puesto_cct_id)
);

create table if not exists equipo.persona_encuadres (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references equipo.personas(id) on delete cascade,
  sede_id integer not null references bitacora.sedes(id) on delete restrict,
  rol_operativo_id uuid references equipo.roles_operativos(id) on delete restrict,
  puesto_cct_id uuid references equipo.puestos_cct(id) on delete restrict,
  funcion_real text,
  supervisor_persona_id uuid references equipo.personas(id) on delete set null,
  modalidad text,
  jornada text,
  fecha_desde date not null default current_date,
  fecha_hasta date,
  es_principal boolean not null default true,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  check (fecha_hasta is null or fecha_hasta >= fecha_desde),
  check (rol_operativo_id is not null or puesto_cct_id is not null or nullif(btrim(funcion_real), '') is not null)
);

create index if not exists roles_operativos_sede_activo_idx
  on equipo.roles_operativos (sede_id, activo);
create index if not exists equivalencias_puesto_idx
  on equipo.rol_puesto_equivalencias (puesto_cct_id);
create index if not exists persona_encuadres_persona_fecha_idx
  on equipo.persona_encuadres (persona_id, fecha_desde desc);
create index if not exists persona_encuadres_sede_vigente_idx
  on equipo.persona_encuadres (sede_id, persona_id)
  where fecha_hasta is null;
create index if not exists persona_encuadres_rol_idx
  on equipo.persona_encuadres (rol_operativo_id)
  where fecha_hasta is null;
create index if not exists persona_encuadres_puesto_idx
  on equipo.persona_encuadres (puesto_cct_id)
  where fecha_hasta is null;
create index if not exists persona_encuadres_supervisor_idx
  on equipo.persona_encuadres (supervisor_persona_id)
  where fecha_hasta is null;
create unique index if not exists persona_encuadres_principal_vigente_uidx
  on equipo.persona_encuadres (persona_id)
  where es_principal and fecha_hasta is null;

drop trigger if exists puestos_cct_touch_updated_at on equipo.puestos_cct;
create trigger puestos_cct_touch_updated_at before update on equipo.puestos_cct
for each row execute function equipo.touch_updated_at();
drop trigger if exists roles_operativos_touch_updated_at on equipo.roles_operativos;
create trigger roles_operativos_touch_updated_at before update on equipo.roles_operativos
for each row execute function equipo.touch_updated_at();
drop trigger if exists equivalencias_touch_updated_at on equipo.rol_puesto_equivalencias;
create trigger equivalencias_touch_updated_at before update on equipo.rol_puesto_equivalencias
for each row execute function equipo.touch_updated_at();
drop trigger if exists persona_encuadres_touch_updated_at on equipo.persona_encuadres;
create trigger persona_encuadres_touch_updated_at before update on equipo.persona_encuadres
for each row execute function equipo.touch_updated_at();

insert into equipo.puestos_cct (codigo, nombre, nivel, area)
values
  ('CCT-389-04-N0-APOYO', 'Ingreso y apoyo basico', 0, 'General'),
  ('CCT-389-04-N1-LAVACOPA', 'Lavacopa', 1, 'Cocina'),
  ('CCT-389-04-N1-PEON-COCINA', 'Peon de cocina', 1, 'Cocina'),
  ('CCT-389-04-N2-SANDWICHERO', 'Sandwichero', 2, 'Cocina'),
  ('CCT-389-04-N2-CAFETERO', 'Cafetero', 2, 'Salon'),
  ('CCT-389-04-N2-COCTELERO-BASICO', 'Coctelero basico', 2, 'Barra'),
  ('CCT-389-04-N2-MOZO-MOSTRADOR', 'Mozo de mostrador', 2, 'Salon'),
  ('CCT-389-04-N3-AYUDANTE-COCINA', 'Ayudante de cocina', 3, 'Cocina'),
  ('CCT-389-04-N3-MINUTERO', 'Minutero', 3, 'Cocina'),
  ('CCT-389-04-N3-PANQUEQUERO', 'Panquequero', 3, 'Cocina'),
  ('CCT-389-04-N4-COMIS', 'Comis', 4, 'Salon'),
  ('CCT-389-04-N4-EMPANADERO', 'Empanadero', 4, 'Cocina'),
  ('CCT-389-04-N4-COCTELERO-ESPECIALIZADO', 'Coctelero especializado', 4, 'Barra'),
  ('CCT-389-04-N5-ADICIONISTA', 'Adicionista', 5, 'Salon'),
  ('CCT-389-04-N5-CAJERO', 'Cajero', 5, 'Caja'),
  ('CCT-389-04-N5-COMIS-COCINA', 'Comis de cocina', 5, 'Cocina'),
  ('CCT-389-04-N5-FIAMBRERO-PRINCIPAL', 'Fiambrero principal', 5, 'Cocina'),
  ('CCT-389-04-N6-MOZO', 'Mozo', 6, 'Salon'),
  ('CCT-389-04-N6-BARMAN', 'Barman', 6, 'Barra'),
  ('CCT-389-04-N6-JEFE-PARTIDA', 'Jefe de partida', 6, 'Cocina'),
  ('CCT-389-04-N6-ROTISERO', 'Rotisero', 6, 'Cocina'),
  ('CCT-389-04-N7-JEFE-BRIGADA', 'Jefe de brigada', 7, 'Cocina'),
  ('CCT-389-04-N7-MAITRE-PRINCIPAL', 'Maitre principal', 7, 'Salon'),
  ('CCT-389-04-N7-JEFE-TECNICO', 'Jefe tecnico', 7, 'Tecnica')
on conflict (codigo) do update set
  nombre = excluded.nombre,
  nivel = excluded.nivel,
  area = excluded.area,
  updated_at = now();

alter table equipo.puestos_cct enable row level security;
alter table equipo.roles_operativos enable row level security;
alter table equipo.rol_puesto_equivalencias enable row level security;
alter table equipo.persona_encuadres enable row level security;

create policy puestos_cct_authenticated_select on equipo.puestos_cct
for select to authenticated using (true);
create policy puestos_cct_admin_write on equipo.puestos_cct
for all to authenticated
using (exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and p.rol = 'admin'))
with check (exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and p.rol = 'admin'));

create policy roles_operativos_authenticated_select on equipo.roles_operativos
for select to authenticated using (true);
create policy roles_operativos_admin_write on equipo.roles_operativos
for all to authenticated
using (exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and p.rol = 'admin'))
with check (exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and p.rol = 'admin'));

create policy equivalencias_authenticated_select on equipo.rol_puesto_equivalencias
for select to authenticated using (true);
create policy equivalencias_admin_write on equipo.rol_puesto_equivalencias
for all to authenticated
using (exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and p.rol = 'admin'))
with check (exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and p.rol = 'admin'));

create policy persona_encuadres_staff_select on equipo.persona_encuadres
for select to authenticated using (
  exists (
    select 1 from bitacora.perfiles p
    where p.id = (select auth.uid()) and p.activo and (
      p.rol in ('admin','editor','consultor')
      or (p.rol = 'grupo' and exists (select 1 from bitacora.sedes s where s.id = persona_encuadres.sede_id and s.grupo_id = p.grupo_id))
      or (p.rol in ('encargado','sede') and persona_encuadres.sede_id = any(coalesce(p.sede_ids, '{}')))
    )
  )
);
create policy persona_encuadres_staff_insert on equipo.persona_encuadres
for insert to authenticated with check (
  exists (
    select 1 from bitacora.perfiles p
    where p.id = (select auth.uid()) and p.activo and (
      p.rol in ('admin','editor')
      or (p.rol = 'grupo' and exists (select 1 from bitacora.sedes s where s.id = persona_encuadres.sede_id and s.grupo_id = p.grupo_id))
      or (p.rol in ('encargado','sede') and persona_encuadres.sede_id = any(coalesce(p.sede_ids, '{}')))
    )
  )
);
create policy persona_encuadres_staff_update on equipo.persona_encuadres
for update to authenticated
using (
  exists (
    select 1 from bitacora.perfiles p
    where p.id = (select auth.uid()) and p.activo and (
      p.rol in ('admin','editor')
      or (p.rol = 'grupo' and exists (select 1 from bitacora.sedes s where s.id = persona_encuadres.sede_id and s.grupo_id = p.grupo_id))
      or (p.rol in ('encargado','sede') and persona_encuadres.sede_id = any(coalesce(p.sede_ids, '{}')))
    )
  )
)
with check (
  exists (
    select 1 from bitacora.perfiles p
    where p.id = (select auth.uid()) and p.activo and (
      p.rol in ('admin','editor')
      or (p.rol = 'grupo' and exists (select 1 from bitacora.sedes s where s.id = persona_encuadres.sede_id and s.grupo_id = p.grupo_id))
      or (p.rol in ('encargado','sede') and persona_encuadres.sede_id = any(coalesce(p.sede_ids, '{}')))
    )
  )
);

grant usage on schema equipo to authenticated;
grant select on equipo.puestos_cct, equipo.roles_operativos, equipo.rol_puesto_equivalencias to authenticated;
grant insert, update, delete on equipo.puestos_cct, equipo.roles_operativos, equipo.rol_puesto_equivalencias to authenticated;
grant select, insert, update on equipo.persona_encuadres to authenticated;

comment on table equipo.puestos_cct is 'Catalogo convencional de referencia; no determina por si solo el encuadre legal.';
comment on table equipo.roles_operativos is 'Roles internos Fly, independientes de las categorias convencionales.';
comment on table equipo.rol_puesto_equivalencias is 'Equivalencias editables y explicitamente confirmables entre rol Fly y puesto CCT.';
comment on table equipo.persona_encuadres is 'Asignacion operativa historizada de una persona; los turnos se modelan por separado.';
