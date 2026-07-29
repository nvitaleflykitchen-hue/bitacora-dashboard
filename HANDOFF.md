# HANDOFF — traspaso entre agentes

Cada agente anota acá lo que hizo antes de terminar su turno. El siguiente lo lee antes de
empezar. Lo más nuevo va arriba. Reglas completas en [`AGENTS.md`](./AGENTS.md) §4.

---

## 2026-07-29 · Codex — informe general configurable desde la app

- `DashboardGlobal.jsx` incorpora el botón “Informe de gestión”.
- El nuevo modal permite seleccionar período, múltiples sedes dentro del alcance del
  usuario y cualquiera de estos puntos: Operación, Escalamientos, Mantenimiento, Flota,
  Compras, Calidad, Tareas/Gestión y Equipo/RR. HH.
- `gestionGeneralReportPdf.js` consulta únicamente los módulos y sedes seleccionados,
  resume estados/KPIs y descarga un PDF A4 con el alcance indicado.
- Se agregó cobertura para informe completo y selección de un solo punto.
- Validación local: revisión visual de las dos páginas renderizadas sin recortes ni
  superposiciones; `npm run check` aprobado (lint sin errores, 11 advertencias
  preexistentes; 17 archivos y 61 tests aprobados; build Vite aprobado).
- No hubo cambios en Supabase, datos, esquema, RLS o permisos.

## 2026-07-29 · Codex — apercibimientos visibles y firmado adjunto

- Se verificó en Supabase, únicamente mediante consultas de solo lectura sobre
  `mixyhfdlzjarvszinytk`, que Pablo Gabriel Oggero tiene 2 solicitudes disciplinarias
  notificadas y 2 filas vigentes correctamente vinculadas en `equipo.historial_personal`.
- `EquipoView.jsx` y `MobilePersonal.jsx` ahora leen el historial desde la tabla canónica
  `equipo.historial_personal`, protegida por RLS, en lugar de depender de
  `public.v_historial_personal`, cuya falla quedaba silenciada como una lista vacía.
- `PersonaFormularios.jsx` muestra, debajo de cada solicitud notificada, el panel
  “Apercibimiento firmado” asociado al mismo `historial_id`; admin puede subir archivo o
  foto desde allí. El adjunto también se ve en Historial, sin duplicar archivos.
- Verificación previa en el árbol compartido: `npm run check` aprobado (lint sin errores,
  11 advertencias preexistentes; 16 archivos y 59 tests aprobados; build Vite aprobado).
- No se modificaron datos, esquema, grants, RLS ni policies.

## 2026-07-28 · Codex — Falso error al aprobar formularios disciplinarios

- Se confirmó en producción que la aprobación de la solicitud de Exequiel Lobo
  sí quedó guardada, aunque la interfaz informó
  `Cannot coerce the result to a single JSON object`.
- La causa estaba en `reviewDisciplinaryRequest`: el `UPDATE` exigía una
  representación única con `.select('*').single()`. La modificación podía
  persistir y, aun así, esa conversión de respuesta fallaba.
- El flujo ahora actualiza sin depender de la representación del `UPDATE` y
  verifica el estado final mediante una consulta separada con `maybeSingle()`.
  También detecta solicitudes inexistentes o ya resueltas en otro estado.
- Se agregó cobertura de regresión para reconocer aprobaciones y rechazos ya
  aplicados.
- El PDF de apercibimiento ahora calcula la altura del motivo, amplía el marco
  y desplaza el bloque de firmas. Para textos excepcionalmente extensos reduce
  moderadamente la tipografía antes de alcanzar el límite de una hoja.
- Se renderizó y revisó visualmente el caso de Exequiel Lobo: el texto completo
  queda contenido, legible y sin superposición.
- Para motivos que no entran de forma legible en una hoja, el documento ahora
  continúa automáticamente en páginas numeradas y coloca las firmas después
  de la última línea, sin recortar contenido.
- Los administradores ahora pueden editar un apercibimiento aprobado mientras
  todavía no fue notificado. Se editan fecha, texto y campos complementarios;
  la versión anterior queda anexada a las observaciones de revisión.
- Los apercibimientos ya notificados permanecen inmutables.
- Verificado con `npm run check`: 19 archivos de prueba, 75 tests aprobados,
  lint sin errores y build de producción correcto. Persisten 6 warnings
  preexistentes.
- Pendiente de autorización de Nicolás para commit y push.

## 2026-07-24 · Codex — PDF de organigrama optimizado para impresión

