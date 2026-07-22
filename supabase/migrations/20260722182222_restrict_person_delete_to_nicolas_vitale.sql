grant delete on table equipo.personas to authenticated;

drop policy if exists personas_admin_delete
on equipo.personas;

create policy personas_nicolas_delete
on equipo.personas
for delete
to authenticated
using (
  (select auth.uid()) =
  '626b2a44-be84-4b3e-a03f-505eaf9d195e'::uuid
);
