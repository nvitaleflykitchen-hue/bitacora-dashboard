-- Periodos estructurados de ausentismo para cruzar novedades con Horarios.

alter table bitacora.persona_novedades
  add column motivo_ausencia text,
  add column fecha_desde date,
  add column fecha_hasta date,
  add column estado_documentacion text,
  add column fecha_reintegro_estimada date;

alter table bitacora.persona_novedades
  add constraint persona_novedades_motivo_ausencia_check
    check (motivo_ausencia is null or motivo_ausencia in (
      'Carpeta médica', 'Accidente laboral / ART', 'Licencia especial',
      'Ausencia injustificada', 'Otro'
    )),
  add constraint persona_novedades_estado_documentacion_check
    check (estado_documentacion is null or estado_documentacion in (
      'Pendiente', 'Presentado', 'Validado', 'Rechazado', 'No requerido'
    )),
  add constraint persona_novedades_periodo_check
    check (fecha_hasta is null or (fecha_desde is not null and fecha_hasta >= fecha_desde)),
  add constraint persona_novedades_reintegro_check
    check (fecha_reintegro_estimada is null or fecha_desde is null or fecha_reintegro_estimada >= fecha_desde),
  add constraint persona_novedades_cm_periodo_check
    check (motivo_ausencia <> 'Carpeta médica' or (categoria = 'Ausentismo' and fecha_desde is not null and fecha_hasta is not null));

create index persona_novedades_ausencias_sede_periodo_idx
  on bitacora.persona_novedades (sede_id, fecha_desde, fecha_hasta)
  where categoria = 'Ausentismo';

create index persona_novedades_ausencias_persona_periodo_idx
  on bitacora.persona_novedades (persona_id, fecha_desde, fecha_hasta)
  where categoria = 'Ausentismo';

comment on column bitacora.persona_novedades.motivo_ausencia is 'Motivo operativo normalizado; no almacenar diagnóstico médico.';
comment on column bitacora.persona_novedades.fecha_desde is 'Inicio inclusivo del período de indisponibilidad.';
comment on column bitacora.persona_novedades.fecha_hasta is 'Fin inclusivo del período de indisponibilidad.';
comment on column bitacora.persona_novedades.estado_documentacion is 'Estado administrativo del respaldo, sin detalle clínico.';
comment on column bitacora.persona_novedades.fecha_reintegro_estimada is 'Fecha estimada de regreso informada operativamente.';
