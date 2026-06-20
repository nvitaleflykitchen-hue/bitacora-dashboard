# REPOSITORY_AUDIT — bitacora-dashboard

> Auditoría de estructura de repo, higiene de código y dependencias. Todos los números de este documento se obtuvieron ejecutando comandos directos sobre el repositorio (`find`, `du`, `grep`, `wc`) el 2026-06-17, no por estimación. Advertencia general aplicable a todo este documento: TEST_REPORT.md §2 documenta que el entorno usado en esta sesión puede leer versiones truncadas de algunos archivos `.jsx` sin reportar error. Para conteos de líneas/tamaño esto no es relevante (un archivo truncado simplemente cuenta menos bytes/líneas, no más, y no se detectaron discrepancias de esa magnitud en los conteos de abajo); para búsquedas de texto (TODO, secretos) existe un riesgo residual de falsos negativos si algún archivo grande estuviera truncado exactamente en la sección buscada — se señala explícitamente donde aplica.

## 1. Estructura del repositorio

```
bitacora-dashboard/
├── src/                          → 55 archivos (50 .jsx, 4 .js, 1 .css), 16.347 líneas totales
│   ├── components/
│   ├── hooks/
│   ├── lib/                      → supabase.js, auth.jsx, queries.js
│   ├── mobile/                   → árbol separado para la versión mobile
│   └── views/
│       └── mantenimiento/
├── scripts/postinstall.cjs       → 679 bytes, parchea @supabase/phoenix
├── docs/                         → este paquete de documentación
├── node_modules/                 → 144 MB, 131 paquetes de primer nivel
├── dist/                         → 11 MB (build de producción más reciente)
├── dist2/                        → 508 KB
├── dist_v2/                      → 4.0 MB
├── bitacora-dashboard/           → 36 MB — COPIA DUPLICADA COMPLETA (ver §2.1)
├── .vercel/                      → project.json con orgId/projectId vinculados
├── BITACORA.MD.docx              → 221 KB, notas de una sesión previa
├── 58 archivos vite.config.js.timestamp-*.mjs
├── package.json / package-lock.json
├── .env.local (291 B) / .env.example
└── .gitignore (existe, pero no hay repositorio git — ver §4)
```

## 2. Anomalías de estructura encontradas

### 2.1 Carpeta duplicada `bitacora-dashboard/bitacora-dashboard/`

Es una copia completa y funcional del proyecto, no un resto vacío: tiene su propio `node_modules` (21 MB, instalación parcial/antigua — no los 144 MB de la copia activa), su propio `dist`/`dist2`/`dist_v2`, su propio `.vercel/`, y **su propio `.env.local`**. Se confirmó por `diff` que ese `.env.local` duplicado es **byte a byte idéntico** al de la raíz real — es decir, contiene la misma URL de Supabase y la misma anon key reales, no un placeholder.

Evidencia de que es una copia vieja y abandonada, no un mirror activo: tiene 38 archivos en `src/` contra 55 en la copia real (le faltan los módulos de Flota y otros agregados después), y sus 17 archivos `vite.config.js.timestamp-*` están fechados 11/06, mientras que la copia real tiene 58 fechados hasta el 17/06 — el último cambio real en esta carpeta fue hace 6 días, mientras el proyecto real sigue activo.

**Riesgo:** bajo pero real. No es una filtración de secretos críticos (la anon key está diseñada para ser pública), pero es una duplicación innecesaria de credenciales y de 36 MB de código desactualizado que puede confundir a quien explore el repo por primera vez ("¿cuál es la carpeta real?"). Recomendación: borrar la carpeta completa — no hay nada en ella que no exista, más actualizado, en la raíz.

### 2.2 Archivos de build residuales

- 58 archivos `vite.config.js.timestamp-*.mjs` en la raíz (entre 1.0 KB y 1.6 KB cada uno) — son artefactos que Vite genera y normalmente borra solo; el hecho de que se acumularon 58 sugiere que algunas ejecuciones de `vite`/`vite build` se interrumpieron antes de la limpieza automática.
- Tres carpetas de build (`dist/` 11 MB, `dist2/` 508 KB, `dist_v2/` 4.0 MB) en paralelo. Solo `dist/` es la que usa `vite.config.js` (`outDir: 'dist'`) y la que efectivamente sirve Vercel (ver DEPLOYMENT.md). `dist2/` y `dist_v2/` son builds manuales o de pruebas que quedaron sin limpiar.
- `vite.config.js` tiene `emptyOutDir: false` explícito — significa que `dist/` nunca se vacía automáticamente entre builds, así que puede acumular archivos de versiones anteriores con nombres de chunk distintos indefinidamente si no se limpia a mano.

### 2.3 `BITACORA.MD.docx` en la raíz del proyecto

221 KB, generado por una sesión de trabajo previa como resumen de decisiones y hallazgos (usado como fuente en DECISIONS.md de este paquete). No es código ni configuración — no debería vivir en la raíz de un repositorio de software a largo plazo. Recomendación: mover a una carpeta de notas/`docs/archivo` o eliminarlo una vez que su contenido relevante quedó incorporado a DECISIONS.md/BACKLOG.md (que ya ocurrió en este paquete).

