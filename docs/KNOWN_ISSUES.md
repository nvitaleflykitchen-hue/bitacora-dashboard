# KNOWN_ISSUES — bitacora-dashboard

> Verificado contra el proyecto Supabase `mixyhfdlzjarvszinytk` en vivo: `pg_policies`, `pg_class.relrowsecurity`, `pg_trigger`, `pg_proc`, y **pruebas empíricas reales** (simulación de rol `anon`/`authenticated` con `SET LOCAL role` + `request.jwt.claim.sub`, dentro de transacciones cerradas con `ROLLBACK`, sin dejar datos persistentes — confirmado con `SELECT` posterior a cada prueba). Cruzado contra `src/lib/auth.jsx`, `src/components/Sidebar.jsx`, `src/mobile/MobileReporte.jsx`. Fecha de verificación: 2026-06-17.
>
> Cada hallazgo indica cómo fue verificado: **empírico** (se ejecutó la operación real y se observó el resultado), **estático** (lectura de policy/constraint/grant sin ejecutar la operación), o **no verificable** (se documenta la incertidumbre explícitamente).

## Cómo priorizar esto

| Severidad | Significado |
|---|---|
| 🔴 CRÍTICO | Explotable hoy, sin credenciales o con una de bajo privilegio. Acción inmediata. |
| 🟠 ALTO | Acceso indebido a datos sensibles, o rotura de una función operativa real. Resolver esta semana. |
| 🟡 MEDIO | Riesgo real pero acotado, o deuda técnica con impacto indirecto. Resolver este mes. |
| ⚪ BAJO | Higiene de código/infraestructura, sin impacto funcional directo hoy. Resolver cuando haya ventana. |

---

## 1. 🔴 CRÍTICO

### 1.1 Cualquiera puede convertirse en `admin` sin autenticarse

**Qué pasa:** `bitacora.perfiles` —la tabla que define el rol y el alcance de sedes de cada usuario— tiene RLS habilitado pero con políticas totalmente permisivas:

| Política | Comando | Roles | Condición |
|---|---|---|---|
| `read_perfiles` | SELECT | `anon`, `authenticated` | `true` |
| `insert_perfiles` | INSERT | `anon`, `authenticated` | `true` |
| `update_perfiles` | UPDATE | `anon`, `authenticated` | `true` |

No hay ninguna condición que limite "solo puedo leer/editar mi propio perfil" ni "solo un admin puede cambiar el rol de otro". El rol `anon` es el que usa cualquier request sin sesión iniciada (la `anon key`, pública, embebida en el bundle JS — ver SETUP.md §3).

**Verificación empírica:** se ejecutó, dentro de una transacción revertida con `ROLLBACK`, lo siguiente simulando `anon` sin ningún token de sesión:

```sql
SET LOCAL role = anon;
UPDATE bitacora.perfiles SET rol = 'admin' WHERE id = '<cualquier uuid>';
```

La operación **se ejecutó sin error** y devolvió la fila modificada con `rol: 'admin'`. Se confirmó después que el `ROLLBACK` revirtió el cambio (no quedó persistido).

**Impacto:** con solo la `anon key` pública (visible para cualquiera que abra las herramientas de desarrollador del navegador en el sitio en producción), sin loguearse, se puede: leer todos los perfiles (nombre, email, sedes, grupo), y escribir cualquier perfil — incluido el propio si ya se tiene una cuenta de bajo privilegio, o el de un tercero. Esto es escalación de privilegios completa: alcanza con un `UPDATE` para obtener rol `admin` y, con eso, acceso a Usuarios y Trazabilidad además de a todo lo demás.

**Recomendación:** reemplazar las 3 políticas por reglas que (a) limiten SELECT/UPDATE a `auth.uid() = id` para usuarios no-admin, (b) prohíban a cualquier rol no-admin modificar la columna `rol`/`sede_ids`/`grupo_id` de su propia fila (vía trigger `BEFORE UPDATE` o columna separada con `WITH CHECK` que compare `OLD.rol = NEW.rol` salvo que el ejecutor sea admin), y (c) eliminen el INSERT/UPDATE para `anon` por completo (el alta de perfil ya la hace `loadPerfil()` autenticado). Esto requiere diseño cuidadoso porque el auto-aprovisionamiento de `consultor` (BUSINESS_RULES.md §1.4) depende de poder insertar la propia fila al primer login.

---

### 1.2 La creación automática de escalamientos está rota para todo usuario real

**Qué pasa:** el trigger `trg_sync_escalamiento` (`AFTER INSERT OR UPDATE OF requiere_escalamiento ON bitacora.registros`) llama a `bitacora.fn_sync_escalamiento()`, que inserta en `bitacora.escalamientos`. Esa función **no es `SECURITY DEFINER`** (`prosecdef: false`), por lo que el `INSERT` que ejecuta corre con los mismos permisos/RLS que la sesión que disparó el trigger — no con privilegios elevados.

