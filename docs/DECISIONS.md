# DECISIONS — bitacora-dashboard

> Decisiones de producto, arquitectura y operación tomadas durante el desarrollo, con su razón documentada. Fuentes: código fuente verificado en este paquete, historial de migraciones de Supabase, y `BITACORA.MD.docx` (resumen de sesión generado 2026-06-16 por el desarrollo previo — citado explícitamente donde es la única fuente, no re-verificado dato por dato salvo donde se indica). No existe repositorio git, por lo que no hay historial de commits/PRs que documente decisiones de forma independiente. Fecha de esta redacción: 2026-06-17.

## 1. Decisiones de producto / alcance

### 1.1 Unificar Comedores y Hospitales en una sola app, no dos
`registros.origen_form` distingue `Comedores`/`Hospitales` como valores de un mismo dominio, no como sistemas separados. Mismo turno (`Apertura`/`Cierre`/`Único`), mismo flujo de escalamiento, mismo RBAC. Decisión implícita en el esquema, no hay documentación explícita de la alternativa descartada (apps separadas por tipo de sede).

### 1.2 Migración planeada de Google Form a captura directa en la app
Según `BITACORA.MD.docx` §1 y §6: el plan documentado por el equipo era cerrar el Google Form el **22/06/2026** y monitorear que las novedades nuevas lleguen con `origen_form = 'app'`. Esto explica por qué existe el campo `origen_form` y por qué hubo (y puede seguir habiendo) un flujo de backfill manual desde planillas de Sheets hacia `bitacora.registros` — no es el modo de captura final previsto, es una transición. **No verificado en esta sesión si ese corte ya se ejecutó** (la fecha está a 5 días de la fecha de esta documentación) — confirmar con el equipo.

### 1.3 Onboarding de 22 operadores con fecha límite 18/06/2026
Documentado en `BITACORA.MD.docx` §1 y §6, sin detalle adicional sobre qué significa "onboarding" en términos de sistema (¿cuentas creadas? ¿capacitación?). **Esta fecha es mañana respecto de hoy (17/06) — no verificable desde este paquete si está cumplido o en curso**, marcarlo como urgente a confirmar con el equipo no técnico.

### 1.4b UX de formularios: placeholders de ejemplo + asterisco para campos obligatorios, sin tocar reglas de negocio (2026-06-18)
A pedido explícito del usuario ("que el llenado de formularios sea simple, con ejemplo de qué dato cargar en cada lugar, y marcar cuáles son obligatorios"), se aplicó un patrón uniforme en los 21 formularios de carga de datos de la app: cada input/select/textarea sin `placeholder` recibió un ejemplo concreto (ej. `placeholder="Ej: Reparación motor"`), y toda etiqueta de un campo ya validado como obligatorio en el código (HTML `required` real o chequeo JS que bloquea el guardado) quedó terminada en " *", sincronizando los casos donde el asterisco visual y la validación real estaban desfasados (ej. `CAPA.jsx` "Tipo *", `MntTickets.jsx` "Descripción *", `Usuarios.jsx` Nombre/Email/Password). Regla seguida estrictamente: no se inventó ninguna obligatoriedad nueva — solo se sincronizó visualmente lo que ya bloqueaba el guardado hoy. Archivos tocados: `MobileReporte.jsx`, `MobileChecklist.jsx`, `MntKanban.jsx`, `MntTickets.jsx`, `MntPlanes.jsx`, `MntMatafuegos.jsx`, `MntProveedores.jsx`, `MntVehiculos.jsx`, `MntFlotaGestion.jsx`, `MntResponsables.jsx`, `MntInsumos.jsx`, `QRActivoView.jsx`, `TareaForm.jsx`, `Requerimientos.jsx`, `CAPA.jsx`, `NoConformidades.jsx`, `SedeFicha.jsx`, `EquipoView.jsx`, `Usuarios.jsx`, `SedeResponsables.jsx`. Sin cambios de esquema/RLS — solo JSX. Verificado por agente independiente (lectura completa de los 20 archivos no-mobile + los 2 mobile) sin hallar problemas de sintaxis.

