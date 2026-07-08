-- REVIEW ONLY — no ejecutar sin confirmar alcance de permisos/RLS.
-- Proyecto correcto: mixyhfdlzjarvszinytk (cerdova-db).
-- Objetivo: gestionar solicitudes de personal, candidatos, entrevistas y fichas imprimibles.
--
-- Importante:
-- - No crea bucket nuevo: los CVs usan bitacora.adjuntos + Storage bucket bitacora-adjuntos
--   con entity_type='reclutamiento_candidato_cv'.
-- - Incluye GRANT/RLS propuestos para revisión. Por regla operativa del repo, no aplicarlos
--   sin confirmación explícita.

begin;

create table if not exists equipo.reclutamiento_solicitudes (
  id uuid primary key default gen_random_uuid(),
  estado text not null default 'borrador'
    check (estado in (
      'borrador',
      'enviada_whatsapp',
      'recibiendo_cvs',
      'entrevistas',
      'preocupacional',
      'ingreso',
      'cerrada',
      'cancelada'
    )),
  puesto text not null,
  sede_id integer references bitacora.sedes(id),
  horario text,
  fecha_apertura date not null default current_date,
  urgencia text not null default 'Media' check (urgencia in ('Alta', 'Media', 'Baja')),
  periodo_necesidad text,
  motivo text,
  cantidad integer not null default 1 check (cantidad > 0),
  modalidad text,
  tareas text,
  requisitos text,
  experiencia text,
  documentacion text,
  responsable text,
  contacto text,
  observaciones text,
  requiere_psicologico boolean not null default false,
  requiere_direccion boolean not null default false,
  horas_semanales text,
  categoria text,
  sueldo_especificaciones text,
  creado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists equipo.reclutamiento_candidatos (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid references equipo.reclutamiento_solicitudes(id) on delete set null,
  estado text not null default 'cv_recibido'
    check (estado in (
      'cv_recibido',
      'preseleccionado',
      'entrevista',
      'evaluacion',
      'psicologico_direccion',
      'preocupacional',
      'apto_ingreso',
      'incorporado',
      'no_apto'
    )),
  nombre_apellido text not null,
  dni text,
  cuil text,
  celular text,
  email text,
  origen text,
  recomendado_por text,
  evaluacion_breve text,
  resultado text check (resultado in ('apto', 'no_apto', 'reserva') or resultado is null or resultado = ''),
  requiere_psicologico boolean not null default false,
  requiere_direccion boolean not null default false,
  fecha_preocupacional date,
  resultado_preocupacional text,
  fecha_ingreso date,
  induccion_at timestamptz,
  notas text,
  persona_id uuid references equipo.personas(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists equipo.reclutamiento_entrevistas (
  id uuid primary key default gen_random_uuid(),
  candidato_id uuid not null references equipo.reclutamiento_candidatos(id) on delete cascade,
  fecha_entrevista date,
  entrevistador text,
  nombre_apellido text,
  dni text,
  cuil text,
  estado_civil text,
  hijos_menores text,
  edades_hijos text,
  domicilio text,
  piso text,
  departamento text,
  barrio text,
  ciudad text,
  codigo_postal text,
  fecha_nacimiento date,
  nacionalidad text,
  celular text,
  celular_alternativo text,
  email text,
  nivel_estudio text,
  estudios_cursados text,
  estudia_actualmente text,
  movilidad text,
  carnet_conducir text,
  disponibilidad_horaria text,
  enfermedades_cronicas text,
  talle_pantalon text,
  talle_camisa text,
  talle_calzado text,
  carnet_sanitario boolean not null default false,
  antecedentes_penales boolean not null default false,
  recomendado_por text,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidato_id)
);

create index if not exists idx_reclutamiento_solicitudes_estado
  on equipo.reclutamiento_solicitudes (estado, fecha_apertura desc);

create index if not exists idx_reclutamiento_solicitudes_sede
  on equipo.reclutamiento_solicitudes (sede_id);

create index if not exists idx_reclutamiento_candidatos_solicitud
  on equipo.reclutamiento_candidatos (solicitud_id);

create index if not exists idx_reclutamiento_candidatos_estado
  on equipo.reclutamiento_candidatos (estado, updated_at desc);

create index if not exists idx_reclutamiento_entrevistas_candidato
  on equipo.reclutamiento_entrevistas (candidato_id);

create or replace function equipo.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_reclutamiento_solicitudes_updated_at on equipo.reclutamiento_solicitudes;
create trigger trg_reclutamiento_solicitudes_updated_at
before update on equipo.reclutamiento_solicitudes
for each row execute function equipo.touch_updated_at();

drop trigger if exists trg_reclutamiento_candidatos_updated_at on equipo.reclutamiento_candidatos;
create trigger trg_reclutamiento_candidatos_updated_at
before update on equipo.reclutamiento_candidatos
for each row execute function equipo.touch_updated_at();

drop trigger if exists trg_reclutamiento_entrevistas_updated_at on equipo.reclutamiento_entrevistas;
create trigger trg_reclutamiento_entrevistas_updated_at
before update on equipo.reclutamiento_entrevistas
for each row execute function equipo.touch_updated_at();

comment on table equipo.reclutamiento_solicitudes is
  'Solicitudes internas de personal. El texto para WhatsApp se genera desde el frontend.';

comment on table equipo.reclutamiento_candidatos is
  'Candidatos asociados o no a una solicitud. Los CVs se adjuntan en bitacora.adjuntos.';

comment on table equipo.reclutamiento_entrevistas is
  'Datos de la ficha de entrevista. La ficha de alta se completa reutilizando datos de candidato, entrevista y solicitud.';

-- PROPUESTA DE ACCESO DATA API / RLS — revisar antes de ejecutar.
-- Se mantiene consistente con el patrón actual de EquipoView: acceso directo al schema equipo.

alter table equipo.reclutamiento_solicitudes enable row level security;
alter table equipo.reclutamiento_candidatos enable row level security;
alter table equipo.reclutamiento_entrevistas enable row level security;

grant usage on schema equipo to authenticated;
grant select, insert, update, delete on equipo.reclutamiento_solicitudes to authenticated;
grant select, insert, update, delete on equipo.reclutamiento_candidatos to authenticated;
grant select, insert, update, delete on equipo.reclutamiento_entrevistas to authenticated;

create policy "reclutamiento_solicitudes_staff_select"
on equipo.reclutamiento_solicitudes
for select
to authenticated
using (
  exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and (
        p.rol in ('admin', 'editor')
        or (p.rol = 'grupo' and exists (
          select 1 from bitacora.sedes s
          where s.id = reclutamiento_solicitudes.sede_id
            and s.grupo_id = p.grupo_id
        ))
        or (p.rol in ('encargado', 'sede') and reclutamiento_solicitudes.sede_id = any(coalesce(p.sede_ids, '{}'::integer[])))
      )
  )
);

create policy "reclutamiento_solicitudes_staff_write"
on equipo.reclutamiento_solicitudes
for all
to authenticated
using (
  exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and (
        p.rol in ('admin', 'editor')
        or (p.rol = 'grupo' and exists (
          select 1 from bitacora.sedes s
          where s.id = reclutamiento_solicitudes.sede_id
            and s.grupo_id = p.grupo_id
        ))
        or (p.rol in ('encargado', 'sede') and reclutamiento_solicitudes.sede_id = any(coalesce(p.sede_ids, '{}'::integer[])))
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
        or (p.rol = 'grupo' and exists (
          select 1 from bitacora.sedes s
          where s.id = reclutamiento_solicitudes.sede_id
            and s.grupo_id = p.grupo_id
        ))
        or (p.rol in ('encargado', 'sede') and reclutamiento_solicitudes.sede_id = any(coalesce(p.sede_ids, '{}'::integer[])))
      )
  )
);

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
              or (p.rol in ('encargado', 'sede') and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[])))
            )
        )
      )
  )
);

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
              or (p.rol in ('encargado', 'sede') and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[])))
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
              or (p.rol in ('encargado', 'sede') and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[])))
            )
        )
      )
  )
);

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
              or (p.rol in ('encargado', 'sede') and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[])))
            )
        )
      )
  )
);

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
              or (p.rol in ('encargado', 'sede') and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[])))
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
              or (p.rol in ('encargado', 'sede') and rs.sede_id = any(coalesce(p.sede_ids, '{}'::integer[])))
            )
        )
      )
  )
);

commit;
