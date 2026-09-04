-- Consulta interna de credenciales con alcance por identidad, supervisión, sede y permisos.
-- No expone DNI, CUIL, domicilio, datos médicos, disciplina ni remuneraciones.

create table if not exists bitacora.credencial_consultas_internas (
  id bigint generated always as identity primary key,
  credencial_id uuid not null references equipo.credenciales_personal(id),
  persona_id uuid not null references equipo.personas(id),
  consultado_por uuid not null references auth.users(id),
  alcance text not null check (alcance in ('propio', 'supervision', 'sede', 'global')),
  secciones text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

alter table bitacora.credencial_consultas_internas enable row level security;
revoke all on table bitacora.credencial_consultas_internas from public, anon, authenticated;
comment on table bitacora.credencial_consultas_internas is
  'Auditoría privada de consultas autenticadas de credenciales; no se expone por API.';

create index if not exists credencial_consultas_persona_fecha_idx
  on bitacora.credencial_consultas_internas(persona_id, created_at desc);
create index if not exists credencial_consultas_usuario_fecha_idx
  on bitacora.credencial_consultas_internas(consultado_por, created_at desc);

create or replace function public.obtener_credencial_interna(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, bitacora, equipo
as $$
declare
  v_uid uuid := auth.uid();
  v_perfil bitacora.perfiles%rowtype;
  v_persona equipo.personas%rowtype;
  v_credencial equipo.credenciales_personal%rowtype;
  v_viewer_persona_id uuid;
  v_target_sedes integer[] := '{}'::integer[];
  v_is_self boolean := false;
  v_is_supervisor boolean := false;
  v_same_site boolean := false;
  v_global_basic boolean := false;
  v_global_laboral boolean := false;
  v_global_evaluaciones boolean := false;
  v_documentacion boolean := false;
  v_open_full boolean := false;
  v_show_laboral boolean := false;
  v_show_evaluaciones boolean := false;
  v_scope text;
  v_sections text[] := array['basico'];
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Se requiere una sesión autenticada.' using errcode = '42501';
  end if;

  select * into v_perfil
  from bitacora.perfiles
  where id = v_uid and activo = true;
  if not found then
    raise exception 'El usuario no tiene un perfil activo.' using errcode = '42501';
  end if;

  select * into v_credencial
  from equipo.credenciales_personal
  where token = p_token;
  if not found then
    return null;
  end if;

  select * into v_persona from equipo.personas where id = v_credencial.persona_id;
  if not found then return null; end if;

  select id into v_viewer_persona_id
  from equipo.personas
  where perfil_id = v_uid and activo = true
  order by updated_at desc nulls last
  limit 1;

  v_is_self := v_persona.perfil_id = v_uid;
  v_is_supervisor := v_viewer_persona_id is not null and exists (
    select 1 from equipo.persona_encuadres e
    where e.persona_id = v_persona.id
      and e.supervisor_persona_id = v_viewer_persona_id
      and e.fecha_desde <= current_date
      and (e.fecha_hasta is null or e.fecha_hasta >= current_date)
  );

  select coalesce(array_agg(distinct sede_id), '{}'::integer[]) into v_target_sedes
  from (
    select unnest(coalesce(v_persona.sede_ids, '{}'::integer[])) as sede_id
    union
    select e.sede_id from equipo.persona_encuadres e
    where e.persona_id = v_persona.id
      and e.fecha_desde <= current_date
      and (e.fecha_hasta is null or e.fecha_hasta >= current_date)
  ) s where sede_id is not null;
  v_same_site := coalesce(v_perfil.sede_ids, '{}'::integer[]) && v_target_sedes;

  select
    bool_or(accion = 'view_all_basic'),
    bool_or(accion = 'view_all_employment'),
    bool_or(accion = 'view_all_performance'),
    bool_or(accion = 'view_document_status'),
    bool_or(accion = 'open_full_record')
  into v_global_basic, v_global_laboral, v_global_evaluaciones, v_documentacion, v_open_full
  from bitacora.perfil_permisos
  where perfil_id = v_uid and modulo = 'personal' and activo = true;

  v_global_basic := v_perfil.rol = 'admin' or coalesce(v_global_basic, false);
  v_global_laboral := v_perfil.rol = 'admin' or coalesce(v_global_laboral, false);
  v_global_evaluaciones := v_perfil.rol = 'admin' or coalesce(v_global_evaluaciones, false);
  v_documentacion := v_perfil.rol = 'admin' or coalesce(v_documentacion, false);
  v_open_full := v_perfil.rol = 'admin' or coalesce(v_open_full, false);

  if v_global_basic then v_scope := 'global';
  elsif v_is_self then v_scope := 'propio';
  elsif v_is_supervisor then v_scope := 'supervision';
  elsif v_same_site then v_scope := 'sede';
  else
    raise exception 'No tenés permiso para consultar esta credencial.' using errcode = '42501';
  end if;

  v_show_laboral := v_is_self or v_is_supervisor or v_global_laboral;
  v_show_evaluaciones := v_is_self or v_is_supervisor or v_global_evaluaciones;
  if v_show_laboral then v_sections := array_append(v_sections, 'laboral'); end if;
  if v_show_evaluaciones then v_sections := array_append(v_sections, 'evaluaciones'); end if;
  if v_documentacion then v_sections := array_append(v_sections, 'documentacion'); end if;

  v_result := jsonb_build_object(
    'scope', v_scope,
    'sections', to_jsonb(v_sections),
    'canOpenFullRecord', v_open_full,
    'credential', jsonb_build_object(
      'id', v_credencial.id,
      'status', v_credencial.estado,
      'issuedAt', v_credencial.fecha_emision,
      'expiresAt', v_credencial.fecha_vencimiento
    ),
    'person', jsonb_build_object(
      'id', v_persona.id,
      'name', concat_ws(' ', v_persona.nombre, v_persona.apellido),
      'jobTitle', coalesce(v_credencial.puesto_impreso, v_persona.puesto),
      'area', coalesce(v_persona.functional_area, v_credencial.area_impresa, v_persona.area),
      'photoUrl', v_persona.foto_url,
      'active', v_persona.activo,
      'sites', (select coalesce(jsonb_agg(s.nombre order by s.nombre), '[]'::jsonb)
                from bitacora.sedes s where s.id = any(v_target_sedes))
    ),
    'supervisor', (
      select jsonb_build_object(
        'name', concat_ws(' ', supervisor.nombre, supervisor.apellido),
        'jobTitle', supervisor.puesto,
        'phone', supervisor.telefono
      )
      from equipo.persona_encuadres e
      join equipo.personas supervisor on supervisor.id = e.supervisor_persona_id
      where e.persona_id = v_persona.id
        and e.fecha_desde <= current_date
        and (e.fecha_hasta is null or e.fecha_hasta >= current_date)
      order by e.es_principal desc, e.fecha_desde desc
      limit 1
    ),
    'employment', case when v_show_laboral then jsonb_build_object(
      'employeeNumber', v_persona.legajo,
      'startDate', v_persona.fecha_ingreso,
      'realFunction', (select e.funcion_real from equipo.persona_encuadres e
        where e.persona_id = v_persona.id and e.fecha_desde <= current_date
          and (e.fecha_hasta is null or e.fecha_hasta >= current_date)
        order by e.es_principal desc, e.fecha_desde desc limit 1)
    ) else null end,
    'performance', case when v_show_evaluaciones then (
      select jsonb_build_object(
        'count', count(*),
        'averageScore', round(avg(e.puntaje_calculado), 2),
        'latest', coalesce((array_agg(jsonb_build_object(
          'date', e.fecha_evaluacion, 'period', e.periodo,
          'score', e.puntaje_calculado, 'result', e.resultado_global,
          'evaluator', e.evaluador_nombre
        ) order by e.fecha_evaluacion desc))[1], null)
      ) from equipo.evaluaciones e where e.persona_id = v_persona.id
    ) else null end,
    'documentation', case when v_documentacion then jsonb_build_object(
      'attachmentCount', (select count(*) from bitacora.adjuntos a
        join equipo.historial_personal h on h.id::text = a.entity_id::text
        where h.persona_id = v_persona.id and a.entity_type = 'historial_personal')
    ) else null end,
    'remuneration', jsonb_build_object('visible', false)
  );

  insert into bitacora.credencial_consultas_internas
    (credencial_id, persona_id, consultado_por, alcance, secciones)
  values (v_credencial.id, v_persona.id, v_uid, v_scope, v_sections);

  return v_result;
end;
$$;

revoke all on function public.obtener_credencial_interna(uuid) from public, anon;
grant execute on function public.obtener_credencial_interna(uuid) to authenticated;
comment on function public.obtener_credencial_interna(uuid) is
  'Ficha mínima para escaneo interno. Autoriza por identidad, supervisor, sede o permisos personal:* y audita la consulta.';
