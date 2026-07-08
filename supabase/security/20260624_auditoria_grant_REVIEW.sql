-- REVIEW ONLY - NO EJECUTAR SIN APROBACION EXPLICITA DEL USUARIO
-- Proyecto destino exclusivo: mixyhfdlzjarvszinytk (cerdova-db).
--
-- BUG: la pantalla "Trazabilidad" del dashboard (AuditoriaView.jsx) siempre
-- muestra "Sin registros", aun habiendo 1298+ eventos reales en
-- bitacora.auditoria (confirmado por consulta directa a la base).
--
-- CAUSA CONFIRMADA: bitacora.auditoria solo tiene GRANT de SELECT para
-- "postgres" y "service_role". El rol "authenticated" (con el que corre
-- cualquier usuario logueado vía anon key + sesión) NO tiene grant alguno.
-- La vista pública v_auditoria sí tiene grants para "authenticated", pero
-- eso no alcanza: al consultarla, Postgres revisa también los permisos
-- sobre la tabla de base (bitacora.auditoria) y devuelve:
--   ERROR 42501: permission denied for table auditoria
-- AuditoriaView.jsx atrapa ese error en el catch y lo único que hace es
-- loguearlo en consola (consola del navegador, invisible para el usuario)
-- dejando "rows" vacío → pantalla en blanco sin ningún aviso.
--
-- La política RLS "Admins ven auditoria" (solo rol admin/superadmin) sigue
-- vigente sin cambios: este GRANT no abre la tabla a cualquier usuario,
-- solo permite que el motor de permisos llegue a evaluar esa política.

grant select on table bitacora.auditoria to authenticated;

-- No se otorga insert/update/delete: el registro de auditoría lo escribe
-- únicamente la función/trigger del sistema (policy "Sistema inserta
-- auditoria", with_check true, ya vigente y sin cambios).
