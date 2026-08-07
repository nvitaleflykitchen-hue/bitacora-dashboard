-- Alinea las políticas de escritura con los permisos de Calidad en la app:
-- responsables de sede operan únicamente las sedes ya asignadas.
begin;

drop policy capacitaciones_insert on bitacora.capacitaciones;
drop policy capacitaciones_update on bitacora.capacitaciones;
drop policy capacitacion_asistentes_insert on bitacora.capacitacion_asistentes;
drop policy capacitacion_asistentes_update on bitacora.capacitacion_asistentes;

create policy capacitaciones_insert on bitacora.capacitaciones for insert to authenticated
with check (bitacora.puede_responder_auditoria_sede(sede_id));

create policy capacitaciones_update on bitacora.capacitaciones for update to authenticated
using (bitacora.puede_responder_auditoria_sede(sede_id))
with check (bitacora.puede_responder_auditoria_sede(sede_id));

create policy capacitacion_asistentes_insert on bitacora.capacitacion_asistentes for insert to authenticated
with check (exists (
  select 1 from bitacora.capacitaciones c
  where c.id = capacitacion_id
    and bitacora.puede_responder_auditoria_sede(c.sede_id)
));

create policy capacitacion_asistentes_update on bitacora.capacitacion_asistentes for update to authenticated
using (exists (
  select 1 from bitacora.capacitaciones c
  where c.id = capacitacion_id
    and bitacora.puede_responder_auditoria_sede(c.sede_id)
))
with check (exists (
  select 1 from bitacora.capacitaciones c
  where c.id = capacitacion_id
    and bitacora.puede_responder_auditoria_sede(c.sede_id)
));

commit;