- La exportación PDF ya no replica el tema oscuro de la aplicación.
- El paño se clona en modo impresión con fondo y tarjetas blancos, texto negro,
  encabezado verde oscuro y sin sombras ni grilla decorativa.
- Las líneas jerárquicas se imprimen en gris oscuro y las relaciones funcionales,
  de apoyo o comunicación en azul con sus trazos diferenciados.
- El cambio afecta únicamente el PDF; la interfaz conserva el tema oscuro.
- Prueba específica de exportación aprobada. Pendiente de commit y publicación.

## 2026-07-24 · Codex — visor full-screen, herencia y PDF de organigramas

- Se separó la consulta de la edición: cada organigrama ofrece `Ver pantalla completa`
  para todos los perfiles y `Editar` únicamente para admin.
- El visor full-screen reencuadra automáticamente al abrir/cargar datos y suma un botón
  manual `Encuadrar`, corrigiendo la vista vacía o excesivamente alejada del resumen.
- Se agregó exportación PDF A4 apaisada con título, fecha y el paño completo encuadrado.
  Usa `html2canvas@1.4.1` y `jspdf`; el nombre del archivo se normaliza sin acentos.
- El selector consolida categorías duplicadas y conserva el ID del grupo natural cuando
  existe, para no perder organigramas ya publicados. Quedan Global, Equipo central,
  Aeropuertos, Hospitales, Educación, Comedores, Planta, CCI y Restaurantes más grupos
  verdaderamente adicionales.
- Los organigramas operativos heredan como nodos obligatorios a Dirección General,
  Nicolás o Vanesa según corresponda y Calidad transversal. Los layouts publicados
  previamente conservan sus tarjetas y posiciones.
- Vanesa rige Planta Córdoba y CCI; Nicolás el resto; Débora se vincula funcionalmente
  con línea punteada y permanece al mismo nivel.
- No requiere SQL. `npm run check` aprobado: 19 archivos/70 tests, lint sin errores y
  build Vite correcto. Auditoría de dependencias de producción: 0 vulnerabilidades.
- Cambios locales pendientes de commit y publicación.

## 2026-07-24 · Codex — unidades operativas bajo Equipo central

- El organigrama global queda reducido a `Fly Kitchen → Equipo central`; las unidades
  operativas ya no aparecen como pares independientes del equipo central.
- En Equipo central se incorporan nodos navegables obligatorios sin reemplazar ni mover
  el diseño ya publicado: Planta de Producción Córdoba y CCI dependen de Vanesa Ledesma;
  Aeropuertos, Hospitales, Educación, Comedores y Restaurantes dependen de Nicolás Vitale.
- Débora Rodríguez conserva el mismo nivel jerárquico y se conecta funcionalmente con
  todas las unidades mediante líneas azules punteadas de Calidad transversal.
- Se agregaron scopes para CCI, Educación y Restaurantes, con clasificación automática
  de sedes por nombre/tipo.
- `mergeRequiredStructure` incorpora los nuevos nodos y conexiones sobre modelos
  publicados existentes, preservando posiciones y tarjetas creadas por el administrador.
- No requiere migración ni cambios de datos. `npm run check` aprobado: 18 archivos,
  68 tests y build Vite correctos; permanecen 6 warnings preexistentes ajenos.
- Cambios locales pendientes de commit y publicación.

## 2026-07-24 · Codex — organigrama global y editor de conexiones

- Se agregó un organigrama matriz `Fly Kitchen` con cinco unidades navegables:
  Equipo central, Aeropuertos, Hospitales, Comedores y Planta de Producción.
- Cada unidad abre su propio suborganigrama con doble clic y el diseñador incorpora
  una ruta superior para regresar al organigrama global.
- Las sedes se agrupan automáticamente por nombre/tipo en Hospitales, Comedores,
  Aeropuertos y Planta, conservando también los grupos existentes.
- El inspector permite editar cada conexión: tipo jerárquico/funcional/apoyo/
  comunicación, etiqueta, color, trazo, grosor, flecha y eliminación.
- No requiere SQL adicional: `bitacora.organigramas` ya persiste un modelo JSON
  independiente por `grupo_clave`.
- Verificación: `npm run check` aprobado, 18 archivos/67 tests y build Vite correctos;
  quedan únicamente 6 warnings de lint preexistentes en archivos ajenos.
- Cambios locales pendientes de commit y publicación.

## 2026-07-24 · Codex — editor visual de organigrama

