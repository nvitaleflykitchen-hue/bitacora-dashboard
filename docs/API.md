# API — bitacora-dashboard

> Verificado contra código fuente real (`src/lib/supabase.js`, `src/lib/queries.js`, `src/views/**`) y contra el proyecto Supabase `mixyhfdlzjarvszinytk` en vivo (Edge Functions, funciones RPC, grants de tabla, políticas RLS). Fecha de verificación original: 2026-06-17; búsqueda global actualizada y verificada el 2026-06-28. No hay capa de API propia: "la API" de esta app son tres superficies de Supabase — PostgREST (tablas/vistas), RPC (funciones Postgres) y 3 Edge Functions.

## 1. Edge Functions

Las 3 funciones activas tienen `verify_jwt: false` a nivel de gateway — Supabase no rechaza ninguna request por falta de JWT antes de que llegue al código; la autenticación, cuando existe, la implementa cada función manualmente.

### 1.1 `invite-user` (v2)

| | |
|---|---|
| Invocada desde | `Usuarios.jsx:34` |
| Método | POST |
| Auth requerida | Sí, verificada en código |

Flujo verificado (código fuente completo recuperado vía `get_edge_function`):

1. Lee el header `Authorization`, extrae el JWT y llama `supabaseAdmin.auth.getUser(token)`. Si no hay usuario válido → 401.
2. Busca `bitacora.perfiles.rol` del usuario autenticado y compara `rol.toLowerCase() === 'admin'`. Si no es admin → 403.
3. Body esperado: `{ email, nombre, rol }`.
4. Llama `supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: 'https://bitacora-dashboard.vercel.app', data: { nombre } })`.
5. Si la invitación se crea, hace `upsert` en `bitacora.perfiles` con `rol: rol || 'Editor'` (nota: default capitalizado — ver inconsistencia de mayúsculas en KNOWN_ISSUES.md).
6. Devuelve el resultado de la invitación o el error de Supabase Auth tal cual.

Riesgo a documentar: el `redirectTo` está hardcodeado a la URL de producción de Vercel — si el dominio cambia, hay que actualizar la función manualmente (no hay variable de entorno para esto).

### 1.2 `admin-user-actions` (v4)

| | |
|---|---|
| Invocada desde | `Usuarios.jsx:227` |
| Método | POST |
| Auth requerida | Sí, verificada en código vía RPC |

Flujo verificado:

1. Verifica JWT igual que `invite-user` (`auth.getUser(token)`).
2. Verifica rol llamando a la función RPC `get_user_rol_bitacora(user_id)` (ver §2.1) en lugar de consultar `bitacora.perfiles` directo — único punto del backend que usa esta función.
3. Body esperado: `{ action, userId, email }` (según la acción, no todos los campos son obligatorios).
4. Tres acciones soportadas vía `switch(action)`:
   - **`reset_password`**: `auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: ... } })`. Devuelve el link generado (no envía el email automáticamente: queda a criterio del frontend qué hacer con el link).
   - **`resend_invite`**: vuelve a llamar `auth.admin.inviteUserByEmail(...)`.
   - **`delete_user`**: bloquea explícitamente la auto-eliminación (`if (userId === caller.id) return 400`); borra primero la fila de `bitacora.perfiles` con un `fetch` crudo a la REST API (header `Content-Profile: bitacora` + `service_role` key, no usa el SDK para este paso) y luego llama `auth.admin.deleteUser(userId)`.
5. Cualquier acción fuera de las 3 reconocidas devuelve 400.

### 1.3 `bitacora-ingest` (v4)

| | |
|---|---|
| Invocada desde | **Nadie en `src/`** (confirmado por grep — no hay referencia en el frontend) |
| Método | POST |
| Auth requerida | **Ninguna** |

Flujo verificado:

