-- REVIEW ONLY - NO EJECUTAR SIN APROBACION EXPLICITA DEL USUARIO
-- Proyecto destino exclusivo: mixyhfdlzjarvszinytk (cerdova-db).
-- Habilita acceso de "authenticated" a la tabla nueva creada en la
-- Tarea #22 (bitacora.modulo_novedades), que hoy NO tiene ningún grant
-- para anon/authenticated (solo postgres y service_role pueden tocarla)
-- ni RLS habilitado. Sin esto, MobileReporte.jsx no puede insertar/leer
-- estas novedades de módulo con la anon key + sesión de usuario.
--
-- Replica exactamente el mismo patrón ya aplicado en
-- 20260624_vehiculo_persona_novedades_grants_REVIEW.sql (a su vez tomado
-- de bitacora.escalamientos):
--   - GRANT select, insert, update a "authenticated" (nunca a "anon", nunca delete).
--   - RLS habilitado con 4 policies: lectura por sede asignada, lectura por
--     rol de staff, insert solo para roles de staff activos, update solo
--     para roles de staff con permiso de edición.

-- ── 1. Grants ────────────────────────────────────────────────────────────
grant select, insert, update on table bitacora.modulo_novedades to authenticated;

-- ── 2. RLS ───────────────────────────────────────────────────────────────
alter table bitacora.modulo_novedades enable row level security;

-- ── 3. Policies (mismo patrón que vehiculo_novedades/persona_novedades) ──
create policy sede_read_mod on bitacora.modulo_novedades
  for select to public
  using (
    exists (
      select 1 from bitacora.perfiles
      where perfiles.id = auth.uid()
        and perfiles.sede_ids @> array[modulo_novedades.sede_id::integer]
    )
  );

create policy staff_read_mod on bitacora.modulo_novedades
  for select to public
  using (
    exists (
      select 1 from bitacora.perfiles
      where perfiles.id = auth.uid()
        and perfiles.rol = any (array['admin','editor','encargado','consultor','grupo','viewer'])
    )
  );

create policy staff_insert_mod on bitacora.modulo_novedades
  for insert to authenticated
  with check (
    exists (
      select 1 from bitacora.perfiles p
      where p.id = auth.uid()
        and p.activo = true
        and p.rol = any (array['admin','editor','grupo','encargado','sede'])
    )
  );

create policy staff_update_mod on bitacora.modulo_novedades
  for update to public
  using (
    exists (
      select 1 from bitacora.perfiles
      where perfiles.id = auth.uid()
        and perfiles.rol = any (array['admin','editor','encargado'])
    )
  );
