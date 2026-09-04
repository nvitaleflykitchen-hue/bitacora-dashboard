begin;

alter table mantenimiento.tickets
  add column if not exists subarea text,
  add column if not exists impacto_operativo text,
  add column if not exists causa_raiz text,
  add column if not exists trabajo_realizado text,
  add column if not exists subtareas jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mnt_tickets_subtareas_array_check') then
    alter table mantenimiento.tickets add constraint mnt_tickets_subtareas_array_check
      check (jsonb_typeof(subtareas) = 'array');
  end if;
end $$;

create or replace view public.mnt_tickets as
select
  id, numero, tipo, activo_id, activo_nombre, estado, descripcion, diagnostico,
  responsable, proveedor_id, costo, presupuesto, presupuesto_aprobado, lectura_km,
  evidencia_url, prioridad, sede, categoria, fecha_cierre, creado_por, created_at,
  updated_at, responsable_id, fecha_limite, sede_id, es_externo, presupuesto_estado,
  costo_estimado, costo_real, oc_numero, oc_estado, notas_costos, escalamiento_id,
  plan_id, subarea, impacto_operativo, causa_raiz, trabajo_realizado, subtareas
from mantenimiento.tickets;

comment on column mantenimiento.tickets.subarea is
  'Especialidad o subárea técnica del trabajo, independiente de la categoría general.';
comment on column mantenimiento.tickets.subtareas is
  'Lista operativa JSON de pasos del ticket con id, texto y estado de finalización.';

commit;
