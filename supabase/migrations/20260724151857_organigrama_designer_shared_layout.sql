-- Persistencia compartida y versionada para el Diseñador de Organigramas.

create table if not exists bitacora.organigramas (
  id uuid primary key default gen_random_uuid(),
  grupo_clave text not null unique,
  nombre text not null,
  borrador jsonb,
  publicado jsonb,
  version_publicada integer not null default 0 check (version_publicada >= 0),
  actualizado_por uuid references auth.users(id) on delete set null,
  publicado_por uuid references auth.users(id) on delete set null,
  actualizado_en timestamptz not null default now(),
  publicado_en timestamptz
);

comment on table bitacora.organigramas is
  'Diseños de organigrama por grupo. Las fichas de personas permanecen en sus tablas de origen.';

alter table bitacora.organigramas enable row level security;

revoke all on table bitacora.organigramas from anon;
revoke all on table bitacora.organigramas from authenticated;
grant select, insert, update on table bitacora.organigramas to authenticated;

create policy organigramas_authenticated_select
on bitacora.organigramas
for select
to authenticated
using ((select auth.uid()) is not null);

create policy organigramas_admin_insert
on bitacora.organigramas
for insert
to authenticated
with check (
  exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and p.rol = 'admin'
      and p.activo = true
  )
  and actualizado_por = (select auth.uid())
);

create policy organigramas_admin_update
on bitacora.organigramas
for update
to authenticated
using (
  exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and p.rol = 'admin'
      and p.activo = true
  )
)
with check (
  exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and p.rol = 'admin'
      and p.activo = true
  )
  and actualizado_por = (select auth.uid())
);

create index if not exists organigramas_actualizado_por_idx
  on bitacora.organigramas (actualizado_por);

create index if not exists organigramas_publicado_por_idx
  on bitacora.organigramas (publicado_por);