1. No valida ningún header, token ni origen. Acepta cualquier POST con body JSON.
2. `insertStrippingUnknown()`: intenta insertar el body (tal cual, mapeado a columnas) en `bitacora.registros` usando la `service_role` key.
3. Si Postgres devuelve `23505` (unique violation, choca con alguna de las dos constraints UNIQUE de `registros`) → lo trata como éxito idempotente (`{ skipped: true }`), no como error.
4. Si Postgres devuelve `42703` (columna no existe) → extrae el nombre de la columna ofensora con la regex `/field \"([^\"]+)\"/` sobre el mensaje de error, la quita del payload, y reintenta. Hasta `MAX_RETRIES = 15` veces.
5. Si se agotan los reintentos o el error es de otro tipo → `logError()` inserta una fila en `bitacora.errores_ingesta` con el detalle, y la función responde con el error.

Esta función es, por diseño, un endpoint público de inserción sin autenticación que escribe con privilegios de `service_role`. Es el hallazgo de seguridad más severo de todo el paquete — desarrollado en detalle en KNOWN_ISSUES.md. Su nombre y comportamiento (tolerante a columnas desconocidas, reintentos, idempotencia por UNIQUE) sugiere que fue diseñado para recibir datos de un sistema externo de formularios (hipótesis: Google Apps Script, consistente con hallazgos de un hilo de diagnóstico previo — no confirmado de forma directa en este paquete).

## 2. Funciones RPC (Postgres, invocables vía `supabase.rpc(...)`)

### Actualización 2026-06-28 — búsqueda global

| Función | Firma | Seguridad | Usada desde frontend |
|---|---|---|---|
| `public.buscar_global` | `(p_query text, p_limit integer DEFAULT 30) RETURNS TABLE (...)` | Wrapper `SECURITY INVOKER`; `EXECUTE` revocado a `PUBLIC`/`anon` y concedido solo a `authenticated` | Sí — `src/components/GlobalSearch.jsx` |
| `bitacora_private.buscar_global_core` | Misma firma y resultado | `SECURITY DEFINER`, `search_path` fijo, valida `auth.uid()`, perfil activo, rol y alcance de sedes antes de leer | Solo desde el wrapper |

El RPC busca sedes, reportes, tareas, escalamientos, compras, tickets, activos, planes, documentos de flota, insumos, proveedores, matafuegos, no conformidades, CAPA, personas, candidatos de Selección, responsables y vuelos. Los candidatos se buscan por nombre, DNI/CUIL, contacto, estado, origen, puesto y sede, respetando el alcance territorial de la solicitud vinculada. `operario` recibe cero resultados; `flota` queda limitado a entidades vehiculares. Aplicado mediante la migración `global_search_20260628`, ampliado por `add_reclutamiento_global_search` y verificado con simulaciones transaccionales.

Los resultados transportan `tipo`, `id` y `sede_id` hasta la URL (`targetType`, `targetId`, `targetSedeId`). Las vistas consumen ese destino para abrir la ficha, modal o tarjeta expandida correspondiente. Las tareas incluyen además `intervinientes` en el texto buscable. Esto se completó con las migraciones `global_search_participants_20260628` y `global_search_flota_routes_20260628`.

Auditoría original del 2026-06-17: **15 funciones existían en los esquemas `public`/`bitacora`/`mantenimiento`/`equipo`**, y **las 15 tenían `EXECUTE` otorgado tanto a `anon` como a `authenticated`** (grant `PUBLIC` por defecto de Postgres, nunca revocado en ninguna). Las dos funciones de búsqueda agregadas el 2026-06-28 son la excepción explícita documentada arriba. Tomado de forma aislada, el estado original parecía una superficie de ataque de 15 funciones — pero hay que distinguir dos grupos:

### 2.1 Funciones realmente invocables vía RPC (4 de 15)

