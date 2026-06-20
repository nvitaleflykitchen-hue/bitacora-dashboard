# Revisión de seguridad pendiente de autorización

El SQL propuesto está en `supabase/security/20260620_access_hardening_REVIEW.sql`. No forma parte de `supabase/migrations` y no fue ejecutado.

## Efecto esperado

- Elimina acceso anónimo a `bitacora.perfiles`.
- Un usuario autenticado solo puede leer y editar datos no sensibles de su propio perfil; rol, sedes, grupo, activo e identidad quedan reservados a administradores.
- Corrige la política de escalamientos para los seis roles reales en minúscula.
- Retira tres políticas amplias de `bitacora.registros`; permanecen las políticas angostas existentes por rol y sede.

## Revisión obligatoria antes de aplicar

1. Confirmar en `mixyhfdlzjarvszinytk` los nombres y definiciones actuales de todas las políticas.
2. Ejecutar el SQL dentro de una transacción de prueba y terminar con `ROLLBACK`.
3. Probar `anon`, `consultor`, `sede`, `encargado`, `grupo`, `editor` y `admin`.
4. Revisar por separado Storage y las tablas abiertas de tareas, compras, calidad, mantenimiento y equipo. No se incluyeron todavía porque requieren una matriz completa por tabla y bucket.
5. Aplicar únicamente después de aprobación explícita del usuario.
