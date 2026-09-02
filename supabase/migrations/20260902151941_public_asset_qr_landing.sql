create or replace function public.consultar_activo_qr(p_activo_id uuid)
returns table (
  id uuid,
  codigo_interno text,
  nombre text,
  tipo text,
  categoria text,
  marca text,
  modelo text
)
language sql
stable
security definer
set search_path = pg_catalog, mantenimiento
as $$
  select
    a.id,
    a.codigo_interno,
    a.nombre,
    a.tipo,
    a.categoria,
    a.marca,
    a.modelo
  from mantenimiento.activos a
  where a.id = p_activo_id
    and coalesce(a.estado, '') <> 'baja'
  limit 1;
$$;

comment on function public.consultar_activo_qr(uuid) is
  'Consulta pública mínima para etiquetas QR de activos. No expone sede, responsables, serie, documentos, tickets ni historial.';

revoke all on function public.consultar_activo_qr(uuid) from public;
revoke all on function public.consultar_activo_qr(uuid) from anon, authenticated;
grant execute on function public.consultar_activo_qr(uuid) to anon, authenticated;
