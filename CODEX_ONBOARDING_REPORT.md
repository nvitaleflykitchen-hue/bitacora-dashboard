# CODEX ONBOARDING REPORT

Fecha de auditoría: 2026-06-17  
Alcance: revisión local, sin ejecutar la aplicación, sin conectarse a Supabase/Google Drive/Vercel y sin modificar producción.

## Resumen ejecutivo

Estado general: **compila, pero no está en condiciones de recibir cambios funcionales ni de considerarse production-ready sin cerrar primero riesgos críticos de permisos y trazabilidad**.

La SPA React/Vite tiene 55 archivos en `src/` y el build de producción completó correctamente sobre 2.988 módulos. No existen linter, typecheck, pruebas automatizadas ni CI. El control de acceso depende fuertemente del cliente y, según la evidencia documentada contra Supabase el 2026-06-17, varias políticas RLS permiten escalación de privilegios y acceso anónimo. Esos hallazgos de base no se revalidaron en vivo en esta auditoría porque el pedido prohíbe usar producción.

No existe repositorio Git. Hay una copia anidada desactualizada, artefactos de build acumulados y código de Edge Functions/migraciones que no está versionado localmente.

## Evidencia verificada localmente

- Proyecto correcto configurado en `.env.local`: `mixyhfdlzjarvszinytk`. La clave pública existe y no fue mostrada ni copiada.
- `npm ls --depth=0`: exitoso, sin dependencias faltantes.
- Dependencias instaladas: Supabase JS 2.108.2, Vite 5.4.21, React 18.3.1 y Recharts 3.8.1. Los rangos declarados en `package.json` permiten estas versiones, pero parte de la documentación presenta las versiones mínimas declaradas como si fueran las efectivas.
- `npm run build -- --outDir <directorio temporal> --emptyOutDir`: exitoso en 9,04 s; 2.988 módulos transformados.
- Salida principal: JS 1.347,39 kB (342,85 kB gzip), con advertencia de chunk mayor a 500 kB.
- `npm audit --json`: 2 vulnerabilidades, una alta en Vite y una moderada transitiva en esbuild. No se ejecutó ningún fix ni actualización.
- Scripts disponibles: `dev`, `build`, `preview`, `postinstall`. No hay `lint`, `typecheck` ni `test`.
- No hay `.git`; `git status` falla con “not a git repository”.
- 58 archivos `vite.config.js.timestamp-*.mjs`, tres directorios de build y una copia anidada del proyecto.
- La copia anidada contiene 38 archivos fuente: 32 difieren del árbol activo y solo 6 coinciden. No es un respaldo confiable.
- `.env.local` está ignorado por `.gitignore`, pero también existe una copia dentro del proyecto anidado según la auditoría previa.
- No se encontraron marcadores `TODO`/`FIXME` relevantes ni secretos de tipo `service_role` hardcodeados en `src/`. La URL de funciones se construye desde variables Vite.
- El código confirma accesos directos a `mantenimiento` y `equipo`, además de vistas proxy en `public`; el patrón de acceso es mixto.
- El código confirma el fallback fail-open de `auth.jsx`: perfiles restringidos mal configurados terminan con `allowedSedeIds = null`, que significa acceso sin restricción.
- El código confirma consultas inválidas de `SedeFicha.jsx` a `mantenimiento.mnt_tickets` y `mantenimiento.mnt_activos`.

## Arquitectura y estado real

- SPA React 18 + Vite 5, sin router: navegación por `activeView` en `App.jsx`.
- Cliente Supabase único en `src/lib/supabase.js`; acceso directo al esquema `bitacora` mediante `db()`.
- Acceso inconsistente a mantenimiento/RRHH: algunas operaciones usan vistas `mnt_*`/`v_*` en `public`; otras escriben directamente en `mantenimiento` o `equipo`.
- Desktop y mobile son árboles separados, por lo que una regla de negocio puede requerir dos implementaciones y dos verificaciones.
- No hay backend propio. Las Edge Functions activas y las migraciones existen solo fuera de este directorio, según la documentación.
- El deploy es manual y directo a producción mediante Vercel; no existe staging ni gate automatizado.

## Hallazgos críticos

Los siguientes tres hallazgos proceden de `docs/KNOWN_ISSUES.md`, que declara pruebas contra Supabase real con transacciones revertidas el 2026-06-17. **No fueron reejecutados durante esta auditoría**:

