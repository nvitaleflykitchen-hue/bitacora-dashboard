alter table bitacora.capa_planes
  add column if not exists estado text not null default 'activo';

alter table bitacora.capa_planes
  drop constraint if exists capa_planes_estado_check;

alter table bitacora.capa_planes
  add constraint capa_planes_estado_check
  check (estado in ('activo', 'obsoleto'));

create index if not exists capa_planes_estado_idx
  on bitacora.capa_planes (estado);

comment on column bitacora.capa_planes.estado is
  'Ciclo de vida manual del proyecto. Los finalizados se derivan cuando todas sus acciones están completadas o verificadas.';