- `src/views/OrganigramaView.jsx` convierte la vista estática en un lienzo interactivo.
- Únicamente admin puede activar el modo edición, arrastrar responsables y sedes, ordenar
  automáticamente y guardar una distribución diferente por grupo.
- La segunda etapa permite agregar personas existentes del directorio, quitarlas solo del
  organigrama (sin borrar ficha ni historial) y cambiar su dependencia jerárquica; las
  líneas se reconstruyen con cada cambio.
- Las líneas jerárquicas y las conexiones de apoyo se recalculan mientras se mueve cada
  tarjeta. El resto de los perfiles conserva una vista de solo lectura.
- La primera versión guarda las posiciones en `localStorage`; no modifica responsables,
  fichas, sedes, permisos ni datos de Supabase.
- Verificación: ESLint específico sin errores, 17 archivos/65 tests aprobados y build
  Vite de producción aprobado.
- Pendiente: validación visual dentro de una sesión autenticada y, si se requiere que la
  disposición sea compartida entre usuarios, diseñar/aprobar una tabla de layout en
  Supabase antes de aplicar SQL.
- Sin commit, push, deploy ni cambios remotos.

## 2026-07-24 · Codex — rediseño full-screen del organigrama

- Se reemplazó el editor simple por `OrganigramaDesigner.jsx`, basado en
  `@xyflow/react@12.11.2` fijado de forma exacta.
- El modo diseño cubre toda la aplicación y ofrece panel de personas, paño con zoom,
  minimapa, selección múltiple, conexiones por arrastre, prevención de ciclos,
  inspector de propiedades, autoordenamiento, deshacer/rehacer, borrador y publicación.
- Solo `admin` edita; los demás perfiles pueden abrir la vista publicada a pantalla completa.
- Se agregó fallback local y el repositorio de sincronización compartida. Mientras no
  exista la tabla remota, la interfaz informa “Guardado en este dispositivo”.
- Migración aplicada en el proyecto correcto `mixyhfdlzjarvszinytk` y espejada en
  `supabase/migrations/20260724151857_organigrama_designer_shared_layout.sql`.
  Crea `bitacora.organigramas`, habilita RLS, permite lectura autenticada y reserva
  inserción/actualización a perfiles `admin`. Verificación: RLS activo, `anon` sin
  privilegios, `authenticated` sin DELETE, tres policies esperadas y cero filas iniciales.
- ESLint y build aprobados; prueba específica del motor aprobada (2/2). La verificación
  visual automatizada no llegó a abrir el navegador y fue detenida tras el primer timeout.
- Sin commit, push, deploy ni cambios remotos.

## 2026-07-22 · Codex — selector válido en alta móvil de Compras

- `MobileRequerimientos.jsx` reemplaza el texto libre de `tipo_compra` por un selector
  limitado a los tres valores admitidos por la base: reposición, prueba y compra única.
- El valor inicial es `reposicion`; “Compra única / equipamiento” envía `unica` y ya no
  provoca el CHECK `requerimientos_tipo_compra_check`.
- Se cargó manualmente en producción el requerimiento N.º 54 para Elisa Bessone:
  balanza para materia prima de 20 a 30 kg, compra única, urgencia media y estado Pendiente.
- Verificación desde worktree limpio de `main`: `npm run check` aprobado; 0 errores de
  lint (6 warnings preexistentes), 16 archivos/59 tests y build Vite correcto.

---

## 2026-07-21 · Codex — miniaturas de fotos de personal

### Implementado localmente

- `src/lib/personaFotos.js` genera al subir cada foto una miniatura WebP cuadrada de 256 px y la almacena junto al original con sufijo `-thumb.webp`.
- El original se conserva para credenciales, PDF y edición; la eliminación o reemplazo retira original y miniatura.
- Las URLs firmadas se reutilizan durante 55 minutos para evitar solicitudes repetidas.
- `src/components/PersonaAvatar.jsx` usa miniatura, carga diferida, decodificación asíncrona y fallback automático al original para fotos antiguas.
- `src/lib/personaFotos.test.js` cubre la convención de rutas de miniaturas.

### Verificación

- `npm run check`: lint 0 errores/11 advertencias preexistentes; 16 archivos y 59 tests aprobados; build Vite aprobado.
- No se cambió esquema, grants, RLS ni policies. No se escribió en Supabase.
- Sin commit, push o deploy.

### Pendiente

- Las fotos existentes siguen cargando el original hasta generar sus miniaturas. Hacer un backfill controlado después de publicar el código, sin reemplazar los originales.

