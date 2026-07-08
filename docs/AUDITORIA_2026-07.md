# AUDITORÍA — bitacora-dashboard

> Fecha: **2026-07-03**. Alcance solicitado: seguridad, base de datos, calidad de código y operativa/funcional.
> Método: lectura del repo + verificación **en vivo, solo lectura**, contra el proyecto Supabase correcto (`mixyhfdlzjarvszinytk`, "cerdova-db") usando `pg_policies`, `pg_class.relrowsecurity`, `information_schema.role_table_grants`, `get_advisors` (linter de Supabase), definición de Edge Functions y `npm run build`/`eslint`. No se escribió ni modificó ningún dato.
> Este documento complementa `docs/KNOWN_ISSUES.md`: acá se marca qué de lo ya documentado **sigue vigente hoy**, qué **ya fue corregido**, y qué hallazgos son **nuevos**.

## Cómo leer las severidades

| Severidad | Significado |
|---|---|
| 🔴 CRÍTICO | Explotable hoy sin credenciales o con una de bajo privilegio, o rompe el build/deploy. Acción inmediata. |
| 🟠 ALTO | Acceso indebido a datos sensibles o rotura de una función operativa real. Esta semana. |
| 🟡 MEDIO | Riesgo acotado o deuda técnica con impacto indirecto. Este mes. |
| ⚪ BAJO | Higiene de código/infra, sin impacto funcional directo. Cuando haya ventana. |

---

## Resumen ejecutivo

Lo bueno primero: los dos hallazgos 🔴 **críticos** de seguridad del informe anterior (`perfiles` abierta a `anon` y escalamientos rotos por rol capitalizado) **ya están corregidos** en la base — verificado en vivo. Las políticas de `perfiles` ahora limitan a "tu propia fila o admin", y `staff_insert_esc` usa los roles en minúscula correctos. También se corrigió el fail-open de permisos por sede en `auth.jsx` y las políticas amplias de `registros`.

Lo que sigue abierto y es lo más urgente hoy:

1. 🔴 **El proyecto no compila.** `src/views/NoConformidades.jsx` está truncado a mitad de una edición; `npm run build` y `npm run check` fallan. La app en producción funciona porque corre un deploy anterior, pero cualquier deploy nuevo desde el estado actual del repo va a fallar.
2. 🔴 **Datos de otra aplicación expuestos a `anon` en el mismo proyecto.** Hay ~11 tablas de una app de recetas/producción (`app_users`, `recipes`, `raw_materials`, `suppliers`, `production_logs`, etc.) en el esquema `public`, varias con RLS **apagado** y grant total a `anon`. Cualquiera con la anon key pública puede leer/escribir `app_users` y el resto.
3. 🟠 **RRHH y Mantenimiento siguen sin control de acceso real por rol.** `equipo.*` (legajos, evaluaciones, sanciones) y `mantenimiento.*` (18 tablas) tienen políticas `true` — cualquier usuario logueado, sin importar su rol, lee y edita todo. Varias tablas de `mantenimiento` además tienen grant a `anon`.
4. 🟠 **62 archivos modificados sin commitear** en el árbol de trabajo, uno de ellos roto (el del punto 1). Riesgo real de perder trabajo o deployar algo a medio hacer.

El resto son medios/bajos: Edge Functions sin verificación de JWT, contraseña temporal universal `123456`, vistas `SECURITY DEFINER`, y bastante basura de repo (76 archivos `vite.config.timestamp`, 3 carpetas de build, un `.docx` de 221 KB).

---

## 1. 🔴 CRÍTICO

### 1.1 El build está roto — `NoConformidades.jsx` truncado (NUEVO)

**Qué pasa:** `src/views/NoConformidades.jsx` termina abruptamente en la línea 576, en medio de un bloque JSX (`<td>` sin cerrar, sin `</tbody>`, sin cierre de componente ni `export`). Es una edición a medio terminar.

**Verificación empírica:**
```
$ npx vite build
[vite:esbuild] ERROR: Unexpected end of file before a closing "td" tag
  src/views/NoConformidades.jsx:577:20
```
`npx eslint .` reporta el mismo archivo: `error Parsing error: Unterminated JSX contents`. La versión commiteada en HEAD (`git show HEAD:src/views/NoConformidades.jsx`) sí está completa (389 líneas) — el daño está solo en el árbol de trabajo (576 líneas, truncado).

