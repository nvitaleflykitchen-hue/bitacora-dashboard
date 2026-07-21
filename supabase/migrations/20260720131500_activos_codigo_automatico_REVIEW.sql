-- Códigos internos automáticos, únicos y estables para activos.
-- REVIEW: contiene REVOKE de ejecución sobre una función SECURITY DEFINER.
-- No modifica RLS ni políticas. Requiere aprobación explícita antes de aplicar.

begin;

create sequence if not exists mantenimiento.activo_codigo_equipo_seq;
create sequence if not exists mantenimiento.activo_codigo_instalacion_seq;
create sequence if not exists mantenimiento.activo_codigo_vehiculo_seq;

-- Si ya existiera algún código del formato nuevo, la secuencia continúa desde allí.
select pg_catalog.setval(
  'mantenimiento.activo_codigo_equipo_seq'::pg_catalog.regclass,
  greatest(coalesce(max(((pg_catalog.regexp_match(codigo_interno, '^FK-EQ-([0-9]{6})$'))[1])::bigint), 0::bigint) + 1, 1::bigint),
  false
)
from mantenimiento.activos;

select pg_catalog.setval(
  'mantenimiento.activo_codigo_instalacion_seq'::pg_catalog.regclass,
  greatest(coalesce(max(((pg_catalog.regexp_match(codigo_interno, '^FK-IN-([0-9]{6})$'))[1])::bigint), 0::bigint) + 1, 1::bigint),
  false
)
from mantenimiento.activos;

select pg_catalog.setval(
  'mantenimiento.activo_codigo_vehiculo_seq'::pg_catalog.regclass,
  greatest(coalesce(max(((pg_catalog.regexp_match(codigo_interno, '^FK-VH-([0-9]{6})$'))[1])::bigint), 0::bigint) + 1, 1::bigint),
  false
)
from mantenimiento.activos;

create or replace function mantenimiento.asignar_codigo_interno_activo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefijo text;
  v_numero bigint;
begin
  -- Una vez asignado, el código no puede cambiar ni borrarse.
  if tg_op = 'UPDATE' and nullif(pg_catalog.btrim(old.codigo_interno), '') is not null then
    new.codigo_interno := old.codigo_interno;
    return new;
  end if;

  if nullif(pg_catalog.btrim(new.codigo_interno), '') is not null then
    return new;
  end if;

  case pg_catalog.upper(new.tipo)
    when 'EQUIPO' then
      v_prefijo := 'FK-EQ';
      v_numero := pg_catalog.nextval('mantenimiento.activo_codigo_equipo_seq'::pg_catalog.regclass);
    when 'INSTALACION' then
      v_prefijo := 'FK-IN';
      v_numero := pg_catalog.nextval('mantenimiento.activo_codigo_instalacion_seq'::pg_catalog.regclass);
    when 'VEHICULO' then
      v_prefijo := 'FK-VH';
      v_numero := pg_catalog.nextval('mantenimiento.activo_codigo_vehiculo_seq'::pg_catalog.regclass);
    else
      raise exception 'Tipo de activo no soportado para código automático: %', new.tipo;
  end case;

  new.codigo_interno := v_prefijo || '-' || pg_catalog.lpad(v_numero::text, 6, '0');
  return new;
end;
$$;

-- Una función RETURNS trigger solo se usa desde el trigger. Se revoca la
-- ejecución directa y SECURITY DEFINER permite usar las secuencias sin exponerlas.
revoke all on function mantenimiento.asignar_codigo_interno_activo() from public;
revoke all on function mantenimiento.asignar_codigo_interno_activo() from anon;
revoke all on function mantenimiento.asignar_codigo_interno_activo() from authenticated;

drop trigger if exists trg_asignar_codigo_interno_activo on mantenimiento.activos;
create trigger trg_asignar_codigo_interno_activo
before insert or update of codigo_interno
on mantenimiento.activos
for each row
execute function mantenimiento.asignar_codigo_interno_activo();

-- Completa únicamente los activos históricos vacíos. No altera códigos existentes.
update mantenimiento.activos
set codigo_interno = null
where nullif(pg_catalog.btrim(codigo_interno), '') is null;

comment on function mantenimiento.asignar_codigo_interno_activo() is
  'Asigna códigos FK-EQ/FK-IN/FK-VH únicos cuando codigo_interno está vacío.';

commit;
