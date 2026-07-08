alter table equipo.reclutamiento_entrevistas
  add column if not exists hora_entrevista time without time zone;

comment on column equipo.reclutamiento_entrevistas.hora_entrevista is
  'Hora local programada para la entrevista de selección.';
