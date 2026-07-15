# PROJECT_STATUS — Fly Gestión (Fly Kitchen)

> Última verificación: 2026-06-17. Todo lo indicado en este documento fue confirmado contra el código fuente del repositorio y el proyecto Supabase real (`mixyhfdlzjarvszinytk`), no contra memoria de conversaciones previas. Donde no fue posible verificar un dato, se indica explícitamente como "no verificado".

## 1. Qué es el sistema

**Fly Gestión** es la plataforma web interna de Fly Kitchen para gestión operativa de sedes (comedores y hospitales): bitácora/novedades diarias, escalamientos, no conformidades, CAPA, tareas, mantenimiento de activos e instalaciones, gestión de flota de vehículos y equipo/RRHH. La bitácora sigue siendo la base operativa, pero ya no es el nombre del producto completo. Single Page Application sin backend propio: toda la lógica de negocio vive en el frontend y en Postgres (Supabase), sin una capa de API intermedia salvo Edge Functions puntuales.

## 2. Stack tecnológico confirmado

| Capa | Tecnología | Versión (package.json) |
|---|---|---|
| Frontend | React | 18.3.1 |
| Build tool | Vite | 5.3.1 |
| Estilos | Tailwind CSS | 3.4.4 |
| Backend / DB | Supabase JS client | 2.45.0 |
| Gráficos | Recharts | ^3.8.1 |
| Fechas | date-fns | ^3.6.0 |
| Hosting | Vercel | — |
| Base de datos | PostgreSQL (Supabase) | proyecto `mixyhfdlzjarvszinytk` |

No hay router (no `react-router`): la navegación es 100% por estado local (`activeView`) en `App.jsx`. No hay test framework, no hay ESLint configurado, no hay CI/CD (deploy 100% manual vía `DEPLOY.bat` → `npx vercel --prod --yes`).

## 3. Módulos funcionales

| Módulo | Vistas principales | Esquema DB | Estado |
|---|---|---|---|
| Bitácora / Novedades | DashboardGlobal, PorSede, Escalamientos, Calendario, NoConformidades, CAPA, Indicadores, Tareas, Requerimientos | `bitacora` (acceso directo vía `db()`) | Operativo, en uso diario |
| Mantenimiento | MntDashboard, MntTickets, MntActivos, MntPlanes, MntProveedores, MntMatafuegos, MntInsumos, MntKanban, MntResponsables, AuditoriaView | `mantenimiento` (acceso indirecto vía vistas `mnt_*` en `public`) | Operativo |
| Flota | MntFlotaGestion, MntVehiculos | `mantenimiento.activos` (subtipo VEHICULO) | Operativo, agregado recientemente (ver DECISIONS.md) |
| Equipo / RRHH | EquipoView, SedeFicha, SedeResponsables | `equipo` (acceso indirecto vía vistas `v_*` en `public`) | Operativo — ficha con legajo y Formularios; apercibimiento PDF en desktop/mobile |
| Usuarios / Admin | Usuarios.jsx | `bitacora.perfiles` + Edge Functions | Operativo, con hallazgos de seguridad (ver KNOWN_ISSUES.md) |
| App móvil | MobileApp + MobileHome/MobileReporte/MobileChecklist/MobileEscalamientos/MobileSedes/MobileTareas | bitácora + mantenimiento | Operativo, breakpoint 768px |

## 4. Arquitectura de datos (resumen — detalle completo en DATABASE.md)

- 4 esquemas Postgres: `bitacora` (17 tablas), `mantenimiento` (17 tablas), `equipo` (5 tablas), `public` (20 vistas proxy `mnt_*`/`v_*` SECURITY DEFINER + 11 tablas de **otra aplicación** que comparte el mismo proyecto Supabase, no relacionada con Fly Kitchen).
- El frontend accede a `bitacora` directamente vía `supabase.schema('bitacora')` (helper `db()` en `src/lib/supabase.js`).
- El frontend accede a `mantenimiento` y `equipo` **solo indirectamente**, a través de las 20 vistas SECURITY DEFINER expuestas en `public` (`supabase.from('mnt_...')` / `supabase.from('v_...')`, sin `.schema()` porque el cliente apunta a `public` por defecto). Esto está confirmado leyendo `src/lib/queries.js` línea por línea, no es una suposición.
- 47 migraciones aplicadas en una ventana de 8 días (2026-06-10 a 2026-06-17) — ritmo de cambio muy alto, sin control de versiones (no existe repo git).
- RLS deshabilitado en 20 tablas across 4 esquemas. De las 11 tablas ajenas en `public`, solo 3 (`operators`, `production_logs`, `suppliers`) tienen RLS activo.
- RBAC implementado **enteramente en el cliente** (`src/lib/auth.jsx`), no hay políticas RLS por rol robustas — ver BUSINESS_RULES.md y KNOWN_ISSUES.md para el detalle de riesgo.

## 5. Integraciones externas confirmadas

3 Edge Functions activas en el proyecto Supabase (`list_edge_functions` verificado en vivo):