## 2026-07-20 · Codex — flujo de aprobación disciplinaria aplicado en Supabase

### Implementado localmente

- `PersonaFormularios.jsx` ahora crea solicitudes, permite documentar descargo,
  testigos/evidencia, texto de NotebookLM y medidas preventivas urgentes.
- Solo `admin` revisa, aprueba/rechaza, descarga el PDF y confirma la notificación.
- El antecedente formal se crea recién al confirmar la notificación.
- Desktop/mobile bloquean la carga manual de sanciones para no administradores.
- Nueva capa `disciplinaryWorkflow.js` con pruebas de roles y estados.
- Migración REVIEW creada con Supabase CLI en
  `20260720235102_disciplinary_approval_workflow_REVIEW.sql`.

### Base de datos

- Se inspeccionó y modificó únicamente `mixyhfdlzjarvszinytk` con confirmación de Nicolás.
- La migración crea `equipo.solicitudes_disciplinarias`, RLS, grants, policies y RPC de
  notificación; también reemplaza la policy de escritura general de
  `equipo.historial_personal` para reservar sanciones formales a `admin`.
- Migración aplicada manualmente mediante Supabase MCP. Verificación posterior: tabla
  existente, RLS activo, RPC existente, 7 policies esperadas entre solicitudes/historial,
  grants `SELECT/INSERT/UPDATE` solo para `authenticated`, 0 grants para `anon` y 0 filas
  de prueba persistidas.
- Security Advisor ejecutado: no informó hallazgos nuevos del flujo disciplinario; conserva
  hallazgos preexistentes de otros esquemas que no se tocaron.

### Verificación

- `npm run check`: lint 0 errores/6 advertencias preexistentes; 16 archivos y 57 tests
  aprobados; build Vite aprobado.
- Sin commit, push ni deploy. Supabase sí fue actualizado; Vercel/GitHub/NotebookLM no.

---

## 2026-07-20 · Codex — acceso restringido al cuaderno disciplinario

### Objetivo

Dejar el cuaderno de NotebookLM a mano dentro de la app únicamente para perfiles con rol
`admin` o `encargado`, tanto en escritorio como en celular.

### Archivos tocados

- `src/lib/access.js` — URL centralizada y regla `canAccessDisciplinaryNotebook()`.
- `src/lib/access.test.js` — prueba que permite solamente `admin` y `encargado`.
- `src/components/Sidebar.jsx` — acceso externo "Control disciplinario" en escritorio.
- `src/mobile/MobileMas.jsx` — tarjeta equivalente en Más para mobile.

Se preservaron los cambios locales preexistentes de Proyectos en `access.js`,
`access.test.js` y `Sidebar.jsx`.

### Verificación

- Test específico: 20/20 aprobado.
- `npm run check`: lint sin errores (6 advertencias preexistentes), 15 archivos y 54 tests
  aprobados, build Vite aprobado.
- No se modificó Supabase, NotebookLM, Vercel ni GitHub. Sin commit, push o deploy.

### Pendiente funcional

El formulario actual `PersonaFormularios.jsx` genera el PDF y registra el apercibimiento
inmediatamente. El circuito propuesto debe pasar a borrador → aprobación admin →
notificación. Requiere estados/auditoría persistentes y cambios de seguridad en el esquema
`equipo`; antes de cualquier SQL se debe mostrar la propuesta a Nicolás y obtener su
confirmación explícita.

---

## 2026-07-20 · Claude — PDF de la credencial alineado a la vista previa

### Objetivo

Corregir el PDF de impresión de la credencial aeroportuaria para que reproduzca la
composición de la vista previa, sin tocar la vista de creación/edición.

### Archivos tocados

- `src/lib/credenciales.js` — **único archivo modificado**. No se tocó
  `CredencialPersonalModal.jsx` ni ningún otro trabajo en curso.

### Qué se cambió y por qué

La geometría del PDF estaba escrita con números sueltos que no coincidían con la vista
previa. Ahora se deriva de los píxeles del modal (tarjeta de 270 x 428 px sobre CR80 de
53,98 x 85,6 mm) mediante los helpers `mx()`, `my()` y `ptFromPx()`.

| | antes | ahora | referencia (vista previa) |
|---|---|---|---|
| Logo dorso | 36,06 x 14,00 mm | 25,76 x 10,00 mm | 25,76 x 10,00 mm |
| Logo frente | 21,12 x 8,20 mm | 20,61 x 8,00 mm | 20,61 x 8,00 mm |
| Ancho de foto | 45,00 mm | 46,18 mm | 231 px = 46,18 mm |
| Franja categoría | 8,98 mm | 7,80 mm | 39 px = 7,80 mm |
| Lienzo del recorte | 450 x 436 (1,0321) | 462 x 436 (1,0596) | 231 x 218 = 1,0596 |
| QR | 30 mm en y=20 | 33,20 mm en y=14 | 166 px = 33,20 mm |

