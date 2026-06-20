# SETUP — bitacora-dashboard

> Verificado contra el repositorio real (`package.json`, `vite.config.js`, `vercel.json`, `scripts/postinstall.cjs`, `.env.local`, `src/lib/supabase.js`) ejecutando los comandos descritos. Fecha de verificación: 2026-06-17.

## 1. Requisitos previos

| Requisito | Detalle |
|---|---|
| Node.js | No hay `engines` en `package.json` ni `.nvmrc`/`.node-version` en el repo, por lo tanto **no hay una versión mínima declarada explícitamente**. Vite 5.3.1 requiere Node ≥ 18. Verificado en este entorno con Node v22.22.3 sin problemas — usar Node 18 LTS o 20 LTS si se quiere reproducir un entorno más cercano al estándar de Vite 5. |
| npm | Cualquier versión reciente compatible con `package-lock.json` v2/v3. No se usa `yarn` ni `pnpm` (solo hay `package-lock.json`). |
| Cuenta Supabase | Acceso al proyecto `mixyhfdlzjarvszinytk` (o uno propio si se monta un entorno separado — ver advertencia en §4). |
| Editor | Sin requisitos especiales. No hay configuración de ESLint/Prettier en el repo (confirmado: no existen `.eslintrc*` ni `.prettierrc*` en la raíz). |

## 2. Clonar y instalar

⚠️ **Advertencia de estructura de repo**: dentro de la raíz del proyecto existe una carpeta `bitacora-dashboard/bitacora-dashboard/` que es una **copia duplicada completa** del proyecto (con su propio `node_modules`, `dist`, `.env.local`, etc.), generada en algún momento por error. Trabajar siempre desde la raíz (`bitacora-dashboard/`), nunca desde la subcarpeta duplicada. Esta duplicación está pendiente de limpieza — ver REPOSITORY_AUDIT.md.

```bash
cd bitacora-dashboard   # la raíz, NO bitacora-dashboard/bitacora-dashboard
npm install --no-package-lock
```

El flag `--no-package-lock` es el mismo que usa `vercel.json` en producción (`installCommand: "npm install --no-package-lock"`). Se puede usar `npm install` simple en local, pero usar el mismo comando que producción reduce el riesgo de diferencias de árbol de dependencias entre entornos.

### 2.1 Qué hace el `postinstall`

`package.json` define `"postinstall": "node scripts/postinstall.cjs"`. Este script (`scripts/postinstall.cjs`, 19 líneas, verificado) parchea manualmente un archivo faltante:

```
node_modules/@supabase/phoenix/priv/static/phoenix.mjs
```

El paquete `@supabase/phoenix` no incluye ese archivo en algunas versiones publicadas, y sin él el build de Vite falla al resolver el import. El script lo crea con un re-export hacia `phoenix.cjs.js` si no existe. Corre automáticamente después de cada `npm install`; no requiere acción manual. Si en algún momento se actualiza `@supabase/supabase-js` y el problema deja de reproducirse, este script y su llamada en `postinstall` pueden eliminarse — pero confirmar primero que el build sigue funcionando sin él.

## 3. Variables de entorno

El frontend usa **3 variables de entorno** con prefijo `VITE_` (requerido por Vite para exponerlas al bundle del cliente).

