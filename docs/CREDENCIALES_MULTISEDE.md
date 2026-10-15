# Credenciales multisede — primera etapa

Implementación del 2026-10-14. **Migración autorizada explícitamente y aplicada en producción; frontend 2.9.15 publicado por GitHub mediante PR #152.** Proyecto único permitido: `mixyhfdlzjarvszinytk`.

## Uso

En Personal, abrir una ficha y elegir **Accesos y credencial**. Disponible para administradores activos; escritorio y mobile comparten el mismo modal. La ficha permite cargar la fotografía necesaria para emitir.

- Departamentos OPS, CAL, LOG, PRO, AER, ADM; se conservan MNT y RRHH históricos. PRO usa bordó y AER índigo. El departamento impreso puede elegirse sin cambiar el cargo ni asignar sectores por defecto. Las credenciales anteriores mantienen su área hasta reemitirlas.
- Catálogo por sede, con unicidad `(sede_id,codigo)`. La primera configuración contiene 01–08 de **Planta de Producción Córdoba** (sede 24, comprobada mediante consulta de sólo lectura). El Aeropuerto de Córdoba es otra sede (21). ZRA identifica internamente 04, 05 y 06; no es un departamento ni una clasificación oficial PSA.
- Selección individual en una o varias sedes. Ningún departamento otorga accesos automáticamente. Sin selección, se imprime «SIN SECTORES AUTORIZADOS».
- Confirmación expresa de autorización antes de emitir. Quedan conservados el administrador emisor, la fecha y la instantánea de sectores en cada emisión. La aprobación por un responsable distinto y las habilitaciones temporales quedan para la segunda etapa.
- La impresión masiva A4 conserva nueve tarjetas por hoja, con dorsos espejados; cuenta una tarjeta por sede y comprueba la vigencia antes de generar.
- Un PDF CR80 de **dos páginas por sede** (frente/dorso) para evitar números sin contexto. Todos los pares de la misma emisión comparten el QR. El selector de vista previa permite revisar cada sede. No se permite descargar con cambios sin guardar/reemitir.
- Cambios de departamento o sectores requieren reemisión; datos opcionales y encuadre pueden guardarse por separado. Reemitir invalida el QR previo y crea el nuevo en una sola transacción; si falla, se conserva la emisión previa. Dos administradores con la misma versión no pueden sobrescribirse silenciosamente.
- QR público: sólo consulta por token aleatorio. Muestra estado, nombre, cargo, empresa, vencimiento, departamento y sectores vigentes por sede. Contacto únicamente si se comparte. No expone DNI, foto ni identidad del aprobador. Extravío, anulación, baja o vencimiento impiden mostrar accesos válidos.
- Desactivar un sector o una sede lo retira de la consulta vigente; la instantánea histórica permanece. La credencial impresa siempre debe verificarse mediante QR.

## SQL aplicado con autorización

`supabase/migrations/20261014180409_credenciales_multisede_REVIEW.sql`:

1. Amplía el CHECK de `personas.functional_area` con `production` y `airports`.
2. Crea `equipo.credencial_sectores` y carga los ocho sectores de Córdoba. No asigna permisos a ninguna persona.
3. Agrega instantánea de sectores y confirmación individual a las credenciales existentes, con valores vacíos por defecto.
4. Habilita RLS en el catálogo y permite SELECT sólo a administradores activos autenticados. No concede escritura del catálogo desde la API.
5. Crea un trigger de integridad: sectores válidos/activos, instantánea generada en servidor, autorización inmutable y prohibición de reactivar una credencial invalidada.
6. Crea `emitir_credencial_multisede` como SECURITY INVOKER, con comprobación explícita de admin y RLS existentes. Sólo `authenticated` tiene EXECUTE; el rol por sí solo no permite emitir.
7. Crea `verificar_credencial_multisede` como SECURITY DEFINER para la consulta pública acotada al token. EXECUTE para `anon` y `authenticated`; sin permisos de lectura directa sobre las tablas. Actualiza la función anterior conservando su firma y permisos.

Aplicado el 2026-10-14 mediante `apply_migration`, nombre `credenciales_multisede`, tras autorización explícita del usuario conforme AGENTS.md §0.3. No volver a ejecutar este archivo: crea objetos que ya existen. Frontend publicado desde main, commit 569638c, con checks aprobados. No hace falta reemitir las credenciales antiguas para que sigan validando; permanecerán sin sectores hasta su asignación individual.

Verificación posterior en producción (sólo lectura): 8 sectores en sede 24, ZRA 04–06; 178 credenciales conservadas y 0 con sectores asignados; ambas funciones QR devuelven las 178 filas existentes. RLS habilitado, sin SELECT del catálogo ni emisión para anon, sin escritura del catálogo para authenticated. Simulación de admin en transacción de sólo lectura: 8 sectores visibles; consulta anon con token inexistente: 0 filas.

El asesor de seguridad señala EXECUTE público y autenticado en la nueva función SECURITY DEFINER de verificación. Es intencional y forma parte del SQL aprobado: permite validar el QR sin login, exclusivamente por token aleatorio y con campos acotados, sin lectura directa de tablas. Referencias: [linter 0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) y [linter 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Para incorporar otra sede, preparar un INSERT al catálogo con su ID verificado y sus propios códigos/nombres; no copiar automáticamente la matriz de Córdoba. La administración visual del catálogo y las matrices/plantillas se dejan para la etapa de seguridad administrativa.

## Verificación reproducible

- `npm run test -- src/lib/credentialAreas.test.js src/lib/credentialAccess.test.js`.
- `node scripts/verify-credential-migration.mjs <ruta-a-@electric-sql/pglite/dist/index.js>` usa una base WASM efímera. Comprueba migraciones, admin/consultor/anon, separación de sedes, rollback ante error, versión anterior obsoleta, baja, sector desactivado y extravío. No conecta con Supabase.
- `node scripts/verify-credential-browser.mjs <ruta-a-playwright/index.mjs>` compila un fixture con datos ficticios y bloquea las conexiones externas. Usa Edge headless. Prueba selección, emisión simulada, PDF, consulta QR, desktop/mobile, cambios pendientes y consultor. Artefactos en `tmp/credential-qa/`; no se incluyen en el build normal.
- `npm run build` para el build normal. Las advertencias existentes del módulo `docx`/`buffer` no bloquean la compilación.

Backup previo en `backups/credenciales-multisede-20261014/`. Verificación pública posterior: https://bitacora-dashboard.vercel.app sirve 2.9.15; el QR consulta el proyecto correcto, rechaza un token inexistente y no genera errores JavaScript. Prueba de sólo lectura, sin emitir credenciales reales. La base ya fue verificada por consultas de sólo lectura. No hay integración de puertas, lectores, biometría ni capacitación AVSEC en esta etapa.

