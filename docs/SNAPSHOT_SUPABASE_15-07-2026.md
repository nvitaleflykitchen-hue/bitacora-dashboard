# Snapshot previo a estabilización — 15/07/2026

## Alcance y garantías

- Tarea: IA-0004, Etapa 0, autorizada expresamente por Nicolás.
- Captura realizada: 2026-07-15 16:44:16 ART (UTC-03:00).
- Se trabajó únicamente en la rama `respaldo/pre-estabilizacion-15-07-2026`.
- **No se modificó producción:** no se ejecutaron migraciones ni DDL/DML, no se aplicó SQL de cambio, no se alteraron datos, RLS, policies, grants, funciones, configuración ni variables de entorno en Supabase; tampoco se desplegó ni modificó configuración en Vercel; `main` no fue modificada.
- Las consultas remotas fueron listados de metadatos y `SELECT` sobre catálogos (`pg_catalog`, `information_schema`, `pg_policies` y `supabase_migrations`).

## Repositorio y árbol de trabajo antes del respaldo

- Repositorio: `nvitaleflykitchen-hue/bitacora-dashboard`.
- Remoto: `origin` → `https://github.com/nvitaleflykitchen-hue/bitacora-dashboard.git`.
- Rama inicial: `main`, alineada con `origin/main`.
- Commit inicial: `e9a4fc5d03923ecae2666dc154d8ec4ee3a3c6e4` (`fix: corregir toast de alta en equipo`, 2026-07-13 12:56:44 ART).
- Rama de respaldo creada desde ese punto: `respaldo/pre-estabilizacion-15-07-2026`.
- Estado inicial: 59 archivos versionados modificados y 32 archivos nuevos no versionados.
- El árbol contenía cambios amplios en documentación, configuración de PWA/build, componentes desktop/mobile, librerías y tests, vistas, dos Edge Functions y migraciones. No se corrigió ni reinterpretó ninguno de esos cambios.
- Archivos nuevos destacados: `CHANGELOG.md`, documentación de release/bienvenida, componentes de actualizaciones y reportes, módulos de auditoría/personal/mobile, cinco migraciones SQL, `.codex/compras_items.json` y dos PDF de muestra bajo `output/pdf/`.
- Migraciones locales: 23 archivos SQL; 18 ya versionados y 5 nuevos no versionados.
- Control de secretos: no había archivos `.env`, `.pem`, `.key`, credenciales o secretos visibles en el conjunto a respaldar. Los archivos binarios se identificaron como PDF de muestra. Antes del commit se realizó además una búsqueda por indicadores de tokens, claves privadas, URLs con credenciales y contraseñas; no se documentó ni imprimió ningún valor sensible.

### Cinco migraciones locales nuevas

1. `20260714143000_auditorias_internas.sql`
2. `20260714194500_historial_personal_anulacion_doble_control.sql`
3. `20260714201500_auditoria_reportante_registros.sql`
4. `20260714202505_fix_auditoria_registro_id_cast.sql`
5. `20260714_add_tareas_creado_por.sql`

## Snapshot de Supabase (solo lectura)

- Proyecto consultado y verificado por ID: `mixyhfdlzjarvszinytk`.
- Nombre: `cerdova-db`.
- Estado: `ACTIVE_HEALTHY`.
- Región: `us-east-2`.
- PostgreSQL: 17 (`17.6.1.054`, canal GA).
- Esquemas relevados: `bitacora`, `mantenimiento` y `public`.

### Tablas y RLS

| Esquema | Tablas | RLS activo | RLS inactivo |
|---|---:|---:|---:|
| `bitacora` | 38 | 38 | 0 |
| `mantenimiento` | 21 | 18 | 3 |
| `public` | 11 | 3 | 8 |
| **Total** | **70** | **59** | **11** |

RLS está inactivo en:

- `public.global_settings`
- `public.app_users`
- `public.raw_materials`
- `public.recipes`
- `public.recipe_ingredients`
- `public.final_products`
- `public.product_packaging`
- `public.technical_sheets`
- `mantenimiento.zz_backup_tickets_pcba_20260708`
- `mantenimiento.zz_backup_historial_pcba_20260708`
- `mantenimiento.zz_backup_costos_pcba_20260708`

Esto es una fotografía, no una corrección. No se aplicó la remediación sugerida por Supabase.

### Policies

- Total relevado: 187 policies.
- `bitacora`: 109 (10 `ALL`, 7 `DELETE`, 25 `INSERT`, 43 `SELECT`, 24 `UPDATE`).
- `mantenimiento`: 72 (18 por cada operación `DELETE`, `INSERT`, `SELECT` y `UPDATE`).
- `public`: 6 policies `ALL`.
- Se observaron policies dirigidas a `anon` o `public` en 12 tablas, entre ellas `public.operators`, `public.production_logs`, `public.suppliers` y nueve tablas de `bitacora`.
- No se evaluó aquí la corrección funcional de cada expresión `USING`/`WITH CHECK`; se preservó el inventario sin cambios.

### Grants relevantes

- `anon` posee grants de tabla en los tres esquemas: en `bitacora`, `SELECT`/`INSERT` sobre 10 tablas, `UPDATE` sobre 9 y `DELETE` sobre 2; en `mantenimiento`, las cuatro operaciones sobre 3 tablas; en `public`, `SELECT` sobre 14 tablas y amplios privilegios sobre 13 tablas.
- `authenticated` posee grants de lectura/escritura amplios: 33 tablas con `SELECT` en `bitacora`, 21 tablas con las cuatro operaciones en `mantenimiento`, y 32 objetos con privilegios amplios en `public`.
- `service_role` conserva acceso amplio conforme a su función privilegiada.
- Los grants no se modificaron. La combinación efectiva de grants y RLS requiere una auditoría posterior; queda fuera de esta Etapa 0.

