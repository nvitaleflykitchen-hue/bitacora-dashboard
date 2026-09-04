-- Fly Marcacion - piloto cerrado para Nicolas Vitale.
-- La evidencia original es append-only: no se conceden UPDATE ni DELETE.

create table equipo.marcacion_pilotos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  persona_id uuid references equipo.personas(id) on delete restrict,
  activo boolean not null default true,
  habilitado_desde timestamptz not null default now(),
  habilitado_por uuid references auth.users(id),
  constraint marcacion_pilotos_persona_unique unique nulls not distinct (persona_id)
);

create table equipo.marcacion_sedes (
  sede_id integer primary key references bitacora.sedes(id) on delete restrict,
  latitud double precision not null check (latitud between -90 and 90),
  longitud double precision not null check (longitud between -180 and 180),
  radio_metros integer not null default 120 check (radio_metros between 10 and 5000),
  precision_maxima_metros integer not null default 100 check (precision_maxima_metros between 5 and 5000),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table equipo.marcacion_eventos (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references equipo.personas(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  sede_id integer references bitacora.sedes(id) on delete restrict,
  event_type text not null check (event_type in ('CLOCK_IN', 'CLOCK_OUT')),
  server_timestamp timestamptz not null default clock_timestamp(),
  client_timestamp timestamptz,
  timezone text,
  latitud double precision not null check (latitud between -90 and 90),
  longitud double precision not null check (longitud between -180 and 180),
  gps_accuracy_m double precision not null check (gps_accuracy_m >= 0 and gps_accuracy_m <= 100000),
  distance_to_location_m double precision check (distance_to_location_m is null or distance_to_location_m >= 0),
  location_verified boolean not null default false,
  schedule_verified boolean not null default false,
  validation_status text not null check (validation_status in ('VALIDATED', 'VALIDATED_WITH_WARNING', 'PENDING_REVIEW', 'REJECTED')),
  validation_reasons text[] not null default '{}',
  client_event_id uuid not null unique,
  rules_version text not null default 'pilot-v1',
  created_at timestamptz not null default clock_timestamp()
);

create index marcacion_eventos_persona_fecha_idx
  on equipo.marcacion_eventos (persona_id, server_timestamp desc);
create index marcacion_eventos_user_fecha_idx
  on equipo.marcacion_eventos (user_id, server_timestamp desc);
create index marcacion_eventos_sede_fecha_idx
  on equipo.marcacion_eventos (sede_id, server_timestamp desc)
  where sede_id is not null;

alter table equipo.marcacion_pilotos enable row level security;
alter table equipo.marcacion_sedes enable row level security;
alter table equipo.marcacion_eventos enable row level security;

create policy marcacion_pilotos_lectura_propia
on equipo.marcacion_pilotos for select to authenticated
using ((select auth.uid()) = user_id);

create policy marcacion_eventos_lectura_propia
on equipo.marcacion_eventos for select to authenticated
using ((select auth.uid()) = user_id);

-- UUID confirmado en el repositorio para Nicolas Vitale. La persona se enlaza
-- automaticamente si equipo.personas.perfil_id ya apunta al mismo usuario.
insert into equipo.marcacion_pilotos (user_id, persona_id, habilitado_por)
select
  '626b2a44-be84-4b3e-a03f-505eaf9d195e'::uuid,
  (select p.id from equipo.personas p
    where p.perfil_id = '626b2a44-be84-4b3e-a03f-505eaf9d195e'::uuid
      and p.activo
    limit 1),
  '626b2a44-be84-4b3e-a03f-505eaf9d195e'::uuid
on conflict (user_id) do update
set activo = true,
    persona_id = coalesce(excluded.persona_id, equipo.marcacion_pilotos.persona_id);

create or replace function equipo.marcacion_distancia_m(
  p_latitud_1 double precision,
  p_longitud_1 double precision,
  p_latitud_2 double precision,
  p_longitud_2 double precision
)
returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(p_latitud_2 - p_latitud_1) / 2), 2) +
    cos(radians(p_latitud_1)) * cos(radians(p_latitud_2)) *
    power(sin(radians(p_longitud_2 - p_longitud_1) / 2), 2)
  ));
$$;

