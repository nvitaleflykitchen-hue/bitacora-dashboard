-- Sólo los administradores pueden retirar validaciones cargadas por error o prueba.
-- La interfaz pide confirmación y el resto de los roles no recibe permiso DELETE.

drop policy if exists id_validaciones_delete_admin on bitacora.id_validaciones;

create policy id_validaciones_delete_admin
on bitacora.id_validaciones
for delete
to authenticated
using (
  exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and p.activo = true
      and p.rol = 'admin'
  )
);

grant delete on bitacora.id_validaciones to authenticated;
