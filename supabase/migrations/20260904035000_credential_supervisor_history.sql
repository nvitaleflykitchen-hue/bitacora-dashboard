-- Permite al supervisor directo o a un administrador registrar una observación
-- no disciplinaria desde la lectura interna de una credencial.

create or replace function public.registrar_observacion_credencial(
  p_token uuid,
  p_descripcion text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, bitacora, equipo
as $$
declare
  v_uid uuid := auth.uid();
  v_perfil bitacora.perfiles%rowtype;
  v_persona_id uuid;
  v_viewer_persona_id uuid;
  v_historial_id uuid;
  v_es_supervisor boolean := false;
begin
  if v_uid is null then
    raise exception 'Se requiere una sesión autenticada.' using errcode = '42501';
  end if;
  if nullif(btrim(p_descripcion), '') is null then
    raise exception 'Escribí una observación.' using errcode = '22023';
  end if;
  if char_length(btrim(p_descripcion)) > 1500 then
    raise exception 'La observación no puede superar 1500 caracteres.' using errcode = '22023';
  end if;

  select * into v_perfil from bitacora.perfiles
  where id = v_uid and activo = true;
  if not found then
    raise exception 'El usuario no tiene un perfil activo.' using errcode = '42501';
  end if;

  select c.persona_id into v_persona_id
  from equipo.credenciales_personal c
  join equipo.personas p on p.id = c.persona_id
  where c.token = p_token;
  if v_persona_id is null then
    raise exception 'No se encontró la credencial.' using errcode = 'P0002';
  end if;

  select id into v_viewer_persona_id
  from equipo.personas
  where perfil_id = v_uid and activo = true
  order by updated_at desc nulls last
  limit 1;

  v_es_supervisor := v_viewer_persona_id is not null and exists (
    select 1 from equipo.persona_encuadres e
    where e.persona_id = v_persona_id
      and e.supervisor_persona_id = v_viewer_persona_id
      and e.fecha_desde <= current_date
      and (e.fecha_hasta is null or e.fecha_hasta >= current_date)
  );

  if v_perfil.rol <> 'admin' and not v_es_supervisor then
    raise exception 'Sólo el supervisor directo o un administrador puede registrar esta observación.' using errcode = '42501';
  end if;

  insert into equipo.historial_personal (
    persona_id, tipo, fecha, descripcion, registrado_por
  ) values (
    v_persona_id,
    'otro',
    current_date,
    btrim(p_descripcion),
    coalesce(nullif(btrim(v_perfil.nombre), ''), v_perfil.email)
  ) returning id into v_historial_id;

  return v_historial_id;
end;
$$;

revoke all on function public.registrar_observacion_credencial(uuid, text) from public, anon;
grant execute on function public.registrar_observacion_credencial(uuid, text) to authenticated;

comment on function public.registrar_observacion_credencial(uuid, text) is
  'Agrega una observación no disciplinaria al historial desde un QR; autoriza únicamente supervisor directo vigente o admin.';
