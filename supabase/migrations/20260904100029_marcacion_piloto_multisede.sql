-- Fly Marcacion - seleccion de sede por evento para personas multisede.

alter table equipo.marcacion_pilotos
  add column if not exists multisede boolean not null default false;

update equipo.marcacion_pilotos
set multisede = true
where user_id = '626b2a44-be84-4b3e-a03f-505eaf9d195e'::uuid;

create or replace function bitacora.obtener_mi_marcacion(p_limite integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_persona equipo.personas%rowtype;
  v_multisede boolean := false;
  v_sede_id integer;
  v_sede_nombre text;
  v_geocerca_configurada boolean := false;
  v_ultimo equipo.marcacion_eventos%rowtype;
begin
  if v_uid is null then raise exception 'Se requiere una sesion autenticada'; end if;

  select mp.multisede into v_multisede
  from equipo.marcacion_pilotos mp
  where mp.user_id = v_uid and mp.activo;
  if not found then return jsonb_build_object('enabled', false); end if;

  select p.* into v_persona
  from equipo.personas p
  join equipo.marcacion_pilotos mp
    on mp.user_id = v_uid and mp.activo
   and (mp.persona_id = p.id or (mp.persona_id is null and p.perfil_id = v_uid))
  where p.activo
  order by (mp.persona_id = p.id) desc
  limit 1;

  if v_persona.id is null then
    return jsonb_build_object('enabled', true, 'ready', false,
      'message', 'Tu usuario todavia no esta vinculado con una persona activa.');
  end if;

  select pe.sede_id into v_sede_id
  from equipo.persona_encuadres pe
  where pe.persona_id = v_persona.id and pe.es_principal and pe.fecha_hasta is null
  order by pe.fecha_desde desc limit 1;
  v_sede_id := coalesce(v_sede_id, v_persona.sede_ids[1]);
  select s.nombre into v_sede_nombre from bitacora.sedes s where s.id = v_sede_id;
  select exists (select 1 from equipo.marcacion_sedes ms where ms.sede_id = v_sede_id and ms.activa)
    into v_geocerca_configurada;

  select me.* into v_ultimo
  from equipo.marcacion_eventos me
  where me.persona_id = v_persona.id
  order by me.server_timestamp desc limit 1;

  return jsonb_build_object(
    'enabled', true,
    'ready', true,
    'multiSite', v_multisede,
    'persona', jsonb_build_object('id', v_persona.id,
      'name', concat_ws(' ', v_persona.nombre, v_persona.apellido)),
    'site', jsonb_build_object('id', v_sede_id,
      'name', coalesce(v_sede_nombre, 'Sede sin asignar'),
      'geofenceConfigured', v_geocerca_configurada),
    'sites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.nombre,
        'geofenceConfigured', exists (
          select 1 from equipo.marcacion_sedes ms where ms.sede_id = s.id and ms.activa
        )
      ) order by s.nombre)
      from bitacora.sedes s
      where s.activa and (
        v_multisede
        or s.id = v_sede_id
        or s.id = any(coalesce(v_persona.sede_ids, '{}'))
      )
    ), '[]'::jsonb),
    'nextEventType', case when v_ultimo.event_type = 'CLOCK_IN' then 'CLOCK_OUT' else 'CLOCK_IN' end,
    'lastEvent', case when v_ultimo.id is null then null else jsonb_build_object(
      'id', v_ultimo.id,
      'eventType', v_ultimo.event_type,
      'serverTimestamp', v_ultimo.server_timestamp,
      'siteId', v_ultimo.sede_id,
      'siteName', (select s.nombre from bitacora.sedes s where s.id = v_ultimo.sede_id),
      'validationStatus', v_ultimo.validation_status
    ) end,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'eventType', e.event_type,
        'serverTimestamp', e.server_timestamp,
        'siteName', coalesce(s.nombre, 'Sede sin asignar'),
        'gpsAccuracyM', e.gps_accuracy_m,
        'distanceM', e.distance_to_location_m,
        'validationStatus', e.validation_status,
        'reasons', e.validation_reasons
      ) order by e.server_timestamp desc)
      from (select * from equipo.marcacion_eventos
        where persona_id = v_persona.id order by server_timestamp desc
        limit greatest(1, least(coalesce(p_limite, 20), 50))) e
      left join bitacora.sedes s on s.id = e.sede_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function bitacora.registrar_mi_marcacion(
  text, double precision, double precision, double precision,
  timestamptz, text, uuid
) from public, anon, authenticated;
drop function bitacora.registrar_mi_marcacion(
  text, double precision, double precision, double precision,
  timestamptz, text, uuid
);

