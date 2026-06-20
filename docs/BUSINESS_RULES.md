# BUSINESS_RULES — bitacora-dashboard

> Verificado contra `src/lib/auth.jsx` (completo), `src/App.jsx`, `src/components/Sidebar.jsx`, `src/mobile/MobileReporte.jsx`, `src/views/Usuarios.jsx` y los `CHECK` constraints reales del proyecto Supabase `mixyhfdlzjarvszinytk` (consultados vía `pg_constraint`, no transcriptos de memoria). Fecha de verificación: 2026-06-17.

## 1. Roles y control de acceso (RBAC)

### 1.1 Roles válidos

`bitacora.perfiles` tiene un `CHECK` que limita `rol` a exactamente estos 6 valores (en minúscula, sin excepción):

```
admin | editor | consultor | encargado | grupo | sede
```

Cualquier intento de guardar un perfil con un valor fuera de esta lista (incluida una variante con mayúscula, ej. `'Editor'`) es rechazado por Postgres a nivel de constraint (`23514`), no es una validación de la aplicación.

### 1.2 Qué determina cada rol (verificado en `src/lib/auth.jsx`)

| Rol | `allowedSedeIds` resultante | Efecto |
|---|---|---|
| `admin` | `null` (sin restricción) | Ve todas las sedes. Único rol con acceso a "Usuarios" y "Trazabilidad" (gateado en `App.jsx:navigate()` e `isAdmin` en `Sidebar.jsx`). |
| `editor` | `null` (sin restricción) | Ve todas las sedes. Sin diferencia de UI/menú respecto a `consultor` salvo lo que cada vista decida internamente (no se encontró ninguna). |
| `consultor` | `null` (sin restricción) | Mismo alcance de datos que `admin`/`editor` en cuanto a sedes — el nombre sugiere un rol de solo lectura, pero `allowedSedeIds=null` no implica ninguna restricción de escritura por sí solo; cualquier limitación de "solo lectura" para este rol tendría que estar en otra parte del código y no se encontró. **Es también el rol por defecto que recibe automáticamente cualquier usuario autenticado sin perfil existente** (`loadPerfil()`, ver §1.4). |
| `grupo` | IDs de sedes activas del `grupo_id` del perfil | Ve solo las sedes de su grupo — pero **solo si `grupo_id` está seteado**; si es `null`, cae al `else` final y termina con `allowedSedeIds=null` (sin restricción). |
| `encargado` / `sede` | El array `sede_ids` del perfil | Ve solo esas sedes — pero **solo si `sede_ids` tiene al menos un elemento**; si está vacío o `null`, cae al mismo `else` final y termina **sin restricción** (ve todas las sedes). |

⚠️ **Patrón "fail-open" en dos ramas**: tanto `grupo` sin `grupo_id` como `encargado`/`sede` sin `sede_ids` terminan en la misma rama `else` que da acceso sin restricción a todas las sedes, en lugar de no dar acceso a ninguna. Un perfil mal configurado (creado a mano, por ejemplo, sin asignarle sedes) queda con más alcance del que su rol sugiere, no menos. Detalle de severidad en KNOWN_ISSUES.md.

### 1.3 Qué NO está restringido por rol

`Sidebar.jsx` muestra **todos** los ítems de menú a **todos** los roles excepto la sección "ADMIN" (Usuarios, Trazabilidad), que solo se renderiza si `isAdmin`. No hay gating por rol en ningún otro ítem del menú (Mantenimiento, Flota, Equipo, Calidad, etc.). La única restricción de navegación a nivel de código está en `App.jsx`: `if (view === 'usuarios' && !isAdmin) return`.

Los roles `encargado`/`sede` son redirigidos automáticamente a la vista `sedeEncargado` **solo como pantalla de entrada** (si `activeView === 'dashboard'` al cargar la sesión). Esto es una preferencia de landing page, no una restricción de acceso: nada en el código impide que un usuario con rol `encargado`/`sede` haga clic manualmente en cualquier otro ítem del menú (Dashboard global, Mantenimiento, Flota, Equipo, etc.). Si esas vistas filtran o no sus datos según `allowedSedeIds` no fue verificado vista por vista en este paquete — queda como punto a revisar (ver BACKLOG.md).

### 1.4 Auto-aprovisionamiento de perfiles

