begin;

create sequence if not exists bitacora.id_proyecto_codigo_seq;

create table if not exists bitacora.id_proyectos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default (
    'FK-ID-' || to_char(current_date, 'YYYY') || '-' ||
    lpad(nextval('bitacora.id_proyecto_codigo_seq')::text, 4, '0')
  ),
  titulo text not null check (length(trim(titulo)) >= 3),
  descripcion text,
  categoria text not null,
  origen_tipo text not null default 'iniciativa_interna',
  origen_id text,
  origen_detalle text,
  objetivo text not null,
  etapa text not null default 'Idea' check (etapa in (
    'Idea','Evaluación','Desarrollo','Pruebas','Validación',
    'Aprobación','Implementación','Seguimiento'
  )),
  situacion text not null default 'Activo' check (situacion in (
    'Activo','Pausado','Completado','Cancelado'
  )),
  prioridad text not null default 'Media' check (prioridad in ('Alta','Media','Baja')),
  responsable_id uuid not null references bitacora.perfiles(id),
  sede_id integer references bitacora.sedes(id),
  cliente text,
  fecha_objetivo date,
  proximo_paso text,
  impacto_esperado text,
  costo_objetivo numeric(14,2) check (costo_objetivo is null or costo_objetivo >= 0),
  version_aprobada_id uuid,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bitacora.id_proyecto_miembros (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references bitacora.id_proyectos(id) on delete cascade,
  perfil_id uuid not null references bitacora.perfiles(id) on delete cascade,
  rol_proyecto text not null default 'integrante' check (rol_proyecto in (
    'coordinador','integrante','validador','observador'
  )),
  puede_editar boolean not null default false,
  created_at timestamptz not null default now(),
  unique (proyecto_id, perfil_id)
);

create table if not exists bitacora.id_versiones (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references bitacora.id_proyectos(id) on delete cascade,
  numero integer not null check (numero > 0),
  nombre text,
  descripcion text not null,
  formulacion jsonb not null default '[]'::jsonb check (jsonb_typeof(formulacion) = 'array'),
  proceso text,
  estado text not null default 'Borrador' check (estado in (
    'Borrador','Candidata','Probada','Descartada','Aprobada'
  )),
  creada_por uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (proyecto_id, numero)
);

alter table bitacora.id_proyectos
  add constraint id_proyectos_version_aprobada_fk
  foreign key (version_aprobada_id) references bitacora.id_versiones(id) on delete set null;

create table if not exists bitacora.id_pruebas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references bitacora.id_proyectos(id) on delete cascade,
  version_id uuid references bitacora.id_versiones(id) on delete restrict,
  numero integer not null check (numero > 0),
  fecha date not null default current_date,
  sede_id integer references bitacora.sedes(id),
  responsables jsonb not null default '[]'::jsonb check (jsonb_typeof(responsables) = 'array'),
  proveedor text,
  materias_primas jsonb not null default '[]'::jsonb check (jsonb_typeof(materias_primas) = 'array'),
  proceso text,
  temperatura text,
  tiempo_minutos numeric(10,2) check (tiempo_minutos is null or tiempo_minutos >= 0),
  rendimiento numeric(14,3) check (rendimiento is null or rendimiento >= 0),
  merma_porcentaje numeric(7,3) check (merma_porcentaje is null or merma_porcentaje between 0 and 100),
  costo numeric(14,2) check (costo is null or costo >= 0),
  observaciones text,
  resultado text not null default 'Repetir prueba' check (resultado in (
    'Aprobado','Aprobado con ajustes','Rechazado','Repetir prueba'
  )),
  conclusion text,
  proximo_ajuste text,
  creada_por uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, numero)
);

