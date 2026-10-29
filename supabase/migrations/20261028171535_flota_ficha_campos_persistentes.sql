-- Proyecto autorizado: mixyhfdlzjarvszinytk. Sólo ampliación aditiva.
-- No modifica registros, GRANT, RLS, políticas, propietario ni opciones de la vista.
begin;
create temporary table flota_view_before on commit drop as
select relacl::text as acl, reloptions, relowner from pg_class where oid='public.mnt_activos'::regclass;
alter table mantenimiento.activos
  add column if not exists dominio text,
  add column if not exists anio integer,
  add column if not exists combustible text,
  add column if not exists km_lectura_fecha date;
-- Misma selección original, columnas nuevas al final. Conserva ACL y opciones.
create or replace view public.mnt_activos as select a.* from mantenimiento.activos a;
do $$
begin
  if exists(select 1 from pg_class c cross join flota_view_before b
    where c.oid='public.mnt_activos'::regclass and
    (c.relacl::text is distinct from b.acl or c.reloptions is distinct from b.reloptions or c.relowner is distinct from b.relowner))
  then raise exception 'La migración no debe cambiar permisos ni opciones de la vista'; end if;
end $$;
notify pgrst, 'reload schema';
commit;