Cualquier usuario que se autentique contra Supabase Auth y no tenga fila en `bitacora.perfiles` recibe automáticamente una al primer login, con `rol: 'consultor'`, `activo: true`, y `nombre`/`email` tomados de los metadatos de Auth (`loadPerfil()` en `auth.jsx`). No hay paso de aprobación manual entre "se crea el usuario en Auth" y "tiene un perfil operativo con acceso sin restricción de sede".

### 1.5 Invitación de usuarios (`invite-user`, detalle técnico en API.md)

El flujo normal (`Usuarios.jsx`) siempre envía un `rol` explícito en minúscula (el `<select>` del formulario inicializa en `'editor'` y solo ofrece los 6 valores válidos) — verificado, no es una suposición. La función `invite-user` tiene un *fallback* `rol: rol || 'Editor'` (capitalizado) para el caso en que no llegue `rol` en el body. Por el `CHECK` de §1.1, si ese fallback se ejecutara alguna vez, el `upsert` a `bitacora.perfiles` fallaría con un error de constraint (no se guardaría un perfil con rol mal escrito de forma silenciosa). Es un defecto latente y de baja probabilidad de disparo con la UI actual, no un bug activo — corregir igual el literal a `'editor'` por prolijidad (ver BACKLOG.md).

### 1.6 Matriz de acceso propuesta para el flujo QR (pendiente de aprobación y RLS)

No se agrega un rol nuevo “medio”; se reutilizan los 6 valores válidos. Esta matriz es la propuesta funcional acordada como punto de partida el 2026-06-19 y todavía no constituye una barrera real hasta implementarla en RLS:

| Rol | Activos/manuales | Notificar avería / crear ticket | Gestionar ticket | Costos/proveedores | Usuarios/seguridad |
|---|---|---|---|---|---|
| `sede` | Solo sedes asignadas | Sí, en sus sedes; puede adjuntar evidencia | Ver seguimiento; no reasignar ni cerrar | No | No |
| `encargado` | Solo sedes asignadas | Sí | Actualizar estado, prioridad y notas en sus sedes | Solo lectura | No |
| `grupo` | Sedes de su grupo | Sí | Gestionar tickets del grupo | Solo lectura | No |
| `consultor` | Lectura según alcance a definir | No | Solo lectura | Solo lectura | No |
| `editor` | Todas las sedes | Sí | Gestión operativa completa | Sí | No |
| `admin` | Todas las sedes | Sí | Gestión completa | Sí | Sí |

Regla QR propuesta: sin sesión se muestra Login y se conserva la URL; autenticado pero fuera del alcance de la sede recibe “Activo no autorizado”; un rol operativo de sede puede como mínimo abrir la ficha, consultar manuales, notificar una avería y ver el seguimiento del ticket creado.

## 2. Dominios de valores por módulo (enforced a nivel de base, vía `CHECK`)

Estos son los únicos valores que Postgres acepta para cada campo de estado/clasificación — cualquier UI que ofrezca opciones distintas generaría un error al guardar, no una inconsistencia silenciosa.

### 2.1 Bitácora / Novedades

| Tabla.campo | Valores válidos |
|---|---|
| `registros.turno` | `Apertura`, `Cierre`, `Único` |
| `registros.estado_general` | `Sin novedades`, `Hay novedades`, `Operación condicionada` |
| `registros.nivel_actividad` | `Normal`, `Pico`, `Bajo` |
| `registros.origen_form` | `Comedores`, `Hospitales` |
| `checklists.tipo` / `checklist_items.tipo` | `apertura`, `cierre` |
| `escalamientos.estado` | `Pendiente`, `En gestión`, `Resuelto` |
| `tareas.estado` | `Pendiente`, `En proceso`, `Resuelto`, `Cancelado` |
| `tareas.prioridad` | `Alta`, `Media`, `Baja` |
| `tareas.categoria` | `A` Producción / Servicio del turno; `B` Cadena de frío y conservación; `C` Recepción / Abastecimiento; `D` Stock crítico; `E` Equipos / Mantenimiento; `F` Higiene / BPM; `G` Personal / Dotación; `H` Cliente / Usuario / Incidentes; `OTRA` Otras. Fuente de verdad del frontend: `src/components/TareaForm.jsx`. |
| `no_conformidades.estado` | `Abierta`, `En proceso`, `Cerrada`, `Verificada` |
| `capa.tipo` | `Correctiva`, `Preventiva` |
| `capa.estado` | `Pendiente`, `En ejecución`, `Completada`, `Verificada` |
| `requerimientos.estado` | `Pendiente`, `Observado`, `Aprobado`, `Enviado`, `En compra`, `Recibido`, `Cumplido`, `Rechazado`, `Cancelado` (frontend implementado; requiere aplicar migración local pendiente) |
| `requerimientos.urgencia` | `alta`, `media`, `baja` |
| `requerimientos.tipo_compra` | `reposicion`, `prueba`, `unica` |
| `sedes.tipo` | `Comedor`, `Hospital`, `Aeropuerto`, `Universidad`, `Planta`, `Oficina`, `Otro` (a pesar de que el negocio actual es solo comedores y hospitales, el dominio ya contempla otros tipos de sede) |