`bitacora.escalamientos` tiene una sola política de INSERT, `staff_insert_esc`:

```sql
WITH CHECK (EXISTS (
  SELECT 1 FROM bitacora.perfiles
  WHERE perfiles.id = auth.uid()
    AND perfiles.rol = ANY (ARRAY['Admin','Editor','Encargado','Sede'])  -- capitalizado
))
```

El `CHECK` constraint de `perfiles.rol` (BUSINESS_RULES.md §1.1) solo permite los valores en minúscula `admin, editor, consultor, encargado, grupo, sede`. Ningún perfil real puede tener `rol = 'Admin'` (con mayúscula) — Postgres lo rechazaría al guardarlo. La comparación es de tipo `text` con collation default (case-sensitive, confirmado por `information_schema.columns`), así que `'admin' = 'Admin'` es `false`. **La condición de esta política nunca puede ser verdadera para ningún usuario real.**

**Verificación empírica:** se simuló, dentro de una transacción revertida, un INSERT en `registros` con `requiere_escalamiento = true` y `auth.uid()` apuntando a un perfil real con `rol = 'admin'` y `activo = true` (el mismo flujo que ejecuta `MobileReporte.jsx` al guardar una novedad con escalamiento o con estado "Operación condicionada"):

```
ERROR: 42501: new row violates row-level security policy for table "escalamientos"
CONTEXT: ... PL/pgSQL function bitacora.fn_sync_escalamiento() line 7 ...
```

Como el trigger es `AFTER` y corre dentro de la misma transacción que el `INSERT`/`UPDATE` de `registros`, esta excepción **revierte la operación completa**: el registro tampoco se guarda. No es solo que falte el escalamiento — el usuario ve un error y pierde la novedad que estaba reportando.

