-- Historial privado de escaneos internos de activos.
-- La tabla no se expone al cliente: toda lectura/escritura pasa por RPCs que
-- validan sesión, perfil activo y alcance por sede.

create table if not exists mantenimiento.escaneos_activo (
  id uuid primary key default gen_random_uuid(),
  activo_id uuid not null references mantenimiento.activos(id) on delete cascade,
  usuario_id uuid not null references auth.users(id),
  evento_cliente uuid not null,
  fecha timestamptz not null default now(),
  latitud double precision,
  longitud double precision,
  precision_metros double precision,
  estado_ubicacion text not null default 'no_solicitada'
    check (estado_ubicacion in ('obtenida','denegada','no_disponible','timeout','error','no_solicitada')),
  contexto text not null default 'qr_interno'
    check (contexto in ('qr_interno','enlace_qr')),
  constraint escaneos_activo_coordenadas_check check (
    (latitud is null and longitud is null)
    or (latitud between -90 and 90 and longitud between -180 and 180)
  ),
  constraint escaneos_activo_precision_check check (precision_metros is null or precision_metros >= 0),
  unique (usuario_id, evento_cliente)
);

create index if not exists escaneos_activo_activo_fecha_idx
  on mantenimiento.escaneos_activo (activo_id, fecha desc);

alter table mantenimiento.escaneos_activo enable row level security;
revoke all on table mantenimiento.escaneos_activo from public, anon, authenticated;

create or replace function public.puede_consultar_activo(p_activo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, bitacora, mantenimiento
as $$
  select exists (
    select 1
    from mantenimiento.activos a
    join bitacora.perfiles p on p.id = (select auth.uid())
    left join bitacora.sedes s on s.id = a.sede_id
    where a.id = p_activo_id
      and p.activo = true
      and (
        p.rol in ('admin','editor','consultor')
        or a.sede_id = any(coalesce(p.sede_ids, '{}'::integer[]))
        or (p.rol = 'grupo' and p.grupo_id is not null and s.grupo_id = p.grupo_id)
      )
  );
$$;

revoke all on function public.puede_consultar_activo(uuid) from public, anon, authenticated;

create or replace function public.registrar_escaneo_activo(
  p_activo_id uuid,
  p_evento_cliente uuid,
  p_latitud double precision default null,
  p_longitud double precision default null,
  p_precision_metros double precision default null,
  p_estado_ubicacion text default 'no_solicitada',
  p_contexto text default 'qr_interno'
)
returns table (id uuid, fecha timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, bitacora, mantenimiento
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere una sesión autenticada';
  end if;
  if not public.puede_consultar_activo(p_activo_id) then
    raise exception 'No tenés permiso para registrar este escaneo';
  end if;
  if p_estado_ubicacion not in ('obtenida','denegada','no_disponible','timeout','error','no_solicitada') then
    raise exception 'Estado de ubicación inválido';
  end if;
  if p_contexto not in ('qr_interno','enlace_qr') then
    raise exception 'Contexto de escaneo inválido';
  end if;
  if (p_latitud is null) <> (p_longitud is null) then
    raise exception 'Las coordenadas deben informarse juntas';
  end if;

  return query
  insert into mantenimiento.escaneos_activo (
    activo_id, usuario_id, evento_cliente, latitud, longitud,
    precision_metros, estado_ubicacion, contexto
  ) values (
    p_activo_id, (select auth.uid()), p_evento_cliente, p_latitud, p_longitud,
    p_precision_metros, p_estado_ubicacion, p_contexto
  )
  on conflict (usuario_id, evento_cliente) do update
    set evento_cliente = excluded.evento_cliente
  returning escaneos_activo.id, escaneos_activo.fecha;
end;
$$;

revoke all on function public.registrar_escaneo_activo(uuid, uuid, double precision, double precision, double precision, text, text) from public, anon;
grant execute on function public.registrar_escaneo_activo(uuid, uuid, double precision, double precision, double precision, text, text) to authenticated;

create or replace function public.listar_escaneos_activo(p_activo_id uuid, p_limite integer default 20)
returns table (
  id uuid,
  fecha timestamptz,
  usuario_id uuid,
  usuario_nombre text,
  latitud double precision,
  longitud double precision,
  precision_metros double precision,
  estado_ubicacion text,
  contexto text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, bitacora, mantenimiento
as $$
begin
  if (select auth.uid()) is null or not public.puede_consultar_activo(p_activo_id) then
    raise exception 'No tenés permiso para consultar estos escaneos';
  end if;

  return query
  select e.id, e.fecha, e.usuario_id,
    coalesce(nullif(trim(p.nombre), ''), nullif(trim(p.email), ''), 'Usuario')::text,
    e.latitud, e.longitud, e.precision_metros, e.estado_ubicacion, e.contexto
  from mantenimiento.escaneos_activo e
  left join bitacora.perfiles p on p.id = e.usuario_id
  where e.activo_id = p_activo_id
  order by e.fecha desc
  limit greatest(1, least(coalesce(p_limite, 20), 100));
end;
$$;

revoke all on function public.listar_escaneos_activo(uuid, integer) from public, anon;
grant execute on function public.listar_escaneos_activo(uuid, integer) to authenticated;

comment on table mantenimiento.escaneos_activo is
  'Trazabilidad privada de escaneos de QR realizados por usuarios autenticados; la ubicación es opcional y requiere permiso del dispositivo.';