### 2.2 Mantenimiento / Flota

| Tabla.campo | Valores válidos |
|---|---|
| `activos.tipo` | `VEHICULO`, `EQUIPO`, `INSTALACION` |
| `activos.estado` | `operativo`, `en_reparacion`, `baja` |
| `tickets.tipo` | `correctivo`, `preventivo` |
| `tickets.prioridad` | `baja`, `media`, `alta`, `critica` |
| `tickets.estado` | `abierto`, `aprobado`, `en_progreso`, `resuelto`, `rechazado` |
| `tickets.oc_estado` | `sin_oc`, `pendiente`, `emitida`, `aprobada` |
| `tickets.presupuesto_estado` | `sin_presupuesto`, `pendiente_aprobacion`, `aprobado`, `rechazado` |
| `ticket_costos.tipo` | `mano_obra`, `repuesto`, `servicio_externo`, `traslado`, `otros` |
| `matafuegos.estado` | `operativo`, `vencido`, `baja` |
| `inspecciones_matafuegos.resultado` | `ok`, `observado`, `baja` |
| `movimientos_insumo.tipo` | `entrada`, `salida`, `ajuste` |
| `planes_preventivos.estado` | `activo`, `pausado`, `archivado` |
| `proveedores.estado` | `activo`, `inactivo`, `bloqueado` |
| `proveedores.rating` | entero 0–5 |
| `reglas_escalacion.prioridad` | `alta`, `media`, `baja` |
| `responsables.nivel_escalacion` | `1`, `2`, `3` |
| `visitas_activo.tipo_visita` | `inspeccion`, `mantenimiento`, `reparacion`, `entrega`, `otro` |

### 2.3 Equipo / RRHH

| Tabla.campo | Valores válidos |
|---|---|
| `evaluaciones.*` (9 columnas `p1…p3`, `d1…d3`, `e1…e5`) | entero 1–5 cada una |
| `evaluaciones.resultado_global` | `Bajo`, `Aceptable`, `Alto`, `Excelente` |
| `historial_personal.tipo` | `apercibimiento`, `suspension`, `llamado_atencion`, `reconocimiento`, `logro`, `otro` |

## 3. Reglas de integridad embebidas en triggers (no en el código del frontend)

Estas reglas se aplican **siempre**, sin importar qué cliente escriba (frontend, Edge Function, o cualquier llamada directa con la `anon key`), porque viven en triggers de Postgres:

1. **`bitacora.registros` no se puede borrar.** Dos triggers redundantes (`protect_registros`, `block_delete_registros`) lanzan una excepción ante cualquier `DELETE`. Ni el frontend ni nadie con acceso directo a la tabla puede eliminar una novedad — solo modificarla.
2. **`fecha_reporte` se autocompleta.** Si un `INSERT` en `registros` no trae `fecha_reporte`, el trigger `fix_fecha_reporte` la setea a `NOW()`.
3. **Sincronización automática `registros → escalamientos`** (trigger `fn_sync_escalamiento`, dispara en `INSERT`/`UPDATE` de `registros`): si `requiere_escalamiento = true` y todavía no existe una fila en `escalamientos` para ese `registro_id`, se crea una automáticamente, con:
   - `tipo`: `'RRHH'` si `escalado_a = 'RR HH'` exactamente; `'Otro'` si `escalado_a` es `NULL`; en cualquier otro caso, el valor literal de `escalado_a` tal cual venga.
   - `descripcion`: `motivo_escalamiento`, o `'Sin detalle'` si viene vacío.
   - `estado` inicial: siempre `'Pendiente'`.
   - La condición `NOT EXISTS` evita duplicar el escalamiento si el registro se vuelve a actualizar, pero también significa que **el escalamiento inicial nunca se actualiza** si después cambia el motivo o el destino en el registro original — quedaría desincronizado (no se encontró ningún trigger de `UPDATE` que sincronice cambios posteriores).

### 3.1 Caso particular verificado: `MobileReporte.jsx` puede generar un escalamiento "vacío"

