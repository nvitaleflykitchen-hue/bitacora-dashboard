alter table equipo.personas
  add column if not exists duplicado_de uuid references equipo.personas(id),
  add column if not exists consolidado_at timestamptz,
  add column if not exists consolidado_por uuid references auth.users(id),
  add column if not exists baja_registrada_at timestamptz,
  add column if not exists baja_registrada_por uuid references auth.users(id),
  add column if not exists reactivada_at timestamptz,
  add column if not exists reactivada_por uuid references auth.users(id),
  add column if not exists motivo_reactivacion text;

create index if not exists personas_duplicado_de_idx
  on equipo.personas (duplicado_de)
  where duplicado_de is not null;

create index if not exists personas_baja_programada_idx
  on equipo.personas (fecha_baja)
  where activo = true and fecha_baja is not null;

comment on column equipo.personas.duplicado_de is
  'Ficha canónica que reemplaza este registro duplicado. El registro se conserva por trazabilidad.';
comment on column equipo.personas.fecha_baja is
  'Fecha programada o efectiva de baja. activo=false confirma que la baja ya se hizo efectiva.';