**Impacto:** `npm run build`, `npm run check` y cualquier deploy (`DEPLOY.bat` → Vercel) fallan hoy desde el estado actual del repo. La app sigue online únicamente porque Vercel sirve un build anterior; no se puede publicar ninguna corrección ni feature hasta arreglar esto.

**Recomendación (inmediata):** terminar el componente o, si la edición se puede descartar, restaurar desde HEAD: `git checkout -- src/views/NoConformidades.jsx`. Después correr `npm run build` para confirmar que vuelve a compilar. Decidir con quien hizo la edición si había cambios que conservar antes de descartar.

### 1.2 Datos de otra app expuestos a `anon` en el esquema `public` (NUEVO)

**Qué pasa:** en el mismo proyecto Supabase de la bitácora conviven tablas de una aplicación distinta (de recetas/producción de alimentos), en el esquema `public`, que es el que PostgREST expone por defecto. Estado verificado en vivo:

| Tabla | RLS | Grant a `anon` | Filas |
|---|---|---|---|
| `app_users` | ❌ apagado | ALL (incl. DELETE/TRUNCATE) | — |
| `recipes` | ❌ apagado | ALL | — |
| `raw_materials` | ❌ apagado | ALL | — |
| `recipe_ingredients` | ❌ apagado | ALL | — |
| `final_products`, `product_packaging`, `technical_sheets`, `global_settings` | ❌ apagado | ALL | — |
| `operators` | ✅ on, pero política `Enable access for anon` = `true` | ALL | 1 |
| `production_logs` | ✅ on, pero política `true` | ALL | 14 |
| `suppliers` | ✅ on, pero política `true` | ALL | 0 |

Con RLS apagado y grant a `anon`, o con RLS on pero política `USING true`, el efecto es el mismo: **cualquiera con la anon key pública** (embebida en el bundle JS del sitio, visible desde las devtools) puede leer y escribir estas tablas sin loguearse, incluida `app_users`.

**Impacto:** exposición de datos de un tercero/otra app (usuarios, recetas, proveedores, logs de producción) a cualquiera en internet. El linter de Supabase lo marca como ERROR (`rls_disabled_in_public`).

**Recomendación:** confirmar de quién son estas tablas. Si no pertenecen a la bitácora, lo más limpio es moverlas a otro proyecto o borrarlas. Si deben quedarse, habilitar RLS y **revocar los grants a `anon`** (`REVOKE ALL ON public.<tabla> FROM anon;`). Presentar el SQL antes de aplicarlo (regla 3 de AGENTS.md). Nota: `app_users` con RLS off es lo más urgente del bloque.

---

## 2. 🟠 ALTO

### 2.1 `equipo.*` — RRHH sin control de acceso por rol (VIGENTE, era §2.1 de KNOWN_ISSUES)

Las 5 tablas núcleo de RRHH — `personas`, `evaluaciones`, `historial_personal`, `logros_config`, `logros_obtenidos` — tienen RLS habilitado pero con una única política `auth_all` cuya condición es `true` para `authenticated`. Verificado en `pg_policies` y confirmado por el linter.

**Impacto:** cualquier usuario logueado (rol `sede`, `operario`, `flota`, el que sea) puede leer y editar legajos, evaluaciones de desempeño y antecedentes disciplinarios de **cualquier** empleado de **cualquier** sede. Dato sensible sin barrera real en la base.

**Nota positiva:** el submódulo de reclutamiento (`reclutamiento_*`) sí tiene políticas con condición real por rol — el patrón correcto existe en el proyecto, falta aplicarlo a estas 5 tablas.

**Recomendación:** reemplazar `auth_all` por políticas por rol (mínimo: `admin`/`grupo`/`encargado` de la sede correspondiente ven/editan; el resto no). Presentar SQL para aprobación.

### 2.2 `mantenimiento.*` — 18 tablas con política `true`, varias con grant a `anon` (VIGENTE, era §2.2)

Las 18 tablas de `mantenimiento` (`tickets`, `activos`, `ticket_costos`, `insumos`, `proveedores`, `planes_preventivos`, `matafuegos`, etc.) tienen política única `auth_all`/`autenticados_*` con condición `true`. Además, **13 de ellas tienen grant de `anon`** con SELECT/INSERT/UPDATE/DELETE (incl. `tickets`, `activos`, `ticket_costos`, `proveedores`, `insumos`, `matafuegos`).

Como `public` está expuesto en PostgREST y varias vistas proxy (`mnt_tickets`, `mnt_documentos_flota`, `v_sedes`) también tienen grant a `anon`, el acceso sin login a datos de mantenimiento es plausible por más de una vía.