En el formulario de novedad mobile (`src/mobile/MobileReporte.jsx:275-280`), `requiere_escalamiento` se calcula como `escalamientos.length > 0 || estadoGeneral === 'Operación condicionada'`. Esto significa que marcar el estado general como "Operación condicionada" **sin agregar ningún ítem de escalamiento específico** igual dispara la creación automática de una fila en `escalamientos` (vía el trigger de §3, punto 3) — pero con `escalado_a = NULL` y `motivo_escalamiento = NULL`, por lo que termina como `tipo: 'Otro'`, `descripcion: 'Sin detalle'`. Esto explica por qué pueden aparecer escalamientos sin información útil en la vista Escalamientos: no es un bug de esa vista, es la consecuencia esperada de esta combinación de inputs.

### 3.2 Caso particular verificado: un registro con múltiples tipos de escalamiento se aplana en un solo string

Si el usuario agrega más de un ítem de escalamiento en el formulario (por ejemplo, uno de tipo "Mantenimiento" y otro de tipo "RR HH"), `MobileReporte.jsx` los combina en un solo campo `escalado_a` del registro como string separado por comas (`[...new Set(...)].join(', ')`). El trigger `fn_sync_escalamiento` solo reconoce el valor exacto `'RR HH'` para mapearlo a `'RRHH'`; cualquier string combinado (ej. `"Mantenimiento, RR HH"`) cae en el `ELSE` y se guarda tal cual en `escalamientos.tipo`. Resultado: `escalamientos.tipo` no es garantizado como una categoría única y limpia — puede contener una concatenación de categorías. Quien construya reportes o filtros sobre `escalamientos.tipo` debe tener esto en cuenta.

## 4. Flujo operativo de turnos y checklists (resumen, según dominio de valores)

