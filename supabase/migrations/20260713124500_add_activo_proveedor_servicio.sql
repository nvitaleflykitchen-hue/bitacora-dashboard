alter table mantenimiento.activos
  add column if not exists proveedor_servicio_id uuid references mantenimiento.proveedores(id) on delete set null;

comment on column mantenimiento.activos.proveedor_servicio_id is 'Proveedor de servicio tecnico asignado al activo para contacto directo y trazabilidad de mantenimiento.';

create or replace view public.mnt_activos as
select
  id,
  codigo_interno,
  tipo,
  nombre,
  marca,
  modelo,
  numero_serie,
  categoria,
  sede,
  responsable,
  estado,
  estado_notas,
  estado_cambiado_at,
  km_actual,
  qr_code,
  manual_url,
  foto_url,
  fecha_compra,
  proveedor_compra,
  vencimiento_seguro,
  vencimiento_vtv,
  numero_poliza,
  vencimiento_senasa,
  vencimiento_rmtsa,
  proxima_consulta_tecnico,
  notas_tecnico,
  created_at,
  updated_at,
  sede_id,
  sede_nombre,
  notas,
  proveedor_servicio_id
from mantenimiento.activos;