### Funciones y RPC

- Funciones relevadas: 24; 16 en `bitacora` (11 `SECURITY DEFINER`), 1 en `mantenimiento`, 7 en `public` (6 `SECURITY DEFINER`).
- RPC/funciones no-trigger observadas (12): `bitacora.get_usuario_email`, `bitacora.get_usuario_nombre`, `bitacora.puede_gestionar_auditoria_sede`, `bitacora.puede_responder_auditoria_sede`, `bitacora.puede_ver_auditoria_sede`, `public.buscar_global`, `public.get_user_rol_bitacora`, `public.log_auditoria`, `public.registrar_acceso_app`, `public.reporte_accesos_app`, `public.resolver_anulacion_historial` y `public.solicitar_anulacion_historial`.
- También se verificaron 8 Edge Functions activas: `invite-user`, `admin-user-actions`, `bitacora-ingest`, `send-priority-notification`, `cron-preventivos`, `create-user-direct`, `send-quality-email` y `admin-evidence-upload`. No se descargaron secretos ni se desplegó ninguna función.

### Migraciones: producción vs. carpeta local

- Historial remoto: 87 migraciones.
- Carpeta local: 23 archivos; por lo tanto, la carpeta local no contiene una copia completa del historial remoto.
- Las cinco migraciones locales nuevas ya tienen contrapartes semánticas en producción, pero con timestamps/nombres de historial distintos:

| Local | Remota observada |
|---|---|
| `20260714_add_tareas_creado_por.sql` | `20260714101349_add_tareas_creado_por` |
| `20260714143000_auditorias_internas.sql` | `20260714184311_auditorias_internas` |
| `20260714201500_auditoria_reportante_registros.sql` | `20260714231522_auditoria_reportante_registros` |
| `20260714202505_fix_auditoria_registro_id_cast.sql` | `20260714232658_fix_auditoria_registro_id_cast` |
| `20260714194500_historial_personal_anulacion_doble_control.sql` | `20260715003102_historial_personal_anulacion_doble_control_20260714` |

La coincidencia anterior es por nombre/propósito; no se aplicaron migraciones ni se afirmó equivalencia byte a byte de sus cuerpos SQL.

## Vercel: versión de producción

- Vínculo local: project ID `prj_S0Z2YRiONwuCk5Fef0fR0ofWy9iE`, org/team ID `team_bK3SVeUIvlG2eQWjZtgqKMFw`.
- Proyecto inferido por el vínculo y la URL de deployment: `bitacora-dashboard`.
- Deployment de producción: exitoso.
- Fecha: 2026-07-13 15:57:32 UTC / 12:57:32 ART.
- URL registrada por el estado de deployment: `https://bitacora-dashboard-4f5ray7j1-nvitaleflykitchen-3071s-projects.vercel.app`.
- Commit desplegado: `e9a4fc5d03923ecae2666dc154d8ec4ee3a3c6e4`.
- Rama: la API consultable no expuso el nombre de rama; el deployment usa el SHA anterior, que coincide exactamente con `origin/main` y con el commit base local. Se registra esa correspondencia sin presentar la rama como dato directo de Vercel.
- Diferencia con el estado local: producción coincide con el commit base, pero no contiene los 59 archivos modificados ni los 32 archivos nuevos que estaban sin commit al iniciar el snapshot.

## Bloqueos y límites de verificación

- El conector Vercel autenticado devolvió `403 Forbidden` para el scope `nvitaleflykitchen-3071s-projects`; la CLI `vercel` no está instalada localmente.
- Para no detener la Etapa 0, el commit y el estado de producción se verificaron mediante la API pública de deployments de GitHub y su estado emitido por Vercel. No se pudo inspeccionar desde Vercel la configuración interna completa ni confirmar la rama como campo directo.
- La CLI `gh` tampoco está instalada; el push del respaldo se hará con `git` y las credenciales ya configuradas, sin abrir PR.
- No se compararon cuerpos completos de todas las funciones, policies o migraciones; se relevaron metadatos suficientes para fotografiar el estado y señalar la deriva.

## Discrepancias principales

1. Producción Vercel está en el commit base `e9a4fc5…`, mientras el árbol local contiene 91 rutas con cambios o archivos nuevos antes de agregar este documento.
2. Supabase registra 87 migraciones, pero la carpeta local solo contiene 23.
3. Las cinco migraciones locales nuevas parecen ya aplicadas remotamente bajo versiones distintas.
4. Hay 11 tablas con RLS desactivado y grants amplios para `anon`/`authenticated`; no se modificó ninguna política o permiso.
5. El vínculo Vercel local apunta a un equipo no accesible con el conector disponible, aunque la evidencia pública permitió confirmar el deployment y commit.

## Confirmación final de no intervención

Durante esta etapa no se modificó Supabase ni Vercel, no se desplegó nada, no se alteraron variables de entorno, no se ejecutaron migraciones, no se aplicaron cambios SQL y no se modificó ni fusionó `main`. El único trabajo autorizado fue crear la rama de respaldo, capturar información de solo lectura, documentarla y respaldar archivos locales sin secretos.
