-- APLICADA manualmente con confirmación de Nicolás el 2026-07-20.
-- Proyecto autorizado: mixyhfdlzjarvszinytk (cerdova-db).
-- Flujo: encargado/admin solicita -> admin aprueba/rechaza -> admin notifica.
-- Las medidas preventivas urgentes se registran, pero no constituyen una sanción.

create table if not exists equipo.solicitudes_disciplinarias (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references equipo.personas(id) on delete restrict,
  tipo text not null default 'apercibimiento'
    check (tipo in ('apercibimiento')),
  fecha_hecho date not null default current_date,
  hechos text not null check (length(btrim(hechos)) >= 10),
  descargo_trabajador text,
  testigos_evidencia text,
  fundamento_legal text,
  texto_propuesto text,
  urgente boolean not null default false,
  medida_preventiva text,
  estado text not null default 'pendiente_aprobacion'
    check (estado in ('pendiente_aprobacion', 'aprobado', 'rechazado', 'notificado', 'cancelado')),
  creado_por uuid not null default auth.uid() references auth.users(id),
  revisado_por uuid references auth.users(id),
  revisado_at timestamptz,
  revision_observaciones text,
  historial_id uuid unique references equipo.historial_personal(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint solicitudes_disciplinarias_urgencia_check check (
    not urgente or length(btrim(coalesce(medida_preventiva, ''))) >= 10
  ),
  constraint solicitudes_disciplinarias_revision_check check (
    (estado = 'pendiente_aprobacion' and revisado_por is null and revisado_at is null)
    or
    (estado in ('aprobado', 'rechazado', 'notificado', 'cancelado') and revisado_por is not null and revisado_at is not null)
  ),
  constraint solicitudes_disciplinarias_notificacion_check check (
    (estado = 'notificado' and historial_id is not null)
    or
    (estado <> 'notificado' and historial_id is null)
  )
);

comment on table equipo.solicitudes_disciplinarias is
  'Borradores disciplinarios sujetos a aprobación admin. urgente/medida_preventiva documentan una acción operativa inmediata, no una sanción.';
comment on column equipo.solicitudes_disciplinarias.medida_preventiva is
  'Acción inmediata para controlar el riesgo. No constituye apercibimiento ni suspensión.';

create index if not exists solicitudes_disciplinarias_persona_fecha_idx
  on equipo.solicitudes_disciplinarias (persona_id, fecha_hecho desc);
create index if not exists solicitudes_disciplinarias_estado_idx
  on equipo.solicitudes_disciplinarias (estado, created_at desc);
create index if not exists solicitudes_disciplinarias_creado_por_idx
  on equipo.solicitudes_disciplinarias (creado_por, created_at desc);

create or replace function equipo.touch_solicitudes_disciplinarias_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists solicitudes_disciplinarias_touch_updated_at
  on equipo.solicitudes_disciplinarias;
create trigger solicitudes_disciplinarias_touch_updated_at
before update on equipo.solicitudes_disciplinarias
for each row execute function equipo.touch_solicitudes_disciplinarias_updated_at();

alter table equipo.solicitudes_disciplinarias enable row level security;

revoke all on table equipo.solicitudes_disciplinarias from public, anon;
revoke all on table equipo.solicitudes_disciplinarias from authenticated;
grant select, insert, update on table equipo.solicitudes_disciplinarias to authenticated;

drop policy if exists solicitudes_disciplinarias_select on equipo.solicitudes_disciplinarias;
create policy solicitudes_disciplinarias_select
on equipo.solicitudes_disciplinarias
for select
to authenticated
using (
  exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and p.activo is true
      and (
        p.rol = 'admin'
        or (
          p.rol = 'encargado'
          and creado_por = (select auth.uid())
          and exists (
            select 1
            from equipo.personas per
            where per.id = solicitudes_disciplinarias.persona_id
              and per.sede_ids && coalesce(p.sede_ids, '{}'::integer[])
          )
        )
      )
  )
);

drop policy if exists solicitudes_disciplinarias_insert on equipo.solicitudes_disciplinarias;
create policy solicitudes_disciplinarias_insert
on equipo.solicitudes_disciplinarias
for insert
to authenticated
with check (
  creado_por = (select auth.uid())
  and estado = 'pendiente_aprobacion'
  and revisado_por is null
  and revisado_at is null
  and historial_id is null
  and exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and p.activo is true
      and (
        p.rol = 'admin'
        or (
          p.rol = 'encargado'
          and exists (
            select 1
            from equipo.personas per
            where per.id = solicitudes_disciplinarias.persona_id
              and per.sede_ids && coalesce(p.sede_ids, '{}'::integer[])
          )
        )
      )
  )
);

drop policy if exists solicitudes_disciplinarias_update_encargado on equipo.solicitudes_disciplinarias;
create policy solicitudes_disciplinarias_update_encargado
on equipo.solicitudes_disciplinarias
for update
to authenticated
using (
  estado = 'pendiente_aprobacion'
  and creado_por = (select auth.uid())
  and exists (
    select 1 from bitacora.perfiles p
    where p.id = (select auth.uid()) and p.activo is true and p.rol = 'encargado'
  )
)
with check (
  estado = 'pendiente_aprobacion'
  and creado_por = (select auth.uid())
  and revisado_por is null
  and revisado_at is null
  and historial_id is null
);