**Campos detectados que probablemente deberían ser obligatorios pero hoy no bloquean el guardado (no se tocaron — requieren decisión del usuario, ver BACKLOG.md):**
- `MobileReporte.jsx`: "Raciones del turno" y el tipo de área en escalamiento.
- `MntPlanes.jsx` (`PlanDetalle`): nombre del plan.
- `MntFlotaGestion.jsx`: dominio/patente del vehículo.
- `MntInsumos.jsx` (`NuevoInsumoModal`): unidad de medida.
- `Requerimientos.jsx`: solicitante, cantidad.
- `NoConformidades.jsx`: sede, responsable.
- `SedeFicha.jsx`: tipo de sede, dirección, teléfono.
- `TareaForm.jsx`: responsable.
- `EquipoView.jsx` (evaluación de desempeño): nombre y cargo del evaluador, período evaluado. (`NuevaPersonaModal`): DNI, puesto, fecha de ingreso.

### 1.4c Carga del Plan de Acción CAPA "Escala Mendoza" (auditoría 29/05/2026) (2026-06-18)
A pedido del usuario, se cargaron directamente por SQL (no por el formulario de la app) las 9 acciones correctivas del documento `Plan_de_Accion_CAPA_Escala_Mendoza_2026-05-29.docx` en `bitacora.capa`, códigos `CA-2026-001` a `CA-2026-009`, agrupadas bajo `auditoria_codigo = 'FK-AUD-MZA-2026-05-29'` (código inventado para esta carga, el documento no define uno propio). Dos puntos sin verificación completa, confirmados por el usuario antes de cargar:
- **Sede**: no existe una sede llamada "Escala Mendoza" en `bitacora.sedes`. Se mapeó a `sede_id=19` ("Aeropuerto Mendoza"), única sede de Mendoza en el sistema — inferencia, no hay forma de confirmarlo por dato exacto.
- **Plazos**: `fecha_limite` se calculó como fecha de auditoría (29/05/2026) + el máximo de cada rango de "Plazo objetivo" del documento (ej. "0-7 días" → +7). Al momento de la carga (18/06/2026) las 9 ya estaban vencidas según ese cálculo — es así por el desfasaje entre fecha de auditoría y fecha de carga, no un error.
`created_by` quedó asignado al usuario admin (Nicolás Vitale). Ningún registro se vinculó a una No Conformidad existente.

### 1.4d Carga del Plan CAPA “Gestión integral de Escalas” (2026-06-19)
A pedido explícito del usuario se cargaron en producción las 11 acciones del documento `Plan_de_Accion_Gestion_de_Escalas_Miguel_Nicolas.docx` como `CA-2026-010` a `CA-2026-020`, agrupadas bajo `auditoria_codigo = 'FK-GEST-ESCALAS-2026-06-19'`. La asignación operativa solicitada prevalece sobre los responsables mixtos del documento: todas quedaron con `responsable = 'Miguel Riviere'`, `sede_id = NULL` y `sede_nombre = 'Gestión'`; los responsables adicionales originales se conservaron en `notas` junto con plazo, inicio y evidencia de cierre. Estado inicial `Pendiente`, tipo `Correctiva`, sin vínculo a No Conformidad. El cargador idempotente `scripts/load_plan_gestion_escalas.mjs` verificó 11 filas, códigos consecutivos, asignación y ausencia de caracteres corruptos.

### 1.4 Agregar Flota como submódulo de Mantenimiento, no como módulo nuevo independiente
Los vehículos se modelan como un subtipo de `mantenimiento.activos` (`tipo = 'VEHICULO'`), reutilizando la misma tabla y los mismos tickets/checklists que equipos e instalaciones, en lugar de crear tablas `vehiculos`/`tickets_flota` separadas. Confirmado en el código: `MntFlotaGestion.jsx` y `MntVehiculos.jsx` filtran `activos` por `tipo`, y `MntActivos.jsx` explícitamente excluye `VEHICULO` de su listado para no duplicar la vista. Ventaja: reutiliza todo el motor de tickets/checklists/alertas sin duplicar lógica. Costo: cualquier columna específica de vehículo (patente, vencimiento de documentación) vive en las mismas columnas genéricas de `activos`, lo que acopla el modelo de datos de vehículos al de equipos/instalaciones.

## 2. Decisiones de arquitectura

### 2.1 SPA sin backend propio, Supabase como única capa de servidor
Confirmado en ARCHITECTURE.md: no hay servidor intermedio entre el navegador y Supabase salvo 3 Edge Functions puntuales. Reduce superficie de infraestructura a mantener (apropiado para un equipo chico), pero también significa que casi todo el control de acceso depende de RLS/grants de Postgres — y donde esos no están bien configurados (ver KNOWN_ISSUES.md), no hay una capa intermedia que compense.

