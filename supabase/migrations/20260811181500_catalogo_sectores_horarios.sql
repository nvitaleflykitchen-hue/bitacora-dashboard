-- Normaliza los sectores de Horarios y Dotacion mediante un catalogo maestro.

create table equipo.sectores_catalogo (
  codigo text primary key check (codigo = lower(codigo) and codigo ~ '^[a-z0-9_]+$'),
  nombre text not null unique check (char_length(btrim(nombre)) between 2 and 80),
  orden smallint not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into equipo.sectores_catalogo (codigo, nombre, orden) values
  ('cocina_elaboracion', 'Cocina y elaboración', 10),
  ('servicio_distribucion', 'Servicio y distribución', 20),
  ('limpieza_lavado', 'Limpieza y lavado', 30),
  ('deposito_despensa', 'Depósito y despensa', 40),
  ('nutricion_calidad', 'Nutrición y calidad', 50),
  ('administracion', 'Administración', 60),
  ('mantenimiento', 'Mantenimiento', 70),
  ('recepcion_porteria', 'Recepción y portería', 80),
  ('hoteleria_habitaciones', 'Hotelería y habitaciones', 90),
  ('exteriores', 'Exteriores', 100);

alter table equipo.horario_sectores
  add column catalogo_codigo text references equipo.sectores_catalogo(codigo) on update cascade on delete restrict;

do $$
begin
  if exists (select 1 from equipo.horario_sectores where catalogo_codigo is null) then
    raise exception 'Existen sectores libres sin catalogo; normalizarlos antes de continuar';
  end if;
end $$;

alter table equipo.horario_sectores alter column catalogo_codigo set not null;

create unique index horario_sectores_sede_catalogo_uidx
  on equipo.horario_sectores (sede_id, catalogo_codigo);
create index horario_sectores_catalogo_codigo_idx
  on equipo.horario_sectores (catalogo_codigo);

create trigger sectores_catalogo_touch_updated_at before update on equipo.sectores_catalogo
for each row execute function equipo.touch_updated_at();

alter table equipo.sectores_catalogo enable row level security;

create policy sectores_catalogo_staff_select on equipo.sectores_catalogo
for select to authenticated using (
  exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo)
);

create policy sectores_catalogo_admin_write on equipo.sectores_catalogo
for all to authenticated
using (
  exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and p.rol in ('admin','editor'))
)
with check (
  exists (select 1 from bitacora.perfiles p where p.id = (select auth.uid()) and p.activo and p.rol in ('admin','editor'))
);

grant select, insert, update on equipo.sectores_catalogo to authenticated;

comment on table equipo.sectores_catalogo is 'Catalogo maestro normalizado de sectores operativos para Horarios y Dotacion.';
comment on column equipo.horario_sectores.catalogo_codigo is 'Sector maestro habilitado para la sede; evita variantes de texto libre.';
