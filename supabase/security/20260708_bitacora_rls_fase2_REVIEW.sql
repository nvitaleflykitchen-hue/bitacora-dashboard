-- ═══════════════════════════════════════════════════════════════════════════
-- RLS bitácora fase 2 — REVISIÓN, NO EJECUTAR SIN APROBAR
-- Fecha: 2026-07-08 · Origen: KNOWN_ISSUES §2.4, BACKLOG #9
--
-- Qué corrige (verificado en vivo):
--   · anon puede BORRAR adjuntos, editar tareas y contactos
--   · capa, no_conformidades y sede_contactos 100% abiertas incluso a anon
--   · cualquier autenticado puede editar sedes (alta/baja es admin-only en la UI)
--
-- Modelo (espejo de src/lib/access.js):
--   admin/editor → todo | consultor → solo lectura |
--   grupo/encargado → lectura y escritura acotada a sus sedes |
--   sede → solo lectura de lo suyo | anon → nada | DELETE → admin/editor
--   (adjuntos: además puede borrar quien lo subió)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Helpers inline (mismo patrón que equipo/reclutamiento):
--   staff:    p.rol IN ('admin','editor')
--   lectura:  staff OR consultor OR grupo(sede del grupo) OR encargado/sede(sede_ids)
--   gestión:  staff OR grupo/encargado scoped

-- ─── 1. capa ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS all_capa ON bitacora.capa;

CREATE POLICY capa_select ON bitacora.capa FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND (
  p.rol IN ('admin','editor','consultor')
  OR (p.rol = 'grupo' AND EXISTS (SELECT 1 FROM bitacora.sedes s WHERE s.grupo_id = p.grupo_id AND s.id = capa.sede_id))
  OR (p.rol IN ('encargado','sede') AND capa.sede_id = ANY (COALESCE(p.sede_ids,'{}'::integer[])))
)));

CREATE POLICY capa_write ON bitacora.capa FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND (
  p.rol IN ('admin','editor')
  OR (p.rol = 'grupo' AND EXISTS (SELECT 1 FROM bitacora.sedes s WHERE s.grupo_id = p.grupo_id AND s.id = capa.sede_id))
  OR (p.rol = 'encargado' AND capa.sede_id = ANY (COALESCE(p.sede_ids,'{}'::integer[])))
)));

CREATE POLICY capa_update ON bitacora.capa FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND (
  p.rol IN ('admin','editor')
  OR (p.rol = 'grupo' AND EXISTS (SELECT 1 FROM bitacora.sedes s WHERE s.grupo_id = p.grupo_id AND s.id = capa.sede_id))
  OR (p.rol = 'encargado' AND capa.sede_id = ANY (COALESCE(p.sede_ids,'{}'::integer[])))
)))
WITH CHECK (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND (
  p.rol IN ('admin','editor')
  OR (p.rol = 'grupo' AND EXISTS (SELECT 1 FROM bitacora.sedes s WHERE s.grupo_id = p.grupo_id AND s.id = capa.sede_id))
  OR (p.rol = 'encargado' AND capa.sede_id = ANY (COALESCE(p.sede_ids,'{}'::integer[])))
)));

CREATE POLICY capa_delete ON bitacora.capa FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND p.rol IN ('admin','editor')));

-- ─── 2. no_conformidades (idéntico a capa) ──────────────────────────────────
DROP POLICY IF EXISTS all_no_conformidades ON bitacora.no_conformidades;

CREATE POLICY nc_select ON bitacora.no_conformidades FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND (
  p.rol IN ('admin','editor','consultor')
  OR (p.rol = 'grupo' AND EXISTS (SELECT 1 FROM bitacora.sedes s WHERE s.grupo_id = p.grupo_id AND s.id = no_conformidades.sede_id))
  OR (p.rol IN ('encargado','sede') AND no_conformidades.sede_id = ANY (COALESCE(p.sede_ids,'{}'::integer[])))
)));

CREATE POLICY nc_write ON bitacora.no_conformidades FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND (
  p.rol IN ('admin','editor')
  OR (p.rol = 'grupo' AND EXISTS (SELECT 1 FROM bitacora.sedes s WHERE s.grupo_id = p.grupo_id AND s.id = no_conformidades.sede_id))
  OR (p.rol = 'encargado' AND no_conformidades.sede_id = ANY (COALESCE(p.sede_ids,'{}'::integer[])))
)));

CREATE POLICY nc_update ON bitacora.no_conformidades FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND (
  p.rol IN ('admin','editor')
  OR (p.rol = 'grupo' AND EXISTS (SELECT 1 FROM bitacora.sedes s WHERE s.grupo_id = p.grupo_id AND s.id = no_conformidades.sede_id))
  OR (p.rol = 'encargado' AND no_conformidades.sede_id = ANY (COALESCE(p.sede_ids,'{}'::integer[])))
)))
WITH CHECK (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND (
  p.rol IN ('admin','editor')
  OR (p.rol = 'grupo' AND EXISTS (SELECT 1 FROM bitacora.sedes s WHERE s.grupo_id = p.grupo_id AND s.id = no_conformidades.sede_id))
  OR (p.rol = 'encargado' AND no_conformidades.sede_id = ANY (COALESCE(p.sede_ids,'{}'::integer[])))
)));

CREATE POLICY nc_delete ON bitacora.no_conformidades FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND p.rol IN ('admin','editor')));

