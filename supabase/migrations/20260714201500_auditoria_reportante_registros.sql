-- Recupera la identidad declarada en el reporte cuando una integracion externa
-- crea el registro sin una sesion Supabase y, por lo tanto, auth.uid() es null.
create or replace view public.v_auditoria as
select
  a.id,
  a.tabla,
  a.registro_id,
  a.accion,
  a.descripcion,
  a.campo,
  a.valor_antes,
  a.valor_nuevo,
  a.cambios_json,
  a.usuario_id,
  coalesce(a.usuario_email, r.email_reportante) as usuario_email,
  coalesce(a.usuario_nombre, r.reportante) as usuario_nombre,
  a.sede_id,
  a.sede_nombre,
  a.ip_address,
  a.created_at,
  case
    when a.usuario_id is null
      and (r.reportante is not null or r.email_reportante is not null)
    then 'reportante_formulario'
    when a.usuario_id is not null then 'sesion_autenticada'
    else 'sistema'
  end as usuario_origen
from bitacora.auditoria a
left join bitacora.registros r
  on a.tabla in ('registros', 'bitacora.registros')
  and a.registro_id ~ '^[0-9]+$'
  and r.id = a.registro_id::integer;

grant select on public.v_auditoria to authenticated;
