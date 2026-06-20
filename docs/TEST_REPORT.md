# TEST_REPORT — bitacora-dashboard

> Estado de testing automatizado y resultado de verificación de build. Verificado contra el repositorio real el 2026-06-17. Esta sesión encontró una limitación del propio entorno de verificación que afecta cómo deben leerse los resultados de build de abajo — está documentada en detalle en §2 porque es relevante para cualquiera que repita esta verificación.

## 1. Testing automatizado: no existe

Confirmado por inspección directa, no por inferencia:

- `package.json` no tiene script `test` ni `lint`. Los únicos scripts son `dev`, `build`, `preview`, `postinstall`.
- Cero dependencias de testing en `dependencies`/`devDependencies` (no hay `vitest`, `jest`, `@testing-library/*`, `cypress`, `playwright`, ni nada equivalente).
- No existen archivos `*.test.*` ni `*.spec.*` en `src/` (búsqueda recursiva, cero resultados).
- No existe ninguna carpeta `__tests__`.
- No hay configuración de ESLint ni Prettier (no hay `.eslintrc*`/`.prettierrc*` en la raíz — ya señalado en SETUP.md §1).

**Conclusión:** no hay ninguna red de seguridad automatizada hoy. Cualquier cambio se verifica manualmente, a mano, en la app corriendo. Recomendación de smoke tests mínimos ya está en BACKLOG.md (Prioridad 4).

## 2. Verificación de build: resultado y limitación importante del entorno

### 2.1 Qué se intentó

Se intentó confirmar que `npm install && npm run build` completa sin errores, para corroborar (o corregir) la afirmación ya existente en SETUP.md §5 de que el build pasó en la sesión de auditoría previa (tarea #58).

### 2.2 Hallazgo: el entorno de esta sesión no puede leer con confiabilidad algunos archivos fuente del repo

Al ejecutar el build dentro de esta sesión (tanto en el directorio original del repo como en una copia limpia fuera de él), `vite build` falló repetidamente con errores de sintaxis en archivos `.jsx` que, a simple vista, parecían indicar código roto:

- `src/App.jsx` — el build reportó el archivo cortado a mitad de una instrucción, en la línea 138 de un archivo que en teoría tiene 137 líneas.
- `src/lib/auth.jsx` — el build reportó un byte nulo (`\x00`) al final del archivo.
- `src/views/DashboardGlobal.jsx` — el build reportó el archivo cortado a mitad de una etiqueta JSX, en la línea 267.

Estos tres archivos se releyeron con una herramienta de lectura distinta a la que usó el intento de build (que pasa por el sandbox de shell sobre la carpeta sincronizada con OneDrive). **Los tres archivos están completos y sintácticamente correctos en el repositorio real** — no falta ninguna línea, no hay bytes nulos, y las etiquetas JSX cierran correctamente. Al reemplazar manualmente esas tres copias por el contenido verificado correcto y reintentar el build, el proceso avanzó cada vez más lejos en el árbol de módulos (de 8 a 13 módulos transformados) antes de tropezar con el siguiente archivo igualmente "roto" solo en la copia leída por el shell.

**Interpretación:** el problema no está en el código del proyecto. Es un artefacto del entorno de esta sesión de documentación: la vía de lectura de archivos usada por el shell sobre la carpeta sincronizada con OneDrive devolvió, para varios archivos, contenido truncado o corrupto sin reportar ningún error — silenciosamente. La vía de lectura alternativa (usada para inspeccionar manualmente cada archivo) sí devolvió el contenido real y correcto en los tres casos. Dado que el patrón se repitió en 3 archivos no relacionados entre sí (de tamaños y módulos distintos) y que en los 3 casos el archivo real resultó estar bien formado, no hay motivo para sospechar que el resto del árbol `src/` (52 archivos más) esté realmente roto — pero tampoco hay forma, desde este entorno, de confirmarlo de punta a punta de forma 100% confiable, porque la misma vía de lectura no confiable es la que alimentaría cualquier intento de build completo dentro de esta sesión.

### 2.3 Qué SÍ quedó confirmado de forma confiable

- El `postinstall` (`scripts/postinstall.cjs`, parchea `node_modules/@supabase/phoenix/priv/static/phoenix.mjs`) corre correctamente y sin errores en cada intento de `npm install`, tanto en el directorio original como en una copia limpia. Esto no depende de leer archivos de `src/`, así que no está afectado por el problema de §2.2.
- `npm install` completa sin errores (181 paquetes en la copia limpia).
- Los binarios nativos de Rollup (`@rollup/rollup-*`) cargan correctamente de forma aislada — no hay un problema real de plataforma/arquitectura.
- Los 3 archivos puntualmente verificados (`App.jsx`, `auth.jsx`, `DashboardGlobal.jsx`) están confirmados correctos en el repositorio real, no solo "probablemente correctos".

### 2.4 Qué quedó sin confirmar de punta a punta

Un `npm run build` completo, ejecutado de inicio a fin sin ningún error, **no se logró producir dentro de esta sesión** — no porque se haya encontrado o se sospeche un error real de código, sino porque el método de lectura de archivos disponible en esta sesión no es confiable para este repositorio en particular (motivo exacto desconocido — podría ser una sincronización incompleta de OneDrive al sandbox de esta sesión, no de la carpeta en la PC del usuario).

**Esto NO es evidencia de que el proyecto esté roto.** La afirmación previa de SETUP.md §5 ("el build completa sin errores", de la tarea #58) sigue siendo la mejor evidencia disponible de que el proyecto compila — simplemente no se pudo reconfirmar de forma independiente en esta sesión por la razón anterior, no porque se haya encontrado algo que la contradiga.

### 2.5 Recomendación concreta

Antes de cualquier decisión que dependa de "el build pasa" (por ejemplo, antes de un deploy crítico o de declarar cerrado este traspaso), correr directamente en una máquina normal (la del usuario o la de quien continúe el proyecto, fuera de cualquier sandbox intermediario):

```bash
npm install
npm run build
```

Si eso falla, el error es real y hay que tratarlo como tal. Si pasa (que es lo esperado dado lo confirmado en §2.3 y el antecedente de la tarea #58), se puede dar por cerrada la duda sin reservas.

## 3. Plan de smoke test manual sugerido (mientras no haya tests automatizados)

Checklist mínimo para validar manualmente después de cualquier cambio antes de deployar (complementa, no reemplaza, BACKLOG.md Prioridad 4):

1. Login con un usuario de cada rol relevante (`admin`, `editor`, `encargado`, `sede` si hay credenciales de prueba) y confirmar que el menú/vistas mostradas son las esperadas para ese rol.
2. Crear una novedad (bitácora) desde escritorio y desde mobile, confirmar que aparece en `PorSede` y, si corresponde, genera un escalamiento.
3. Abrir la vista Escalamientos y confirmar que lista los pendientes sin error de consola.
4. Abrir `SedeFicha.jsx` de una sede y verificar si el KPI de tickets críticos muestra datos (hoy es un punto conocido como roto — KNOWN_ISSUES.md §2.5 — sirve como caso de prueba de regresión una vez corregido).
5. Revisar la consola del navegador en cada paso anterior: cualquier error de Supabase (403/406/PGRST*) es indicio de un problema de esquema o de permisos, no solo de UI.