**Impacto:** cualquier usuario autenticado edita todo el back-office de mantenimiento sin distinción de rol/sede; y por el grant a `anon`, parte de esos datos (costos de tickets, activos, proveedores) es potencialmente accesible sin login.

**Recomendación:** (a) revocar grants de `anon` en las tablas de `mantenimiento` que no lo necesiten, y (b) reemplazar las políticas `true` por condiciones por rol/sede. Presentar SQL.

### 2.3 8 tablas de `bitacora` abiertas a `anon`/`public` con condición `true` (VIGENTE, era §2.4)

Verificado en `pg_policies` (condición `true`, sin scoping):

| Tabla | Comandos | Roles |
|---|---|---|
| `adjuntos` | SELECT, INSERT, DELETE | `anon`, `authenticated` |
| `capa` | ALL (incl. DELETE) | `anon`, `authenticated` |
| `capa_planes` | ALL | `anon`, `authenticated` |
| `contactos` | SELECT, INSERT, UPDATE | `anon`, `authenticated` |
| `no_conformidades` | ALL (incl. DELETE) | `anon`, `authenticated` |
| `sede_contactos` | ALL | `public` |
| `sedes` | SELECT abierto a `anon`; escritura a `authenticated` `true` | mixto |
| `tareas` | SELECT, INSERT, UPDATE | `anon`, `authenticated` |

**Impacto:** desde borrar adjuntos o no conformidades ajenas hasta crear/editar contactos y tareas de cualquier sede, en varios casos sin estar logueado. `checklists`/`checklist_items` sí están bien resueltas — la inconsistencia entre tablas es la causa raíz.

**Recomendación:** definir por tabla qué rol/condición corresponde y reemplazar las políticas `true`. Presentar SQL.

### 2.4 Árbol de trabajo con 62 archivos modificados sin commitear (NUEVO)

**Qué pasa:** `git status` muestra 62 archivos tracked modificados sin commitear (incluye `src/App.jsx`, `queries.js`, `auth.jsx`, casi todo `src/mobile/`, la mayoría de `docs/`) más varios archivos y carpetas untracked (`src/assets/`, `src/components/ComentariosHilo.jsx`, `public/templates/`, scripts de inserción). Uno de esos 62 es el `NoConformidades.jsx` roto de §1.1.

**Impacto:** una cantidad grande de trabajo vive solo en el árbol de trabajo local, sin punto de restauración. Un `git checkout` accidental, o deployar desde este estado, puede perder cambios o publicar código a medio hacer. El último commit (`0d65bb3`) quedó muy atrás respecto de lo que hoy hace funcionar la app.

**Recomendación:** una vez arreglado el build (§1.1), commitear en tandas lógicas (por módulo) con mensajes claros. No dejar el árbol en este estado. Confirmar que `.env.local`/`.env.vapid.local` siguen gitignored (hoy lo están) antes de cualquier `git add`.

---

## 3. 🟡 MEDIO

### 3.1 Edge Functions: todas con `verify_jwt = false`; `bitacora-ingest` sin ninguna autenticación (VIGENTE/ampliado, era §3.3)

Las 6 Edge Functions activas (`invite-user`, `admin-user-actions`, `bitacora-ingest`, `send-priority-notification`, `cron-preventivos`, `create-user-direct`) tienen `verify_jwt: false`. Algunas compensan con verificación interna: `create-user-direct` y `admin-user-actions` validan token + rol admin en el código (correcto). Pero **`bitacora-ingest` no valida nada** — cualquiera que conozca la URL puede insertar filas en `bitacora.registros` (usa la service role key internamente, así que saltea RLS).

**Impacto:** inyección de novedades falsas en el registro operativo sin credenciales. Hoy lo usa el sync de Google Forms, pero el endpoint es abierto.

**Recomendación:** agregar un secreto compartido (header `X-Ingest-Token` comparado contra un secreto de entorno) a `bitacora-ingest` y configurarlo también en el llamador de Apps Script.

### 3.2 Contraseña temporal universal `123456` (NUEVO)

`create-user-direct` crea todos los usuarios con `password: '123456'` y `must_change_password: true`. El frontend (`Usuarios.jsx`) muestra esa contraseña al admin para pasársela al usuario, y `CambiarContrasena.jsx` obliga a cambiarla al primer login (y bloquea reusar `123456`).

