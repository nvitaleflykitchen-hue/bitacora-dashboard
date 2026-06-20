# CODEX HANDOFF GAPS

## Vacíos que impiden una toma de control segura

### Entornos y accesos

- No existe staging. El `.env.local` activo apunta al proyecto productivo `mixyhfdlzjarvszinytk`.
- No hay cuentas de prueba por rol ni dataset aislado documentado.
- No está confirmado si `mantenimiento` y `equipo` están expuestos en PostgREST.
- No está confirmado el estado del deploy Vercel ni sus variables de entorno.
- No está identificado el consumidor de `bitacora-ingest` ni su contrato operativo.
- No hay objetivo concreto de Google Drive/Sheets/Form (URL, ID o carpeta) para auditar la integración externa sin adivinar.

### Fuentes de verdad faltantes

- No hay repositorio Git, historial, tags, ramas ni mecanismo de rollback.
- No existen migraciones Supabase en el proyecto local.
- No existe el código fuente local de `invite-user`, `admin-user-actions` ni `bitacora-ingest`.
- La copia anidada es divergente: 32/38 archivos difieren y no debe considerarse backup.
- No hay inventario versionado de configuración de Auth, Storage, exposed schemas, secrets o settings de Edge Functions.

### Reglas de negocio pendientes

- Significado de `tareas.categoria` A-H.
- Estado real del corte Google Form → captura directa en app.
- Estado real del onboarding de operadores.
- Estado y alcance de la segunda ronda de backfill de Comedores/Hospitales.
- Matriz aprobada de permisos por rol, sede, módulo y operación.
- Política de acceso a RRHH, adjuntos y datos compartidos con la otra aplicación alojada en `public`.

### Verificación incompleta

- El build está verificado, pero no hay pruebas de comportamiento.
- No se ejecutó login ni navegación porque usaría producción.
- No se probaron escrituras, triggers, RLS, Storage ni Edge Functions.
- No se verificó la paridad funcional entre desktop y mobile.
- No se cruzaron todavía todas las columnas usadas en cada select/insert/update contra el esquema actual.
- No se auditó vista por vista el filtrado con `allowedSedeIds`.
- El escaneo estático detecta componentes con acceso a datos sin `useAuth`, pero hace falta revisar cada flujo antes de declarar un bypass concreto.

## Contradicciones documentales a resolver

1. `PROJECT_STATUS.md` describe acceso indirecto exclusivo a mantenimiento/RRHH; `ARCHITECTURE.md`, `API.md` y el código prueban acceso mixto.
2. `TEST_REPORT.md` deja el build como no certificado; la auditoría actual lo certificó localmente.
3. Las versiones presentadas como stack efectivo son, en varios casos, mínimos declarados y no las versiones resueltas por el lockfile.
4. Los conteos de líneas y algunos conteos de residuos difieren entre documentos; deben explicitar método y fecha.
5. Algunas afirmaciones de “operativo” provienen de observación/documentación previa y no de pruebas reproducibles actuales.

## Decisiones requeridas del responsable

- Autorizar o rechazar la preparación y posterior ejecución del SQL de `staff_insert_esc`.
- Definir si primero se prioriza continuidad operativa o cierre integral de escalación de privilegios; ambos son P0.
- Aprobar una estrategia de staging antes de pruebas funcionales con escrituras.
- Definir responsable y repositorio para código, migraciones y Edge Functions.
- Confirmar quién puede aprobar cambios de permisos y quién ejecutará SQL en producción.
- Aclarar si las 11 tablas ajenas en `public` deben permanecer en el mismo proyecto.

## Estado del traspaso

La arquitectura local, el build y los riesgos documentados están suficientemente entendidos para planificar. El proyecto **no está suficientemente controlado para implementar con seguridad** hasta contar con versionado/backup y un mecanismo aprobado para validar permisos sin experimentar sobre producción.