**Por qué hoy existen 43 escalamientos en la tabla, incluido uno con fecha de hoy:** todos los `registro_id` con `requiere_escalamiento = true` tienen su fila correspondiente en `escalamientos` (0 faltantes, verificado por conteo). Varios comparten timestamp `created_at` idéntico hasta el microsegundo (filas consecutivas creadas en el mismo instante), lo cual es consistente con una carga masiva por backfill (la del hilo de trabajo previo, tareas #10/#11) ejecutada con un rol con privilegios elevados que no pasa por RLS — no con tráfico real de la app vía PostgREST. No se pudo confirmar con certeza absoluta el origen de cada fila individual (no hay columna que registre "creado por backfill vs. trigger"), pero la prueba empírica de este documento demuestra que, **hoy**, el flujo normal de la app no puede generar una por sí mismo.

**Impacto:** cualquier alta o edición de una novedad que dispare `requiere_escalamiento = true` (marcar un ítem de escalamiento, o solo elegir "Operación condicionada" sin ítems — ver BUSINESS_RULES.md §3.1) falla por completo hoy, para cualquier rol, incluido `admin`. Es un bug de disponibilidad/integridad activo, no solo una vulnerabilidad latente.

**Recomendación (urgente):** corregir `staff_insert_esc` para usar los valores reales en minúscula: `ARRAY['admin','editor','encargado','sede']` (o más simple, dado que el resto de las políticas de esta tabla ya no validan nada útil — ver §3.4 — unificar el criterio). Antes de aplicar el fix, confirmar con el equipo si todavía hay novedades con "Operación condicionada" que los usuarios estén reportando y fallando silenciosamente (revisar logs de errores del cliente si existen, o preguntar directamente si vienen notando que "se pierde" la novedad al marcar esa opción).

---

## 2. 🟠 ALTO

### 2.1 Esquema `equipo`: cualquier usuario logueado puede leer y modificar todo el módulo de RRHH

Las 5 tablas de `equipo` (`personas`, `evaluaciones`, `historial_personal`, `logros_config`, `logros_obtenidos`) tienen RLS **deshabilitado** (`relrowsecurity = false`) y grants de `SELECT/INSERT/UPDATE` otorgados a `authenticated` sin ninguna distinción de rol (sin grant a `anon`). Verificado vía `pg_class`/`information_schema.role_table_grants` (detalle completo en API.md §3.4).

**Impacto:** un usuario con rol `sede` o `encargado` (pensado para operar solo su propia sede) puede, con la misma sesión autenticada, leer y editar legajos, evaluaciones de desempeño y antecedentes disciplinarios de **cualquier** empleado de **cualquier** sede — no hay barrera de base de datos, y el frontend no aplica ningún filtro adicional verificado para este módulo. Dato sensible (evaluaciones, sanciones) sin control de acceso real.

**Recomendación:** habilitar RLS en las 5 tablas y restringir por rol (mínimo: solo `admin`/`grupo`/`encargado` de la sede correspondiente puede ver/editar; el resto solo lectura de su propio legajo si aplica).

### 2.2 Esquema `mantenimiento`: 4 tablas sin RLS y con grant a `anon` (alcance no confirmable del todo)

`ejecucion_items`, `plan_checklist`, `ticket_costos`, `visitas_activo` tienen RLS deshabilitado y grants completos (`SELECT/INSERT/UPDATE/DELETE`) otorgados tanto a `anon` como a `authenticated`. A diferencia de `equipo`, aquí el grant **sí** incluye `anon`.

**Lo que no se pudo verificar:** si el esquema `mantenimiento` está expuesto directamente en la API de PostgREST (`db_schemas`) — la consulta a `pg_settings` para ese parámetro no devolvió resultado desde esta conexión. Hay evidencia indirecta de que sí (varios módulos como `EquipoView.jsx`, `MntVehiculos.jsx`, `MntInsumos.jsx` llaman `supabase.schema('mantenimiento')` directo y funcionan en producción — ver API.md §3.1), pero no es una confirmación directa a nivel de configuración.

**Impacto si está expuesto:** acceso sin ningún login a costos de tickets, ítems de ejecución de planes preventivos y visitas de activos.

**Recomendación:** habilitar RLS en las 4 tablas independientemente de si hoy son explotables — el grant a `anon` no debería existir para tablas internas de operación, y depender de que el esquema no esté expuesto en PostgREST es una protección frágil (un cambio de configuración futuro lo expondría sin aviso).

### 2.3 `bitacora.registros`: las políticas por rol son decorativas — el acceso real es total

La tabla tiene políticas superpuestas por comando. Todas son `PERMISSIVE` (confirmado en `pg_policies.permissive`), y Postgres combina políticas permisivas del mismo comando con OR: alcanza con que una sola coincida.

| Comando | Política amplia (siempre coincide) | Políticas angostas (redundantes en la práctica) |
|---|---|---|
| SELECT | `read_registros`: `anon`+`authenticated`, `true` | `staff_read`, `sede_read` (scoped por rol/sede) |
| INSERT | `insert_registros`: `anon`+`authenticated`, `true` | `staff_insert`, `sede_insert` (scoped por rol/sede) |
| UPDATE | `update_registros`: `authenticated`, `true` | `staff_update` (solo admin/editor) |
| DELETE | — (no existe política amplia) | `staff_delete` (solo admin/editor) — pero **bloqueado igual a nivel de trigger** para cualquiera (BUSINESS_RULES.md §3, punto 1) |

**Verificación empírica:** simulando `anon` sin ningún token, dentro de una transacción revertida: `SELECT` sobre `registros` no dio error (acceso total de lectura), e `INSERT` de una fila de prueba se ejecutó sin error (alta sin autenticación).

**Impacto:** cualquiera con la `anon key` puede leer todas las novedades de todas las sedes y fabricar novedades falsas sin loguearse (riesgo de integridad del registro operativo). Cualquier usuario autenticado, sin importar su rol, puede modificar cualquier novedad de cualquier sede (la política angosta `staff_update` no resta nada, porque la amplia ya lo permite). Las políticas `staff_*`/`sede_*` dan una falsa sensación de control de acceso granular que no se sostiene.

**Recomendación:** eliminar las políticas amplias (`insert_registros`, `read_registros`, `update_registros`) y dejar que el control de acceso dependa exclusivamente de las políticas angostas ya existentes — que ya están bien diseñadas (validan rol y, para `sede`, pertenencia de `sede_id`). Esto es, en términos de esfuerzo, el fix de mayor impacto por menor cambio de todo este documento: las reglas correctas ya existen, solo hace falta borrar las que las anulan.

### 2.4 Varias tablas de `bitácora` están completamente abiertas a `anon`+`authenticated`, sin ningún scoping

Verificado en `pg_policies` (`qual`/`with_check` = `true`, sin condición):

| Tabla | Comandos abiertos | Roles |
|---|---|---|
| `adjuntos` | SELECT, INSERT, DELETE | `anon`, `authenticated` |
| `capa` | ALL (incluye DELETE) | `anon`, `authenticated` |
| `contactos` | SELECT, INSERT, UPDATE | `anon`, `authenticated` |
| `no_conformidades` | ALL (incluye DELETE) | `anon`, `authenticated` |
| `requerimientos` | ALL (incluye DELETE) | `public` (= cualquier rol) |
| `sede_contactos` | ALL (incluye DELETE) | `public` |
| `tareas` | SELECT, INSERT, UPDATE | `anon`, `authenticated` |
| `sedes` | ALL (escritura) | `authenticated`; SELECT también abierto a `anon` |

Como contraste, `checklists`/`checklist_items` sí están bien resueltas (políticas con condición real por rol/autor) — no es que el patrón de RLS scoped no exista en el proyecto, es que se aplicó de forma inconsistente entre tablas.

**Impacto:** desde borrar adjuntos o no conformidades ajenas, hasta crear/editar requerimientos de compra o contactos de cualquier sede, sin restricción de rol — en varios casos sin necesidad ni de estar logueado.

**Recomendación:** mismo patrón que §2.3 — definir qué rol/condición debería aplicar a cada tabla (probablemente `staff` para escritura, lectura amplia para autenticados) y reemplazar las políticas `true` por esas condiciones.

### 2.5 `SedeFicha.jsx`: bug de esquema rompe KPIs de tickets/activos en la ficha de sede

Ya documentado en API.md §3.2 y BUSINESS_RULES.md §5 — se repite aquí por severidad. El componente llama `supabase.schema('mantenimiento').from('mnt_tickets')` y `.from('mnt_activos')`, pero esos nombres son vistas que existen únicamente en `public`, no en `mantenimiento`. La consulta apunta a una relación inexistente en ese esquema, por lo que el KPI de "tickets críticos" y los datos de activos en esa pantalla probablemente no muestren datos reales hoy.

**Recomendación:** cambiar esas dos llamadas a `supabase.from('mnt_tickets')`/`.from('mnt_activos')` (sin `.schema('mantenimiento')`), igual que se hace en el resto del código para esas vistas.

### 2.6 Dos bugs "fail-open" en el cálculo de permisos por sede (`src/lib/auth.jsx`)

Ya documentado en BUSINESS_RULES.md §1.2 — se repite aquí por severidad. Un perfil `grupo` sin `grupo_id`, o `encargado`/`sede` sin `sede_ids` (o con array vacío), cae en la rama `else` de `loadPerfil()` y termina con `allowedSedeIds = null`, es decir, **sin restricción, viendo todas las sedes** — el resultado opuesto al que su rol sugiere. Un perfil mal configurado (por error humano al crearlo) queda con más acceso del que debería tener, no con menos.

**Recomendación:** cambiar el `else` final para que, en ausencia de `grupo_id`/`sede_ids` válidos, el resultado sea un array vacío (`[]`, sin sedes visibles) en lugar de `null` (todas). Failar cerrado, no abierto.

### 2.7 Modal "Ver Reporte" en Escalamientos no mostraba ningún dato — ✅ corregido y deployado (2026-06-18)

**Reportado por el usuario** con captura real: al hacer clic en "Ver Reporte" sobre un escalamiento pendiente, el modal abría vacío (`REPORTANTE: —`, `DETALLE POR CATEGORÍA: Sin detalle por categoría`, sin adjuntos), **sin mostrar ningún error** — el síntoma más confuso de diagnosticar, porque no hay nada en consola que indique la causa.

**Causa raíz (verificada leyendo el código fuente):** en `src/views/Escalamientos.jsx`, el componente calculaba correctamente un objeto `selRegistro` (uniendo el `id` seleccionado con los datos del registro vía join), pero **nunca lo usaba**. El JSX que renderiza el modal pasaba en cambio `registro={{ id: selRegId }}` — un objeto con *únicamente* el `id`, sin ningún otro campo. `RegistroModal` recibe `sede_nombre`, `reportante`, `estado_a..h`, etc. todos `undefined`, y como React simplemente renderiza eso como texto vacío/fallback en vez de tirar una excepción, no aparece ningún error visible. Coincide exactamente con lo reportado.

Además, el join de `getEscalamientosItems()` en `src/lib/queries.js` solo traía 4 columnas del registro relacionado (`id, fecha_reporte, turno, estado_general`) — insuficiente aunque se hubiera usado `selRegistro` tal cual, porque a `RegistroModal` le faltarían igual `reportante`, `estado_a..h`, `detalle_a..h`, `sede_id`, etc.

**Fix aplicado en este paquete** (código, sin cambios de esquema — ya guardado en el repo, pendiente de deploy a Vercel):
- `src/lib/queries.js`: `.select('*, registros(id, fecha_reporte, turno, estado_general)')` → `.select('*, registros(*)')` (trae el registro completo).
- `src/views/Escalamientos.jsx`: `registro={{ id: selRegId }}` → `registro={selRegistro}`.

**Estado:** deployado a Vercel por el usuario el 2026-06-18. Pendiente verificación en vivo (re-click en "Ver Reporte" en producción) para confirmar que el modal ya muestra los datos completos.

### 2.8 Guardar/editar un ticket de Mantenimiento falla: `creado_por` no existe en `mnt_tickets` — ✅ corregido (2026-06-18)

**Reportado por el usuario** con captura real: al editar el ticket #571 ("Desnivelado") y guardar, aparece el error `Could not find the 'creado_por' column of 'mnt_tickets' in the schema cache`.

**Causa raíz (verificada cruzando esquema real + código):** `mantenimiento.tickets` (la tabla real, 677 filas) sí tiene la columna `creado_por` (uuid, FK a `bitacora.perfiles`) y también `evidencia_url`. Pero `public.mnt_tickets` —la vista que el frontend realmente usa (`src/lib/queries.js`, `createTicket`/`updateTicket` apuntan a `supabase.from('mnt_tickets')`, sin especificar esquema, o sea `public`)— es una vista simple (`SELECT <31 columnas explícitas> FROM mantenimiento.tickets`, sin joins, confirmado con `pg_get_viewdef`) que **no incluye ni `creado_por` ni `evidencia_url`**. No es caché de PostgREST desactualizado: la columna directamente no está en la definición de la vista.

`src/views/mantenimiento/MntTickets.jsx` (línea 378) manda `creado_por: perfil?.id || null` en **todo** guardado (alta y edición), así que el error se dispara siempre, para cualquier usuario, en cualquier ticket. `evidencia_url` no se usa en ningún lugar del código hoy — es un campo faltante en la vista pero todavía no es un bug activo.

**Fix aplicado (cambio de esquema, confirmado por el usuario y ejecutado el 2026-06-18):**

```sql
CREATE OR REPLACE VIEW public.mnt_tickets AS
SELECT id, numero, tipo, activo_id, activo_nombre, estado, descripcion, diagnostico,
       responsable, responsable_id, proveedor_id, prioridad, sede, sede_id, categoria,
       lectura_km, fecha_limite, fecha_cierre, costo, presupuesto, presupuesto_aprobado,
       es_externo, presupuesto_estado, costo_estimado, costo_real, oc_numero, oc_estado,
       notas_costos, created_at, updated_at, escalamiento_id,
       creado_por, evidencia_url
FROM mantenimiento.tickets;
```

**Estado:** vista recreada vía `apply_migration`, verificado que ambas columnas aparecen en `information_schema.columns` y que el conteo de filas (677) no cambió. Es un cambio de base de datos — ya está activo en producción sin necesidad de deploy de frontend. Pendiente verificación en vivo (guardar un ticket real) para confirmar que el error no vuelve a aparecer.

---

### 2.9 Crear/editar un ticket falla al elegir sede: `sede_nombre` no existe en `mnt_tickets` — ✅ corregido localmente (2026-06-19)

**Reportado por el usuario** con captura real: al crear un ticket aparece `Could not find the 'sede_nombre' column of 'mnt_tickets' in the schema cache`.

**Causa raíz:** `TicketModal` guardaba tres representaciones de la sede en el formulario (`sede_id`, `sede` y `sede_nombre`) y luego enviaba `...form` completo. Tanto `mantenimiento.tickets` como `public.mnt_tickets` usan `sede` y `sede_id`; no existe `sede_nombre` en esa relación.

**Fix local:** se eliminó la asignación redundante de `sede_nombre` en `MntTickets.jsx` y `createTicket`/`updateTicket` ahora normalizan defensivamente el payload: si reciben el alias, lo convierten a `sede` y nunca lo envían a PostgREST.

**Estado:** build local exitoso. Pendiente deploy y verificación por el usuario creando/editando un ticket con sede; no se escribieron datos de prueba porque no existe staging.

---

### 2.10 Adjuntos de tickets/activos fallaban porque `entity_id` era `bigint` y sus IDs son UUID — ✅ corregido (2026-06-19)

**Reportado por el usuario** con captura real: al subir un archivo al ticket aparece `invalid input syntax for type bigint` seguido del UUID del ticket.

**Causa raíz:** `bitacora.adjuntos` es una relación polimórfica genérica, pero `entity_id` fue definido como `bigint`. Funciona para entidades de ID numérico (`registro`, `capa`, `requerimiento`) y falla para `mantenimiento.tickets`/`activos`, cuyos IDs son UUID.

**Fix requerido:** cambiar `entity_id` a `text` con `USING entity_id::text`; no tiene FK y la conversión preserva los IDs numéricos existentes. El frontend ya normaliza todos los IDs con `String()` y elimina del Storage el archivo recién subido si el INSERT de metadatos falla.

**Estado:** columna cambiada a `text` por el usuario en Supabase y verificada mediante `information_schema.columns` (captura real). Frontend corregido y build exitoso; falta desplegar esa versión y repetir una carga. La prueba fallida anterior probablemente dejó un archivo huérfano en Storage porque la versión desplegada todavía no hacía rollback.

---

### 2.11 Impresión y navegación QR de activos incompletas — ✅ corregido localmente (2026-06-19)

**Reportado por el usuario** con captura real: la etiqueta impresa mostraba texto pero no la imagen QR. Además, el flujo debía abrir la ficha autorizada del equipo para consultar manuales o generar un ticket.

**Causas raíz encontradas:** la impresión se lanzaba con un timeout fijo de 400 ms sin esperar la carga de la imagen remota; en pantallas menores a 768 px `MobileApp` interceptaba la ruta `?scan=activo&id=<uuid>`; la vista QR convertía el UUID con `Number()` al consultar tickets; y el alta rápida enviaba una columna inexistente `titulo`.

**Fix local:** impresión en blanco y negro que espera `img.onload`; etiqueta de 80 mm con marco y sin ubicación; ruta QR prioritaria en mobile después de autenticar; contenedor mobile con scroll propio; UUID conservado como string; payload de ticket válido; acceso desde la ficha QR a manual principal y documentos/adjuntos del activo.

**Estado:** build final exitoso. Pendiente deploy y prueba física de impresión/escaneo desde un teléfono autenticado y otro sin sesión. El scoping por sede/rol todavía requiere diseño y aplicación de RLS; ocultar botones en frontend no sería suficiente.

---

### 2.12 Alta de ticket QR ofrecía `predictivo`, rechazado por `tickets_tipo_check` — ✅ corregido localmente (2026-06-19)

**Reportado por el usuario** con captura real desde teléfono: al guardar una avería de tipo `predictivo`, Postgres respondió `new row for relation "tickets" violates check constraint "tickets_tipo_check"`.

**Causa raíz:** el constraint real admite solo `correctivo`/`preventivo`, pero QR, ticket rápido, editor principal y el editor legado de Kanban contenían opciones adicionales incompatibles.

**Fix local:** `TICKET_TIPOS_VALIDOS` centraliza los dos valores permitidos; todas las superficies lo reutilizan y `normalizeTicketPayload()` valida defensivamente antes de llamar a Supabase con un mensaje comprensible.

**Estado:** build exitoso y cero tipos incompatibles restantes en `src/`. Pendiente deploy y repetición del alta QR. La captura confirma que navegación, login, ficha, documentos y scroll mobile ya alcanzan correctamente el formulario.

---

## 3. 🟡 MEDIO

### 3.1 El menú (`Sidebar.jsx`) no oculta módulos por rol — el control real depende de cada vista, no verificado vista por vista

Ya documentado en BUSINESS_RULES.md §1.3. Solo la sección "ADMIN" (Usuarios, Trazabilidad) está gateada por `isAdmin`; todo lo demás (Mantenimiento, Flota, Equipo, Calidad, etc.) se muestra a todos los roles. El redirect automático de `encargado`/`sede` a `sedeEncargado` es solo la pantalla de entrada, no una barrera — nada impide navegar manualmente a cualquier otra vista. Si esas vistas filtran sus datos según `allowedSedeIds` no fue auditado módulo por módulo en este paquete (ver BACKLOG.md).

### 3.2 RBAC 100% client-side, sin equivalente sistemático en RLS

Esto es la causa raíz de la categoría de hallazgos de §2.3/§2.4: `allowedSedeIds` se calcula en el navegador y depende de que cada query del frontend lo respete. Donde sí hay políticas RLS con condición real (`staff_*`/`sede_*` en `registros`, `checklist_items`/`checklists`), quedan anuladas por políticas amplias coexistentes (§2.3) o simplemente no existen para otras tablas (§2.4). No hay, hoy, una single source of truth de control de acceso a nivel de base que refleje el modelo de roles documentado en BUSINESS_RULES.md §1.

### 3.3 Edge Function `bitacora-ingest` sin ninguna verificación de autenticación

Ya documentado en API.md §1.3. A diferencia de `invite-user` y `admin-user-actions`, no valida JWT ni ningún secreto compartido en su código. No está referenciada desde `src/`, lo que sugiere un consumidor externo (posiblemente vinculado al sistema de Apps Script de los hilos de trabajo previos sobre el gap de novedades — no confirmado de forma directa). Cualquiera que conozca la URL del endpoint puede insertar filas en `bitacora.registros` sin credenciales.

### 3.4 Valores de rol "fantasma" en políticas RLS (no bloquean nada, pero son ruido/trampa de mantenimiento)

Distinto del hallazgo de §1.2 (que sí bloquea todo): estas políticas tienen una rama muerta dentro de una lista `OR` más amplia, así que el resto de la condición sigue funcionando:

- `escalamientos.staff_read_esc` incluye `'viewer'` en su lista de roles permitidos — valor que no existe en el `CHECK` de `perfiles.rol`. Las otras 5 ramas (`admin`, `editor`, `encargado`, `consultor`, `grupo`) sí son válidas y funcionan.
- `auditoria`'s política `Admins ven auditoria` incluye `'superadmin'` además de `'admin'` — solo `'admin'` puede coincidir alguna vez.

**Recomendación:** limpiar estos valores al corregir §1.2, para que el código de las políticas no sugiera roles que no existen (riesgo de confusión para el próximo desarrollador, no riesgo de seguridad en sí).

### 3.5 `invite-user`: fallback `rol: rol || 'Editor'` capitalizado (latente, no disparado por la UI actual)

Ya documentado en BUSINESS_RULES.md §1.5. El flujo actual (`Usuarios.jsx`) siempre envía un `rol` válido en minúscula, así que este fallback no se ejecuta hoy. Si alguna vez se dispara, falla con error de constraint (no guarda un perfil corrupto silenciosamente). Corregir el literal a `'editor'` por prolijidad.

---

### 3.6 Tareas mostraba códigos `CAT.H`/`CAT.X` en lugar del nombre de categoría — ✅ corregido localmente (2026-06-19)

**Reportado por el usuario** con captura real de la vista Kanban. La fuente de etiquetas ya existía en `TareaForm.jsx`, pero las superficies no la presentaban de forma consistente: tabla mostraba `Cat.H`, mobile solo `H`, y Kanban combinaba código + etiqueta.

**Fix local:** se agregó `getCategoriaLabel()` como helper compartido y Kanban, tabla y mobile muestran solo el nombre humano (`Cliente / Usuario / Incidentes`, por ejemplo). El helper acepta mayúsculas/minúsculas y conserva como fallback cualquier valor desconocido.

**Estado:** helper verificado con 3 casos y build local exitoso. Pendiente deploy del frontend.

---

### 3.7 La pestaña Adjuntos del ticket quedaba vacía por props incorrectas — ✅ corregido localmente (2026-06-19)

**Detectado al revisar la solicitud de adjuntar archivos y manuales:** `MntTickets.jsx` invocaba `AdjuntosPanel` con `entidad`/`entidadId`, pero el componente espera `entityType`/`entityId`. Al no recibir ID, retornaba `null` y la pestaña quedaba vacía sin error.

**Fix local:** el ticket usa ahora `entityType="ticket"`/`entityId={ticket.id}`. La ficha del activo incorpora además una pestaña “Documentos / Manuales” con `entityType="activo"`, reutilizando el mismo almacenamiento genérico para archivos y links externos.

**Estado:** contrato de todos los usos de `AdjuntosPanel` verificado y build local exitoso. Pendiente deploy y prueba de una subida real; no se probó contra producción porque no existe staging.

---

### 3.8 Tickets y Tablero de Gestión usaban editores distintos para la misma fila — ✅ corregido localmente (2026-06-19)

**Reportado por el usuario** al comparar el ticket #680 en ambas vistas. Los dos módulos ya operaban sobre la misma fila de `public.mnt_tickets`, pero Kanban mantenía un editor parcial duplicado, mientras Tickets ofrecía Datos, Historial, Costos/OC y Adjuntos.

**Riesgo:** dos formularios para la misma entidad podían evolucionar con campos y validaciones diferentes. Además, Kanban consultaba una selección parcial de columnas, peligrosa si se reutilizaba para guardar el objeto completo.

**Fix local:** `MntTickets.jsx` exporta el editor completo y `MntKanban.jsx` lo reutiliza directamente. Kanban carga tickets completos mediante `getTickets()`, junto con los catálogos de activos, responsables, proveedores y sedes. Arrastrar conserva el cambio rápido de estado; hacer clic abre el mismo editor completo que la pantalla Tickets.

**Estado:** build local exitoso. No requiere cambios en Supabase; pendiente deploy y verificación visual.

---

## 4. ⚪ BAJO

### 4.1 10 funciones trigger con `EXECUTE` otorgado a `anon`/`authenticated`, pero inertes

Ya documentado en API.md §2.2. Postgres no permite invocar una función de retorno `trigger` fuera de un contexto de trigger real, así que el grant heredado (nunca revocado) no es explotable. Limpieza de higiene, no riesgo activo.

### 4.2 Código fuente de las 3 Edge Functions sin respaldo en ningún repositorio

Ya documentado en DEPLOYMENT.md §1. Recuperado para este paquete consultando el proyecto en vivo; no existe en ningún archivo del repo.

### 4.3 Sin control de versiones (`.git`) ni CI/CD

Ya documentado en PROJECT_STATUS.md.

### 4.4 Carpeta duplicada `bitacora-dashboard/bitacora-dashboard/`

Ya documentado en SETUP.md §2 y REPOSITORY_AUDIT.md.

### 4.5 Archivos residuales en la raíz del repo

~52 `vite.config.js.timestamp-*.mjs`, 3 carpetas de build (`dist/`, `dist2/`, `dist_v2/`), un `BITACORA.MD.docx` de 221 KB. Ya documentado en SETUP.md §6.

---

## 5. Tabla resumen

| # | Hallazgo | Severidad | Verificación | Esfuerzo de fix estimado |
|---|---|---|---|---|
| 1.1 | `perfiles` totalmente abierta — escalación a admin sin login | 🔴 Crítico | Empírica | Medio (rediseñar 3 políticas + trigger anti-auto-promoción) |
| 1.2 | RLS rompe creación de escalamientos para todos | 🔴 Crítico | Empírica | Bajo (corregir 1 policy: minúsculas) |
| 2.1 | `equipo` sin RLS — RRHH abierto a cualquier autenticado | 🟠 Alto | Estática | Medio (habilitar RLS + políticas por rol en 5 tablas) |
| 2.2 | `mantenimiento` 4 tablas sin RLS + grant a `anon` | 🟠 Alto | Estática (alcance no confirmable) | Medio |
| 2.3 | `registros` — políticas angostas anuladas por amplias | 🟠 Alto | Empírica | Bajo (borrar 3 políticas amplias) |
| 2.4 | 8 tablas de bitácora totalmente abiertas | 🟠 Alto | Estática | Medio (definir y aplicar condición por tabla) |
| 2.5 | `SedeFicha.jsx` apunta a esquema incorrecto | 🟠 Alto | Estática (código) | Muy bajo (2 líneas) |
| 2.6 | Fail-open en `grupo`/`encargado`/`sede` sin asignación | 🟠 Alto | Estática (código) | Muy bajo (cambiar `null` por `[]`) |
| 2.7 | Modal "Ver Reporte" vacío en Escalamientos | 🟠 Alto | Empírica (reproducido en vivo) | ✅ Corregido y deployado |
| 2.8 | `mnt_tickets` sin `creado_por`/`evidencia_url` — falla guardado de tickets | 🟠 Alto | Empírica (reproducido en vivo) | ✅ Corregido (vista recreada) |
| 2.9 | `sede_nombre` enviado a `mnt_tickets` — falla guardado al elegir sede | 🟠 Alto | Empírica (captura real) + estática | ✅ Corregido localmente; falta deploy |
| 2.10 | `adjuntos.entity_id` bigint rechazaba UUID de tickets/activos | 🟠 Alto | Empírica + verificación de columna | ✅ Corregido en Supabase; falta deploy/prueba final |
| 2.11 | QR de activo no imprimía imagen y el flujo mobile/ticket usaba UUID incorrectamente | 🟠 Alto | Empírica (captura) + estática | ✅ Corregido localmente; falta deploy/prueba física |
| 2.12 | QR ofrecía tipos de ticket rechazados por el CHECK | 🟠 Alto | Empírica (captura) + constraint documentado | ✅ Corregido localmente; falta deploy/prueba final |
| 3.1 | Sidebar no oculta por rol | 🟡 Medio | Estática (código), no auditado vista por vista | Medio (requiere auditoría adicional) |
| 3.2 | RBAC sin equivalente sistemático en RLS | 🟡 Medio | Estática | Alto (rediseño transversal) |
| 3.3 | `bitacora-ingest` sin autenticación | 🟡 Medio | Estática (código) | Bajo (agregar secreto compartido o JWT) |
| 3.4 | Roles fantasma en políticas (`viewer`, `superadmin`) | 🟡 Medio | Estática | Muy bajo |
| 3.5 | `invite-user` fallback capitalizado | 🟡 Medio | Estática (código) | Muy bajo |
| 3.6 | Tareas muestra códigos de categoría en vez de etiquetas humanas | 🟡 Medio | Empírica (captura real) + estática | ✅ Corregido localmente; falta deploy |
| 3.7 | Adjuntos del ticket vacío por props incorrectas | 🟡 Medio | Estática (código) | ✅ Corregido localmente; falta deploy/prueba real |
| 3.8 | Tickets y Kanban tenían editores diferentes para la misma fila | 🟡 Medio | Empírica (capturas) + estática | ✅ Corregido localmente; falta deploy |
| 4.1–4.5 | Higiene de repo/infraestructura | ⚪ Bajo | Estática | Bajo |

## 6. Lo que este documento no cubre

No se auditó línea por línea cada vista de escritorio/mobile para confirmar que respeta `allowedSedeIds` en sus queries (§3.1) — es el ítem de mayor incertidumbre restante y queda como acción de seguimiento en BACKLOG.md. Tampoco se verificó si existen otros consumidores de la `anon key` además del frontend (por ejemplo, si algún script externo ya depende del comportamiento abierto de alguna de las tablas de §2.3/§2.4 — corregir esas políticas sin coordinar podría romper algo que hoy "funciona" apoyado en el agujero).