| Función | Firma | Seguridad | Usada desde frontend |
|---|---|---|---|
| `public.get_user_rol_bitacora` | `(user_id uuid) RETURNS text` | `SECURITY DEFINER`, `STABLE`. Cuerpo: `SELECT rol FROM bitacora.perfiles WHERE id = user_id LIMIT 1;` | Indirectamente, dentro de la Edge Function `admin-user-actions` |
| `public.log_auditoria` | `(p_tabla text, p_registro_id text DEFAULT NULL, p_accion text DEFAULT 'ACTION', p_descripcion text DEFAULT NULL, p_campo text DEFAULT NULL, p_valor_antes text DEFAULT NULL, p_valor_nuevo text DEFAULT NULL, p_sede_id bigint DEFAULT NULL, p_sede_nombre text DEFAULT NULL) RETURNS void` | `SECURITY DEFINER`, `plpgsql`. Inserta en `bitacora.auditoria` usando `auth.uid()` + `bitacora.get_usuario_email()`/`get_usuario_nombre()` | **Sí** — única llamada `supabase.rpc(...)` de todo el código, en `src/lib/queries.js:912` |
| `bitacora.get_usuario_email` | `(uuid) RETURNS text` | `SECURITY DEFINER` | No directamente — usada internamente por `log_auditoria` |
| `bitacora.get_usuario_nombre` | `(uuid) RETURNS text` | `SECURITY DEFINER` | No directamente — usada internamente por `log_auditoria` |

`get_usuario_email`/`get_usuario_nombre` viven en el esquema `bitacora`, no en `public`. Son técnicamente invocables vía `supabase.schema('bitacora').rpc(...)` por cualquier cliente con la `anon key`, ya que la app misma prueba que el esquema `bitacora` está expuesto vía PostgREST (lo usa para todo). No hay evidencia de que esto se explote ni de que sea necesario corregirlo con urgencia (no devuelven datos sensibles más allá de email/nombre de un usuario dado su UUID), pero es una superficie técnicamente abierta que vale la pena anotar.

### 2.2 Funciones con grant pero NO invocables vía RPC (10 de 15)

Las restantes 10 funciones devuelven el pseudo-tipo `trigger`: `bitacora.audit_activos`, `audit_matafuegos`, `audit_perfiles`, `audit_registros`, `audit_tareas`, `audit_tickets`, `block_delete_registros`, `fix_fecha_reporte`, `fn_sync_escalamiento`, `protect_registros`, y `mantenimiento.set_updated_at`. Postgres rechaza físicamente la invocación de una función `trigger` fuera de un contexto real de disparo de trigger (`ERROR: trigger functions can only be called as triggers`), sin importar qué privilegios de `EXECUTE` tenga otorgados. **El grant a `anon`/`authenticated` en estas 10 es inerte** — no representa una vía de ataque real, aunque sea técnicamente un grant de más (limpieza cosmética recomendada, no urgente).

## 3. Acceso a tablas/vistas vía PostgREST

### 3.1 Corrección a la documentación de arquitectura

Una verificación exhaustiva de **todos** los call sites `.schema(...)` en `src/` (no solo `src/lib/queries.js`) muestra que el patrón "bitácora se accede directo, mantenimiento/equipo solo vía vistas `public`" — documentado como regla absoluta en una versión anterior de ARCHITECTURE.md §2 — **no es correcto**. El frontend mezcla ambos patrones de forma inconsistente, archivo por archivo:

| Archivo | Llamada | Esquema/tabla real |
|---|---|---|
| `src/views/EquipoView.jsx:80` | `.schema('equipo').from('evaluaciones').insert(...)` | tabla real `equipo.evaluaciones` |
| `src/views/EquipoView.jsx:112` | `.schema('equipo').from('historial_personal').insert(...)` | tabla real `equipo.historial_personal` |
| `src/views/EquipoView.jsx:542` | `.schema('equipo').from('personas').insert(...)` | tabla real `equipo.personas` |
| `src/views/mantenimiento/MntVehiculos.jsx:50,72,74,427,441` | `.schema('mantenimiento').from('tickets')` (select/insert/update) | tabla real `mantenimiento.tickets` |
| `src/views/mantenimiento/MntInsumos.jsx:137` | `.schema('mantenimiento').from('insumos').insert(...)` | tabla real `mantenimiento.insumos` |
| `src/views/mantenimiento/MntResponsables.jsx:50,189,196,203,258` | `.schema('mantenimiento').from('responsables'/'reglas_escalacion')` | tablas reales |
| `src/views/mantenimiento/QRActivoView.jsx:79` | `.schema('mantenimiento').from('visitas_activo').insert(...)` | tabla real `mantenimiento.visitas_activo` |
| `src/lib/queries.js:1150` (`getEventosMantenimiento`) | `.schema('mantenimiento').from('tickets')` | tabla real `mantenimiento.tickets` |

