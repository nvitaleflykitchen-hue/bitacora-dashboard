# AGENTS.md — guía para agentes/IA que trabajen en este repo

> Este archivo es para cualquier asistente de IA (Claude, Copilot, Cursor, etc.) que vaya a leer, editar o ejecutar código en este repositorio. Resume las reglas que **no se pueden inferir solo leyendo el código** porque son operativas, de negocio, o de seguridad de cuentas. El detalle técnico completo está en `docs/` — este archivo es el punto de entrada rápido. Verificado contra el repositorio y el proyecto Supabase real el 2026-06-17.

## 0. Reglas que no se negocian (leer antes de tocar nada)

1. **Nunca ejecutes nada contra el proyecto Supabase `hmyzuuujyurvyuusvyzp` ("OCTOPUS COQUINARIA").** Es de otro cliente, vive en la misma organización de Supabase que el proyecto de este repo pero es un proyecto completamente distinto. El proyecto correcto para este repo es **`mixyhfdlzjarvszinytk`** (nombre interno `cerdova-db`). Si una herramienta o MCP te pide elegir un proyecto/`project_id`, confirmá el ID exacto antes de ejecutar cualquier SQL o función. Verificado en esta sesión vía API de Supabase — ambos proyectos existen y son distinguibles solo por ID, no por contenido obvio en una consulta apurada.
2. **Nunca borres filas de `bitacora.registros`.** Dos triggers (`protect_registros`, `block_delete_registros`) lo bloquean a propósito — las novedades son append-only por diseño (decisión documentada en DECISIONS.md §2.6). Si en algún momento hace falta borrar una fila real (no un test), hay que dropear el trigger explícitamente primero, y eso requiere acuerdo explícito del usuario, no una decisión unilateral del agente.
3. **Nunca aplique cambios de `GRANT`/`RLS`/políticas de seguridad directo en la base sin mostrar el SQL al usuario primero y esperar confirmación explícita.** Es una política operativa ya establecida en este proyecto (ver DECISIONS.md §2.5), no una preferencia nueva. Mostrá el SQL, explicá el efecto, y dejá que el usuario decida si lo corre él mismo o te autoriza a correrlo.
4. **Los valores de `rol` en `bitacora.perfiles` son exactamente estos 6, en minúscula, sin excepción:** `admin`, `editor`, `consultor`, `encargado`, `grupo`, `sede`. Cualquier otro valor (incluida una variante con mayúscula) es rechazado por un `CHECK` constraint de Postgres. No asumas que un literal como `'Editor'` en el código es solo un detalle de estilo — puede romper un `INSERT`/`UPDATE` real.
5. **No hay entorno de staging.** `npm run dev` en local apunta a la base de producción real de Fly Kitchen (ver `.env.local`/SETUP.md). Cualquier prueba manual con datos "de prueba" deja rastro real en la base que usa el negocio. Si necesitás insertar/modificar datos para probar algo, avisá explícitamente y limpiá después, o usá una transacción `BEGIN...ROLLBACK` para verificar sin persistir (técnica usada extensivamente en KNOWN_ISSUES.md para confirmar hallazgos de RLS sin tocar datos reales).
6. **No hay repositorio git.** No hay forma de revertir un cambio de archivo mediante `git checkout`/`git revert`. Antes de una edición grande, considerá guardar una copia o confirmar con el usuario.

## 1. Cómo está organizado el código (mapa rápido)

| Si necesitás... | Mirá en... |
|---|---|
| Entender qué hace el sistema en general | `docs/PROJECT_STATUS.md` |
| Entender la arquitectura y los diagramas de flujo | `docs/ARCHITECTURE.md` |
| El esquema completo de base de datos (tablas, FKs, triggers, RLS) | `docs/DATABASE.md` |
| Cómo levantar el proyecto en local | `docs/SETUP.md` |
| Cómo se despliega a producción | `docs/DEPLOYMENT.md` |
| Edge Functions, RPCs, vistas proxy `mnt_*`/`v_*` | `docs/API.md` |
| Reglas de negocio, RBAC, dominios de valores válidos por campo | `docs/BUSINESS_RULES.md` |
| Bugs y riesgos de seguridad ya conocidos (para no "redescubrirlos" como si fueran nuevos, o para no asumir que algo funciona cuando está documentado como roto) | `docs/KNOWN_ISSUES.md` |
| Tareas pendientes priorizadas | `docs/BACKLOG.md` |
| Por qué se tomó tal o tal decisión de diseño | `docs/DECISIONS.md` |