- **Logo:** `addContainImage()` ya conservaba la proporción; se le agregó una guarda para
  que, si `getImageProperties` no devuelve dimensiones válidas, omita el dibujo en lugar
  de deformar la imagen o emitir medidas NaN. Verificado: relación 2,5758 idéntica al
  archivo original (340 x 132 px) en las dos caras, y centrado en ambos ejes.
- **Foto:** el lienzo del recorte ahora tiene la misma relación de aspecto que el
  contenedor de la vista previa. Se verificó numéricamente que la fórmula de
  `coverImageData()` es **exactamente equivalente** a `object-fit:cover` +
  `object-position` + `transform:scale` con `transform-origin` de CSS (diferencia máxima
  2,27e-13 px sobre 15 combinaciones de posición y zoom). El encuadre del administrador se
  respeta tal cual.
- Textos y bandas reubicados según el flujo del modal (paddings, interlineados y
  `marginTop:auto` de la fila de sede/grupo sanguíneo). Se conservan QR, vencimiento,
  categoría, DNI, puesto, sede, grupo sanguíneo y el nombre del archivo.

### Verificación

- `npm run check`: lint 0 errores / 6 advertencias · **15 archivos y 53 tests aprobados**
  · build Vite OK. Idéntico a la línea de base de Codex.
- `git diff --check`: limpio en `credenciales.js`. Las advertencias de espacios que
  aparecen son preexistentes en `.codex/compras_items.json` y no se tocaron.
- **Visual:** se generó el PDF real ejecutando el código del archivo fuente en Node y se
  rasterizó a 300 dpi para revisar **frente y dorso**, no sólo el modal. Se confirmó
  logo sin deformar y centrado, foto sin recorte lateral ni estiramiento, franja de
  categoría con las letras centradas, QR completo y banda de vencimiento.

### Pendiente

- Falta la verificación en la app real con una persona y una foto de verdad: el control
  visual se hizo con una imagen de prueba de 462 x 436 y un QR simulado.
- **Nada publicado.** Todo queda local: sin commit, sin push, sin deploy. No se aplicó
  ninguna migración ni cambio en Supabase/Vercel.

---

## 2026-07-20 · Codex — guardarraíl para continuidad

### Estado comprobado antes del próximo turno

- `npm run check`: **aprobado** el 20/07/2026 (lint: 0 errores/6 advertencias;
  tests: 15 archivos y 53 tests aprobados; build Vite aprobado).
- El árbol de trabajo está muy cargado: hay múltiples archivos modificados y sin
  seguimiento correspondientes a trabajos de ambos agentes. No limpiar ni commitear en
  bloque. Revisar `git status --untracked-files=all` antes de tocar nada.
- Se reforzó `CLAUDE.md` con un protocolo obligatorio de inicio, edición, validación y
  cierre. Claude debe cumplirlo antes de continuar.

### Incidente que no debe repetirse

Faltaron temporalmente exports usados desde `src/lib/queries.js`, lo que rompió el build.
Se restauraron y la línea de base volvió a quedar verde. Antes de eliminar o renombrar
cualquier export, buscar todos los usos con `rg`; antes de entregar, ejecutar siempre
`npm run check` completo.

### Próximo objetivo funcional: credencial aeroportuaria

- La vista de creación/edición quedó visualmente bien y debe conservarse.
- El PDF de impresión debe reproducir esa composición, no estirar el logo de Fly Kitchen
  y mantener siempre su relación de aspecto.
- Decisión visual pendiente solicitada por Nicolás: el logo debe quedar centrado; si el
  espacio no alcanza, reducirlo proporcionalmente. No deformarlo ni estirarlo.
- Conservar el encuadre de foto ajustable por el administrador y reflejar exactamente ese
  encuadre en el PDF.
- Verificar frente y dorso del PDF descargado, no solamente el modal de vista previa.

### Archivos especialmente sensibles en esta continuidad

- `src/components/CredencialPersonalModal.jsx`
- `src/lib/credenciales.js`
- `src/lib/queries.js`
- `src/views/EquipoView.jsx`
- `src/views/CredencialVerificacion.jsx`
- recursos de logo usados por la credencial