create table if not exists bitacora.id_validaciones (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references bitacora.id_proyectos(id) on delete cascade,
  version_id uuid references bitacora.id_versiones(id) on delete restrict,
  area text not null,
  validador_id uuid not null references bitacora.perfiles(id),
  decision text not null default 'Pendiente' check (decision in (
    'Pendiente','Aprobado','Aprobado con condiciones','Observado','Rechazado'
  )),
  observaciones text,
  condicion text,
  decidido_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bitacora.id_eventos (
  id bigint generated always as identity primary key,
  proyecto_id uuid not null references bitacora.id_proyectos(id) on delete cascade,
  entidad_tipo text not null default 'proyecto',
  entidad_id text,
  tipo text not null,
  resumen text not null,
  datos jsonb not null default '{}'::jsonb check (jsonb_typeof(datos) = 'object'),
  autor_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists id_proyectos_atencion_idx
  on bitacora.id_proyectos (situacion, etapa, prioridad, fecha_objetivo);
create index if not exists id_proyectos_responsable_idx
  on bitacora.id_proyectos (responsable_id, situacion);
create index if not exists id_proyectos_sede_idx
  on bitacora.id_proyectos (sede_id);
create index if not exists id_miembros_perfil_idx
  on bitacora.id_proyecto_miembros (perfil_id, proyecto_id);
create index if not exists id_versiones_proyecto_idx
  on bitacora.id_versiones (proyecto_id, numero desc);
create index if not exists id_pruebas_proyecto_idx
  on bitacora.id_pruebas (proyecto_id, numero desc);
create index if not exists id_validaciones_pendientes_idx
  on bitacora.id_validaciones (validador_id, decision) where decision = 'Pendiente';
create index if not exists id_eventos_proyecto_idx
  on bitacora.id_eventos (proyecto_id, created_at desc);

create schema if not exists bitacora_private;

create or replace function bitacora_private.id_puede_acceder(
  p_proyecto_id uuid,
  p_escritura boolean default false
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from bitacora.perfiles p
    join bitacora.id_proyectos pr on pr.id = p_proyecto_id
    where p.id = (select auth.uid())
      and p.activo is true
      and (
        p.rol in ('admin','editor')
        or pr.responsable_id = p.id
        or exists (
          select 1 from bitacora.id_proyecto_miembros m
          where m.proyecto_id = pr.id
            and m.perfil_id = p.id
            and (not p_escritura or m.puede_editar or m.rol_proyecto = 'coordinador')
        )
        or exists (
          select 1 from bitacora.id_validaciones v
          where v.proyecto_id = pr.id
            and v.validador_id = p.id
            and not p_escritura
        )
        or (
          not p_escritura and p.rol = 'consultor'
        )
        or (
          p.rol = 'grupo' and pr.sede_id is not null and exists (
            select 1 from bitacora.sedes s
            where s.id = pr.sede_id and s.grupo_id = p.grupo_id
          )
        )
        or (
          p.rol in ('encargado','sede')
          and pr.sede_id = any(coalesce(p.sede_ids, '{}'::integer[]))
        )
      )
  );
$$;

revoke all on function bitacora_private.id_puede_acceder(uuid, boolean)
  from public, anon, authenticated;
grant usage on schema bitacora_private to authenticated;
grant execute on function bitacora_private.id_puede_acceder(uuid, boolean)
  to authenticated;

create or replace function bitacora_private.id_es_admin_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from bitacora.perfiles p
    where p.id = (select auth.uid())
      and p.activo is true
      and p.rol in ('admin','editor')
  );
$$;

revoke all on function bitacora_private.id_es_admin_editor()
  from public, anon, authenticated;
grant execute on function bitacora_private.id_es_admin_editor()
  to authenticated;

alter table bitacora.id_proyectos enable row level security;
alter table bitacora.id_proyecto_miembros enable row level security;
alter table bitacora.id_versiones enable row level security;
alter table bitacora.id_pruebas enable row level security;
alter table bitacora.id_validaciones enable row level security;
alter table bitacora.id_eventos enable row level security;

create policy id_proyectos_select on bitacora.id_proyectos
for select to authenticated
using (bitacora_private.id_puede_acceder(id, false));

create policy id_proyectos_insert on bitacora.id_proyectos
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from bitacora.perfiles p
    where p.id = (select auth.uid()) and p.activo is true
      and p.rol in ('admin','editor','grupo','encargado')
  )
);

create policy id_proyectos_update on bitacora.id_proyectos
for update to authenticated
using (bitacora_private.id_puede_acceder(id, true))
with check (bitacora_private.id_puede_acceder(id, true));

create policy id_proyectos_delete on bitacora.id_proyectos
for delete to authenticated
using (bitacora_private.id_es_admin_editor());