| Variable | Usada en | Propósito |
|---|---|---|
| `VITE_SUPABASE_URL` | `src/lib/supabase.js`, `src/views/Usuarios.jsx` (para construir URLs de Edge Functions) | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.js` | Clave pública (anon) del cliente Supabase |
| `VITE_VAPID_PUBLIC_KEY` | `src/lib/pushNotifications.js` | Clave pública Web Push; no es secreta |

Crear un archivo `.env.local` en la raíz del proyecto (no se versiona — está en `.gitignore`) con:

```
VITE_SUPABASE_URL=https://mixyhfdlzjarvszinytk.supabase.co
VITE_SUPABASE_ANON_KEY=<clave anon del proyecto, obtenerla del dashboard de Supabase>
VITE_VAPID_PUBLIC_KEY=<clave pública generada para Web Push>
```

Ver `.env.example` (creado en este mismo paquete de documentación, tarea #71) para la plantilla sin valores reales.

⚠️ Ambas variables terminan **embebidas en el bundle JS que se sirve al navegador** (comportamiento estándar de Vite con prefijo `VITE_`). Esto es aceptable para `VITE_SUPABASE_ANON_KEY` porque está diseñada para ser pública (el control de acceso real depende de RLS, no del secreto de esta clave) — pero ver KNOWN_ISSUES.md para los riesgos derivados de que las políticas RLS subyacentes sean en su mayoría permisivas. Nunca poner aquí la `service_role key`: esa clave solo debe vivir en el entorno de las Edge Functions (gestionado desde el dashboard de Supabase, no desde este repo).

## 4. Levantar el proyecto en local

```bash
npm run dev
```

Levanta el servidor de desarrollo de Vite (puerto por defecto 5173, no fijado explícitamente en `vite.config.js` — Vite usa su default). Hot reload activo.

⚠️ **Importante**: como no hay un Supabase local (no existe carpeta `supabase/` ni `config.toml` en el repo — confirmado, no se usa Supabase CLI/self-hosted), correr `npm run dev` apunta **directo al proyecto Supabase de producción** (`mixyhfdlzjarvszinytk`) si se usan las credenciales reales en `.env.local`. No hay entorno de staging separado documentado en el repo. Cualquier cambio que se pruebe en local contra esas credenciales (altas, bajas, modificaciones) impacta datos reales de Fly Kitchen. Si se necesita un entorno de prueba aislado, crear un proyecto Supabase separado y replicar el esquema manualmente (no hay script de migración exportado fuera de las 47 migraciones ya aplicadas al proyecto — ver DATABASE.md).

## 5. Activar notificaciones Push

1. Generar un par VAPID sin copiarlo al chat ni versionarlo: `node scripts/generate-vapid.mjs`.
2. Configurar `VITE_VAPID_PUBLIC_KEY` en `.env.local` y en Vercel.
3. Configurar en secretos de la Edge Function: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`. La privada nunca lleva prefijo `VITE_`.
4. Revisar y aprobar `supabase/migrations/20260619_push_notifications.sql`; contiene el SQL completo de tablas y RLS.
5. Desplegar `supabase/functions/send-priority-notification/index.ts` con JWT obligatorio.
6. Desplegar el frontend. Cada usuario activa Push desde el icono de campana del escritorio o desde Perfil en el celular.

## 6. Build de producción

```bash
npm run build
```

Genera `dist/` (configurado en `vite.config.js` con `emptyOutDir: false` — **no borra el contenido previo de `dist/` antes de reconstruir**, lo cual puede dejar archivos obsoletos de builds anteriores si cambiaron nombres de chunk; no es el comportamiento default de Vite). Confirmado en build real ejecutado en la sesión de auditoría previa (tarea #58): el build completa sin errores. **Ver TEST_REPORT.md §2 antes de confiar ciegamente en esto**: en esta sesión de documentación (2026-06-17) se detectó que el entorno de verificación usado puede leer versiones truncadas/corruptas de archivos fuente reales sin reportar error — no se trata de un defecto del código (verificado archivo por archivo), pero sí significa que cualquier intento de build dentro de ese entorno no es 100% confiable como evidencia. Recomendación: re-confirmar con `npm install && npm run build` en una máquina sin esa limitación antes de un deploy crítico.

Previsualizar el build de producción localmente:

```bash
npm run preview
```

## 7. Limpieza de archivos residuales (no bloquea el setup, pero ensucia el repo)

Verificado en la raíz del proyecto:

- ~52 archivos `vite.config.js.timestamp-*.mjs` (residuos de ejecuciones previas de Vite que no se limpiaron solos).
- 3 carpetas de build redundantes: `dist/`, `dist2/`, `dist_v2/`.
- Un archivo `BITACORA.MD.docx` de 221 KB en la raíz (notas de una sesión de trabajo previa, no es parte del código).

No afectan el funcionamiento de `npm install`/`dev`/`build`, pero conviene limpiarlos antes de inicializar un repositorio git (ver REPOSITORY_AUDIT.md y PROJECT_STATUS.md §8).

## 8. Deploy

No cubierto en detalle aquí — ver DEPLOYMENT.md para el proceso completo (`DEPLOY.bat` → `npx vercel --prod --yes`, sin CI/CD).
