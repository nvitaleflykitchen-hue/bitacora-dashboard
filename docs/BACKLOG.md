# BACKLOG — bitacora-dashboard

> Consolida en un solo plan de acción: (a) los fixes recomendados en KNOWN_ISSUES.md, (b) el hilo de trabajo previo que quedó pausado para priorizar este paquete de documentación (ver PROJECT_STATUS.md §6), y (c) preguntas abiertas que requieren respuesta del equipo, no solo código. Prioridad asignada por impacto y riesgo, no por orden cronológico. Fecha: 2026-06-17.

## Cómo usar esto

Cada ítem indica de dónde viene (qué documento lo sustenta) para no tener que reconstruir el razonamiento. Los de prioridad 1 son los únicos que deberían bloquear trabajo nuevo sobre el sistema.

---

## Prioridad 1 — Esta semana (seguridad activa o funcionalidad rota hoy)

| # | Acción | Por qué | Esfuerzo | Fuente |
|---|---|---|---|---|
| 1 | Corregir la política `staff_insert_esc` de `bitacora.escalamientos`: cambiar `'Admin','Editor','Encargado','Sede'` por minúsculas reales | Hoy, cualquier novedad que dispare `requiere_escalamiento=true` falla por completo (la novedad ni se guarda) | Bajo — 1 `ALTER POLICY` | KNOWN_ISSUES.md §1.2 |
| 2 | Cerrar `bitacora.perfiles`: limitar SELECT/UPDATE a `auth.uid() = id` (salvo admin) y bloquear que un no-admin cambie su propio `rol`/`sede_ids`/`grupo_id` | Hoy, sin login, se puede leer y reescribir cualquier perfil — incluido ponerse `rol='admin'` | Medio — requiere diseñar el trigger/política sin romper el auto-aprovisionamiento de `consultor` | KNOWN_ISSUES.md §1.1 |
| 3 | Borrar las políticas amplias `insert_registros`, `read_registros`, `update_registros` de `bitacora.registros` (las angostas `staff_*`/`sede_*` ya están bien diseñadas y quedan vigentes) | Hoy, cualquiera sin login puede leer y crear novedades falsas; cualquier autenticado puede editar novedades de cualquier sede | Bajo — 3 `DROP POLICY` | KNOWN_ISSUES.md §2.3 |
| 4 | Corregir `SedeFicha.jsx`: usar `supabase.from('mnt_tickets'/'mnt_activos')` sin `.schema('mantenimiento')` | KPI de tickets críticos y datos de activos en la ficha de sede probablemente muestran datos vacíos/incorrectos hoy | Muy bajo — 2 líneas | KNOWN_ISSUES.md §2.5, API.md §3.2 |
| 5 | Confirmar si la sesión de Vercel CLI sigue vigente y correr `DEPLOY.bat` para asegurar que el último estado de `src/` (incluye `Escalamientos.jsx`, modificado 2026-06-15) está realmente publicado | No se pudo verificar el estado del último deploy en producción desde este paquete (sin acceso al proyecto Vercel desde esta sesión — error 403 de scope al intentar consultarlo). El propio repo tiene una tarea pendiente de un hilo anterior ("deployar fix de Escalamientos") sin confirmación de que se haya ejecutado | Bajo, una vez resuelto el acceso | PROJECT_STATUS.md §6, DEPLOYMENT.md §2.4 |
| 6 | Retomar y cerrar el backfill de novedades faltantes (Comedores en curso, Hospitales pendiente) y verificar conteos finales | Hilo de diagnóstico de gap de novedades quedó pausado a mitad — no se sabe si el gap real está resuelto | Medio (depende del volumen real pendiente, no cuantificado en este paquete) | PROJECT_STATUS.md §6 |
| 21 | ✅ **Resuelto 2026-06-18** — Deploy a Vercel del fix de `Escalamientos.jsx`/`queries.js` (modal "Ver Reporte" vacío). Pendiente solo verificación en vivo | El usuario confirmó haber corrido el deploy (`DEPLOY.bat`) | — | KNOWN_ISSUES.md §2.7 |
| 22 | ✅ **Resuelto 2026-06-18** — Vista `public.mnt_tickets` recreada con `creado_por` y `evidencia_url`. Pendiente solo verificación en vivo | SQL confirmado por el usuario y ejecutado; columnas verificadas, conteo de filas sin cambios (677) | — | KNOWN_ISSUES.md §2.8 |