create policy id_miembros_select on bitacora.id_proyecto_miembros
for select to authenticated
using (bitacora_private.id_puede_acceder(proyecto_id, false));
create policy id_miembros_insert on bitacora.id_proyecto_miembros
for insert to authenticated
with check (bitacora_private.id_puede_acceder(proyecto_id, true));
create policy id_miembros_update on bitacora.id_proyecto_miembros
for update to authenticated
using (bitacora_private.id_puede_acceder(proyecto_id, true))
with check (bitacora_private.id_puede_acceder(proyecto_id, true));
create policy id_miembros_delete on bitacora.id_proyecto_miembros
for delete to authenticated
using (bitacora_private.id_puede_acceder(proyecto_id, true));

create policy id_versiones_select on bitacora.id_versiones
for select to authenticated
using (bitacora_private.id_puede_acceder(proyecto_id, false));
create policy id_versiones_insert on bitacora.id_versiones
for insert to authenticated
with check (bitacora_private.id_puede_acceder(proyecto_id, true));
create policy id_versiones_update on bitacora.id_versiones
for update to authenticated
using (
  bitacora_private.id_puede_acceder(proyecto_id, true)
  and estado <> 'Aprobada'
  and not exists (select 1 from bitacora.id_pruebas e where e.version_id = id_versiones.id)
)
with check (bitacora_private.id_puede_acceder(proyecto_id, true));

create policy id_pruebas_select on bitacora.id_pruebas
for select to authenticated
using (bitacora_private.id_puede_acceder(proyecto_id, false));
create policy id_pruebas_insert on bitacora.id_pruebas
for insert to authenticated
with check (bitacora_private.id_puede_acceder(proyecto_id, true));
create policy id_pruebas_update on bitacora.id_pruebas
for update to authenticated
using (bitacora_private.id_puede_acceder(proyecto_id, true))
with check (bitacora_private.id_puede_acceder(proyecto_id, true));

create policy id_validaciones_select on bitacora.id_validaciones
for select to authenticated
using (bitacora_private.id_puede_acceder(proyecto_id, false));
create policy id_validaciones_insert on bitacora.id_validaciones
for insert to authenticated
with check (bitacora_private.id_puede_acceder(proyecto_id, true));
create policy id_validaciones_update on bitacora.id_validaciones
for update to authenticated
using (
  bitacora_private.id_puede_acceder(proyecto_id, true)
  or validador_id = (select auth.uid())
)
with check (
  bitacora_private.id_puede_acceder(proyecto_id, true)
  or validador_id = (select auth.uid())
);

create policy id_eventos_select on bitacora.id_eventos
for select to authenticated
using (bitacora_private.id_puede_acceder(proyecto_id, false));
create policy id_eventos_insert on bitacora.id_eventos
for insert to authenticated
with check (
  autor_id = (select auth.uid())
  and bitacora_private.id_puede_acceder(proyecto_id, true)
);

grant usage on schema bitacora to authenticated;
grant select, insert, update, delete on bitacora.id_proyectos to authenticated;
grant select, insert, update, delete on bitacora.id_proyecto_miembros to authenticated;
grant select, insert, update on bitacora.id_versiones to authenticated;
grant select, insert, update on bitacora.id_pruebas to authenticated;
grant select, insert, update on bitacora.id_validaciones to authenticated;
grant select, insert on bitacora.id_eventos to authenticated;
grant usage, select on sequence bitacora.id_proyecto_codigo_seq to authenticated;
grant usage, select on sequence bitacora.id_eventos_id_seq to authenticated;

-- Los componentes genéricos de adjuntos y comentarios se reutilizan, pero los
-- registros de I+D respetan el acceso del proyecto en vez de quedar visibles
-- para cualquier sesión autenticada.
drop policy if exists adjuntos_select_auth on bitacora.adjuntos;
create policy adjuntos_select_auth on bitacora.adjuntos
for select to authenticated
using (
  case when entity_type = 'id_proyecto'
    then bitacora_private.id_puede_acceder(entity_id::uuid, false)
    else true
  end
);

drop policy if exists adjuntos_insert_auth on bitacora.adjuntos;
create policy adjuntos_insert_auth on bitacora.adjuntos
for insert to authenticated
with check (
  case when entity_type = 'id_proyecto'
    then bitacora_private.id_puede_acceder(entity_id::uuid, true)
    else true
  end
);

