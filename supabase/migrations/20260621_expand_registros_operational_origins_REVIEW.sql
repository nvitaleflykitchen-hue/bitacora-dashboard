-- APLICADA 2026-06-21: cambio no destructivo para alinear el formulario mobile con los grupos reales.
-- Proyecto permitido: mixyhfdlzjarvszinytk (cerdova-db).
-- Normaliza el nombre del grupo Restaurantes y reemplaza un CHECK constraint.

begin;

update bitacora.grupos
set nombre = 'Restaurantes'
where nombre = 'RESTAURANTES';

alter table bitacora.registros
  drop constraint if exists registros_origen_form_check;

alter table bitacora.registros
  add constraint registros_origen_form_check
  check (origen_form in (
    'Aeropuertos',
    'Comedores',
    U&'Educaci\00F3n',
    'Hospitales',
    'Otros',
    'Restaurantes'
  ));

commit;