Es decir: las escrituras en `EquipoView.jsx` van directo a las tablas reales de `equipo`, no a las vistas `v_*` (que sí se usan, pero solo para **lecturas**: `v_personas`, `v_evaluaciones`, `v_historial_personal`, `v_logros_obtenidos`, `v_logros_config`). Y varios módulos de Mantenimiento (Flota, Insumos, Responsables, visitas QR, calendario) usan acceso directo a `mantenimiento.tickets`/`insumos`/`responsables`/`reglas_escalacion`/`visitas_activo`, en paralelo con otros módulos que sí pasan por las vistas `mnt_*`. **Se corrigió ARCHITECTURE.md §2 para reflejar esto.**

### 3.2 Bug encontrado: `SedeFicha.jsx` apunta vistas a un esquema donde no existen

`src/views/SedeFicha.jsx` líneas 250, 261 y 263, dentro del `Promise.all([...])` que carga el detalle de una sede, llama:

```js
supabase.schema('mantenimiento').from('mnt_tickets')...   // línea 250
supabase.schema('mantenimiento').from('mnt_activos')...   // línea 261
supabase.schema('mantenimiento').from('mnt_tickets')...   // línea 263
```

Verificado vía `information_schema.tables`: `mnt_tickets` y `mnt_activos` son vistas que existen **únicamente en el esquema `public`** (`table_schema: public`, `table_type: VIEW`). No hay relación con esos nombres en el esquema `mantenimiento`. PostgREST debería responder con un error de "relación no encontrada" para estas 3 llamadas, lo que probablemente rompe en silencio la sección de KPIs de Mantenimiento de la Ficha de Sede (conteo de tickets, conteo de tickets críticos, listado de activos) — el código tiene un `.catch`/manejo de error que evita que la pantalla entera se caiga, pero esos datos específicos no deberían estar llegando nunca. **Detalle completo y prioridad de fix en KNOWN_ISSUES.md.**

### 3.3 Vistas proxy `public` (`mnt_*` / `v_*`)

20 vistas `SECURITY DEFINER` en `public` — listado completo de definiciones (vista → tabla base → joins → filtros) en DATABASE.md §5. De estas, 6 son auto-actualizables (`SELECT *` simple sin agregación) y efectivamente reciben escrituras desde el frontend:

| Vista | Operación usada | Archivo |
|---|---|---|
| `mnt_activos` | `upsert` | `queries.js` |
| `mnt_tickets` | `insert`/`update` | `queries.js` |
| `mnt_proveedores` | `upsert` | `queries.js` |
| `mnt_matafuegos` | `upsert` | `queries.js` |
| `mnt_insumos` | `update` | `queries.js` |
| `mnt_movimientos` | `insert` | `queries.js` |

Las demás 14 vistas (`mnt_ejecuciones`, `mnt_planes`, `mnt_plan_checklist`, `mnt_visitas`, `mnt_historial`, `v_sedes`, `v_personas`, `v_evaluaciones`, `v_historial_personal`, `v_logros_config`, `v_logros_obtenidos`, `v_auditoria`, etc.) se usan solo para lectura en el código revisado.

### 3.4 Acceso directo a tablas — matriz de permisos efectivos (hallazgo nuevo, no documentado antes)

Dado que el frontend sí llama `.schema('mantenimiento')`/`.schema('equipo')` directo (§3.1), importa saber qué puede hacer cada rol de Postgres (`anon`, `authenticated`) sobre esas tablas **antes** de que el frontend intervenga. Verificado cruzando `information_schema.role_table_grants` con `pg_policies`/`pg_class.relrowsecurity`:

**Esquema `mantenimiento` (17 tablas):**