### 2.2 Sin router — navegación por estado local
`App.jsx` mantiene `activeView` en `useState` en lugar de usar `react-router`. Razonable para una app interna de uso siempre-logueado sin necesidad de compartir URLs profundas (excepción: el flujo QR `?scan=activo&id=...`, que sí necesita un parámetro de URL real y se maneja como caso especial). Costo: no se puede enlazar directo a una vista específica ni usar el botón "atrás" del navegador de forma significativa.

### 2.3 Separación por esquema Postgres (`bitacora`/`mantenimiento`/`equipo`) en vez de prefijos de tabla en un solo esquema
Decisión de modelado de datos: cada dominio de negocio vive en su propio esquema Postgres. Intención aparente (no documentada explícitamente, inferida de la estructura): aislar permisos y mantener claro qué tablas pertenecen a qué módulo. Acceso a `mantenimiento`/`equipo` se diseñó para pasar por vistas `SECURITY DEFINER` expuestas en `public`, no por acceso directo al esquema — pero esa intención **no se sostuvo de forma consistente** (varios componentes acceden directo a `mantenimiento`/`equipo`, detalle en ARCHITECTURE.md §2 y API.md §3.1). Es una decisión de diseño correcta cuya ejecución quedó incompleta, no un error de diseño en sí.

### 2.4 RBAC implementado en el cliente, no en RLS granular por rol
`src/lib/auth.jsx` calcula `allowedSedeIds` según el rol del perfil y el frontend filtra sus queries según ese valor — pero la base de datos no tiene políticas RLS equivalentes que reproduzcan esa misma restricción. Decisión razonable para iterar rápido en una primera versión, pero deja la restricción de "qué sede puede ver cada usuario" dependiente de que el frontend se porte bien, no de una barrera real en la base. Es la causa raíz de varios hallazgos de KNOWN_ISSUES.md §1–2.

### 2.5 Cambios de permisos (GRANT/RLS) nunca se aplican automáticamente — siempre se presentan como SQL para que el usuario los corra
Regla operativa explícita documentada en `BITACORA.MD.docx` §1: "Cambios de permisos (GRANT/RLS) en la base: siempre se presentan como SQL para que el usuario los corra él mismo, nunca se aplican automáticamente." Esto explica por qué hay hallazgos de seguridad conocidos desde antes de este paquete (ej. el `GRANT` faltante en `bitacora.adjuntos`, documentado en la misma fuente §4) que siguen sin resolverse: no es negligencia ni desconocimiento, es una política deliberada de no tocar permisos de producción sin supervisión humana directa en cada cambio. Quien continúe el proyecto debería decidir si mantiene esta política o la delega con más automatización, sabiendo que el costo es una acumulación de deuda de seguridad pendiente de aplicación manual (ver BACKLOG.md).

### 2.6 `bitacora.registros` es append-only por diseño (no se puede borrar, solo corregir)
Dos triggers (`protect_registros`, `block_delete_registros`) bloquean cualquier `DELETE` sobre la tabla de novedades. Decisión de integridad/auditoría: una novedad reportada queda como registro permanente, las correcciones se hacen vía `UPDATE`, no borrando y recreando. Confirmado además en `BITACORA.MD.docx` §1 como regla explícita: "Nunca borrar filas de `bitacora.registros` sin antes dropear el trigger `protect_registros_from_delete`" — es decir, incluso el propio equipo de desarrollo trata el borrado como una operación excepcional que requiere desactivar la protección a propósito, no un camino normal.

### 2.7 Sincronización `registros → escalamientos` vía trigger, no desde el frontend
La creación de una fila en `escalamientos` cuando `requiere_escalamiento = true` ocurre en un trigger de base de datos (`fn_sync_escalamiento`), no en el código de `MobileReporte.jsx`/`RegistroModal`. Decisión correcta en principio (garantiza el comportamiento sin importar qué cliente inserte el registro: frontend, Edge Function, o acceso directo), pero su efectividad depende de que la política RLS de `escalamientos` permita la inserción al rol que esté ejecutando el `INSERT` original — y hoy no la permite para ningún rol real (ver KNOWN_ISSUES.md §1.2). La decisión de arquitectura es sólida; la implementación de la policy que la sostiene tiene un defecto.

## 3. Decisiones técnicas puntuales sobre el backfill de novedades

