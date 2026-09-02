alter table mantenimiento.activos
  add column if not exists custodio_persona_id uuid references equipo.personas(id) on delete set null,
  add column if not exists custodia_desde date,
  add column if not exists ubicacion_detalle text;

comment on column mantenimiento.activos.custodio_persona_id is 'Persona de Equipo que mantiene la custodia actual del activo; independiente de la sede física.';
comment on column mantenimiento.activos.custodia_desde is 'Fecha desde la que la persona actual tiene el activo bajo custodia.';
comment on column mantenimiento.activos.ubicacion_detalle is 'Sector, oficina u otra referencia de ubicación actual dentro o fuera de la sede base.';

create index if not exists activos_custodio_persona_idx
  on mantenimiento.activos (custodio_persona_id)
  where custodio_persona_id is not null;

create table if not exists mantenimiento.activo_custodias (
  id uuid primary key default gen_random_uuid(),
  activo_id uuid not null references mantenimiento.activos(id) on delete cascade,
  persona_anterior_id uuid references equipo.personas(id) on delete set null,
  persona_nueva_id uuid references equipo.personas(id) on delete set null,
  persona_anterior_nombre text,
  persona_nueva_nombre text,
  tipo_movimiento text not null check (tipo_movimiento in ('asignacion','transferencia','devolucion')),
  observacion text,
  registrado_por uuid,
  created_at timestamptz not null default now()
);

create index if not exists activo_custodias_activo_fecha_idx
  on mantenimiento.activo_custodias (activo_id, created_at desc);

alter table mantenimiento.activo_custodias enable row level security;
revoke all on mantenimiento.activo_custodias from public, anon, authenticated;
grant select on mantenimiento.activo_custodias to authenticated;

drop policy if exists activo_custodias_auth_select on mantenimiento.activo_custodias;
create policy activo_custodias_auth_select
  on mantenimiento.activo_custodias for select
  to authenticated
  using (true);

create or replace function mantenimiento.registrar_cambio_custodia_activo()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, mantenimiento, equipo
as $$
declare
  v_anterior_nombre text;
  v_nueva_nombre text;
  v_tipo text;
begin
  if tg_op = 'INSERT' and new.custodio_persona_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.custodio_persona_id is not distinct from new.custodio_persona_id then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.custodio_persona_id is not null then
    select concat_ws(' ', p.nombre, p.apellido) into v_anterior_nombre
    from equipo.personas p where p.id = old.custodio_persona_id;
  end if;
  if new.custodio_persona_id is not null then
    select concat_ws(' ', p.nombre, p.apellido) into v_nueva_nombre
    from equipo.personas p where p.id = new.custodio_persona_id;
  end if;

  v_tipo := case
    when tg_op = 'INSERT' or old.custodio_persona_id is null then 'asignacion'
    when new.custodio_persona_id is null then 'devolucion'
    else 'transferencia'
  end;

  insert into mantenimiento.activo_custodias (
    activo_id, persona_anterior_id, persona_nueva_id,
    persona_anterior_nombre, persona_nueva_nombre,
    tipo_movimiento, registrado_por
  ) values (
    new.id,
    case when tg_op = 'UPDATE' then old.custodio_persona_id else null end,
    new.custodio_persona_id,
    v_anterior_nombre, v_nueva_nombre,
    v_tipo, auth.uid()
  );
  return new;
end;
$$;

revoke all on function mantenimiento.registrar_cambio_custodia_activo() from public, anon, authenticated;

drop trigger if exists trg_registrar_cambio_custodia_activo on mantenimiento.activos;
create trigger trg_registrar_cambio_custodia_activo
after insert or update of custodio_persona_id on mantenimiento.activos
for each row
execute function mantenimiento.registrar_cambio_custodia_activo();

create or replace view public.mnt_activos as
select
  a.id, a.codigo_interno, a.tipo, a.nombre, a.marca, a.modelo,
  a.numero_serie, a.categoria, a.sede, a.responsable, a.estado,
  a.estado_notas, a.estado_cambiado_at, a.km_actual, a.qr_code,
  a.manual_url, a.foto_url, a.fecha_compra, a.proveedor_compra,
  a.vencimiento_seguro, a.vencimiento_vtv, a.numero_poliza,
  a.vencimiento_senasa, a.vencimiento_rmtsa, a.proxima_consulta_tecnico,
  a.notas_tecnico, a.created_at, a.updated_at, a.sede_id, a.sede_nombre,
  a.notas, a.proveedor_servicio_id,
  a.custodio_persona_id, a.custodia_desde, a.ubicacion_detalle
from mantenimiento.activos a;

revoke all on public.mnt_activos from anon;
grant select, insert, update, delete on public.mnt_activos to authenticated;
