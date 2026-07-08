-- Amplia la busqueda de tareas a los intervinientes ya autorizados.
-- No cambia permisos, grants ni alcance de sedes.
do $$
declare
  function_sql text;
  updated_sql text;
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

  updated_sql := replace(
    function_sql,
    't.responsable, t.categoria, s.nombre',
    't.responsable, t.categoria, t.intervinientes::text, s.nombre'
  );

  if updated_sql = function_sql then
    raise exception 'No se encontro el fragmento esperado para actualizar';
  end if;

  execute updated_sql;
end;
$$;
