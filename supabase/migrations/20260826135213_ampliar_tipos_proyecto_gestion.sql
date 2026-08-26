alter table bitacora.capa
  drop constraint if exists capa_tipo_check;

alter table bitacora.capa
  add constraint capa_tipo_check
  check (tipo = any (array[
    'Correctiva'::text,
    'Preventiva'::text,
    'Desarrollo'::text,
    'Implementación'::text,
    'Mejora continua'::text,
    'Innovación'::text,
    'Estandarización'::text
  ]));
