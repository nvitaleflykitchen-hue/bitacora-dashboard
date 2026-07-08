-- Enruta entidades vehiculares al hub de Flota para poder abrir su detalle.
-- No cambia permisos, grants ni alcance de datos.
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

  updated_sql := replace(
    function_sql,
    'case when v_rol = ''flota'' then ''flotaGestion'' else ''mntTickets'' end::text',
    'case when v_rol = ''flota'' or upper(coalesce(a.tipo, '''')) = ''VEHICULO'' or lower(coalesce(tk.categoria, '''')) like ''%vehic%'' then ''flotaGestion'' else ''mntTickets'' end::text'
  );
  updated_sql := replace(
    updated_sql,
    'case when v_rol = ''flota'' then ''flotaGestion'' else ''mntActivos'' end::text',
    'case when v_rol = ''flota'' or upper(coalesce(a.tipo, '''')) = ''VEHICULO'' then ''flotaGestion'' else ''mntActivos'' end::text'
  );
  updated_sql := replace(
    updated_sql,
    'case when v_rol = ''flota'' then ''flotaGestion'' else ''mntPlanes'' end::text',
    'case when v_rol = ''flota'' or upper(coalesce(a.tipo, '''')) = ''VEHICULO'' then ''flotaGestion'' else ''mntPlanes'' end::text'
  );

  if updated_sql = function_sql then
    raise exception 'No se encontraron los fragmentos esperados para actualizar';
  end if;

  execute updated_sql;
end;
$$;