No se autorizó en este turno ningún commit, push, despliegue ni cambio remoto.

---

## 2026-07-20 · Claude

### Estado del repositorio

- Rama única acordada con Nicolás: **`main`**. `origin/main` = `9d8de89`.
- `respaldo/pre-estabilizacion-15-07-2026` quedó congelada en `4e27292` (16/07) y pasa a
  ser sólo respaldo histórico. `main` la contiene entera más 19 commits.
- **Pendiente de Nicolás:** confirmar en Vercel → Settings → Git que la *Production Branch*
  sea `main`. El último deploy de producción figuraba tomando `respaldo/...`, por lo que
  puede haber cosas mergeadas en `main` que todavía no estén publicadas.

### Cambios publicados hoy en `main`

| commit | qué |
|---|---|
| `e7e55cf` | Tablón: alcance por áreas/equipos (Compras, Mantenimiento, Flota, Encargados) y personas sueltas |
| `8679bfe` | Notificaciones: el push pasó a ser best-effort. Antes `setVapidDetails` corría antes de guardar la notificación y sin try/catch, así que una VAPID mal cargada devolvía 500 y tumbaba la publicación del anuncio |
| `f8b6c34` | Vacaciones: no se podía enviar la solicitud. La policy `vacaciones_staff_insert` exige `solicitado_por = auth.uid()` y el formulario nunca mandaba ese campo. También se calcula `dias_solicitados` en el cliente (no hay trigger) |
| `9d8de89` | Credenciales: `public/fly-kitchen-credencial.png` no estaba en el repo (en producción la ruta devolvía el index.html y jsPDF fallaba con "files of type UNKNOWN"). Además `autoEscalarTickets` pasó a hacer un único upsert en lote en vez de hasta 20 escrituras sueltas por carga de página |

Edge Function `send-priority-notification` desplegada en Supabase: **v13**.

### Archivos que existen en local pero NO en el repo

Verificar siempre con `git status --untracked-files=all`. Al 20/07 estaban afuera:

```
src/components/CredencialPersonalModal.jsx
src/components/MiGestionPanel.jsx
src/components/PersonaAvatar.jsx
src/views/CredencialVerificacion.jsx
src/views/ProyectosGestion.jsx
src/lib/comprasEntrega.js      (+ .test.js)
src/lib/gestionProjects.js     (+ .test.js)
src/lib/personaFotos.js        (+ .test.js)
```

`src/lib/credenciales.js` y `public/fly-kitchen-credencial.png` ya se subieron en `9d8de89`.

**No commitear en bloque:** hay ~30 archivos modificados sin commitear con trabajo de los
dos agentes mezclado. Hay que revisarlo con Nicolás archivo por archivo.

### Abierto / sin resolver

- **Lentitud de la app.** Descartada la base: la tabla más grande tiene 2.791 filas. Se
  corrigió el punto de las 20 escrituras por carga, pero **no está confirmado que fuera la
  causa principal**. El service worker (`public/sw.js`) sólo maneja push, no cachea nada,
  así que cada visita se baja ~1,4 MB de JS de cero — candidato fuerte si la lentitud es
  sobre todo al abrir la app.
- **Push al celular.** Las notificaciones dentro de la app funcionan. El envío push está
  sin confirmar; si falla, la función ahora devuelve `pushError` con el motivo en la
  respuesta (mirar los logs de la Edge Function).
- **`cron-preventivos`** viene devolviendo 400. Sin revisar.
- **Escalamientos:** ~106 pendientes sin triage.

### 2026-07-21 — Observaciones de Compras dentro de la plataforma

- Se eliminó la apertura automática de correo al marcar un requerimiento como `Observado`.
- La observación queda registrada en Fly Gestión y el usuario seleccionado con `@` recibe la notificación interna existente.
- Verificado: lint sin errores, 59 tests aprobados y build de producción correcto.
- Pendiente de publicación: requiere autorización explícita de Nicolás.

### 2026-07-21 — Compras móvil y período de prueba

- Compras móvil incorpora `Nueva solicitud` con sede, descripción, cantidad, urgencia, fecha necesaria y justificación.
- Se cruzó la planilla de períodos de prueba: 9 fichas faltantes creadas y 3 fichas completadas; 14 personas no-Planta verificadas.
- Equipo incorpora una pestaña administrativa con cuenta regresiva de 180 días desde el ingreso; excluye Planta Córdoba y conserva vencidos por 30 días.
- Autorizado para publicar por Nicolás.

