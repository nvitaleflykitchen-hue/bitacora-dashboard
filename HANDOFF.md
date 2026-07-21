# HANDOFF — traspaso entre agentes

Cada agente anota acá lo que hizo antes de terminar su turno. El siguiente lo lee antes de
empezar. Lo más nuevo va arriba. Reglas completas en [`AGENTS.md`](./AGENTS.md) §4.

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