**Impacto:** entre que se crea el usuario y que hace su primer login, la cuenta es accesible por cualquiera que sepa el email + la contraseña conocida `123456`. La mitigación (cambio forzado) reduce pero no elimina la ventana.

**Recomendación:** generar una contraseña aleatoria por usuario en la Edge Function y transmitirla por el canal de invitación, en lugar de un valor fijo compartido por todos.

### 3.3 4 vistas `SECURITY DEFINER` + función `get_user_rol_bitacora` ejecutable por `anon` (NUEVO, del linter)

El linter de Supabase marca como ERROR 4 vistas con `SECURITY DEFINER` (`public.mnt_documentos_flota`, `public.mnt_proveedores`, `public.mnt_matafuegos`, `public.v_personas`): corren con permisos del creador, no del usuario que consulta, salteando RLS. Además `public.get_user_rol_bitacora(uuid)` es `SECURITY DEFINER` y ejecutable por `anon`/`authenticated` vía `/rest/v1/rpc/`.

**Recomendación:** recrear esas vistas con `security_invoker = on` (como ya están la mayoría de las `mnt_*`) y revisar si `get_user_rol_bitacora` debe ser invocable por `anon` (probablemente revocar EXECUTE a `anon`).

### 3.4 Compras: `perfil_permisos` sigue con 0 filas — `grupo`/`encargado` no pueden cerrar el circuito (VIGENTE, era §2.13)

Confirmado en vivo: `bitacora.perfil_permisos` tiene **0 filas**. El trigger `protect_requerimiento_after_send` exige rol `admin`/`editor` o una fila en esa tabla para avanzar un requerimiento pasado "Enviado". Como el frontend les muestra los botones a `grupo`/`encargado` igual, esos roles ven controles que fallan con error crudo de Postgres. Hoy, en la práctica, solo `admin`/`editor` cierran compras de punta a punta.

**Recomendación:** decisión de producto (ver KNOWN_ISSUES §2.13): construir UI para altas en `perfil_permisos`, o aflojar el trigger para `grupo`/`encargado`. Requiere aprobación antes de tocar el trigger.

### 3.5 Protección de contraseñas filtradas (HaveIBeenPwned) deshabilitada en Auth (NUEVO, del linter)

Supabase Auth puede rechazar contraseñas presentes en filtraciones conocidas; está desactivado. Bajo esfuerzo, se activa desde el dashboard (Authentication → Policies).

### 3.6 Roles "fantasma" en políticas RLS (VIGENTE, era §3.4)

`escalamientos.staff_read_esc` todavía incluye `'viewer'` (rol inexistente) y `auditoria."Admins ven auditoria"` incluye `'superadmin'`. No bloquean nada (son ramas muertas dentro de un OR), pero ensucian y confunden. Limpiar al tocar esas políticas.

### 3.7 20 warnings de `react-hooks/exhaustive-deps` (NUEVO)

`eslint` reporta 20 warnings de dependencias faltantes en `useEffect`/`useCallback` (en `MntTickets`, `MntKanban`, `MntInsumos`, y varios más). No rompen hoy, pero son fuente típica de bugs de datos desactualizados. Revisarlos de a poco.

---

## 4. ⚪ BAJO — Higiene de repositorio

- **76 archivos `vite.config.js.timestamp-*.mjs`** en la raíz (eran ~52 en el informe anterior; siguen creciendo). Son temporales de Vite; ya están en `.gitignore` pero conviene borrarlos del disco: `rm vite.config.js.timestamp-*.mjs`.
- **3 carpetas de build** en el repo: `dist/`, `dist2/`, `dist_v2/`. Solo `dist/` es la actual; `dist2`/`dist_v2` son basura.
- **`BITACORA.MD.docx` de 221 KB** en la raíz — documento pesado versionado innecesariamente.
- **Scripts sueltos en la raíz**: `insert_evaluaciones.mjs/.sql`, `checkjsx_tmp.js`, `DEPLOY.bat`. Conviene moverlos a `scripts/`.
- **Suite de tests lenta:** `npm run test` (vitest run) no terminó en 40 s en el sandbox — probablemente algún test cuelga o espera timeout. Revisar `vitest.config.js` y aislar el test lento; una suite que no corta impide usar `npm run check` en CI.
- **Código fuente de las Edge Functions**: `create-user-direct` y `cron-preventivos` sí están en `supabase/functions/`; las otras 4 (`invite-user`, `admin-user-actions`, `bitacora-ingest`, `send-priority-notification`) siguen sin respaldo en el repo (solo viven desplegadas). Bajar el código a `supabase/functions/` para no depender del deploy.

