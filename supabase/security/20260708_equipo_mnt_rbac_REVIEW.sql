-- ═══════════════════════════════════════════════════════════════════════════
-- RBAC para esquemas equipo y mantenimiento — REVISIÓN, NO EJECUTAR SIN APROBAR
-- Fecha: 2026-07-08
-- Origen: KNOWN_ISSUES.md §2.1/§2.2, BACKLOG.md #7/#8, AUDITORIA_2026-07.md §3
--
-- Qué corrige:
--   1. equipo.*: hoy cualquier usuario logueado (incluso rol 'sede' u 'operario')
--      puede leer y editar legajos, evaluaciones y sanciones de cualquier
--      empleado (política auth_all = true). Se reemplaza por el mismo patrón
--      rol+sede que ya usan las tablas de reclutamiento.
--   2. mantenimiento.*: se limita DELETE a admin/editor/mnt_editor y se
--      revocan los grants a anon (RLS ya bloquea a anon — es higiene sin
--      impacto funcional). El scoping fino por sede queda para una fase 2.
--
-- Modelo (espejo de src/lib/access.js):
--   equipo → admin/editor: todo | consultor: solo lectura |
--            grupo/encargado: lectura y escritura acotada a sus sedes |
--            sede/operario/flota/mnt_editor: sin acceso
--   mantenimiento → igual que hoy salvo DELETE (solo admin/editor/mnt_editor)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── EQUIPO ──────────────────────────────────────────────────────────────────

-- 1. personas (legajos)
DROP POLICY IF EXISTS auth_all ON equipo.personas;

CREATE POLICY personas_staff_select ON equipo.personas
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bitacora.perfiles p
    WHERE p.id = (SELECT auth.uid()) AND (
      p.rol IN ('admin','editor','consultor')
      OR (p.rol = 'grupo' AND EXISTS (
            SELECT 1 FROM bitacora.sedes s
            WHERE s.grupo_id = p.grupo_id AND s.id = ANY (personas.sede_ids)))
      OR (p.rol = 'encargado' AND personas.sede_ids && COALESCE(p.sede_ids, '{}'::integer[]))
    )
  ));

CREATE POLICY personas_staff_write ON equipo.personas
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM bitacora.perfiles p
    WHERE p.id = (SELECT auth.uid()) AND (
      p.rol IN ('admin','editor')
      OR (p.rol = 'grupo' AND EXISTS (
            SELECT 1 FROM bitacora.sedes s
            WHERE s.grupo_id = p.grupo_id AND s.id = ANY (personas.sede_ids)))
      OR (p.rol = 'encargado' AND personas.sede_ids && COALESCE(p.sede_ids, '{}'::integer[]))
    )
  ));

CREATE POLICY personas_staff_update ON equipo.personas
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bitacora.perfiles p
    WHERE p.id = (SELECT auth.uid()) AND (
      p.rol IN ('admin','editor')
      OR (p.rol = 'grupo' AND EXISTS (
            SELECT 1 FROM bitacora.sedes s
            WHERE s.grupo_id = p.grupo_id AND s.id = ANY (personas.sede_ids)))
      OR (p.rol = 'encargado' AND personas.sede_ids && COALESCE(p.sede_ids, '{}'::integer[]))
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM bitacora.perfiles p
    WHERE p.id = (SELECT auth.uid()) AND (
      p.rol IN ('admin','editor')
      OR (p.rol = 'grupo' AND EXISTS (
            SELECT 1 FROM bitacora.sedes s
            WHERE s.grupo_id = p.grupo_id AND s.id = ANY (personas.sede_ids)))
      OR (p.rol = 'encargado' AND personas.sede_ids && COALESCE(p.sede_ids, '{}'::integer[]))
    )
  ));

-- Baja física de legajos: solo admin/editor (la baja operativa es activo=false)
CREATE POLICY personas_admin_delete ON equipo.personas
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bitacora.perfiles p
    WHERE p.id = (SELECT auth.uid()) AND p.rol IN ('admin','editor')
  ));

