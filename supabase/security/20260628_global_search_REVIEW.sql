-- APLICADA 2026-06-28 con aprobacion explicita del usuario.
-- Migration registrada: global_search_20260628.
-- Proyecto permitido: mixyhfdlzjarvszinytk (cerdova-db).
-- Proyecto prohibido: hmyzuuujyurvyuusvyzp.
--
-- Objetivo:
-- Exponer una busqueda global autenticada que aplique alcance por rol y sede
-- dentro de Postgres, sin confiar en filtros del frontend.
--
-- Alcance:
-- - admin/editor/consultor: todas las sedes.
-- - grupo: sedes activas de su grupo.
-- - encargado/sede: solo sede_ids asignadas.
-- - flota: solo vehiculos, tickets, planes y documentos de flota.
-- - operario: sin resultados de busqueda global.

begin;

create schema if not exists bitacora_private;
revoke all on schema bitacora_private from public, anon;
grant usage on schema bitacora_private to authenticated;

create or replace function bitacora_private.buscar_global_core(
  p_query text,
  p_limit integer default 30
)
returns table (
  tipo text,
  id text,
  titulo text,
  subtitulo text,
  estado text,
  vista text,
  sede_id bigint,
  relevancia integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, bitacora, mantenimiento, equipo, bitacora_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_rol text;
  v_sede_ids integer[];
  v_grupo_id integer;
  v_all_sedes boolean := false;
begin
  if v_user_id is null or length(v_query) < 2 or length(v_query) > 100 then
    return;
  end if;

  select p.rol, coalesce(p.sede_ids, '{}'::integer[]), p.grupo_id
    into v_rol, v_sede_ids, v_grupo_id
  from bitacora.perfiles p
  where p.id = v_user_id
    and p.activo = true;

  if not found
     or v_rol not in ('admin','editor','consultor','encargado','grupo','sede','operario','flota')
     or v_rol = 'operario' then
    return;
  end if;

  v_all_sedes := v_rol in ('admin','editor','consultor');

  if v_rol = 'grupo' then
    select coalesce(array_agg(s.id order by s.id), '{}'::integer[])
      into v_sede_ids
    from bitacora.sedes s
    where s.grupo_id = v_grupo_id
      and s.activa = true;
  end if;

  if v_rol in ('grupo','encargado','sede') and cardinality(v_sede_ids) = 0 then
    return;
  end if;

  return query
  select r.tipo, r.id, r.titulo, r.subtitulo, r.estado, r.vista, r.sede_id, r.relevancia
  from (
    -- Sedes
    select
      'sede'::text as tipo,
      s.id::text as id,
      s.nombre::text as titulo,
      concat_ws(' · ', s.tipo, s.responsable, s.direccion)::text as subtitulo,
      case when s.activa then 'Activa' else 'Inactiva' end::text as estado,
      'sedesHub'::text as vista,
      s.id::bigint as sede_id,
      case
        when lower(s.nombre) = v_query then 0
        when lower(s.nombre) like v_query || '%' then 1
        else 2
      end::integer as relevancia
    from bitacora.sedes s
    where v_rol <> 'flota'
      and (v_all_sedes or s.id = any(v_sede_ids))
      and strpos(lower(concat_ws(' ', s.nombre, s.tipo, s.responsable, s.direccion)), v_query) > 0

    union all

    -- Reportes de bitacora. Los detalles marcados como privados solo participan
    -- de la busqueda para los mismos roles que los ven en MobileReporte.
    select
      'registro'::text,
      reg.id::text,
      ('Reporte #' || reg.id || ' · ' || coalesce(reg.sede_nombre, 'Sin sede'))::text,
      concat_ws(' · ', reg.turno, reg.reportante, to_char(reg.fecha_reporte, 'DD/MM/YYYY HH24:MI'))::text,
      reg.estado_general::text,
      'sede'::text,
      reg.sede_id::bigint,
      2::integer
    from bitacora.registros reg
    where v_rol <> 'flota'
      and (v_all_sedes or reg.sede_id = any(v_sede_ids))
      and strpos(lower(concat_ws(
        ' ',
        reg.id::text,
        reg.sede_nombre,
        reg.turno,
        reg.reportante,
        reg.estado_general,
        reg.motivo_escalamiento,
        case when v_rol in ('admin','editor','encargado') then concat_ws(
          ' ', reg.detalle_a, reg.detalle_b, reg.detalle_c, reg.detalle_d,
          reg.detalle_e, reg.detalle_f, reg.detalle_g, reg.detalle_h
        ) else null end
      )), v_query) > 0

    union all

    -- Tareas
    select
      'tarea'::text,
      t.id::text,
      t.titulo::text,
      concat_ws(' · ', s.nombre, t.responsable, t.prioridad)::text,
      t.estado::text,
      'tareas'::text,
      t.sede_id::bigint,
      case
        when lower(t.titulo) = v_query then 0
        when lower(t.titulo) like v_query || '%' then 1
        else 2
      end::integer
    from bitacora.tareas t
    left join bitacora.sedes s on s.id = t.sede_id
    where v_rol <> 'flota'
      and (v_all_sedes or t.sede_id = any(v_sede_ids))
      and strpos(lower(concat_ws(' ', t.titulo, t.descripcion, t.responsable, t.categoria, t.intervinientes::text, s.nombre)), v_query) > 0

    union all

    -- Escalamientos
    select
      'escalamiento'::text,
      e.id::text,
      left(e.descripcion, 140)::text,
      concat_ws(' · ', e.sede_nombre, e.tipo, e.destino, e.reportante)::text,
      e.estado::text,
      'escalamientos'::text,
      e.sede_id::bigint,
      2::integer
    from bitacora.escalamientos e
    where v_rol <> 'flota'
      and (v_all_sedes or e.sede_id = any(v_sede_ids))
      and strpos(lower(concat_ws(' ', e.id::text, e.descripcion, e.sede_nombre, e.tipo, e.destino, e.reportante)), v_query) > 0

    union all

    -- Compras. Reutiliza la autorizacion real del workflow.
    select
      'requerimiento'::text,
      req.id::text,
      ('REQ #' || coalesce(req.numero, req.id) || ' · ' || left(req.descripcion, 120))::text,
      concat_ws(' · ', req.sede_nombre, req.solicitante, req.urgencia)::text,
      req.estado::text,
      'requerimientos'::text,
      req.sede_id::bigint,
      case when req.numero::text = v_query or req.id::text = v_query then 0 else 2 end::integer
    from bitacora.requerimientos req
    where v_rol <> 'flota'
      and bitacora_private.can_read_requerimiento(
        req.sede_id,
        req.solicitante_id,
        req.comprador_id,
        req.supervisor_compras_id,
        req.facturacion_responsable_id
      )
      and strpos(lower(concat_ws(
        ' ', req.id::text, req.numero::text, req.descripcion, req.justificacion,
        req.sede_nombre, req.solicitante, req.proveedor_sugerido,
        req.proveedor_seleccionado, req.orden_compra_numero
      )), v_query) > 0

    union all

    -- Tickets de mantenimiento y flota
    select
      'ticket'::text,
      tk.id::text,
      ('#' || tk.numero || ' ' || left(tk.descripcion, 130))::text,
      concat_ws(' · ', tk.sede, tk.activo_nombre, tk.responsable, tk.prioridad)::text,
      tk.estado::text,
      case when v_rol = 'flota' or upper(coalesce(a.tipo, '')) = 'VEHICULO' or lower(coalesce(tk.categoria, '')) like '%vehic%' then 'flotaGestion' else 'mntTickets' end::text,
      tk.sede_id::bigint,
      case when tk.numero::text = v_query then 0 else 2 end::integer
    from mantenimiento.tickets tk
    left join mantenimiento.activos a on a.id = tk.activo_id
    where (
        (v_rol = 'flota' and (
          upper(coalesce(a.tipo, '')) = 'VEHICULO'
          or lower(coalesce(tk.categoria, '')) like '%flota%'
          or lower(coalesce(tk.tipo, '')) like '%vehic%'
        ))
        or (
          v_rol <> 'flota'
          and (v_all_sedes or tk.sede_id = any(v_sede_ids))
        )
      )
      and strpos(lower(concat_ws(
        ' ', tk.numero::text, tk.descripcion, tk.diagnostico, tk.activo_nombre,
        tk.sede, tk.responsable, tk.oc_numero
      )), v_query) > 0

    union all

    -- Activos; flota solo ve vehiculos.
    select
      'activo'::text,
      a.id::text,
      a.nombre::text,
      concat_ws(' · ', a.codigo_interno, a.tipo, a.marca, a.modelo, a.sede)::text,
      a.estado::text,
      case when v_rol = 'flota' or upper(coalesce(a.tipo, '')) = 'VEHICULO' then 'flotaGestion' else 'mntActivos' end::text,
      a.sede_id::bigint,
      case
        when lower(a.nombre) = v_query or lower(coalesce(a.codigo_interno, '')) = v_query then 0
        when lower(a.nombre) like v_query || '%' then 1
        else 2
      end::integer
    from mantenimiento.activos a
    where (
        (v_rol = 'flota' and upper(coalesce(a.tipo, '')) = 'VEHICULO')
        or (
          v_rol <> 'flota'
          and (v_all_sedes or a.sede_id = any(v_sede_ids))
        )
      )
      and strpos(lower(concat_ws(
        ' ', a.nombre, a.codigo_interno, a.tipo, a.marca, a.modelo,
        a.numero_serie, a.sede, a.responsable
      )), v_query) > 0

    union all

    -- Planes preventivos
    select
      'plan'::text,
      pp.id::text,
      pp.nombre::text,
      concat_ws(' · ', a.nombre, a.sede, pp.frecuencia, pp.responsable)::text,
      pp.estado::text,
      case when v_rol = 'flota' or upper(coalesce(a.tipo, '')) = 'VEHICULO' then 'flotaGestion' else 'mntPlanes' end::text,
      pp.sede_id::bigint,
      case when lower(pp.nombre) = v_query then 0 else 2 end::integer
    from mantenimiento.planes_preventivos pp
    left join mantenimiento.activos a on a.id = pp.activo_id
    where (
        (v_rol = 'flota' and upper(coalesce(a.tipo, '')) = 'VEHICULO')
        or (
          v_rol in ('admin','editor','consultor','grupo','encargado')
          and (v_all_sedes or pp.sede_id = any(v_sede_ids))
        )
      )
      and strpos(lower(concat_ws(' ', pp.nombre, pp.descripcion, a.nombre, a.codigo_interno, pp.responsable)), v_query) > 0

    union all

    -- Documentos de flota
    select
      'documento_flota'::text,
      df.id::text,
      df.titulo::text,
      concat_ws(' · ', df.tipo, df.activo_patente, df.version)::text,
      df.estado::text,
      'flotaGestion'::text,
      a.sede_id::bigint,
      case when lower(df.titulo) = v_query then 0 else 2 end::integer
    from mantenimiento.documentos_flota df
    left join mantenimiento.activos a on a.id = df.activo_id
    where v_rol in ('admin','editor','consultor','grupo','encargado','flota')
      and upper(coalesce(a.tipo, 'VEHICULO')) = 'VEHICULO'
      and (
        v_rol = 'flota'
        or v_all_sedes
        or a.sede_id = any(v_sede_ids)
      )
      and strpos(lower(concat_ws(' ', df.titulo, df.tipo, df.activo_patente, df.version, df.notas)), v_query) > 0

    union all

    -- Insumos
    select
      'insumo'::text,
      i.id::text,
      i.nombre::text,
      concat_ws(' · ', i.categoria, i.unidad, s.nombre)::text,
      case when i.stock_actual <= i.stock_minimo then 'Stock bajo' else 'Disponible' end::text,
      'mntInsumos'::text,
      i.sede_id::bigint,
      case
        when lower(i.nombre) = v_query then 0
        when lower(i.nombre) like v_query || '%' then 1
        else 2
      end::integer
    from mantenimiento.insumos i
    left join bitacora.sedes s on s.id = i.sede_id
    where v_rol in ('admin','editor','consultor','grupo','encargado')
      and (v_all_sedes or i.sede_id = any(v_sede_ids))
      and strpos(lower(concat_ws(' ', i.nombre, i.descripcion, i.categoria, s.nombre)), v_query) > 0

    union all

    -- Proveedores generales o vinculados al alcance territorial.
    select
      'proveedor'::text,
      pr.id::text,
      pr.nombre::text,
      concat_ws(' · ', pr.categoria, pr.contacto, pr.telefono)::text,
      pr.estado::text,
      'mntProveedores'::text,
      null::bigint,
      case
        when lower(pr.nombre) = v_query then 0
        when lower(pr.nombre) like v_query || '%' then 1
        else 2
      end::integer
    from mantenimiento.proveedores pr
    where v_rol in ('admin','editor','consultor','grupo','encargado')
      and (
        v_all_sedes
        or cardinality(coalesce(pr.sede_ids, '{}'::integer[])) = 0
        or pr.sede_ids && v_sede_ids
      )
      and strpos(lower(concat_ws(' ', pr.nombre, pr.categoria, pr.contacto, pr.email, pr.telefono)), v_query) > 0

    union all

    -- Matafuegos
    select
      'matafuego'::text,
      m.id::text,
      concat_ws(' · ', m.codigo, m.ubicacion)::text,
      concat_ws(' · ', m.tipo, m.sede, m.activo_patente)::text,
      m.estado::text,
      'mntMatafuegos'::text,
      m.sede_id::bigint,
      2::integer
    from mantenimiento.matafuegos m
    where v_rol in ('admin','editor','consultor','grupo','encargado')
      and (v_all_sedes or m.sede_id = any(v_sede_ids))
      and strpos(lower(concat_ws(' ', m.codigo, m.tipo, m.sede, m.ubicacion, m.activo_patente)), v_query) > 0

    union all

    -- No conformidades
    select
      'no_conformidad'::text,
      nc.id::text,
      concat_ws(' · ', nc.codigo, left(nc.descripcion, 120))::text,
      concat_ws(' · ', nc.sede_nombre, nc.categoria, nc.responsable)::text,
      nc.estado::text,
      'noConformidades'::text,
      nc.sede_id::bigint,
      case when lower(coalesce(nc.codigo, '')) = v_query then 0 else 2 end::integer
    from bitacora.no_conformidades nc
    where v_rol in ('admin','editor','consultor','grupo','encargado')
      and (v_all_sedes or nc.sede_id = any(v_sede_ids))
      and strpos(lower(concat_ws(
        ' ', nc.codigo, nc.descripcion, nc.categoria, nc.causa_raiz,
        nc.sede_nombre, nc.responsable
      )), v_query) > 0

    union all

    -- Acciones CAPA. Las acciones corporativas sin sede solo son globales.
    select
      'capa'::text,
      c.id::text,
      concat_ws(' · ', c.codigo, left(c.descripcion, 120))::text,
      concat_ws(' · ', c.sede_nombre, c.tipo, c.responsable)::text,
      c.estado::text,
      'capa'::text,
      c.sede_id::bigint,
      case when lower(coalesce(c.codigo, '')) = v_query then 0 else 2 end::integer
    from bitacora.capa c
    where v_rol in ('admin','editor','consultor','grupo','encargado')
      and (
        (v_all_sedes and c.sede_id is null)
        or v_all_sedes
        or c.sede_id = any(v_sede_ids)
      )
      and strpos(lower(concat_ws(
        ' ', c.codigo, c.descripcion, c.tipo, c.sede_nombre,
        c.responsable, c.auditoria_codigo, c.notas
      )), v_query) > 0

    union all

    -- Personal/RRHH. DNI no se devuelve ni se usa como texto visible.
    select
      'persona'::text,
      ep.id::text,
      btrim(concat_ws(' ', ep.nombre, ep.apellido))::text,
      concat_ws(' · ', ep.puesto, ep.area, ep.email)::text,
      case when ep.activo then 'Activo' else 'Inactivo' end::text,
      'equipo'::text,
      case when cardinality(coalesce(ep.sede_ids, '{}'::integer[])) = 1 then ep.sede_ids[1]::bigint else null::bigint end,
      case
        when lower(btrim(concat_ws(' ', ep.nombre, ep.apellido))) = v_query then 0
        when lower(btrim(concat_ws(' ', ep.nombre, ep.apellido))) like v_query || '%' then 1
        else 2
      end::integer
    from equipo.personas ep
    where v_rol in ('admin','editor','consultor','grupo','encargado')
      and (v_all_sedes or ep.sede_ids && v_sede_ids)
      and strpos(lower(concat_ws(' ', ep.nombre, ep.apellido, ep.puesto, ep.area, ep.email)), v_query) > 0

    union all

    -- Responsables tecnicos globales
    select
      'responsable'::text,
      mr.id::text,
      mr.nombre::text,
      concat_ws(' · ', mr.rol, mr.area, mr.email, mr.telefono)::text,
      case when mr.activo then 'Activo' else 'Inactivo' end::text,
      'mntResponsables'::text,
      null::bigint,
      case
        when lower(mr.nombre) = v_query then 0
        when lower(mr.nombre) like v_query || '%' then 1
        else 2
      end::integer
    from mantenimiento.responsables mr
    where v_rol in ('admin','editor','consultor','grupo','encargado')
      and strpos(lower(concat_ws(' ', mr.nombre, mr.rol, mr.area, mr.email, mr.telefono)), v_query) > 0

    union all

    -- Vuelos calendarizados
    select
      'vuelo'::text,
      vc.id::text,
      vc.vuelo_codigo::text,
      concat_ws(' · ', s.nombre, vc.destino, vc.aerolinea, to_char(vc.fecha, 'DD/MM/YYYY'))::text,
      case when vc.activo then 'Activo' else 'Inactivo' end::text,
      'sede'::text,
      vc.sede_id::bigint,
      case when lower(vc.vuelo_codigo) = v_query then 0 else 2 end::integer
    from bitacora.vuelos_calendario vc
    join bitacora.sedes s on s.id = vc.sede_id
    where v_rol <> 'flota'
      and (v_all_sedes or vc.sede_id = any(v_sede_ids))
      and strpos(lower(concat_ws(' ', vc.vuelo_codigo, vc.destino, vc.aerolinea, s.nombre)), v_query) > 0
  ) r
  order by r.relevancia, r.titulo
  limit v_limit;
end;
$$;

revoke all on function bitacora_private.buscar_global_core(text, integer) from public, anon;
grant execute on function bitacora_private.buscar_global_core(text, integer) to authenticated;

-- Wrapper expuesto a PostgREST. No eleva privilegios: toda la lectura privilegiada
-- y la autorizacion viven en la funcion privada anterior.
create or replace function public.buscar_global(
  p_query text,
  p_limit integer default 30
)
returns table (
  tipo text,
  id text,
  titulo text,
  subtitulo text,
  estado text,
  vista text,
  sede_id bigint,
  relevancia integer
)
language sql
stable
security invoker
set search_path = pg_catalog, bitacora_private
as $$
  select *
  from bitacora_private.buscar_global_core(p_query, p_limit);
$$;

revoke all on function public.buscar_global(text, integer) from public, anon;
grant execute on function public.buscar_global(text, integer) to authenticated;

commit;

-- Verificaciones posteriores a la aplicacion (no ejecutar antes):
-- 1. Sin JWT / rol anon: public.buscar_global debe responder permission denied.
-- 2. Perfil operario: debe devolver 0 filas.
-- 3. Perfil sede/encargado: ningun sede_id fuera de perfil.sede_ids.
-- 4. Perfil grupo: ningun sede_id fuera de las sedes activas de perfil.grupo_id.
-- 5. Perfil flota: solo tipos ticket/activo/plan/documento_flota y solo vehiculos.
-- 6. Perfil admin/editor/consultor: resultados globales segun modulos habilitados.