drop policy if exists solicitudes_disciplinarias_update_admin on equipo.solicitudes_disciplinarias;
create policy solicitudes_disciplinarias_update_admin
on equipo.solicitudes_disciplinarias
for update
to authenticated
using (
  exists (
    select 1 from bitacora.perfiles p
    where p.id = (select auth.uid()) and p.activo is true and p.rol = 'admin'
  )
)
with check (
  creado_por is not null
  and (
    (estado = 'pendiente_aprobacion' and revisado_por is null and revisado_at is null and historial_id is null)
    or
    (estado in ('aprobado', 'rechazado', 'cancelado') and revisado_por = (select auth.uid()) and revisado_at is not null and historial_id is null)
    or
    (estado = 'notificado' and revisado_por is not null and revisado_at is not null and historial_id is not null)
  )
);

-- Reemplaza la policy ALL actual para impedir que un encargado/editor/grupo
-- inserte o modifique sanciones formales por fuera del circuito de aprobación.
drop policy if exists historial_personal_staff_write on equipo.historial_personal;

drop policy if exists historial_personal_staff_insert on equipo.historial_personal;
create policy historial_personal_staff_insert
on equipo.historial_personal
for insert
to authenticated
with check (
  exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and p.activo is true
      and (
        p.rol = 'admin'
        or (
          tipo not in ('apercibimiento', 'suspension', 'llamado_atencion')
          and (
            p.rol = 'editor'
            or exists (
              select 1
              from equipo.personas per
              where per.id = historial_personal.persona_id
                and (
                  (p.rol = 'grupo' and exists (
                    select 1 from bitacora.sedes s
                    where s.grupo_id = p.grupo_id and s.id = any(per.sede_ids)
                  ))
                  or (p.rol = 'encargado' and per.sede_ids && coalesce(p.sede_ids, '{}'::integer[]))
                )
            )
          )
        )
      )
  )
);

drop policy if exists historial_personal_staff_update on equipo.historial_personal;
create policy historial_personal_staff_update
on equipo.historial_personal
for update
to authenticated
using (
  exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and p.activo is true
      and (
        p.rol = 'admin'
        or (
          tipo not in ('apercibimiento', 'suspension', 'llamado_atencion')
          and (
            p.rol = 'editor'
            or exists (
              select 1
              from equipo.personas per
              where per.id = historial_personal.persona_id
                and (
                  (p.rol = 'grupo' and exists (
                    select 1 from bitacora.sedes s
                    where s.grupo_id = p.grupo_id and s.id = any(per.sede_ids)
                  ))
                  or (p.rol = 'encargado' and per.sede_ids && coalesce(p.sede_ids, '{}'::integer[]))
                )
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
      and p.activo is true
      and (
        p.rol = 'admin'
        or (
          tipo not in ('apercibimiento', 'suspension', 'llamado_atencion')
          and (
            p.rol = 'editor'
            or exists (
              select 1
              from equipo.personas per
              where per.id = historial_personal.persona_id
                and (
                  (p.rol = 'grupo' and exists (
                    select 1 from bitacora.sedes s
                    where s.grupo_id = p.grupo_id and s.id = any(per.sede_ids)
                  ))
                  or (p.rol = 'encargado' and per.sede_ids && coalesce(p.sede_ids, '{}'::integer[]))
                )
            )
          )
        )
      )
  )
);

create or replace function equipo.notificar_solicitud_disciplinaria(p_solicitud_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_solicitud equipo.solicitudes_disciplinarias%rowtype;
  v_historial_id uuid;
begin
  if not exists (
    select 1 from bitacora.perfiles p
    where p.id = (select auth.uid()) and p.activo is true and p.rol = 'admin'
  ) then
    raise exception 'Solo un administrador puede notificar una sanción disciplinaria';
  end if;

  select * into v_solicitud
  from equipo.solicitudes_disciplinarias
  where id = p_solicitud_id
  for update;

  if not found then
    raise exception 'Solicitud disciplinaria inexistente o no accesible';
  end if;
  if v_solicitud.estado <> 'aprobado' then
    raise exception 'La solicitud debe estar aprobada antes de notificarse';
  end if;

  insert into equipo.historial_personal (
    persona_id, tipo, fecha, descripcion, registrado_por
  ) values (
    v_solicitud.persona_id,
    v_solicitud.tipo,
    current_date,
    v_solicitud.hechos,
    (select coalesce(p.nombre, p.email) from bitacora.perfiles p where p.id = (select auth.uid()))
  )
  returning id into v_historial_id;

  update equipo.solicitudes_disciplinarias
  set estado = 'notificado', historial_id = v_historial_id
  where id = p_solicitud_id;

  return v_historial_id;
end;
$$;

revoke all on function equipo.notificar_solicitud_disciplinaria(uuid) from public, anon;
grant execute on function equipo.notificar_solicitud_disciplinaria(uuid) to authenticated;
