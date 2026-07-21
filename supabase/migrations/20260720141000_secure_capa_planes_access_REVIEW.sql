-- Acceso mínimo a cabeceras de proyectos CAPA / Gestión.
-- Aprobado explícitamente por el usuario el 2026-07-20.

begin;

drop policy if exists all_capa_planes on bitacora.capa_planes;
drop policy if exists capa_planes_select on bitacora.capa_planes;
drop policy if exists capa_planes_insert on bitacora.capa_planes;
drop policy if exists capa_planes_update on bitacora.capa_planes;

create policy capa_planes_select
on bitacora.capa_planes
for select to authenticated
using (
  exists (
    select 1 from bitacora.perfiles p
    where p.id = (select auth.uid())
      and p.activo = true
      and (
        p.rol in ('admin', 'editor', 'consultor')
        or (p.rol = 'grupo' and exists (
          select 1 from bitacora.sedes s
          where s.id = capa_planes.sede_id and s.grupo_id = p.grupo_id
        ))
        or (p.rol in ('encargado', 'sede') and capa_planes.sede_id = any(coalesce(p.sede_ids, '{}')))
      )
  )
);

create policy capa_planes_insert
on bitacora.capa_planes
for insert to authenticated
with check (
  exists (
    select 1 from bitacora.perfiles p
    where p.id = (select auth.uid())
      and p.activo = true
      and (
        p.rol in ('admin', 'editor')
        or (p.rol = 'grupo' and exists (
          select 1 from bitacora.sedes s
          where s.id = capa_planes.sede_id and s.grupo_id = p.grupo_id
        ))
        or (p.rol = 'encargado' and capa_planes.sede_id = any(coalesce(p.sede_ids, '{}')))
      )
  )
);

create policy capa_planes_update
on bitacora.capa_planes
for update to authenticated
using (
  exists (
    select 1 from bitacora.perfiles p
    where p.id = (select auth.uid())
      and p.activo = true
      and (
        p.rol in ('admin', 'editor')
        or (p.rol = 'grupo' and exists (
          select 1 from bitacora.sedes s
          where s.id = capa_planes.sede_id and s.grupo_id = p.grupo_id
        ))
        or (p.rol = 'encargado' and capa_planes.sede_id = any(coalesce(p.sede_ids, '{}')))
      )
  )
)
with check (
  exists (
    select 1 from bitacora.perfiles p
    where p.id = (select auth.uid())
      and p.activo = true
      and (
        p.rol in ('admin', 'editor')
        or (p.rol = 'grupo' and exists (
          select 1 from bitacora.sedes s
          where s.id = capa_planes.sede_id and s.grupo_id = p.grupo_id
        ))
        or (p.rol = 'encargado' and capa_planes.sede_id = any(coalesce(p.sede_ids, '{}')))
      )
  )
);

revoke all on table bitacora.capa_planes from anon;
grant select, insert, update on table bitacora.capa_planes to authenticated;

commit;