---

## 5. Tabla resumen

| # | Hallazgo | Severidad | Estado vs. informe previo | Esfuerzo |
|---|---|---|---|---|
| 1.1 | Build roto — `NoConformidades.jsx` truncado | 🔴 Crítico | **Nuevo** | Muy bajo (restaurar/terminar 1 archivo) |
| 1.2 | Tablas de otra app expuestas a `anon` en `public` | 🔴 Crítico | **Nuevo** | Medio (RLS + revoke) |
| 2.1 | `equipo.*` RRHH sin control por rol | 🟠 Alto | Vigente | Medio |
| 2.2 | `mantenimiento.*` política `true` + grant `anon` | 🟠 Alto | Vigente | Medio |
| 2.3 | 8 tablas `bitacora` abiertas a `anon`/`public` | 🟠 Alto | Vigente | Medio |
| 2.4 | 62 archivos sin commitear (uno roto) | 🟠 Alto | **Nuevo** | Bajo |
| 3.1 | `bitacora-ingest` sin autenticación | 🟡 Medio | Vigente | Bajo |
| 3.2 | Contraseña temporal universal `123456` | 🟡 Medio | **Nuevo** | Bajo |
| 3.3 | 4 vistas `SECURITY DEFINER` + RPC `anon` | 🟡 Medio | **Nuevo** (linter) | Bajo |
| 3.4 | Compras: `perfil_permisos` vacía | 🟡 Medio | Vigente | Medio (decisión) |
| 3.5 | HIBP deshabilitado en Auth | 🟡 Medio | **Nuevo** | Muy bajo |
| 3.6 | Roles fantasma en políticas | 🟡 Medio | Vigente | Muy bajo |
| 3.7 | 20 warnings react-hooks | 🟡 Medio | **Nuevo** | Medio |
| 4 | Higiene de repo (76 junk, 3 dist, docx, tests lentos) | ⚪ Bajo | Vigente/ampliado | Bajo |

## 6. Ya corregido desde el informe anterior (verificado en vivo)

- ✅ **`perfiles`** ya no está abierta a `anon`: políticas actuales son `perfiles_select_self_or_admin`, `perfiles_update_self`, `perfiles_update_admin`, `perfiles_insert_self_as_consultor` (era 🔴 §1.1).
- ✅ **`escalamientos`**: `staff_insert_esc` ahora usa `['admin','editor','grupo','encargado','sede','operario']` en minúscula — la creación automática de escalamientos ya no falla por rol capitalizado (era 🔴 §1.2).
- ✅ **`registros`**: se eliminaron las políticas amplias `read_registros`/`insert_registros`/`update_registros`; quedan solo las angostas `staff_*`/`sede_*`. Ojo: el grant de tabla a `anon` sobre `registros` todavía existe (queda inerte porque no hay política que lo habilite, pero conviene revocarlo como defensa en profundidad).
- ✅ **`auth.jsx`**: la rama `else` de `loadPerfil()` ahora falla cerrado (`allowedSedeIds = []`, `accessBlocked = true`) en vez de dar acceso a todas las sedes (era 🟠 §2.6).

## 7. Plan de acción sugerido (por orden)

1. **Hoy:** restaurar/terminar `NoConformidades.jsx` y confirmar `npm run build` verde (§1.1).
2. **Hoy:** commitear el árbol de trabajo en tandas, con `.env*` fuera del commit (§2.4).
3. **Esta semana:** decidir el destino de las tablas ajenas en `public` y aplicar RLS/revoke (§1.2). Mismo bloque de trabajo SQL: cerrar `equipo.*`, `mantenimiento.*` y las 8 de `bitacora` (§2.1–2.3). Presentar todo el SQL junto para una sola aprobación.
4. **Esta semana:** token compartido para `bitacora-ingest` (§3.1) y contraseña aleatoria en `create-user-direct` (§3.2).
5. **Este mes:** vistas `SECURITY DEFINER` → invoker (§3.3), activar HIBP (§3.5), limpiar roles fantasma (§3.6), decidir modelo de permisos de compras (§3.4), atacar los warnings de hooks (§3.7).
6. **Ventana libre:** limpieza de repo (§4).

> Todo cambio de RLS/GRANT/trigger se presenta como SQL para revisión antes de aplicarse (regla 3 de AGENTS.md). Esta auditoría no ejecutó ninguna escritura.
