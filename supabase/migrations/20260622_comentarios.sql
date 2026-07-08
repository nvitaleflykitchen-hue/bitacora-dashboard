-- PROPUESTA PENDIENTE DE APROBACIÓN EXPLÍCITA.
-- Proyecto destino exclusivo: mixyhfdlzjarvszinytk (cerdova-db).
-- Crea tabla de comentarios por registro (tickets/tareas/escalamientos/CAPA). Ya aplicada en Supabase el 2026-06-22.

create table if not exists bitacora.comentarios (
  id uuid primary key default gen_random_uuid(),
  entidad_tipo text not null,        -- 'ticket' | 'tarea' | 'escalamiento' | 'no_conformidad'
  entidad_id text not null,
  autor_id uuid not null references auth.users(id) on delete cascade,
  autor_nombre text not null,
  texto text not null,
  created_at timestamptz not null default now(),
  eliminado_at timestamptz
);

create index if not exists comentarios_entidad_idx
  on bitacora.comentarios (entidad_tipo, entidad_id, created_at);

alter table bitacora.comentarios enable row level security;

drop policy if exists comentarios_select_auth on bitacora.comentarios;
create policy comentarios_select_auth on bitacora.comentarios
  for select to authenticated using (true);

drop policy if exists comentarios_insert_own on bitacora.comentarios;
create policy comentarios_insert_own on bitacora.comentarios
  for insert to authenticated with check (autor_id = auth.uid());

drop policy if exists comentarios_update_own on bitacora.comentarios;
create policy comentarios_update_own on bitacora.comentarios
  for update to authenticated using (autor_id = auth.uid()) with check (autor_id = auth.uid());

-- Sin política DELETE: el borrado es lógico vía eliminado_at, actualizado por el propio autor
-- a través de comentarios_update_own. No hay borrado físico de comentarios.
