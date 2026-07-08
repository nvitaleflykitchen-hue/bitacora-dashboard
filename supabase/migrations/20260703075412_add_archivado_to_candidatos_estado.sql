begin;

alter table equipo.reclutamiento_candidatos 
  drop constraint if exists reclutamiento_candidatos_estado_check;

alter table equipo.reclutamiento_candidatos 
  add constraint reclutamiento_candidatos_estado_check 
  check (estado in (
    'cv_recibido',
    'preseleccionado',
    'entrevista',
    'evaluacion',
    'psicologico_direccion',
    'preocupacional',
    'apto_ingreso',
    'incorporado',
    'no_apto',
    'archivado'
  ));

commit;
