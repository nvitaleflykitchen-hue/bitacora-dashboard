alter table bitacora.registros
  add column if not exists op2_producidos integer,
  add column if not exists op2_servidos integer,
  add column if not exists op2_sobrante integer;

comment on column bitacora.registros.op2_producidos is
  'Cantidad producida de la opcion 2 del menu en reportes de comedores.';
comment on column bitacora.registros.op2_servidos is
  'Cantidad servida de la opcion 2 del menu en reportes de comedores.';
comment on column bitacora.registros.op2_sobrante is
  'Cantidad sobrante de la opcion 2 del menu en reportes de comedores.';