## 3. Dependencias

Las 6 dependencias de producción y las 5 de desarrollo declaradas en `package.json` están **todas en uso real**, confirmado por grep de cada nombre de paquete contra `src/` (para las de producción) y contra los archivos de configuración (para las de desarrollo):

| Paquete | Uso confirmado |
|---|---|
| `@supabase/supabase-js` | `src/lib/supabase.js` (instancia única del cliente) |
| `date-fns` | 12 archivos |
| `lucide-react` | 33 archivos (set de iconos) |
| `recharts` | 2 archivos (gráficos de KPIs) |
| `react` / `react-dom` | en todo `src/` |
| `@vitejs/plugin-react` | `vite.config.js` |
| `tailwindcss` / `autoprefixer` | `postcss.config.js` |
| `vite` | scripts de `package.json` |

**No se encontraron dependencias huérfanas (sin uso) ni dependencias usadas en código pero no declaradas.** No hay `yarn.lock`/`pnpm-lock.yaml` conviviendo con `package-lock.json` (un solo gestor de paquetes, consistente).

## 4. Control de versiones

**No existe repositorio git** (confirmado: no hay carpeta `.git/`). Sí existe un `.gitignore` (42 bytes: `node_modules`, `dist`, `.env.local`, `.env.*.local`) — preparado para inicializar un repo en algún momento, pero nunca usado. Consecuencia práctica: no hay historial de cambios, no hay forma de revertir una edición salvo restaurar manualmente, y no hay code review posible. Ya señalado como ítem de Prioridad 3 en BACKLOG.md.

## 5. Calidad de código — señales generales

- **16.347 líneas** de código fuente en total (`.jsx`+`.js`), repartidas en 55 archivos.
- Archivo más grande: `src/lib/queries.js` con 1.173 líneas (centraliza la mayoría de las queries a Supabase — ver API.md §3.1 para el detalle de qué SÍ y qué NO está centralizado ahí). Le siguen `MntTickets.jsx` (780), `EquipoView.jsx` (759), `MobileReporte.jsx` (731) y `CAPA.jsx` (699) — todos por encima de lo que normalmente se considera mantenible como un solo archivo de componente, candidatos a dividir si el proyecto sigue creciendo.
- **Cero ocurrencias de `console.log`** en todo `src/` — no hay ruido de debug olvidado en el código.
- **Cero comentarios `TODO`/`FIXME`/`HACK`/`XXX`** en todo `src/` (búsqueda case-sensitive sobre las 4 variantes). Esto puede leerse de dos formas: o el código no tiene deuda técnica marcada explícitamente, o la deuda técnica nunca se marcó en el código y solo vive en la memoria de quien lo escribió — dado el volumen de hallazgos de KNOWN_ISSUES.md que no tienen ningún comentario asociado en el código fuente, la segunda lectura es la más probable.
- No se encontraron secretos hardcodeados en `src/` (claves tipo `sk-`, `AIza`, referencias a `service_role`, contraseñas literales) en la búsqueda por patrón. Esto es consistente con que las únicas credenciales del proyecto (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`) se inyectan vía variables de entorno, no hardcodeadas — pero ver §2.1 sobre la copia duplicada de `.env.local`.
- No hay ESLint ni Prettier configurados (confirmado: no hay `.eslintrc*`/`.prettierrc*`) — no hay forma automática de hacer cumplir un estilo o detectar errores comunes (variables sin usar, imports rotos, etc.) antes de que lleguen a producción.

## 6. Resumen de severidad y acción recomendada

| Hallazgo | Severidad | Acción | Ya está en BACKLOG.md |
|---|---|---|---|
| Carpeta duplicada con `.env.local` real | Baja-media (higiene + duplicación de credenciales) | Eliminar `bitacora-dashboard/bitacora-dashboard/` completa | Prioridad 4 |
| 58 archivos timestamp + `dist2`/`dist_v2` | Baja (solo ensucia el repo) | Borrar, agregar patrón al futuro `.gitignore` real | Prioridad 4 |
| `BITACORA.MD.docx` en raíz | Muy baja | Mover o eliminar (contenido ya incorporado a docs/) | Prioridad 4 |
| Sin git / sin historial | Media (afecta capacidad de revertir cambios) | Inicializar repo, primer commit con el estado actual ya limpio | Prioridad 3 |
| Sin ESLint/Prettier | Baja | Configurar antes de que el equipo crezca | Prioridad 4 |
| Archivos de componente >700 líneas | Baja (mantenibilidad, no funcionalidad) | Evaluar split si se sigue agregando funcionalidad a esas vistas | No estaba en BACKLOG.md — agregar si se decide priorizar |

No se encontró ningún hallazgo de seguridad nuevo en esta auditoría de estructura/calidad que no estuviera ya cubierto por KNOWN_ISSUES.md (que cubre los hallazgos de permisos/RLS, de naturaleza distinta a lo relevado acá).