-- ─── 3. tareas ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS read_tareas ON bitacora.tareas;
DROP POLICY IF EXISTS insert_tareas ON bitacora.tareas;
DROP POLICY IF EXISTS update_tareas ON bitacora.tareas;

CREATE POLICY tareas_select ON bitacora.tareas FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND (
  p.rol IN ('admin','editor','consultor')
  OR (p.rol = 'grupo' AND EXISTS (SELECT 1 FROM bitacora.sedes s WHERE s.grupo_id = p.grupo_id AND s.id = tareas.sede_id))
  OR (p.rol IN ('encargado','sede') AND tareas.sede_id = ANY (COALESCE(p.sede_ids,'{}'::integer[])))
)));

CREATE POLICY tareas_write ON bitacora.tareas FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND (
  p.rol IN ('admin','editor')
  OR (p.rol = 'grupo' AND EXISTS (SELECT 1 FROM bitacora.sedes s WHERE s.grupo_id = p.grupo_id AND s.id = tareas.sede_id))
  OR (p.rol = 'encargado' AND tareas.sede_id = ANY (COALESCE(p.sede_ids,'{}'::integer[])))
)));

CREATE POLICY tareas_update ON bitacora.tareas FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND (
  p.rol IN ('admin','editor')
  OR (p.rol = 'grupo' AND EXISTS (SELECT 1 FROM bitacora.sedes s WHERE s.grupo_id = p.grupo_id AND s.id = tareas.sede_id))
  OR (p.rol = 'encargado' AND tareas.sede_id = ANY (COALESCE(p.sede_ids,'{}'::integer[])))
)))
WITH CHECK (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND (
  p.rol IN ('admin','editor')
  OR (p.rol = 'grupo' AND EXISTS (SELECT 1 FROM bitacora.sedes s WHERE s.grupo_id = p.grupo_id AND s.id = tareas.sede_id))
  OR (p.rol = 'encargado' AND tareas.sede_id = ANY (COALESCE(p.sede_ids,'{}'::integer[])))
)));

CREATE POLICY tareas_delete ON bitacora.tareas FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND p.rol IN ('admin','editor')));

-- ─── 4. contactos (directorio global) ───────────────────────────────────────
DROP POLICY IF EXISTS read_contactos ON bitacora.contactos;
DROP POLICY IF EXISTS insert_contactos ON bitacora.contactos;
DROP POLICY IF EXISTS update_contactos ON bitacora.contactos;

CREATE POLICY contactos_select ON bitacora.contactos FOR SELECT TO authenticated USING (true);

CREATE POLICY contactos_write ON bitacora.contactos FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND p.rol IN ('admin','editor','grupo','encargado')));

CREATE POLICY contactos_update ON bitacora.contactos FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND p.rol IN ('admin','editor','grupo','encargado')))
WITH CHECK (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND p.rol IN ('admin','editor','grupo','encargado')));

CREATE POLICY contactos_delete ON bitacora.contactos FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND p.rol IN ('admin','editor')));

-- ─── 5. sede_contactos ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS allow_all_sede_contactos ON bitacora.sede_contactos;

CREATE POLICY sede_contactos_select ON bitacora.sede_contactos FOR SELECT TO authenticated USING (true);

CREATE POLICY sede_contactos_write ON bitacora.sede_contactos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND (
  p.rol IN ('admin','editor')
  OR (p.rol = 'grupo' AND EXISTS (SELECT 1 FROM bitacora.sedes s WHERE s.grupo_id = p.grupo_id AND s.id = sede_contactos.sede_id))
  OR (p.rol = 'encargado' AND sede_contactos.sede_id = ANY (COALESCE(p.sede_ids,'{}'::integer[])))
)))
WITH CHECK (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND (
  p.rol IN ('admin','editor')
  OR (p.rol = 'grupo' AND EXISTS (SELECT 1 FROM bitacora.sedes s WHERE s.grupo_id = p.grupo_id AND s.id = sede_contactos.sede_id))
  OR (p.rol = 'encargado' AND sede_contactos.sede_id = ANY (COALESCE(p.sede_ids,'{}'::integer[])))
)));

-- ─── 6. sedes ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS read_sedes ON bitacora.sedes;
DROP POLICY IF EXISTS write_sedes ON bitacora.sedes;

CREATE POLICY sedes_select ON bitacora.sedes FOR SELECT TO authenticated USING (true);

CREATE POLICY sedes_write ON bitacora.sedes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND p.rol IN ('admin','editor')))
WITH CHECK (EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND p.rol IN ('admin','editor')));

-- ─── 7. adjuntos ─────────────────────────────────────────────────────────────
-- select/insert pasan a authenticated; delete a staff o quien lo subió.
DROP POLICY IF EXISTS adjuntos_select ON bitacora.adjuntos;
DROP POLICY IF EXISTS adjuntos_insert ON bitacora.adjuntos;
DROP POLICY IF EXISTS adjuntos_delete ON bitacora.adjuntos;

CREATE POLICY adjuntos_select_auth ON bitacora.adjuntos FOR SELECT TO authenticated USING (true);

-- Adjuntar evidencia es parte del flujo de reporte de TODOS los roles
CREATE POLICY adjuntos_insert_auth ON bitacora.adjuntos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY adjuntos_delete_auth ON bitacora.adjuntos FOR DELETE TO authenticated
USING (
  uploaded_by = (SELECT auth.uid())::text
  OR EXISTS (SELECT 1 FROM bitacora.perfiles p WHERE p.id = (SELECT auth.uid()) AND p.rol IN ('admin','editor'))
);

COMMIT;