- Cada novedad (`registros`) corresponde a un turno: `Apertura`, `Cierre`, o `Único` (sedes que no distinguen turno).
- Los checklists (`checklists`/`checklist_items`) están tipados igual: `apertura`/`cierre`, en minúscula (distinto del `turno` de `registros`, que va capitalizado) — son dominios de valores independientes, no hay una relación de `CHECK` cruzada entre ambos a nivel de base; la consistencia entre "turno de la novedad" y "tipo de checklist asociado" depende de que el frontend los arme coherentemente.
- La constraint `registros_sede_fecha_turno_unique` (ver DATABASE.md §4) impide más de un registro por sede+fecha+turno — es la regla que en su momento causó el gap de novedades duplicadas/perdidas que se diagnosticó en el hilo de trabajo previo (tareas #1–4, #30–32).

## 5. Flujo de requerimientos de compra

Flujo aprobado por el usuario el 2026-06-19:

`Pendiente → Observado → Pendiente` (corrección y reenvío), o `Pendiente → Aprobado → Enviado → En compra → Recibido → Cumplido`. `Rechazado` es cierre definitivo por decisión del aprobador; `Cancelado` se reserva para retiro del solicitante o duplicados.

- Pasar a `Observado` o `Rechazado` exige un motivo.
- Al observar, la aplicación abre un correo dirigido al contacto del solicitante. El mensaje comienza con el autorizante y la observación, seguido por el detalle del requerimiento.
- En el Kanban, `Observado` se agrupa visualmente dentro de la columna `Pendiente` y se distingue con borde/etiqueta naranja. El valor real sigue siendo `Observado` para conservar métricas e historial sin agregar una columna operativa separada.
- `Enviado` inicia el reloj principal sólo después de que el usuario confirma que efectivamente envió el correo a Compras.
- Una vez alcanzado `Enviado`, los datos originales del pedido quedan bloqueados en la UI (sede, solicitante, descripción, cantidad, justificación, urgencia, necesidad y comentarios). Sólo pueden cambiar el estado del proceso, la fecha de compromiso y la documentación adjunta. `Cumplido`, `Rechazado` y `Cancelado` son estados terminales. Esta inmutabilidad todavía es una regla del frontend, no una restricción de base/RLS.
- `Recibido` significa recepción física; `Cumplido` significa entrega y validación final por la sede.
- SLA inicial por urgencia, medido en días hábiles: alta 3, media 7, baja 15. El valor se copia a `sla_dias` al enviar para preservar la medición aunque luego cambie la urgencia.
- KPI principal: días hábiles entre `enviado_at` y `cumplido_at`. También se calculan mediana, porcentaje dentro de SLA, vencidos activos, tiempo medio de aprobación, tasa de observados, mayor antigüedad abierta y cumplidos del mes.

## 6. Flujo de tickets de mantenimiento (resumen, según dominio de valores)

- Un ticket nace `abierto`, puede pasar a `aprobado` → `en_progreso` → `resuelto`, o a `rechazado` en cualquier punto. No se encontró ninguna función/trigger que valide que las transiciones de estado sigan ese orden — el dominio de valores limita qué estados son válidos, pero no qué transiciones son válidas; eso queda librado a la UI (`MntTickets.jsx`/`MntKanban.jsx`, no auditado línea por línea en este paquete).
- `oc_estado` (orden de compra) y `presupuesto_estado` son flujos paralelos independientes del `estado` del ticket — un ticket puede estar `resuelto` con `oc_estado: 'pendiente'`, por ejemplo; no hay constraint que lo impida.
- `prioridad: 'critica'` es el único valor que, según lo verificado en el hilo de trabajo previo (no re-confirmado línea por línea en esta sesión), alimenta el conteo de "tickets críticos" que se muestra en KPIs de sede — pero ver el bug confirmado en API.md §3.2: en `SedeFicha.jsx` esa consulta apunta a una vista que no existe en el esquema consultado, por lo que ese KPI específico probablemente no esté mostrando datos reales hoy.

## 7. Calidad — No Conformidades y CAPA

- `no_conformidades.estado` sigue el ciclo `Abierta → En proceso → Cerrada/Verificada` (ISO 9001, según la sección del menú "CALIDAD (ISO 9001)" en `Sidebar.jsx`).
- `capa.tipo` distingue acción `Correctiva` de `Preventiva`, con su propio ciclo `Pendiente → En ejecución → Completada → Verificada`.
- No se encontró ninguna relación de `CHECK`/trigger que obligue a que una `no_conformidad` tenga un `capa` asociado antes de cerrarse, ni viceversa — la relación entre ambos módulos (si existe) es por convención de uso, no forzada por la base.

## 8. Notificaciones prioritarias al celular (implementación local pendiente de activar)

- Disparadores iniciales: requerimientos con urgencia `alta`, tareas con prioridad `Alta`, tickets de mantenimiento/flota `alta` o `critica`, y nuevos escalamientos.
- Destinatarios: todos los perfiles `admin` activos; responsable asignado cuando corresponde a un perfil; técnico de mantenimiento resuelto por coincidencia de email; perfiles `encargado`/`sede` cuyo `sede_ids` contiene la sede del evento.
- La Edge Function vuelve a consultar el registro real y verifica su prioridad antes de enviar; no confía en título/prioridad enviados por el navegador.
- Cada evento usa una clave de deduplicación por módulo, entidad, prioridad y destinatario para evitar alertas repetidas.
- El usuario debe activar voluntariamente Push en cada dispositivo. La clave privada VAPID y `service_role` sólo viven como secretos de la Edge Function; nunca en variables `VITE_*`.
- Código: `public/sw.js`, `src/lib/pushNotifications.js`, `src/components/PushNotificationControl.jsx`, `src/components/NotificationCenter.jsx`, `supabase/functions/send-priority-notification/index.ts`.

### 8.1 Mapa de calor de gestión por sede

La vista `Indicadores` incorpora una matriz por sede con seis riesgos: novedades que requieren escalamiento dentro del período seleccionado; tareas vencidas; tickets fuera de SLA; compras enviadas fuera de SLA; CAPA vencidas; y documentación vehicular/matafuegos vencidos. Verde representa 0 casos; amarillo desde 1 hasta antes del umbral crítico; rojo usa umbrales iniciales de 2 para novedades/compras/documentación y 3 para tareas/tickets/CAPA. Las celdas abren el módulo correspondiente. Las CAPA corporativas con `sede_id = NULL` y `sede_nombre = 'Gestión'` aparecen en una fila adicional sólo para usuarios sin restricción de sedes.

## 9. Limitaciones de esta documentación

Este documento cubre las reglas de negocio verificables por dominio de datos (`CHECK` constraints) y por lógica de triggers/RBAC explícita en el código leído. No cubre: lógica de negocio que viva únicamente dentro de componentes React no auditados línea por línea (ej. validaciones de formulario client-side en cada módulo de Mantenimiento/Flota/Equipo), ni reglas que dependan de convención sin enforcement (ej. relación No Conformidad↔CAPA). Donde no fue posible verificar algo, se indica explícitamente arriba en lugar de asumirlo.
