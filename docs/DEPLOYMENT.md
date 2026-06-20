# DEPLOYMENT — bitacora-dashboard

> Verificado contra `vercel.json`, `DEPLOY.bat`, `.vercel/project.json`, `scripts/postinstall.cjs` y el listado en vivo de Edge Functions del proyecto Supabase `mixyhfdlzjarvszinytk`. Fecha de verificación: 2026-06-17.

## 1. Resumen del proceso

Hay **dos componentes de deploy completamente independientes y desacoplados entre sí**: el frontend (Vercel) y las Edge Functions (Supabase). No existe un pipeline único que despliegue ambos; cada uno se gestiona por separado, manualmente, sin CI/CD en ningún caso.

| Componente | Dónde vive el código | Cómo se despliega | Frecuencia/disparador |
|---|---|---|---|
| Frontend (SPA) | Este repo (`src/`) | Manual, `DEPLOY.bat` → `npx vercel --prod --yes` | Cuando el desarrollador decide correr el script |
| Edge Functions (3) | **No están en este repo** (confirmado: no existe carpeta `supabase/functions/` ni ningún archivo fuente de Edge Functions en el repositorio) | Deploy directo contra el proyecto Supabase (dashboard o herramientas de gestión del proyecto), fuera de este repositorio | Manual, sin relación con el ciclo de vida del repo de frontend |
| Base de datos (esquema/migraciones) | No versionado en este repo | Migraciones aplicadas directo sobre el proyecto Supabase | Manual |

Esto es un hallazgo relevante para quien tome el proyecto: **el código fuente real de las 3 Edge Functions activas no tiene respaldo en ningún repositorio local conocido**. Si se pierde el acceso al proyecto Supabase sin haber exportado antes el código de las funciones, se pierde la única copia. Recomendado como acción inmediata: exportar y versionar el código de `invite-user`, `admin-user-actions` y `bitacora-ingest` (ver API.md para su contenido ya documentado en este paquete de traspaso).

## 2. Deploy del frontend a Vercel

### 2.1 Configuración (`vercel.json`, raíz del repo)

```json
{
  "installCommand": "npm install --no-package-lock",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- `installCommand` usa `--no-package-lock` porque el flujo normal de `npm ci`/`npm install` estricto puede entrar en conflicto con el shim de `postinstall.cjs` si el lockfile no refleja exactamente el estado esperado de `node_modules` en el entorno de build de Vercel — no se pudo confirmar el motivo exacto documentado en ningún comentario del repo, es una inferencia razonable a partir del contexto (el shim para `@supabase/phoenix`), no un hecho confirmado en texto.
- `rewrites` implementa el comportamiento estándar de SPA: cualquier ruta se sirve como `index.html`, dejando el ruteo (inexistente, ver ARCHITECTURE.md §3) en manos del propio JS.

### 2.2 Vínculo con el proyecto Vercel

El repo tiene `.vercel/project.json` con `orgId` y `projectId` ya configurados — es decir, ya está enlazado (`vercel link`) a un proyecto Vercel específico. No hace falta volver a vincular salvo que se mueva a otra cuenta/equipo de Vercel.

### 2.3 Proceso manual de deploy

```bat
DEPLOY.bat
```

Contenido completo del script (3 líneas + pausa):

```bat
@echo off
cd /d "%~dp0"
echo Deployando bitacora-dashboard a Vercel...
npx vercel --prod --yes
pause
```

Pasos que ejecuta:
1. Se posiciona en la carpeta donde está el `.bat` (evita errores si se ejecuta desde otro directorio).
2. Corre `npx vercel --prod --yes`, que: instala dependencias según `vercel.json`, corre `npm run build`, y publica el contenido de `dist/` directo a producción — sin pasar por preview/staging, sin pedir confirmación adicional (`--yes`).

⚠️ No hay ambiente de *preview* ni *staging* en este flujo: cada deploy va directo a producción. No hay tampoco ningún gate de calidad (lint, test, build check en CI) antes de que el cambio quede público — el único control es que el build local de `vercel --prod` falle si hay un error de compilación.

### 2.4 Pre-requisitos para poder correr el deploy

- Tener `npx`/Node disponible (mismo requisito que SETUP.md).
- Estar autenticado en la cuenta de Vercel correspondiente (`npx vercel login` la primera vez, si la sesión de la CLI no está activa — no verificable desde este paquete si la sesión local del desarrollador anterior sigue vigente en su máquina).
- Tener las variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) configuradas **en el proyecto Vercel** (Project Settings → Environment Variables), no solo en `.env.local`. `.env.local` solo aplica a builds locales; Vercel necesita su propia copia configurada en el dashboard para que el build de producción las tenga disponibles. No fue posible verificar desde este paquete si esas variables ya están configuradas en Vercel — confirmar manualmente en el dashboard antes de asumir que un deploy nuevo va a funcionar.

## 3. Deploy de Edge Functions

Las 3 funciones activas (`invite-user` v2, `admin-user-actions` v4, `bitacora-ingest` v4) están desplegadas directamente en el proyecto Supabase. Su código fue recuperado para este paquete de documentación consultando el proyecto en vivo (no desde archivos del repo, porque no existen aquí). Implicancias prácticas:

1. **No hay forma de "redeployar" una función desde este repositorio** — no hay comando, no hay carpeta `supabase/functions/`, no hay Supabase CLI configurada (`supabase/config.toml` no existe).
2. Cualquier cambio a una de estas funciones requiere acceso directo al proyecto Supabase y se gestiona fuera del flujo de Git/Vercel de este repo.
3. Las 3 funciones tienen `verify_jwt: false` a nivel de configuración de gateway — esto se configura por función al desplegarla (vía dashboard o CLI de Supabase), no es algo que viva en código versionado.

Recomendación operativa: antes de hacer cualquier cambio en una Edge Function, copiar su código fuente actual (disponible íntegro en API.md de este paquete) a un archivo versionado, aunque sea fuera de este repo, para tener un punto de retorno.

## 4. Deploy de cambios de base de datos

No hay carpeta de migraciones versionada en el repo (`supabase/migrations/` no existe). Las 47 migraciones aplicadas al proyecto (ventana 2026-06-10 a 2026-06-17, ver DATABASE.md) viven únicamente en el historial interno de Supabase. Cualquier cambio de esquema futuro debería, como mínimo, exportarse y guardarse en este repo bajo control de versiones para no perder trazabilidad — actualmente la única fuente de verdad del historial de cambios de esquema es el propio proyecto Supabase.

## 5. Checklist de deploy seguro (recomendado, no es el proceso actual)

1. Confirmar que `npm run build` corre sin errores en local antes de deployar.
2. Confirmar que las variables de entorno en Vercel están actualizadas si cambiaron credenciales de Supabase.
3. Si el cambio afecta a una Edge Function: respaldar el código actual de la función antes de sobrescribirla.
4. Si el cambio afecta al esquema de la base: documentar la migración aplicada (este paquete de traspaso es el primer punto de partida para llevar ese registro — ver DECISIONS.md).
5. Después del deploy, verificar manualmente las vistas/flujos críticos (login, carga de novedades, vista de escalamientos) — no hay smoke tests automatizados.