### 2026-07-21 — Semáforo visual del período de prueba

- Las tarjetas de la vista `Equipo > Lista` muestran marco y rótulo con la cuenta regresiva.
- Escala: verde >60 días, amarillo 31–60, naranja 16–30 y rojo <=15 o vencido.
- Verificado con ESLint y build; autorizado para publicar.

### 2026-07-22 — Eliminación de fichas de personal exclusiva de Nicolás

- Se restringió el `DELETE` de `equipo.personas` al usuario de Nicolás Vitale (`626b2a44-be84-4b3e-a03f-505eaf9d195e`) mediante la migración `20260722182222_restrict_person_delete_to_nicolas_vitale.sql`, aplicada únicamente en Supabase `mixyhfdlzjarvszinytk`.
- Equipo muestra el botón rojo `Eliminar ficha`/`Eliminar` solamente a ese usuario, tanto en escritorio como en mobile.
- El borrado exige escribir el nombre completo exacto y luego aceptar una segunda confirmación. Si hay registros vinculados y Postgres bloquea la operación, se informa que corresponde usar `Dar de baja`.
- No se eliminó ninguna persona durante la implementación.
- Verificado: 21 tests de acceso aprobados, ESLint sin errores (2 warnings preexistentes en `EquipoView.jsx`) y build de producción correcto.
## 2026-07-24 · Codex — cálculos de raciones y numeración de NC

- Se corrigió localmente la diferencia entre el resumen de “Últimos reportes con
  raciones” y el modal de detalle. `RegistroModal` ahora usa la misma función de
  cálculo que `ComedoresMetricas`.
- Ensalada y postre, que no tienen un campo explícito de servido, calculan
  `servido = producido - reutilizable - descarte`.
- Cuando un campo servido quedó en `0` por defecto pero existe producción, también
  se infiere por diferencia. Esto corrige el caso Quilmes de 160 producidas,
  84 sobrantes y 6 servidas: el resultado consistente es 76 servidas.
- Se agregaron pruebas para Central Plaza y Quilmes. Verificación: ESLint de los
  archivos tocados sin errores, 5 pruebas específicas aprobadas y build Vite OK.
- El arreglo de códigos globales de No Conformidades fue aplicado en producción y
  validado como Nair dentro de una transacción revertida:
  `supabase/migrations/20260724110000_assign_no_conformidad_code_atomically.sql`
  y el cambio correspondiente en `src/lib/queries.js`.
- La prueba intentó insertar `NC-2026-001`, el trigger asignó `NC-2026-013` y el
  `ROLLBACK` confirmó que no quedó ninguna fila de prueba.

## 2026-07-24 - Codex - PDF vectorial de organigramas

- Se reemplazó la captura rasterizada del paño por un PDF vectorial A4 apaisado.
- Las tarjetas se dibujan con texto oscuro y tamaños legibles; las dependencias
  jerárquicas usan líneas verdes sólidas con flechas y las relaciones transversales
  usan líneas azules punteadas.
- El PDF incluye leyenda, fecha y pie de documento, y acomoda automáticamente los
  nodos dentro del área imprimible.
- Verificado con `npm run check`: 19 archivos de prueba, 71 tests aprobados y build
  correcto. Persisten 6 warnings de lint preexistentes, sin errores.
- Se generó y renderizó una muestra de Equipo central para verificar visualmente
  contraste, textos y continuidad de las conexiones.
- Publicación autorizada explícitamente por Nicolás.

## 2026-07-26 - Codex - Estructura privada de RR. HH.

- Se analizó `BASE_COMPLETA_PERSONAL_FLY_2026.xlsx`: 231 filas, 221
  coincidencias seguras, 5 para revisión y 5 excluidas por no existir en la app.
- Se creó y aplicó en producción (`mixyhfdlzjarvszinytk`) la migración
  `persona_rrhh_privada`, con las tablas `equipo.persona_rrhh` e
  `equipo.importaciones_personal`.
- Ambas tablas tienen RLS activo y políticas de lectura/escritura exclusivas
  para perfiles `admin`; `anon` no tiene privilegios y no se concedió `DELETE`.
- El lote seguro fue aplicado en producción: 221/221 personas activas y
  canónicas tienen su ficha `equipo.persona_rrhh`, todas con fila de origen.
- Los 5 casos para revisión manual no fueron importados y las 5 personas que no
  existen en la app continuaron excluidas. El total de personas activas
  canónicas se mantuvo en 234; no se crearon ni reactivaron fichas.
