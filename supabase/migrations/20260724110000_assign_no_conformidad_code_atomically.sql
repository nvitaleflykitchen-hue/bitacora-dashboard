-- Los códigos de NC deben ser globales. Calcularlos desde el cliente con
-- count(*) falla bajo RLS porque cada perfil territorial ve un subconjunto.
-- El trigger serializa la asignación por año y evita colisiones concurrentes.

create or replace function bitacora.assign_no_conformidad_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year text := to_char(coalesce(new.fecha_apertura, now()), 'YYYY');
  v_next_number integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'bitacora.no_conformidades:' || v_year,
      0
    )
  );

  select coalesce(
    max(
      substring(
        nc.codigo
        from '^NC-' || v_year || '-([0-9]+)$'
      )::integer
    ),
    0
  ) + 1
  into v_next_number
  from bitacora.no_conformidades nc
  where nc.codigo ~ ('^NC-' || v_year || '-[0-9]+$');

  new.codigo := pg_catalog.format(
    'NC-%s-%s',
    v_year,
    pg_catalog.lpad(v_next_number::text, 3, '0')
  );

  return new;
end;
$$;

revoke all on function bitacora.assign_no_conformidad_code() from public;

drop trigger if exists assign_no_conformidad_code
on bitacora.no_conformidades;

create trigger assign_no_conformidad_code
before insert on bitacora.no_conformidades
for each row
execute function bitacora.assign_no_conformidad_code();
