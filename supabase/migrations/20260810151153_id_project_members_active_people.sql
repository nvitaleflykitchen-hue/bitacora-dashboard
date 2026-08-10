alter table bitacora.id_proyecto_miembros
  alter column perfil_id drop not null;

alter table bitacora.id_proyecto_miembros
  add column if not exists persona_id uuid references equipo.personas(id) on delete restrict;

alter table bitacora.id_proyecto_miembros
  add constraint id_miembros_identidad_requerida
  check (perfil_id is not null or persona_id is not null);

create unique index if not exists id_miembros_proyecto_persona_uidx
  on bitacora.id_proyecto_miembros(proyecto_id, persona_id)
  where persona_id is not null;

create index if not exists id_miembros_persona_idx
  on bitacora.id_proyecto_miembros(persona_id, proyecto_id)
  where persona_id is not null;