1. `bitacora.perfiles` permite a `anon` leer, insertar y actualizar perfiles, incluida una elevación a `admin`.
2. `staff_insert_esc` compara roles capitalizados contra valores reales en minúscula; una novedad con escalamiento revierte toda la operación.
3. Políticas amplias de `bitacora.registros` anulan las políticas acotadas y permiten lectura/inserción anónima y actualización amplia.

Otros riesgos altos:

- Cinco tablas de `equipo` sin RLS según la documentación; datos de RRHH quedarían accesibles a cualquier autenticado.
- Cuatro tablas de `mantenimiento` sin RLS y con grants a `anon`, condicionado a que el esquema esté expuesto por PostgREST.
- Edge Function `bitacora-ingest` documentada como pública y ejecutada con service role.
- RBAC principalmente client-side; múltiples componentes con acceso a datos no consumen `useAuth` ni tokens de alcance. Esto no prueba por sí solo una vulnerabilidad, pero confirma que el filtrado por sede requiere una auditoría vista por vista.
- Sin Git, migraciones versionadas, código fuente local de Edge Functions, tests o CI.

## Diferencias entre documentación y código/estado local

1. `docs/PROJECT_STATUS.md` §§3-4 afirma acceso exclusivamente indirecto a `mantenimiento`/`equipo`; `docs/ARCHITECTURE.md`, `docs/API.md` y el código confirman un patrón mixto con accesos directos.
2. `docs/TEST_REPORT.md` no pudo certificar un build completo por problemas de lectura de OneDrive. En esta auditoría el build sí completó correctamente; esa limitación ya no describe el resultado actual.
3. La documentación de stack usa versiones de `package.json` como si fueran versiones instaladas. Por los rangos `^` y el lockfile, Supabase JS efectivo es 2.108.2 y Vite efectivo es 5.4.21, no 2.45.0/5.3.1.
4. `docs/REPOSITORY_AUDIT.md` registra 16.347 líneas; el conteo PowerShell actual dio 15.828. La diferencia puede ser metodología/fin de línea y no implica truncamiento: el build recorrió todo el árbol exitosamente.
5. `docs/BACKLOG.md` todavía dice “~52” archivos timestamp; el conteo actual y `REPOSITORY_AUDIT.md` dan 58.
6. Los archivos pedidos por nombre están bajo `docs/`, no en la raíz, salvo `AGENTS.md` y `.env.example`.

## Bloqueos

- No hay staging ni credenciales de prueba aisladas; no fue seguro ejecutar pruebas funcionales, login o escrituras.
- No se revalidó el estado actual de RLS, grants, funciones, migraciones o datos porque hacerlo implicaría consultar producción.
- No se verificó Vercel, deploy vigente ni variables del dashboard.
- No se verificaron Google Sheets/Form ni el consumidor real de `bitacora-ingest`; Google Drive no tenía un archivo o ID objetivo.
- Sin Git no existe baseline confiable, historial o rollback para cambios futuros.

## Comandos ejecutados y resultados

| Comando/control | Resultado |
|---|---|
| `git status --short --branch` | Falló: no es repositorio Git |
| `rg --files ...` | Inventario completado; detectó copia anidada y residuos |
| `npm ls --depth=0` | Exitoso |
| `npm run` | Solo dev/build/preview/postinstall |
| `npm run build -- --outDir %TEMP%/... --emptyOutDir` | Exitoso; advertencia por chunk grande |
| `npm audit --json` | 1 alta, 1 moderada; sin corrección aplicada |
| búsquedas `rg` de Supabase, roles, URLs, TODO y secretos | Completadas; sin secreto sensible mostrado |
| comparación SHA-256 entre `src/` y copia anidada | 6 iguales, 32 diferentes |
| lectura segura de nombres/estado de `.env.local` | URL correcta y anon key presente; valor no expuesto |

## Confirmación de límites

No se modificaron funcionalidades, archivos fuente, dependencias, base de datos, migraciones, políticas, datos, Google Drive, Vercel ni producción. No se ejecutaron `dev`, preview, deploy, commit, push ni conexiones a Supabase. El build escribió exclusivamente en un directorio temporal fuera del proyecto.