-- 2-4. evaluaciones, historial_personal, logros_obtenidos
--     (scoping vía persona_id → personas.sede_ids; mismo patrón las tres)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['evaluaciones','historial_personal','logros_obtenidos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS auth_all ON equipo.%I', t);

    EXECUTE format($f$
      CREATE POLICY %1$s_staff_select ON equipo.%1$I
        FOR SELECT TO authenticated
        USING (EXISTS (
          SELECT 1 FROM bitacora.perfiles p
          WHERE p.id = (SELECT auth.uid()) AND (
            p.rol IN ('admin','editor','consultor')
            OR EXISTS (
              SELECT 1 FROM equipo.personas per
              WHERE per.id = %1$I.persona_id AND (
                (p.rol = 'grupo' AND EXISTS (
                   SELECT 1 FROM bitacora.sedes s
                   WHERE s.grupo_id = p.grupo_id AND s.id = ANY (per.sede_ids)))
                OR (p.rol = 'encargado' AND per.sede_ids && COALESCE(p.sede_ids, '{}'::integer[]))
              ))
          )
        ))$f$, t);

    EXECUTE format($f$
      CREATE POLICY %1$s_staff_write ON equipo.%1$I
        FOR ALL TO authenticated
        USING (EXISTS (
          SELECT 1 FROM bitacora.perfiles p
          WHERE p.id = (SELECT auth.uid()) AND (
            p.rol IN ('admin','editor')
            OR EXISTS (
              SELECT 1 FROM equipo.personas per
              WHERE per.id = %1$I.persona_id AND (
                (p.rol = 'grupo' AND EXISTS (
                   SELECT 1 FROM bitacora.sedes s
                   WHERE s.grupo_id = p.grupo_id AND s.id = ANY (per.sede_ids)))
                OR (p.rol = 'encargado' AND per.sede_ids && COALESCE(p.sede_ids, '{}'::integer[]))
              ))
          )
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM bitacora.perfiles p
          WHERE p.id = (SELECT auth.uid()) AND (
            p.rol IN ('admin','editor')
            OR EXISTS (
              SELECT 1 FROM equipo.personas per
              WHERE per.id = %1$I.persona_id AND (
                (p.rol = 'grupo' AND EXISTS (
                   SELECT 1 FROM bitacora.sedes s
                   WHERE s.grupo_id = p.grupo_id AND s.id = ANY (per.sede_ids)))
                OR (p.rol = 'encargado' AND per.sede_ids && COALESCE(p.sede_ids, '{}'::integer[]))
              ))
          )
        ))$f$, t);
  END LOOP;
END $$;

-- 5. logros_config (catálogo, sin datos personales): lectura para todos los
--    roles con acceso a Equipo, escritura solo admin/editor
DROP POLICY IF EXISTS auth_all ON equipo.logros_config;

CREATE POLICY logros_config_staff_select ON equipo.logros_config
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bitacora.perfiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.rol IN ('admin','editor','consultor','grupo','encargado')
  ));

CREATE POLICY logros_config_admin_write ON equipo.logros_config
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bitacora.perfiles p
    WHERE p.id = (SELECT auth.uid()) AND p.rol IN ('admin','editor')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM bitacora.perfiles p
    WHERE p.id = (SELECT auth.uid()) AND p.rol IN ('admin','editor')
  ));

-- ─── MANTENIMIENTO (fase 1: DELETE restringido + revocar anon) ───────────────
-- Las políticas auth_all (FOR ALL, true) se reemplazan por: SELECT/INSERT/UPDATE
-- igual que hoy (true para authenticated) y DELETE solo admin/editor/mnt_editor.
-- El scoping por sede queda para fase 2 (requiere auditar vista por vista).

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname AS tabla,
           (SELECT p.polname FROM pg_policy p WHERE p.polrelid = c.oid LIMIT 1) AS pol
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'mantenimiento' AND c.relkind = 'r'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON mantenimiento.%I', t.pol, t.tabla);

    EXECUTE format($f$
      CREATE POLICY %1$s_auth_select ON mantenimiento.%1$I
        FOR SELECT TO authenticated USING (true)$f$, t.tabla);
    EXECUTE format($f$
      CREATE POLICY %1$s_auth_insert ON mantenimiento.%1$I
        FOR INSERT TO authenticated WITH CHECK (true)$f$, t.tabla);
    EXECUTE format($f$
      CREATE POLICY %1$s_auth_update ON mantenimiento.%1$I
        FOR UPDATE TO authenticated USING (true) WITH CHECK (true)$f$, t.tabla);
    EXECUTE format($f$
      CREATE POLICY %1$s_editor_delete ON mantenimiento.%1$I
        FOR DELETE TO authenticated
        USING (EXISTS (
          SELECT 1 FROM bitacora.perfiles p
          WHERE p.id = (SELECT auth.uid())
            AND p.rol IN ('admin','editor','mnt_editor')
        ))$f$, t.tabla);
  END LOOP;
END $$;

-- Higiene: anon no tiene políticas en mantenimiento (RLS ya lo bloquea);
-- se revoca el grant para que tampoco figure como riesgo latente.
REVOKE ALL ON ALL TABLES IN SCHEMA mantenimiento FROM anon;

COMMIT;