Puntos de entrada en el código:

- `src/App.jsx` — router manual (`activeView`), define las ~26 vistas de escritorio y el gating de rol para "Usuarios"/"Trazabilidad".
- `src/lib/auth.jsx` — toda la lógica de sesión, carga de perfil, y cálculo de `allowedSedeIds` por rol. Si vas a tocar algo de permisos en el frontend, es acá.
- `src/lib/supabase.js` — instancia única del cliente Supabase y el helper `db()` (= `supabase.schema('bitacora')`).
- `src/lib/queries.js` — la mayoría de las queries a Supabase están centralizadas acá, pero **no todas** — varios componentes (`EquipoView.jsx`, `MntVehiculos.jsx`, `MntInsumos.jsx`, `MntResponsables.jsx`, `QRActivoView.jsx`, `SedeFicha.jsx`) llaman a Supabase directamente. Antes de asumir "todas las queries están en queries.js", revisá API.md §3.1.
- `src/mobile/` — árbol de componentes completamente separado del de escritorio (no es CSS responsive de los mismos componentes). Un cambio de lógica de negocio en una vista de escritorio probablemente necesita el mismo cambio espejado en su equivalente mobile.

## 2. Trampas conocidas (no las repitas)

Estas ya están diagnosticadas — no las trates como hallazgos nuevos, y no asumas que el comportamiento "obvio" es el real:

- `bitacora.registros` tiene políticas RLS angostas bien diseñadas (`staff_*`, `sede_*`) pero coexisten con políticas amplias sin condición que las anulan — hoy la tabla es de hecho legible/insertable por `anon` sin login. Detalle: KNOWN_ISSUES.md §2.3.
- La política de inserción en `bitacora.escalamientos` compara el rol contra valores capitalizados (`'Admin'`, `'Editor'`, etc.) que nunca van a matchear contra los roles reales en minúscula — el resultado es que la creación automática de escalamientos (vía trigger) falla para cualquier usuario real. KNOWN_ISSUES.md §1.2.
- `bitacora.perfiles` (la tabla que define el rol de cada usuario) es editable por `anon` sin autenticación. No asumas que el RBAC del frontend es una barrera real. KNOWN_ISSUES.md §1.1.
- `SedeFicha.jsx` consulta `.schema('mantenimiento').from('mnt_tickets'/'mnt_activos')`, pero esas vistas solo existen en `public`, no en `mantenimiento` — el KPI de tickets críticos de esa pantalla probablemente no muestra datos reales. KNOWN_ISSUES.md §2.5.
- El fallback `else` de `loadPerfil()` en `auth.jsx` para roles `grupo`/`encargado`/`sede` mal configurados (sin `grupo_id`/`sede_ids`) da acceso a **todas** las sedes en lugar de ninguna. KNOWN_ISSUES.md §2.6.

## 3. Antes de dar por terminada una tarea

- Si tocaste algo en `src/`, no asumas que el build pasa — corré `npm run build` (ver SETUP.md por las particularidades del `postinstall` shim de `@supabase/phoenix`).
- Si tocaste algo que afecta a mobile y desktop, verificá ambos árboles de componentes, no solo el que tenías abierto.
- Si el cambio toca permisos de base de datos, mostrá el SQL y pedí confirmación (regla 3 de la sección 0) — no lo aplique solo porque tenés la capacidad técnica de hacerlo.
- Si encontrás un hallazgo de seguridad o un bug nuevo que no está en `docs/KNOWN_ISSUES.md`, agregalo ahí con el mismo formato (severidad, método de verificación, recomendación) en lugar de dejarlo solo mencionado en el chat.