create function bitacora.registrar_mi_marcacion(
  p_event_type text,
  p_sede_id integer,
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
  v_persona equipo.personas%rowtype;
  v_multisede boolean := false;
  v_ultimo_tipo text;
  v_policy equipo.marcacion_sedes%rowtype;
  v_distance double precision;
  v_location_verified boolean := false;
  v_status text := 'PENDING_REVIEW';
  v_reasons text[] := '{}';
  v_event equipo.marcacion_eventos%rowtype;
  v_sede_autorizada boolean := false;
begin
  if v_uid is null then raise exception 'Se requiere una sesion autenticada'; end if;
  if p_client_event_id is null then raise exception 'Falta el identificador unico del intento'; end if;
  if p_event_type not in ('CLOCK_IN', 'CLOCK_OUT') then raise exception 'Tipo de marcacion invalido'; end if;
  if p_sede_id is null then raise exception 'Selecciona el lugar de trabajo'; end if;
  if p_latitud is null or p_latitud not between -90 and 90 then raise exception 'Latitud invalida'; end if;
  if p_longitud is null or p_longitud not between -180 and 180 then raise exception 'Longitud invalida'; end if;
  if p_gps_accuracy_m is null or p_gps_accuracy_m < 0 or p_gps_accuracy_m > 100000 then raise exception 'Precision GPS invalida'; end if;

  select mp.multisede into v_multisede
  from equipo.marcacion_pilotos mp
  where mp.user_id = v_uid and mp.activo;
  if not found then raise exception 'Fly Marcacion no esta habilitado para este usuario'; end if;

  select p.* into v_persona
  from equipo.personas p
  join equipo.marcacion_pilotos mp
    on mp.user_id = v_uid and mp.activo
   and (mp.persona_id = p.id or (mp.persona_id is null and p.perfil_id = v_uid))
  where p.activo
  order by (mp.persona_id = p.id) desc
  limit 1;
  if v_persona.id is null then raise exception 'Tu usuario no esta vinculado con una persona activa'; end if;

  select exists (
    select 1 from bitacora.sedes s
    where s.id = p_sede_id and s.activa and (
      v_multisede
      or s.id = any(coalesce(v_persona.sede_ids, '{}'))
      or exists (select 1 from equipo.persona_encuadres pe
        where pe.persona_id = v_persona.id and pe.sede_id = s.id
          and pe.fecha_hasta is null)
    )
  ) into v_sede_autorizada;
  if not v_sede_autorizada then raise exception 'La sede elegida no esta habilitada para tu marcacion'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_persona.id::text, 0));
  select * into v_event from equipo.marcacion_eventos where client_event_id = p_client_event_id;
  if v_event.id is not null then
    return jsonb_build_object('id', v_event.id, 'serverTimestamp', v_event.server_timestamp,
      'validationStatus', v_event.validation_status, 'reasons', v_event.validation_reasons);
  end if;

  select me.event_type into v_ultimo_tipo
  from equipo.marcacion_eventos me where me.persona_id = v_persona.id
  order by me.server_timestamp desc limit 1;
  if (p_event_type = 'CLOCK_IN' and v_ultimo_tipo = 'CLOCK_IN') or
     (p_event_type = 'CLOCK_OUT' and coalesce(v_ultimo_tipo, '') <> 'CLOCK_IN') then
    raise exception 'La secuencia de ingreso y egreso no es valida';
  end if;

  select * into v_policy from equipo.marcacion_sedes where sede_id = p_sede_id and activa;
  if v_policy.sede_id is null then
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

  v_reasons := array_append(v_reasons, 'Turno pendiente de validacion');
  if v_location_verified then v_status := 'VALIDATED_WITH_WARNING'; end if;

  insert into equipo.marcacion_eventos (
    persona_id, user_id, sede_id, event_type, client_timestamp, timezone,
    latitud, longitud, gps_accuracy_m, distance_to_location_m,
    location_verified, schedule_verified, validation_status,
    validation_reasons, client_event_id
  ) values (
    v_persona.id, v_uid, p_sede_id, p_event_type, p_client_timestamp,
    left(nullif(btrim(p_timezone), ''), 80), p_latitud, p_longitud,
    p_gps_accuracy_m, v_distance, v_location_verified, false, v_status,
    v_reasons, p_client_event_id
  ) returning * into v_event;

  return jsonb_build_object('id', v_event.id,
    'serverTimestamp', v_event.server_timestamp,
    'validationStatus', v_event.validation_status,
    'reasons', v_event.validation_reasons,
    'distanceM', v_event.distance_to_location_m,
    'gpsAccuracyM', v_event.gps_accuracy_m,
    'siteId', v_event.sede_id);
end;
$$;

revoke execute on function bitacora.registrar_mi_marcacion(
  text, integer, double precision, double precision, double precision,
  timestamptz, text, uuid
) from public, anon;
grant execute on function bitacora.registrar_mi_marcacion(
  text, integer, double precision, double precision, double precision,
  timestamptz, text, uuid
) to authenticated;
