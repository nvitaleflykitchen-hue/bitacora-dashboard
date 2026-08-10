drop policy if exists id_proyectos_select on bitacora.id_proyectos;
create policy id_proyectos_select on bitacora.id_proyectos
for select to authenticated
using (
  created_by = (select auth.uid())
  or responsable_id = (select auth.uid())
  or bitacora_private.id_puede_acceder(id, false)
);