- La carga normalizó nombre y apellido a estilo oración y completó solamente
  campos operativos vacíos. No modificó roles, permisos, sedes, estado activo
  ni vínculos históricos.
- Antes de aplicarla se ejecutó el lote completo dentro de
  `BEGIN ... ROLLBACK`: validó 221/221 y dejó cero filas persistidas. Luego se
  aplicó el mismo lote con `COMMIT` y se verificó nuevamente 221/221.
- El archivo local de migración está pendiente de commit/push:
  `supabase/migrations/20260726213000_persona_rrhh_privada.sql`.
- Se generó una simulación auditable de importación, sin cambios de datos:
  221 coincidencias seguras, 5 revisiones manuales y 5 exclusiones.
- La simulación se encuentra en
  `C:/Users/nicol/AppData/Local/Temp/codex-personal-analysis/outputs/SIMULACION_IMPORTACION_PERSONAL_FLY_2026.xlsx`.

## 2026-07-26 - Codex - UUID del creador en Calidad móvil

- Corregido `MobileCapa`: la creación móvil de No Conformidades enviaba el nombre
  del perfil en `created_by`, aunque la columna exige el UUID de autenticación.
- El mismo defecto fue corregido preventivamente en la creación móvil de CAPA.
- Ambos flujos ahora usan `user.id`, con `perfil.id` como respaldo, y `null` si la
  sesión no aporta ninguno.
- Verificado con `npm run check`: 19 archivos de prueba, 71 tests aprobados y build
  correcto; quedan 6 warnings de lint preexistentes y ningún error.
- Publicación autorizada explícitamente por Nicolás.

## 2026-07-26 - Codex - Ficha privada de RR. HH. en Equipo

- Se agregó la pestaña `RR. HH.` a la ficha individual de Equipo, visible
  únicamente para perfiles `admin`.
- La vista consulta `equipo.persona_rrhh` solamente cuando se abre la pestaña y
  organiza la información en datos personales, contacto de emergencia,
  domicilio, datos laborales, indumentaria y trazabilidad de importación.
- Las personas no incluidas en el lote seguro muestran el estado
  `Ficha privada pendiente`, sin inventar ni completar información.
- La interfaz es de solo lectura; la protección real continúa en las políticas
  RLS admin-only de las tablas privadas.
- Verificado con `npm run check`: 19 archivos de prueba y 71 tests aprobados,
  lint sin errores y build de producción correcto. Persisten 6 warnings
  preexistentes.
- Archivos pendientes de commit/push: `src/components/PersonaRrhhPanel.jsx`,
  `src/views/EquipoView.jsx`, `HANDOFF.md` y la migración privada ya aplicada.

## 2026-07-24 - Codex - Calidad transversal en todos los organigramas

- La estructura obligatoria de todo organigrama operativo incluye Dirección,
  Operaciones y Calidad.
- Calidad mantiene dependencia jerárquica de Dirección y una relación funcional
  azul punteada hacia Operaciones.
- La misma regla se aplica automáticamente a Equipo central y a todas las unidades
  de negocio, incluso sobre vistas publicadas anteriormente.
- En Equipo central se eliminaron las múltiples líneas directas de Calidad hacia
  cada unidad; la transversalidad se representa una sola vez hacia Operaciones,
  evitando cruces y duplicaciones visuales.
- Verificado con `npm run check`: 19 archivos de prueba, 71 tests aprobados y build
  correcto; quedan 6 warnings de lint preexistentes y ningún error.
- Publicación autorizada explícitamente por Nicolás.
# 2026-07-28 - PDF de apercibimiento con párrafos

- Corregido el cálculo de altura del apercibimiento: los saltos de párrafo que jsPDF conserva dentro de una línea ahora se contabilizan como renglones reales.
- Esto evita que textos completos guardados en la base invadan el bloque de firmas o queden visualmente recortados.
- Agregada prueba específica con varios párrafos; `apercibimientoPdf.test.js` (6/6) y build de producción pasan.
# 2026-07-28 - Guardarraíles de evaluaciones

- El aviso anti-inflación de puntajes dejó de ser solo informativo.
- Se bloquea el guardado si los 11 criterios tienen calificación 5 y se muestra una advertencia visible en el formulario.
- Toda calificación 4 o 5 exige una justificación concreta en Observaciones RR. HH. (mínimo 30 caracteres).
- Un promedio mayor a 4 exige una oportunidad de mejora en Sugerencias (mínimo 20 caracteres).
- `npm run check`: 76 tests, lint sin errores y build correcto.
