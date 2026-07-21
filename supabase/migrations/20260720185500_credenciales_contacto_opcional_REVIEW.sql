alter table equipo.credenciales_personal
  add column if not exists compartir_telefono boolean not null default false,
  add column if not exists compartir_email boolean not null default false;

drop function if exists public.verificar_credencial(uuid);
create function public.verificar_credencial(p_token uuid)
returns table (estado text, nombre text, puesto text, empresa text, fecha_vencimiento date, telefono text, email text)
language sql security definer stable set search_path = ''
as $$
  select
    case when c.estado = 'activa' and c.fecha_vencimiento < current_date then 'vencida' else c.estado end,
    trim(concat_ws(' ', p.nombre, p.apellido)),
    coalesce(c.puesto_impreso, p.puesto, 'Sin puesto informado'),
    'Fly Kitchen S.A.'::text,
    c.fecha_vencimiento,
    case when c.compartir_telefono then p.telefono else null end,
    case when c.compartir_email then p.email else null end
  from equipo.credenciales_personal c
  join equipo.personas p on p.id = c.persona_id
  where c.token = p_token
  limit 1;
$$;

revoke all on function public.verificar_credencial(uuid) from public;
grant execute on function public.verificar_credencial(uuid) to anon, authenticated;
