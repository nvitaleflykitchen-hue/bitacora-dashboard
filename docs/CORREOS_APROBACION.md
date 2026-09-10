# Fuente de la aprobación de permisos

El archivo `AGENTS.md` está borrado en el árbol de trabajo al 2026-09-10.
Se consultó su versión registrada mediante `git show HEAD:AGENTS.md` antes de
implementar la integración de correos. Su sección 0, regla 3, dice:

> Nunca aplique cambios de `GRANT`/`RLS`/políticas de seguridad directo en la base sin mostrar el SQL al usuario primero y esperar confirmación explícita.

La propuesta concreta está en `supabase/security/correo_evidencias_REVIEW.sql`.
Se probó en PostgreSQL aislado y se aplicó a Supabase el 2026-09-10 tras la
autorización explícita del usuario («si autorizo»). Incluye:

- Tablas de buzones, miembros, correos e historial con RLS.
- Acceso inicial exclusivo de Nicolás Vitale, usuario verificado en la base.
- Un bucket privado de originales y adjuntos, accesible por pertenencia al buzón.
- Permiso de cambiar sólo vínculo y estado; los originales no son editables.
- Auditoría de asociaciones y correcciones. Sin cambios de estado en gestiones.
- Ninguna alteración de políticas de seguridad existentes.

Proyecto autorizado: `mixyhfdlzjarvszinytk`.

Verificación posterior: las cuatro tablas tienen RLS, el bucket es privado,
`anon` no puede leer y `authenticated` sólo puede actualizar vínculo/estado.
Se comprobó lectura y revisión del propietario, auditoría y denegación a otro
usuario mediante una transacción terminada en ROLLBACK, sin persistir datos de
prueba. El asesor de seguridad no informó hallazgos con referencia a los nuevos
objetos de correos. Todavía no se importaron correos reales.