- **Grants de tabla**: las 17 tablas tienen `SELECT/INSERT/UPDATE/DELETE` otorgado tanto a `anon` como a `authenticated` (sin excepción).
- **RLS habilitado en 13 de 17**: `activos`, `ejecuciones_plan`, `historial_tickets`, `inspecciones_matafuegos`, `insumos`, `liberaciones_equipo`, `matafuegos`, `movimientos_insumo`, `planes_preventivos`, `proveedores`, `reglas_escalacion`, `responsables`, `tickets`. En estas 13, la única política existente es `ALL` para el rol `{authenticated}` con `qual: true` / `with_check: true` — es decir, RLS habilitado pero sin restricción real más allá de "estar logueado": cualquier usuario autenticado (sin importar su rol/perfil/sede) puede leer y escribir todo. **El efecto práctico para `anon` es bloqueo total**: como no hay ninguna política que mencione el rol `anon`, RLS habilitado + ausencia de política matching = denegado, a pesar del grant de tabla. Esto es correcto y mitigante.
- **RLS deshabilitado en 4 de 17**: `ejecucion_items`, `plan_checklist`, `ticket_costos`, `visitas_activo`. En estas 4, al no haber RLS, **el grant de tabla aplica sin filtro** — si el esquema `mantenimiento` está expuesto en la configuración de PostgREST (no verificable por SQL directo desde este paquete, pero la existencia de llamadas `.schema('mantenimiento')` funcionando en módulos marcados "Operativo" en PROJECT_STATUS.md hace muy probable que sí lo esté), **cualquier persona con la `anon key` pública (embebida en el bundle JS, ver SETUP.md §3) puede leer, insertar, modificar y borrar filas de estas 4 tablas sin necesidad de loguearse.**

**Esquema `equipo` (5 tablas):**

- **Grants de tabla**: las 5 tablas (`evaluaciones`, `historial_personal`, `logros_config`, `logros_obtenidos`, `personas`) tienen grant de `SELECT/INSERT/UPDATE` para `authenticated` únicamente — **no hay ningún grant para `anon`** en este esquema (a diferencia de `mantenimiento`). Tampoco hay grant de `DELETE` para nadie.
- **RLS deshabilitado en las 5 tablas, sin excepción.**
- Efecto práctico: `anon` no puede acceder (sin grant, more allá de RLS). Pero **cualquier usuario autenticado** (cualquier cuenta válida, sin importar rol) tiene lectura/escritura sin restricción sobre `personas` (legajos de RRHH), `evaluaciones`, `historial_personal` y los logros — la separación por rol que `EquipoView.jsx` implementa es enteramente client-side, sin ninguna barrera equivalente en la base.

Este hallazgo se traslada a KNOWN_ISSUES.md con severidad asignada (las 4 tablas de `mantenimiento` sin RLS y expuestas a `anon` son más graves que las de `equipo`, que al menos requieren estar autenticado).

## 4. Resumen de superficie de API expuesta

| Superficie | Requiere login | Requiere rol específico | Filtra por sede |
|---|---|---|---|
| `bitacora.*` vía `db()` | No a nivel DB (RLS mayormente permisivo, ver DATABASE.md/KNOWN_ISSUES.md) | No a nivel DB | No a nivel DB — solo en el cliente |
| Vistas `mnt_*`/`v_*` en `public` | Depende de la vista (`SECURITY DEFINER` ejecuta con privilegios del dueño) | No | No |
| `mantenimiento.*` directo (13 tablas con RLS) | Sí (cualquier autenticado) | No | No |
| `mantenimiento.*` directo (4 tablas sin RLS: `ejecucion_items`, `plan_checklist`, `ticket_costos`, `visitas_activo`) | **No** | No | No |
| `equipo.*` directo (5 tablas, sin RLS, sin grant a `anon`) | Sí (cualquier autenticado) | No | No |
| RPC `log_auditoria`/`get_user_rol_bitacora` | No a nivel DB | No | N/A |
| Edge Function `invite-user` | Sí, verificado en código | Sí, `admin` | N/A |
| Edge Function `admin-user-actions` | Sí, verificado en código | Sí, `admin` | N/A |
| Edge Function `bitacora-ingest` | **No** | No | No |

Ver KNOWN_ISSUES.md para la lista priorizada de estos hallazgos con severidad y recomendación de fix.
