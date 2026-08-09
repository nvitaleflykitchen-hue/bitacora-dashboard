-- REVISAR Y APROBAR ANTES DE EJECUTAR.
-- Las capacitaciones pendientes conservan el flujo vigente por sede.
-- Una capacitación realizada y sus asistentes sólo pueden modificarse por admin activo.

begin;

drop policy if exists capacitaciones_update on bitacora.capacitaciones;
drop policy if exists capacitacion_asistentes_insert on bitacora.capacitacion_asistentes;
drop policy if exists capacitacion_asistentes_update on bitacora.capacitacion_asistentes;

create policy capacitaciones_update on bitacora.capacitaciones
for update to authenticated
using (
  bitacora.puede_responder_auditoria_sede(sede_id)
  and (
    estado <> 'realizada'
    or exists (
      select 1 from bitacora.perfiles p
      where p.id = (select auth.uid()) and p.activo is true and p.rol = 'admin'
    )
  )
)
with check (
  -- WITH CHECK evalúa la fila nueva. Se conserva el alcance territorial para
  -- que un gestor autorizado pueda finalizar una capacitación pendiente.
  -- El USING anterior evalúa la fila vieja y bloquea correcciones posteriores.
  bitacora.puede_responder_auditoria_sede(sede_id)
);

create policy capacitacion_asistentes_insert on bitacora.capacitacion_asistentes
for insert to authenticated
with check (exists (
  select 1 from bitacora.capacitaciones c
  where c.id = capacitacion_id
    and bitacora.puede_responder_auditoria_sede(c.sede_id)
    and (
      c.estado <> 'realizada'
      or exists (
        select 1 from bitacora.perfiles p
        where p.id = (select auth.uid()) and p.activo is true and p.rol = 'admin'
      )
    )
));

create policy capacitacion_asistentes_update on bitacora.capacitacion_asistentes
for update to authenticated
using (exists (
  select 1 from bitacora.capacitaciones c
  where c.id = capacitacion_id
    and bitacora.puede_responder_auditoria_sede(c.sede_id)
    and (
      c.estado <> 'realizada'
      or exists (
        select 1 from bitacora.perfiles p
        where p.id = (select auth.uid()) and p.activo is true and p.rol = 'admin'
      )
    )
))
with check (exists (
  select 1 from bitacora.capacitaciones c
  where c.id = capacitacion_id
    and bitacora.puede_responder_auditoria_sede(c.sede_id)
    and (
      c.estado <> 'realizada'
      or exists (
        select 1 from bitacora.perfiles p
        where p.id = (select auth.uid()) and p.activo is true and p.rol = 'admin'
      )
    )
));

commit;