create or replace function bitacora.obtener_mi_marcacion(p_limite integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_persona equipo.personas%rowtype;
  v_sede_id integer;
  v_sede_nombre text;
  v_geocerca_configurada boolean := false;
  v_ultimo equipo.marcacion_eventos%rowtype;
begin
  if v_uid is null then
    raise exception 'Se requiere una sesion autenticada';
  end if;

  if not exists (
    select 1 from equipo.marcacion_pilotos mp
    where mp.user_id = v_uid and mp.activo
  ) then
    return jsonb_build_object('enabled', false);
  end if;

  select p.* into v_persona
  from equipo.personas p
  join equipo.marcacion_pilotos mp
    on mp.user_id = v_uid
   and mp.activo
   and (mp.persona_id = p.id or (mp.persona_id is null and p.perfil_id = v_uid))
  where p.activo
  order by (mp.persona_id = p.id) desc
  limit 1;

  if v_persona.id is null then
    return jsonb_build_object(
      'enabled', true,
      'ready', false,
      'message', 'Tu usuario todavia no esta vinculado con una persona activa.'
    );
  end if;

  select pe.sede_id into v_sede_id
  from equipo.persona_encuadres pe
  where pe.persona_id = v_persona.id
    and pe.es_principal
    and pe.fecha_hasta is null
  order by pe.fecha_desde desc
  limit 1;

  v_sede_id := coalesce(v_sede_id, v_persona.sede_ids[1]);
  select s.nombre into v_sede_nombre from bitacora.sedes s where s.id = v_sede_id;
  select exists (
    select 1 from equipo.marcacion_sedes ms
    where ms.sede_id = v_sede_id and ms.activa
  ) into v_geocerca_configurada;

  select me.* into v_ultimo
  from equipo.marcacion_eventos me
  where me.persona_id = v_persona.id
  order by me.server_timestamp desc
  limit 1;

  return jsonb_build_object(
    'enabled', true,
    'ready', true,
    'persona', jsonb_build_object(
      'id', v_persona.id,
      'name', concat_ws(' ', v_persona.nombre, v_persona.apellido)
    ),
    'site', jsonb_build_object(
      'id', v_sede_id,
      'name', coalesce(v_sede_nombre, 'Sede sin asignar'),
      'geofenceConfigured', v_geocerca_configurada
    ),
    'nextEventType', case when v_ultimo.event_type = 'CLOCK_IN' then 'CLOCK_OUT' else 'CLOCK_IN' end,
    'lastEvent', case when v_ultimo.id is null then null else jsonb_build_object(
      'id', v_ultimo.id,
      'eventType', v_ultimo.event_type,
      'serverTimestamp', v_ultimo.server_timestamp,
      'validationStatus', v_ultimo.validation_status
    ) end,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'eventType', e.event_type,
        'serverTimestamp', e.server_timestamp,
        'siteName', coalesce(s.nombre, 'Sede sin asignar'),
        'gpsAccuracyM', e.gps_accuracy_m,
        'distanceM', e.distance_to_location_m,
        'validationStatus', e.validation_status,
        'reasons', e.validation_reasons
      ) order by e.server_timestamp desc)
      from (
        select * from equipo.marcacion_eventos
        where persona_id = v_persona.id
        order by server_timestamp desc
        limit greatest(1, least(coalesce(p_limite, 20), 50))
      ) e
      left join bitacora.sedes s on s.id = e.sede_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function bitacora.registrar_mi_marcacion(
  p_event_type text,
  p_latitud double precision,
  p_longitud double precision,
  p_gps_accuracy_m double precision,
  p_client_timestamp timestamptz,
  p_timezone text,
  p_client_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_persona_id uuid;
  v_sede_id integer;
  v_ultimo_tipo text;
  v_policy equipo.marcacion_sedes%rowtype;
  v_distance double precision;
  v_location_verified boolean := false;
  v_status text := 'PENDING_REVIEW';
  v_reasons text[] := '{}';
  v_event equipo.marcacion_eventos%rowtype;
begin
  if v_uid is null then raise exception 'Se requiere una sesion autenticada'; end if;
  if p_client_event_id is null then raise exception 'Falta el identificador unico del intento'; end if;
  if p_event_type not in ('CLOCK_IN', 'CLOCK_OUT') then raise exception 'Tipo de marcacion invalido'; end if;
  if p_latitud is null or p_latitud not between -90 and 90 then raise exception 'Latitud invalida'; end if;
  if p_longitud is null or p_longitud not between -180 and 180 then raise exception 'Longitud invalida'; end if;
  if p_gps_accuracy_m is null or p_gps_accuracy_m < 0 or p_gps_accuracy_m > 100000 then raise exception 'Precision GPS invalida'; end if;

  if not exists (select 1 from equipo.marcacion_pilotos where user_id = v_uid and activo) then
    raise exception 'Fly Marcacion no esta habilitado para este usuario';
  end if;

  select coalesce(mp.persona_id, p.id) into v_persona_id
  from equipo.marcacion_pilotos mp
  left join equipo.personas p on p.perfil_id = mp.user_id and p.activo
  where mp.user_id = v_uid and mp.activo
  limit 1;
  if v_persona_id is null then raise exception 'Tu usuario no esta vinculado con una persona activa'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_persona_id::text, 0));

  select * into v_event from equipo.marcacion_eventos where client_event_id = p_client_event_id;
  if v_event.id is not null then
    return jsonb_build_object('id', v_event.id, 'serverTimestamp', v_event.server_timestamp,
      'validationStatus', v_event.validation_status, 'reasons', v_event.validation_reasons);
  end if;

  select pe.sede_id into v_sede_id
  from equipo.persona_encuadres pe
  where pe.persona_id = v_persona_id and pe.es_principal and pe.fecha_hasta is null
  order by pe.fecha_desde desc limit 1;
  if v_sede_id is null then
    select p.sede_ids[1] into v_sede_id from equipo.personas p where p.id = v_persona_id;
  end if;

  select me.event_type into v_ultimo_tipo
  from equipo.marcacion_eventos me
  where me.persona_id = v_persona_id
  order by me.server_timestamp desc limit 1;

  if (p_event_type = 'CLOCK_IN' and v_ultimo_tipo = 'CLOCK_IN') or
     (p_event_type = 'CLOCK_OUT' and coalesce(v_ultimo_tipo, '') <> 'CLOCK_IN') then
    raise exception 'La secuencia de ingreso y egreso no es valida';
  end if;

  select * into v_policy from equipo.marcacion_sedes
  where sede_id = v_sede_id and activa;

  if v_sede_id is null then
    v_reasons := array_append(v_reasons, 'No hay una sede laboral asignada');
  elsif v_policy.sede_id is null then
    v_reasons := array_append(v_reasons, 'La sede todavia no tiene geocerca configurada');
  else
    v_distance := equipo.marcacion_distancia_m(p_latitud, p_longitud, v_policy.latitud, v_policy.longitud);
    if p_gps_accuracy_m > v_policy.precision_maxima_metros then
      v_reasons := array_append(v_reasons, format('Precision GPS insuficiente: +/- %s m', round(p_gps_accuracy_m)));
    elsif v_distance > v_policy.radio_metros then
      v_reasons := array_append(v_reasons, format('Fuera de geocerca: %s m', round(v_distance)));
    else
      v_location_verified := true;
    end if;
  end if;

  -- El piloto aun no tiene asignaciones de turno persistidas. Nunca se declara
  -- VALIDATED hasta incorporar esa comprobacion del lado servidor.
  v_reasons := array_append(v_reasons, 'Turno pendiente de validacion');
  if v_location_verified then v_status := 'VALIDATED_WITH_WARNING'; end if;

  insert into equipo.marcacion_eventos (
    persona_id, user_id, sede_id, event_type, client_timestamp, timezone,
    latitud, longitud, gps_accuracy_m, distance_to_location_m,
    location_verified, schedule_verified, validation_status,
    validation_reasons, client_event_id
  ) values (
    v_persona_id, v_uid, v_sede_id, p_event_type, p_client_timestamp,
    left(nullif(btrim(p_timezone), ''), 80), p_latitud, p_longitud,
    p_gps_accuracy_m, v_distance, v_location_verified, false, v_status,
    v_reasons, p_client_event_id
  ) returning * into v_event;

  return jsonb_build_object(
    'id', v_event.id,
    'serverTimestamp', v_event.server_timestamp,
    'validationStatus', v_event.validation_status,
    'reasons', v_event.validation_reasons,
    'distanceM', v_event.distance_to_location_m,
    'gpsAccuracyM', v_event.gps_accuracy_m
  );
end;
$$;

revoke all on equipo.marcacion_pilotos, equipo.marcacion_sedes, equipo.marcacion_eventos from public, anon;
revoke all on equipo.marcacion_pilotos, equipo.marcacion_sedes, equipo.marcacion_eventos from authenticated;
grant select on equipo.marcacion_pilotos, equipo.marcacion_eventos to authenticated;

revoke execute on function equipo.marcacion_distancia_m(double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke execute on function bitacora.obtener_mi_marcacion(integer) from public, anon;
revoke execute on function bitacora.registrar_mi_marcacion(text, double precision, double precision, double precision, timestamptz, text, uuid) from public, anon;
grant execute on function bitacora.obtener_mi_marcacion(integer) to authenticated;
grant execute on function bitacora.registrar_mi_marcacion(text, double precision, double precision, double precision, timestamptz, text, uuid) to authenticated;

comment on table equipo.marcacion_eventos is 'Evidencia original append-only de Fly Marcacion. No actualizar ni borrar.';
comment on function bitacora.registrar_mi_marcacion is 'Registra una marcacion piloto derivando identidad, persona, sede y hora desde el backend.';