## Prioridad 2 — Este mes (huecos de acceso amplios, sin explotación activa confirmada hoy)

| # | Acción | Por qué | Fuente |
|---|---|---|---|
| 7 | Habilitar RLS + políticas por rol en las 5 tablas de `equipo` (`personas`, `evaluaciones`, `historial_personal`, `logros_config`, `logros_obtenidos`) | Cualquier usuario logueado, sin importar rol, puede leer/editar legajos y evaluaciones de cualquier empleado | KNOWN_ISSUES.md §2.1 |
| 8 | Habilitar RLS en las 4 tablas de `mantenimiento` sin protección (`ejecucion_items`, `plan_checklist`, `ticket_costos`, `visitas_activo`) y revisar si el grant a `anon` tiene justificación | Riesgo condicional a si el esquema está expuesto en PostgREST (sin confirmar) — cerrar igual por buena práctica | KNOWN_ISSUES.md §2.2 |
| 9 | Definir y aplicar condición de acceso real (no `true`) en `adjuntos`, `capa`, `contactos`, `no_conformidades`, `requerimientos`, `sede_contactos`, `tareas`, y la escritura de `sedes` | Mismo patrón que `registros`: hoy están completamente abiertas a `anon`/`authenticated` sin scoping | KNOWN_ISSUES.md §2.4 |
| 10 | Cambiar el `else` final de `loadPerfil()` en `auth.jsx`: que `grupo` sin `grupo_id` o `encargado`/`sede` sin `sede_ids` resulte en `allowedSedeIds = []` (sin acceso), no `null` (todo el acceso) | Perfil mal configurado hoy termina con más alcance del que su rol indica | KNOWN_ISSUES.md §2.6, BUSINESS_RULES.md §1.2 |
| 11 | Agregar autenticación (secreto compartido o JWT) a la Edge Function `bitacora-ingest`, después de confirmar quién la consume realmente | Endpoint público sin ninguna verificación, inserta directo en `bitacora.registros` | KNOWN_ISSUES.md §3.3 |
| 12 | Limpiar valores de rol inexistentes en políticas (`'viewer'` en `staff_read_esc`, `'superadmin'` en la política de `auditoria`) y corregir el literal `'Editor'` del fallback de `invite-user` a `'editor'` | No bloquean nada hoy, pero confunden a quien mantenga el código más adelante | KNOWN_ISSUES.md §3.4, §3.5 |
| 13 | Cerrar formalmente el hilo de auditoría código↔esquema previo: terminar el mapeo de llamadas Supabase (ya cubierto en gran parte por API.md §3.1), cruzar columnas usadas en cada insert/update/select contra el esquema real (el bug de `SedeFicha.jsx` es un ejemplo de lo que falta encontrar en el resto de `src/`), y validar sintaxis de todos los `.jsx`/`.js` | Trabajo iniciado y no terminado en el hilo previo a esta documentación | PROJECT_STATUS.md §6 |

## Prioridad 3 — Mediano plazo (deuda estructural)

