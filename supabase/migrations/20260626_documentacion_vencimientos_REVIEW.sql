-- REVIEW ONLY — no ejecutar sin confirmar alcance de permisos/RLS.
-- Proyecto correcto: mixyhfdlzjarvszinytk (cerdova-db).
-- Objetivo: registrar documentación, evidencia y vencimientos por persona/equipo, vehículo/flota y sede.

begin;

create table if not exists bitacora.documentacion_items (
  id bigserial primary key,
  entity_type text not null check (entity_type in ('persona', 'vehiculo', 'sede')),
  entity_id text not null,
  codigo text not null,
  titulo text not null,
  seccion text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'vigente', 'observado', 'vencido', 'no_aplica')),
  aviso_dias integer not null default 30 check (aviso_dias >= 0 and aviso_dias <= 365),
  fecha_vencimiento date,
  observacion text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, codigo)
);

create index if not exists idx_documentacion_items_entity
  on bitacora.documentacion_items (entity_type, entity_id);

create index if not exists idx_documentacion_items_vencimiento
  on bitacora.documentacion_items (fecha_vencimiento)
  where fecha_vencimiento is not null;

alter table bitacora.documentacion_items
  add column if not exists aviso_dias integer not null default 30;

alter table bitacora.documentacion_items
  alter column aviso_dias set default 30;

update bitacora.documentacion_items
set aviso_dias = 30
where aviso_dias is null;

alter table bitacora.documentacion_items
  alter column aviso_dias set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documentacion_items_aviso_dias_check'
      and conrelid = 'bitacora.documentacion_items'::regclass
  ) then
    alter table bitacora.documentacion_items
      add constraint documentacion_items_aviso_dias_check
      check (aviso_dias >= 0 and aviso_dias <= 365);
  end if;
end $$;

comment on table bitacora.documentacion_items is
  'Checklist documental genérico con vencimientos. La evidencia se adjunta en bitacora.adjuntos con entity_type=documentacion_item y entity_id=documentacion_items.id.';

comment on column bitacora.documentacion_items.entity_type is
  'persona, vehiculo o sede. Sede queda previsto para carpeta documental de unidad/aeropuerto.';

comment on column bitacora.documentacion_items.aviso_dias is
  'Cantidad de dias antes del vencimiento para marcar el item como proximo a renovar y generar recordatorio de calendario.';

-- Pendiente de aprobar antes de producción:
-- 1) definir políticas RLS por rol y alcance territorial;
-- 2) otorgar GRANT mínimo a anon/authenticated si corresponde;
-- 3) definir si updated_by debe guardar auth.uid(), email o nombre operativo.

commit;
