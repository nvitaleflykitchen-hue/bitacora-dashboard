-- Aplicada en producción al proyecto mixyhfdlzjarvszinytk el 2026-07-14.
-- No modifica RLS, políticas ni grants.
alter table bitacora.tareas
  add column if not exists creado_por uuid null
  references bitacora.perfiles(id) on delete set null;

comment on column bitacora.tareas.creado_por is
  'Perfil que creó la tarea. Nullable para preservar tareas históricas sin autor registrado.';