| # | Acción | Por qué | Fuente |
|---|---|---|---|
| 14 | Auditar, vista por vista, si cada módulo de escritorio/mobile efectivamente filtra sus queries por `allowedSedeIds` cuando el rol es `encargado`/`sede` | Confirmado que el Sidebar no oculta menús por rol; no confirmado si las vistas mismas filtran datos al navegar manualmente fuera del landing por defecto | KNOWN_ISSUES.md §3.1 |
| 15 | Confirmar con el dueño del proyecto Supabase (Dashboard → Settings → API → Exposed schemas) si `mantenimiento`/`equipo` están en la lista de esquemas expuestos por PostgREST | No verificable por SQL desde esta sesión; cambia la severidad real del hallazgo §2.2 | KNOWN_ISSUES.md §2.2 |
| 16 | Decidir una estrategia de RBAC consistente: hoy coexisten políticas RLS bien diseñadas (`checklists`, partes de `registros`) con políticas que las anulan o con tablas sin RLS — definir si el control de acceso real va a vivir en RLS o seguir dependiendo del cliente, y aplicarlo de forma pareja | Inconsistencia transversal, no solo bugs puntuales | KNOWN_ISSUES.md §3.2 |
| 17 | Inicializar repositorio git y un pipeline mínimo de CI/CD (al menos build + lint antes de deploy) | Sin versionado hoy: no hay historial, no hay revert, no hay code review | PROJECT_STATUS.md §8 |
| 18 | Exportar y versionar el código de las 3 Edge Functions fuera de Supabase | Hoy la única copia vive en el proyecto Supabase; se pierde si se pierde el acceso | DEPLOYMENT.md §1 |
| 19 | Versionar las migraciones de base de datos (hoy 47 migraciones sin respaldo fuera de Supabase) | Mismo riesgo que el ítem anterior, aplicado al esquema | DEPLOYMENT.md §4 |
| 20 | Resolver la duplicación de constraints `registros_unique_reporte` y `registros_sede_fecha_turno_unique` en `bitacora.registros` | Redundancia detectada en el esquema; confirmar si ambas son necesarias o una quedó obsoleta | PROJECT_STATUS.md §8 |

## Prioridad 4 — Cuando haya ventana (higiene, sin impacto funcional)

- Eliminar la carpeta duplicada `bitacora-dashboard/bitacora-dashboard/` (copia completa generada por error, con su propio `node_modules`/`dist`).
- Limpiar ~52 archivos `vite.config.js.timestamp-*.mjs`, las carpetas `dist2/`/`dist_v2/`, y `BITACORA.MD.docx` (221 KB) de la raíz.
- Configurar ESLint/Prettier (no existe hoy ninguna configuración de lint).
- Agregar smoke tests mínimos (login, alta de novedad, vista de escalamientos) dado que no hay ningún test automatizado.
- Revocar el `EXECUTE` heredado sobre las 10 funciones trigger que `anon`/`authenticated` no pueden invocar de todos modos (higiene de grants, no riesgo activo).

## Preguntas abiertas para el equipo (no se resuelven solo con código)

1. ✅ Resuelto 2026-06-19: el significado de `tareas.categoria` está definido en `src/components/TareaForm.jsx` y documentado en BUSINESS_RULES.md §2.1. La UI de Tareas ahora muestra las etiquetas humanas en Kanban, tabla y mobile.
2. ¿Quién consume la Edge Function `bitacora-ingest`? No está referenciada en `src/`; la hipótesis (un sistema externo tipo Google Apps Script, ligado a los hilos previos sobre el gap de novedades) no está confirmada. Hace falta saberlo antes de agregarle autenticación, para no cortar un flujo real sin aviso.
3. ¿La sesión local de la CLI de Vercel del desarrollador anterior sigue activa en alguna máquina? Si no, hay que volver a autenticar (`npx vercel login`) antes de poder deployar.
4. ¿Las variables `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` están configuradas en el dashboard de Vercel (Project Settings → Environment Variables), no solo en `.env.local`? No se pudo confirmar desde este paquete.
5. ¿Hay un entorno de prueba separado (otro proyecto Supabase) para no probar cambios contra datos reales de Fly Kitchen? Hoy `npm run dev` apunta directo a producción.
6. ¿Cuáles de los campos listados en DECISIONS.md §1.4b (raciones, nombre de plan, dominio de vehículo, unidad de insumo, solicitante/cantidad en requerimientos, sede/responsable en no conformidades, datos de sede, responsable de tarea, evaluador/período en evaluaciones, DNI/puesto/fecha de ingreso de personal) deberían pasar a ser obligatorios? Es una decisión de negocio, no técnica — no se aplicó ningún cambio todavía.

## Prioridad 1 — Agregar tras revisión del usuario

| # | Acción | Por qué | Esfuerzo | Fuente |
|---|---|---|---|---|
| 23 | ✅ **Hecho 2026-06-18** — UX de los 21 formularios de carga: placeholders de ejemplo + asterisco sincronizado en campos ya obligatorios | Pedido explícito del usuario para simplificar el llenado de cara al onboarding de operadores de hoy | Bajo (solo JSX, sin esquema/RLS) | DECISIONS.md §1.4b |
