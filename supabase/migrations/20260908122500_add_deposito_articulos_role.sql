-- Rol de minimo privilegio para relevamiento y carga del maestro de articulos.

begin;

alter table bitacora.perfiles
  drop constraint perfiles_rol_check;

alter table bitacora.perfiles
  add constraint perfiles_rol_check
  check (rol = any (array[
    'admin'::text,
    'editor'::text,
    'consultor'::text,
    'grupo'::text,
    'encargado'::text,
    'sede'::text,
    'deposito'::text,
    'operario'::text,
    'flota'::text,
    'mnt_editor'::text
  ]));

create or replace function bitacora.articulos_puede_acceder(escritura boolean default false)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and p.activo is true
      and p.rol = any(case when escritura
        then array['admin','editor','grupo','encargado','sede','deposito']
        else array['admin','editor','grupo','encargado','sede','deposito','consultor']
      end)
      and lower(coalesce(p.email,'')) <> all(array[
        'tecnica@flykitchen.com.ar',
        'fabifranco13@gmail.com',
        'rrhh.higieneyseguridad.emp@gmail.com'
      ])
  );
$$;

revoke all on function bitacora.articulos_puede_acceder(boolean) from public, anon;
grant execute on function bitacora.articulos_puede_acceder(boolean) to authenticated;

commit;
