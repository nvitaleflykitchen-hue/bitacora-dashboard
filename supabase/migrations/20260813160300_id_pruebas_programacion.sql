alter table bitacora.id_pruebas
  add column if not exists area_solicitante text,
  add column if not exists personal_involucrado text,
  add column if not exists controles text,
  add column if not exists destino_producto text,
  add column if not exists lista_distribucion text,
  add column if not exists condiciones_especiales text,
  add column if not exists muestras jsonb not null default '[]'::jsonb,
  add column if not exists evaluacion_sensorial jsonb not null default '[]'::jsonb;

comment on column bitacora.id_pruebas.muestras is 'Identificación y trazabilidad de muestras de la Programación R-8.2.3.1.1.';
comment on column bitacora.id_pruebas.evaluacion_sensorial is 'Evaluación de sabor, aroma, color y textura con escala 1 a 5.';
