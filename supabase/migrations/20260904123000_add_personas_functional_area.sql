begin;

alter table equipo.personas
  add column if not exists functional_area text;

alter table equipo.personas
  drop constraint if exists personas_functional_area_check,
  add constraint personas_functional_area_check
    check (functional_area is null or functional_area in (
      'operations', 'logistics', 'quality', 'maintenance', 'administration', 'hr'
    ));

comment on column equipo.personas.functional_area is
  'Área funcional normalizada, independiente del puesto y del área descriptiva histórica.';

create or replace view public.v_personas with (security_invoker = true) as
select
  p.id, p.perfil_id, p.nombre, p.apellido, p.dni, p.puesto, p.area, p.sede_ids,
  p.telefono, p.email, p.fecha_ingreso, p.fecha_baja, p.activo,
  p.descripcion_puesto, p.procesos, p.foto_url, p.created_at, p.updated_at,
  case
    when private.evaluacion_es_propia(p.id)
      or (private.evaluacion_es_confidencial(p.id) and not private.usuario_actual_es_admin())
    then null::numeric
    else coalesce((select round(avg(e.puntaje_calculado), 1) from equipo.evaluaciones e where e.persona_id = p.id), 0::numeric)
  end as puntaje_promedio,
  (select count(*) from equipo.historial_personal h where h.persona_id = p.id and h.tipo = any (array['apercibimiento','suspension','llamado_atencion'])) as incidentes,
  (select count(*) from equipo.logros_obtenidos lo where lo.persona_id = p.id) as logros_count,
  (select coalesce(sum(lc.puntos), 0) from equipo.logros_obtenidos lo join equipo.logros_config lc on lc.id = lo.logro_id where lo.persona_id = p.id) as puntos_total,
  p.legajo, p.motivo_baja, p.observaciones_baja,
  private.evaluacion_es_confidencial(p.id) as evaluacion_confidencial,
  private.evaluacion_es_propia(p.id) as evaluacion_propia,
  p.functional_area
from equipo.personas p
where p.activo = true;

commit;
