begin;

-- Un candidato conserva solicitud_id como búsqueda principal (PDF/entrevista)
-- y puede asociarse además a otras búsquedas mediante esta tabla.
create table if not exists equipo.reclutamiento_candidato_solicitudes (
  candidato_id uuid not null
    references equipo.reclutamiento_candidatos(id) on delete cascade,
  solicitud_id uuid not null
    references equipo.reclutamiento_solicitudes(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (candidato_id, solicitud_id)
);

create index if not exists idx_reclutamiento_candidato_solicitudes_solicitud
  on equipo.reclutamiento_candidato_solicitudes (solicitud_id, candidato_id);

comment on table equipo.reclutamiento_candidato_solicitudes is
  'Vinculaciones adicionales entre candidatos y búsquedas. solicitud_id en candidatos sigue siendo la búsqueda principal.';

-- Preserva las relaciones actuales sin duplicar candidatos.
insert into equipo.reclutamiento_candidato_solicitudes (
  candidato_id,
  solicitud_id
)
select id, solicitud_id
from equipo.reclutamiento_candidatos
where solicitud_id is not null
on conflict (candidato_id, solicitud_id) do nothing;

alter table equipo.reclutamiento_candidato_solicitudes enable row level security;

grant select, insert, delete
on equipo.reclutamiento_candidato_solicitudes
to authenticated;

drop policy if exists "reclutamiento_candidato_solicitudes_staff_select"
  on equipo.reclutamiento_candidato_solicitudes;

create policy "reclutamiento_candidato_solicitudes_staff_select"
on equipo.reclutamiento_candidato_solicitudes
for select
to authenticated
using (
  exists (
    select 1
    from bitacora.perfiles p
    join equipo.reclutamiento_solicitudes rs
      on rs.id = reclutamiento_candidato_solicitudes.solicitud_id
    join bitacora.sedes s
      on s.id = rs.sede_id
    where p.id = (select auth.uid())
      and (
        p.rol in ('admin', 'editor')
        or (p.rol = 'grupo' and s.grupo_id = p.grupo_id)
        or (
          p.rol in ('encargado', 'sede')
          and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[]))
        )
      )
  )
);

-- La asociación múltiple es una operación de RRHH transversal.
-- Los responsables territoriales pueden verla, pero solo admin/editor modificarla.
drop policy if exists "reclutamiento_candidato_solicitudes_admin_insert"
  on equipo.reclutamiento_candidato_solicitudes;

create policy "reclutamiento_candidato_solicitudes_admin_insert"
on equipo.reclutamiento_candidato_solicitudes
for insert
to authenticated
with check (
  exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and p.rol in ('admin', 'editor')
  )
);

drop policy if exists "reclutamiento_candidato_solicitudes_admin_delete"
  on equipo.reclutamiento_candidato_solicitudes;

create policy "reclutamiento_candidato_solicitudes_admin_delete"
on equipo.reclutamiento_candidato_solicitudes
for delete
to authenticated
using (
  exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and p.rol in ('admin', 'editor')
  )
);

-- Un responsable territorial también puede ver/gestionar un candidato cuando
-- la búsqueda de su alcance es secundaria y no solamente la principal.
drop policy if exists "reclutamiento_candidatos_staff_select"
  on equipo.reclutamiento_candidatos;

create policy "reclutamiento_candidatos_staff_select"
on equipo.reclutamiento_candidatos
for select
to authenticated
using (
  exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and (
        p.rol in ('admin', 'editor')
        or exists (
          select 1
          from equipo.reclutamiento_solicitudes rs
          join bitacora.sedes s on s.id = rs.sede_id
          where rs.id = reclutamiento_candidatos.solicitud_id
            and (
              (p.rol = 'grupo' and s.grupo_id = p.grupo_id)
              or (
                p.rol in ('encargado', 'sede')
                and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[]))
              )
            )
        )
        or exists (
          select 1
          from equipo.reclutamiento_candidato_solicitudes rcs
          join equipo.reclutamiento_solicitudes rs on rs.id = rcs.solicitud_id
          join bitacora.sedes s on s.id = rs.sede_id
          where rcs.candidato_id = reclutamiento_candidatos.id
            and (
              (p.rol = 'grupo' and s.grupo_id = p.grupo_id)
              or (
                p.rol in ('encargado', 'sede')
                and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[]))
              )
            )
        )
      )
  )
);

drop policy if exists "reclutamiento_candidatos_staff_write"
  on equipo.reclutamiento_candidatos;

