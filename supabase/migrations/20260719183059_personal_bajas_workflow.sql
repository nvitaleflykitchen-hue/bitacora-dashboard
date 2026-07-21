alter table equipo.personas
  add column if not exists motivo_baja text,
  add column if not exists observaciones_baja text;

alter table equipo.personas drop constraint if exists personas_motivo_baja_ck;
alter table equipo.personas add constraint personas_motivo_baja_ck check (
  motivo_baja is null or motivo_baja in ('renuncia', 'despido', 'fin_contrato', 'jubilacion', 'fallecimiento', 'otro')
);

comment on column equipo.personas.fecha_baja is 'Ultimo dia de la relacion laboral; puede informarse anticipadamente para programar la baja.';
comment on column equipo.personas.motivo_baja is 'Motivo normalizado del egreso laboral.';
comment on column equipo.personas.observaciones_baja is 'Notas internas relacionadas con el egreso laboral.';

create or replace view public.v_personas with (security_invoker = true) as
select p.id, p.perfil_id, p.nombre, p.apellido, p.dni, p.puesto, p.area, p.sede_ids,
  p.telefono, p.email, p.fecha_ingreso, p.fecha_baja, p.activo, p.descripcion_puesto,
  p.procesos, p.foto_url, p.created_at, p.updated_at,
  coalesce((select round(avg(e.puntaje_calculado), 1) from equipo.evaluaciones e where e.persona_id = p.id), 0::numeric) as puntaje_promedio,
  (select count(*) from equipo.historial_personal h where h.persona_id = p.id and h.tipo = any (array['apercibimiento','suspension','llamado_atencion'])) as incidentes,
  (select count(*) from equipo.logros_obtenidos lo where lo.persona_id = p.id) as logros_count,
  (select coalesce(sum(lc.puntos), 0) from equipo.logros_obtenidos lo join equipo.logros_config lc on lc.id = lo.logro_id where lo.persona_id = p.id) as puntos_total,
  p.legajo, p.motivo_baja, p.observaciones_baja
from equipo.personas p
where p.activo = true;
