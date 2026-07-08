-- Incluye candidatos de Selección de personal en la búsqueda global.
-- Conserva los roles y el alcance territorial del RPC existente.
do $$
declare
  function_sql text;
  updated_sql text;
  needle text := E'    union all\n    select ''responsable''::text';
  candidate_sql text := $candidate$
    union all
    select 'candidato'::text, rc.id::text, rc.nombre_apellido::text,
      concat_ws(' · ', scoped.puesto, scoped.sede_nombre, rc.email, rc.celular)::text,
      rc.estado::text, 'equipo'::text, scoped.sede_id::bigint,
      case when lower(rc.nombre_apellido) = v_query then 0
        when lower(rc.nombre_apellido) like v_query || '%' then 1 else 2 end::integer
    from equipo.reclutamiento_candidatos rc
    left join lateral (
      select
        (array_agg(sol.puesto order by (sol.id = rc.solicitud_id) desc, sol.created_at desc))[1] as puesto,
        (array_agg(s.nombre order by (sol.id = rc.solicitud_id) desc, sol.created_at desc))[1] as sede_nombre,
        (array_agg(sol.sede_id order by (sol.id = rc.solicitud_id) desc, sol.created_at desc))[1] as sede_id,
        string_agg(concat_ws(' ', sol.puesto, s.nombre, sol.estado), ' ') as search_text
      from equipo.reclutamiento_solicitudes sol
      left join bitacora.sedes s on s.id = sol.sede_id
      where (
          sol.id = rc.solicitud_id
          or exists (
            select 1
            from equipo.reclutamiento_candidato_solicitudes rcs
            where rcs.candidato_id = rc.id
              and rcs.solicitud_id = sol.id
          )
        )
        and (v_all_sedes or sol.sede_id = any(v_sede_ids))
    ) scoped on true
    where v_rol in ('admin','editor','consultor','grupo','encargado')
      and (v_all_sedes or scoped.sede_id is not null)
      and strpos(lower(concat_ws(' ', rc.nombre_apellido, rc.dni, rc.cuil, rc.celular,
        rc.email, rc.origen, rc.recomendado_por, rc.estado, rc.resultado, rc.notas,
        scoped.search_text)), v_query) > 0

$candidate$;
begin
  select pg_get_functiondef(p.oid)
    into function_sql
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'bitacora_private'
    and p.proname = 'buscar_global_core'
    and pg_get_function_identity_arguments(p.oid) = 'p_query text, p_limit integer';

  if function_sql is null then
    raise exception 'No se encontro bitacora_private.buscar_global_core(text, integer)';
  end if;

  if position(needle in function_sql) = 0 then
    raise exception 'No se encontro el punto de insercion esperado';
  end if;

  updated_sql := replace(function_sql, needle, candidate_sql || needle);
  execute updated_sql;
end;
$$;
