create unique index if not exists vacaciones_no_duplicadas_activas
on equipo.vacaciones (persona_id, fecha_desde, fecha_hasta)
where estado in ('solicitado', 'aprobado');