create policy "reclutamiento_candidatos_staff_write"
on equipo.reclutamiento_candidatos
for all
to authenticated
using (
  exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and (
        p.rol in ('admin', 'editor')
        or exists (
          select 1
          from equipo.reclutamiento_solicitudes rs
          join bitacora.sedes s on s.id = rs.sede_id
          where rs.id = reclutamiento_candidatos.solicitud_id
            and (
              (p.rol = 'grupo' and s.grupo_id = p.grupo_id)
              or (
                p.rol in ('encargado', 'sede')
                and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[]))
              )
            )
        )
        or exists (
          select 1
          from equipo.reclutamiento_candidato_solicitudes rcs
          join equipo.reclutamiento_solicitudes rs on rs.id = rcs.solicitud_id
          join bitacora.sedes s on s.id = rs.sede_id
          where rcs.candidato_id = reclutamiento_candidatos.id
            and (
              (p.rol = 'grupo' and s.grupo_id = p.grupo_id)
              or (
                p.rol in ('encargado', 'sede')
                and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[]))
              )
            )
        )
      )
  )
)
with check (
  exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and (
        p.rol in ('admin', 'editor')
        or exists (
          select 1
          from equipo.reclutamiento_solicitudes rs
          join bitacora.sedes s on s.id = rs.sede_id
          where rs.id = reclutamiento_candidatos.solicitud_id
            and (
              (p.rol = 'grupo' and s.grupo_id = p.grupo_id)
              or (
                p.rol in ('encargado', 'sede')
                and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[]))
              )
            )
        )
        or exists (
          select 1
          from equipo.reclutamiento_candidato_solicitudes rcs
          join equipo.reclutamiento_solicitudes rs on rs.id = rcs.solicitud_id
          join bitacora.sedes s on s.id = rs.sede_id
          where rcs.candidato_id = reclutamiento_candidatos.id
            and (
              (p.rol = 'grupo' and s.grupo_id = p.grupo_id)
              or (
                p.rol in ('encargado', 'sede')
                and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[]))
              )
            )
        )
      )
  )
);

drop policy if exists "reclutamiento_entrevistas_staff_select"
  on equipo.reclutamiento_entrevistas;

create policy "reclutamiento_entrevistas_staff_select"
on equipo.reclutamiento_entrevistas
for select
to authenticated
using (
  exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and (
        p.rol in ('admin', 'editor')
        or exists (
          select 1
          from equipo.reclutamiento_candidatos rc
          join equipo.reclutamiento_solicitudes rs on rs.id = rc.solicitud_id
          join bitacora.sedes s on s.id = rs.sede_id
          where rc.id = reclutamiento_entrevistas.candidato_id
            and (
              (p.rol = 'grupo' and s.grupo_id = p.grupo_id)
              or (
                p.rol in ('encargado', 'sede')
                and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[]))
              )
            )
        )
        or exists (
          select 1
          from equipo.reclutamiento_candidato_solicitudes rcs
          join equipo.reclutamiento_solicitudes rs on rs.id = rcs.solicitud_id
          join bitacora.sedes s on s.id = rs.sede_id
          where rcs.candidato_id = reclutamiento_entrevistas.candidato_id
            and (
              (p.rol = 'grupo' and s.grupo_id = p.grupo_id)
              or (
                p.rol in ('encargado', 'sede')
                and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[]))
              )
            )
        )
      )
  )
);

drop policy if exists "reclutamiento_entrevistas_staff_write"
  on equipo.reclutamiento_entrevistas;

create policy "reclutamiento_entrevistas_staff_write"
on equipo.reclutamiento_entrevistas
for all
to authenticated
using (
  exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and (
        p.rol in ('admin', 'editor')
        or exists (
          select 1
          from equipo.reclutamiento_candidatos rc
          join equipo.reclutamiento_solicitudes rs on rs.id = rc.solicitud_id
          join bitacora.sedes s on s.id = rs.sede_id
          where rc.id = reclutamiento_entrevistas.candidato_id
            and (
              (p.rol = 'grupo' and s.grupo_id = p.grupo_id)
              or (
                p.rol in ('encargado', 'sede')
                and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[]))
              )
            )
        )
        or exists (
          select 1
          from equipo.reclutamiento_candidato_solicitudes rcs
          join equipo.reclutamiento_solicitudes rs on rs.id = rcs.solicitud_id
          join bitacora.sedes s on s.id = rs.sede_id
          where rcs.candidato_id = reclutamiento_entrevistas.candidato_id
            and (
              (p.rol = 'grupo' and s.grupo_id = p.grupo_id)
              or (
                p.rol in ('encargado', 'sede')
                and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[]))
              )
            )
        )
      )
  )
)
with check (
  exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and (
        p.rol in ('admin', 'editor')
        or exists (
          select 1
          from equipo.reclutamiento_candidatos rc
          join equipo.reclutamiento_solicitudes rs on rs.id = rc.solicitud_id
          join bitacora.sedes s on s.id = rs.sede_id
          where rc.id = reclutamiento_entrevistas.candidato_id
            and (
              (p.rol = 'grupo' and s.grupo_id = p.grupo_id)
              or (
                p.rol in ('encargado', 'sede')
                and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[]))
              )
            )
        )
        or exists (
          select 1
          from equipo.reclutamiento_candidato_solicitudes rcs
          join equipo.reclutamiento_solicitudes rs on rs.id = rcs.solicitud_id
          join bitacora.sedes s on s.id = rs.sede_id
          where rcs.candidato_id = reclutamiento_entrevistas.candidato_id
            and (
              (p.rol = 'grupo' and s.grupo_id = p.grupo_id)
              or (
                p.rol in ('encargado', 'sede')
                and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[]))
              )
            )
        )
      )
  )
);

commit;