| Función | Invocada desde frontend | Propósito | Autenticación |
|---|---|---|---|
| `invite-user` (v2) | Sí — `Usuarios.jsx:34` | Invita un usuario nuevo por email y crea su perfil | Verifica JWT manualmente + exige rol `admin` |
| `admin-user-actions` (v4) | Sí — `Usuarios.jsx:227` | reset_password / resend_invite / delete_user | Verifica JWT manualmente + exige rol `admin` (vía RPC `get_user_rol_bitacora`) |
| `bitacora-ingest` (v4) | **No** (no hay ninguna referencia en `src/`) | Inserta filas en `bitacora.registros` de forma idempotente, con backfill de columnas desconocidas | **Sin autenticación de ningún tipo** — riesgo de seguridad alto, ver KNOWN_ISSUES.md |

Las 3 funciones tienen `verify_jwt: false` a nivel de gateway de Supabase (la verificación, cuando existe, la hace el propio código de la función).

## 6. Trabajo en curso / pausado (no relacionado a esta documentación)

Hay un hilo de trabajo previo de diagnóstico y arreglo de bugs que quedó pausado para priorizar este paquete de documentación de traspaso. Tareas abiertas en ese frente:

1. ✅ Backfill y sincronización de novedades corregidos el 2026-07-02: 585 respuestas reconciliadas, 91 filas faltantes insertadas, segunda pasada idempotente sin pendientes y activadores `onFormSubmitHospitales`/`onFormSubmitComedores` recreados (KNOWN_ISSUES.md §3.13).
2. Deploy pendiente de un fix en el módulo Escalamientos a Vercel.
3. Auditoría de consistencia código↔esquema: mapeo de llamadas Supabase, cruce de columnas usadas vs columnas reales, validación de sintaxis de todo `src/`, revisión de funciones RPC/grants, y aplicación de fixes de bajo riesgo.

Estas tareas no bloquean la documentación de traspaso pero sí deberían retomarse — ver BACKLOG.md para el detalle priorizado.

## 7. Riesgos críticos identificados (resumen — detalle en KNOWN_ISSUES.md)

1. **`bitacora-ingest` es un endpoint público sin autenticación** que inserta directo en `bitacora.registros` con la service role key. Cualquiera con la URL puede insertar/spam datos.
2. **RBAC 100% client-side**: los controles de rol viven en `src/lib/auth.jsx`/`App.jsx`, no en políticas RLS robustas. Un cliente que llame directo a la API REST de Supabase con la anon key puede potencialmente eludir las restricciones de sede/rol.
3. **`bitacora.perfiles` (la tabla que define el rol de cada usuario) tiene políticas RLS permisivas para `anon` y `authenticated`** en lectura, inserción y actualización — la tabla que determina permisos es, en sí misma, editable por cualquier cliente autenticado (y posiblemente anónimo).
4. **Auto-provisión de perfiles**: cualquier usuario autenticado sin perfil existente recibe automáticamente uno con `rol: 'consultor'` la primera vez que entra (`loadPerfil()` en `auth.jsx`).
5. **No existe repositorio git**: no hay historial de cambios, no hay forma de revertir, no hay code review.
6. `invite-user` tiene un fallback `rol: 'Editor'` (capitalizado) si no llega `rol` en el body — por el `CHECK` constraint de `perfiles.rol` (solo minúscula), esto generaría un error de base de datos visible, no una inconsistencia silenciosa. La UI actual (`Usuarios.jsx`) siempre envía un rol válido en minúscula, así que es un defecto latente, no activo (detalle en BUSINESS_RULES.md §1.5).

## 8. Qué falta para considerar el proyecto "production-ready"

1. Inicializar un repositorio git real y migrar a CI/CD (aunque sea básico).
2. Cerrar el acceso anónimo a `bitacora-ingest` (token compartido o JWT) y revisar su necesidad real.
3. Definir políticas RLS reales por rol en lugar de depender solo del cliente.
4. Restringir las políticas de `bitacora.perfiles` a operaciones de servicio (no `anon`/`authenticated` directo).
5. Agregar al menos smoke tests y un linter configurado.
6. Resolver las dos UNIQUE constraints redundantes en `bitacora.registros` (`registros_unique_reporte` y `registros_sede_fecha_turno_unique`).
7. Limpiar archivos residuales (`vite.config.js.timestamp-*.mjs` ×~52, carpetas `dist`/`dist2`/`dist_v2` duplicadas, directorio anidado `bitacora-dashboard/bitacora-dashboard/`).

## 9. Índice de documentación de este traspaso

| Documento | Contenido |
|---|---|
| ARCHITECTURE.md | Diagramas de arquitectura, flujo de datos, decisiones estructurales |
| DATABASE.md | Esquema completo, ER diagram, constraints, vistas |
| SETUP.md | Cómo levantar el proyecto en local |
| DEPLOYMENT.md | Proceso de deploy a Vercel |
| API.md | Edge Functions, RPCs, vistas proxy |
| BUSINESS_RULES.md | Reglas de negocio y RBAC |
| KNOWN_ISSUES.md | Bugs y riesgos conocidos, con severidad |
| BACKLOG.md | Tareas pendientes priorizadas |
| DECISIONS.md | Decisiones de diseño y por qué se tomaron |
| AGENTS.md | Guía para agentes/IA que trabajen sobre este repo |
| .env.example | Variables de entorno requeridas |
| TEST_REPORT.md | Estado de testing (inexistente) y resultado de build |
| REPOSITORY_AUDIT.md | Auditoría de calidad de código y estructura de repo |
| HANDOFF_SUMMARY.md | Resumen ejecutivo final del traspaso |
