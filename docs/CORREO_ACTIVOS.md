# Vinculación de correos a activos

Implementación preparada sobre origin/main v2.9.22.

- En Revisar correo, la pestaña Activos muestra equipos e instalaciones; Vehículos conserva su destino actual.
- Búsqueda por código interno, nombre, marca, modelo, serie, sede, estado o responsable.
- El vínculo manual usa `bitacora.correos.activo_id` (UUID/FK a mantenimiento.activos) y mantiene las personas adicionales.
- La ficha del activo muestra Correos vinculados en Documentos / Manuales, con los permisos del buzón existentes.
- El historial del correo registra el activo anterior y el nuevo. No se cambia el clasificador automático de correo.
- No existe un selector de vínculos independiente en el árbol mobile; los usos compartidos de Correos reciben el mismo catálogo.

## Activación pendiente

El esquema de producción se consultó de forma solo lectura el 2026-10-19 en mixyhfdlzjarvszinytk. No tiene activo_id. La política y la función de auditoría usadas como base coinciden con la versión de multipersona.

1. Obtener aprobación explícita del SQL `supabase/security/correo_activos_REVIEW.sql` (AGENTS.md §0.3).
2. Verificar con transacciones revertidas: revisor habilitado guarda un activo visible; miembro sin revisión y no miembro no lo hacen; activo inexistente/vehículo y destinos simultáneos se rechazan; personas adicionales y auditoría se conservan.
3. Aplicar el SQL aprobado y publicar el frontend mediante el PR. No publicar este frontend antes del SQL: requiere la nueva columna.
4. Revisar en la interfaz un vínculo autorizado, recargar, consultar la ficha del activo y verificar el historial. No usar datos de prueba persistentes en producción.

El SQL fue aplicado con autorización. No se conservaron modificaciones de datos de negocio durante las pruebas.

## Verificación posterior (2026-10-19)

SQL autorizado y aplicado en mixyhfdlzjarvszinytk. Prueba real con rol authenticated dentro de BEGIN/ROLLBACK: revisor admin vincula un activo y genera historial con actor; vehículo en activo_id rechazado por RLS; dos destinos rechazados por CHECK; no miembro actualiza cero filas. Todos los cambios de prueba revertidos. Pendiente integrar/publicar el frontend del PR #161.
