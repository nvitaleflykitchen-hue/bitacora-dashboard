-- REVIEW ONLY - NO EJECUTAR SIN APROBACION EXPLICITA DEL USUARIO
-- Proyecto destino exclusivo: mixyhfdlzjarvszinytk (cerdova-db).
-- Habilita acceso de "authenticated" a las dos tablas nuevas creadas en la
-- Tarea #16 (bitacora.vehiculo_novedades, bitacora.persona_novedades), que
-- hoy NO tienen ningún grant para anon/authenticated (solo postgres y
-- service_role pueden tocarlas) ni RLS habilitado. Sin esto, MobileReporte.jsx
-- no puede insertar/leer estas novedades con la anon key + sesión de usuario.
--
-- Replica exactamente el patrón ya vigente en bitacora.escalamientos:
--   - GRANT select, insert, update a "authenticated" (nunca a "anon", nunca delete).
--   - RLS habilitado con 4 policies: lectura por sede asignada, lectura por
--     rol de staff, insert solo para roles de staff activos, update solo
--     para roles de staff con permiso de edición.

-- ── 1. Grants ────────────────────────────────────────────────────────────
grant select, insert, update on table bitacora.vehiculo_novedades to authenticated;
grant select, insert, update on table bitacora.persona_novedades  to authenticated;

-- ── 2. RLS ───────────────────────────────────────────────────────────────
alter table bitacora.vehiculo_novedades enable row level security;
alter table bitacora.persona_novedades  enable row level security;

-- ── 3. Policies: vehiculo_novedades (mismo patrón que escalamientos) ────
create policy sede_read_veh on bitacora.vehiculo_novedades
  for select to public
  using (
    exists (
      select 1 from bitacora.perfiles
      where perfiles.id = auth.uid()
        and perfiles.sede_ids @> array[vehiculo_novedades.sede_id::integer]
    )
  );

create policy staff_read_veh on bitacora.vehiculo_novedades
  for select to public
  using (
    exists (
      select 1 from bitacora.perfiles
      where perfiles.id = auth.uid()
        and perfiles.rol = any (array['admin','editor','encargado','consultor','grupo','viewer'])
    )
  );

create policy staff_insert_veh on bitacora.vehiculo_novedades
  for insert to authenticated
  with check (
    exists (
      select 1 from bitacora.perfiles p
      where p.id = auth.uid()
        and p.activo = true
        and p.rol = any (array['admin','editor','grupo','encargado','sede'])
    )
  );

create policy staff_update_veh on bitacora.vehiculo_novedades
  for update to public
  using (
    exists (
      select 1 from bitacora.perfiles
      where perfiles.id = auth.uid()
        and perfiles.rol = any (array['admin','editor','encargado'])
    )
  );

-- ── 4. Policies: persona_novedades (idéntico patrón) ────────────────────
create policy sede_read_per on bitacora.persona_novedades
  for select to public
  using (
    exists (
      select 1 from bitacora.perfiles
      where perfiles.id = auth.uid()
        and perfiles.sede_ids @> array[persona_novedades.sede_id::integer]
    )
  );

create policy staff_read_per on bitacora.persona_novedades
  for select to public
  using (
    exists (
      select 1 from bitacora.perfiles
      where perfiles.id = auth.uid()
        and perfiles.rol = any (array['admin','editor','encargado','consultor','grupo','viewer'])
    )
  );

create policy staff_insert_per on bitacora.persona_novedades
  for insert to authenticated
  with check (
    exists (
      select 1 from bitacora.perfiles p
      where p.id = auth.uid()
        and p.activo = true
        and p.rol = any (array['admin','editor','grupo','encargado','sede'])
    )
  );

create policy staff_update_per on bitacora.persona_novedades
  for update to public
  using (
    exists (
      select 1 from bitacora.perfiles
      where perfiles.id = auth.uid()
        and perfiles.rol = any (array['admin','editor','encargado'])
    )
  );