Documentadas en `BITACORA.MD.docx` §2 (primera ronda de backfill, ya completada — corresponde a las tareas #1–4 del historial de trabajo, todas cerradas):

- Fuente: dos planillas de Google Sheets ("BITÁCORA IN SITU – NOVEDADES" para Hospitales y "BITÁCORA IN SITU COMEDORES – NOVEDADES" para Comedores).
- Método de inserción: `ON CONFLICT DO NOTHING`, apoyándose en las constraints únicas ya existentes de la tabla para evitar duplicados, en lugar de construir lógica de deduplicación a mano.
- Resultado de esa primera ronda: 160 filas insertadas para Hospitales (rango 2026-05-19 a 2026-06-15) y 80 filas para Comedores (rango 2026-05-26 a 2026-06-14).
- Caso de pérdida de información aceptada conscientemente: en Comedor Ferreyra, turno Apertura del 26/05, hubo dos respuestas de formulario para el mismo turno/día; la constraint única solo permite una fila, así que se priorizó la más reciente (16:04) y la otra (14:44) quedó fuera de la base, pendiente de decisión manual sobre si agregarla aparte.

**Importante para quien continúe:** las tareas #30–32 del backlog de trabajo (backfill de Comedores en curso, Hospitales pendiente, verificación de conteos) son una **segunda ronda**, posterior a la fecha del documento anterior y no cubierta por él — es decir, se detectó un nuevo gap después de esa primera limpieza. No se debe asumir que el backfill está cerrado solo por la existencia de esa primera ronda documentada.

## 4. Decisiones de seguridad explícitamente diferidas (no tomadas, a propósito)

Documentado en `BITACORA.MD.docx` §5–6 como hallazgos presentados al equipo pero **no resueltos a propósito**, a la espera de una decisión del responsable del proyecto:

- Activar RLS en `bitacora.audit_log`, `bitacora.errores_ingesta`, `bitacora.grupos` (hoy sin RLS).
- Acotar políticas `WITH CHECK (true)` por rol/sede en vez de dejarlas abiertas.
- Revisar si el bucket de Storage `bitacora-adjuntos` debería permitir listado público de archivos.
- Revisar si `get_user_rol_bitacora`/`log_auditoria` (funciones `SECURITY DEFINER`) deberían ser ejecutables por `anon`/`authenticated`.
- Activar la protección de contraseñas filtradas en Supabase Auth.

Estos hallazgos son anteriores a los de KNOWN_ISSUES.md (que agrega hallazgos nuevos, verificados de forma independiente en este paquete) — juntos confirman que el patrón de RLS permisivo no es un incidente puntual sino una característica conocida y discutida del proyecto desde antes, todavía sin resolución.

## 5. Aclaración importante: dos proyectos Supabase distintos, no uno con datos mezclados

Verificado en esta sesión vía la API de Supabase (`list_projects`): la organización del usuario (`ucmxogftocvtpzszxoai`) tiene **dos proyectos separados**:

| Proyecto | ID | Nombre | Estado |
|---|---|---|---|
| Fly Kitchen (este repo) | `mixyhfdlzjarvszinytk` | cerdova-db | ACTIVE_HEALTHY |
| Otro cliente | `hmyzuuujyurvyuusvyzp` | OCTOPUS COQUINARIA | INACTIVE |

Esto es distinto del hallazgo de PROJECT_STATUS.md §4 sobre 11 tablas ajenas dentro del esquema `public` **del proyecto de Fly Kitchen** (`mixyhfdlzjarvszinytk`) — esas 11 tablas son una tercera cosa: datos de otra aplicación que comparte el mismo proyecto físico, no el proyecto Octopus. En total hay tres capas a distinguir y no confundir: (1) los esquemas propios de Fly Kitchen dentro de `mixyhfdlzjarvszinytk`, (2) las 11 tablas ajenas dentro de `public` del mismo proyecto `mixyhfdlzjarvszinytk`, y (3) el proyecto Supabase completamente separado `hmyzuuujyurvyuusvyzp`, que pertenece a otro cliente y nunca debería tocarse desde este trabajo. Detalle operativo de esta regla en AGENTS.md.

## 6. Limitaciones de este documento

No existe historial de commits ni changelog versionado, por lo que las decisiones documentadas aquí son las que quedaron registradas en `BITACORA.MD.docx` (una sesión puntual) o las que se pueden inferir razonablemente de la estructura del código y el esquema. Es probable que existan otras decisiones de diseño tomadas verbalmente o en conversaciones no documentadas, que no están reflejadas acá.