drop policy if exists adjuntos_delete_auth on bitacora.adjuntos;
create policy adjuntos_delete_auth on bitacora.adjuntos
for delete to authenticated
using (
  case when entity_type = 'id_proyecto'
    then bitacora_private.id_puede_acceder(entity_id::uuid, true)
    else (
      uploaded_by = (select auth.uid())::text
      or exists (
        select 1 from bitacora.perfiles p
        where p.id = (select auth.uid()) and p.rol in ('admin','editor')
      )
    )
  end
);

drop policy if exists comentarios_select_auth on bitacora.comentarios;
create policy comentarios_select_auth on bitacora.comentarios
for select to authenticated
using (
  case when entidad_tipo = 'id_proyecto'
    then bitacora_private.id_puede_acceder(entidad_id::uuid, false)
    else true
  end
);

drop policy if exists comentarios_insert_own on bitacora.comentarios;
create policy comentarios_insert_own on bitacora.comentarios
for insert to authenticated
with check (
  autor_id = (select auth.uid())
  and case when entidad_tipo = 'id_proyecto'
    then bitacora_private.id_puede_acceder(entidad_id::uuid, false)
    else true
  end
);

drop policy if exists comentarios_update_own on bitacora.comentarios;
create policy comentarios_update_own on bitacora.comentarios
for update to authenticated
using (
  autor_id = (select auth.uid())
  and case when entidad_tipo = 'id_proyecto'
    then bitacora_private.id_puede_acceder(entidad_id::uuid, false)
    else true
  end
)
with check (
  autor_id = (select auth.uid())
  and case when entidad_tipo = 'id_proyecto'
    then bitacora_private.id_puede_acceder(entidad_id::uuid, false)
    else true
  end
);

create or replace function bitacora_private.notify_id_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.responsable_id is not null
     and (
       (tg_op = 'INSERT' and new.responsable_id is distinct from new.created_by)
       or (tg_op = 'UPDATE' and new.responsable_id is distinct from old.responsable_id)
     )
  then
    insert into bitacora.notificaciones(
      destinatario_id, modulo, entidad_tipo, entidad_id, titulo, cuerpo,
      prioridad, url, dedupe_key
    ) values (
      new.responsable_id, 'id', 'id_proyecto', new.id::text,
      'Proyecto I+D asignado', new.codigo || ' · ' || new.titulo,
      lower(new.prioridad),
      '/?view=idHub&targetType=id_proyecto&targetId=' || new.id,
      'id:responsable:' || new.id || ':' || new.responsable_id
    ) on conflict (destinatario_id, dedupe_key)
      where dedupe_key is not null do nothing;
  end if;
  return new;
end;
$$;

revoke all on function bitacora_private.notify_id_assignment()
  from public, anon, authenticated;
drop trigger if exists notify_id_assignment on bitacora.id_proyectos;
create trigger notify_id_assignment
after insert or update of responsable_id on bitacora.id_proyectos
for each row execute function bitacora_private.notify_id_assignment();

create or replace function bitacora_private.notify_id_validation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_row bitacora.id_proyectos%rowtype;
begin
  select * into project_row from bitacora.id_proyectos where id = new.proyecto_id;
  insert into bitacora.notificaciones(
    destinatario_id, modulo, entidad_tipo, entidad_id, titulo, cuerpo,
    prioridad, url, dedupe_key
  ) values (
    new.validador_id, 'id', 'id_validacion', new.proyecto_id::text,
    'Validación I+D pendiente', project_row.codigo || ' · ' || new.area,
    'media',
    '/?view=idHub&targetType=id_proyecto&targetId=' || new.proyecto_id,
    'id:validacion:' || new.id || ':' || new.validador_id
  ) on conflict (destinatario_id, dedupe_key)
    where dedupe_key is not null do nothing;
  return new;
end;
$$;

revoke all on function bitacora_private.notify_id_validation()
  from public, anon, authenticated;
drop trigger if exists notify_id_validation on bitacora.id_validaciones;
create trigger notify_id_validation
after insert on bitacora.id_validaciones
for each row execute function bitacora_private.notify_id_validation();

commit;
