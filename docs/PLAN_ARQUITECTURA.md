# Plan de arquitectura — bitacora-dashboard

> Fecha: 2026-07-08. Propuesta priorizada para las tres deudas estructurales
> identificadas en la auditoría. Ninguna bloquea la operación diaria; se
> recomienda encararlas en este orden y de a una.

## 1. Entorno de staging (primero — habilita todo lo demás)

**Problema:** `npm run dev` apunta a la base de producción real. Cada prueba
manual deja rastro en los datos del negocio, y cambios de RLS/esquema no se
pueden ensayar.

**Propuesta:**
1. Crear un segundo proyecto Supabase gratuito (`bitacora-staging`).
2. Aplicar el esquema desde `supabase/migrations/` (ya versionadas) +
   `supabase db dump --schema-only` para lo previo a las migraciones versionadas.
3. Sembrar datos mínimos: 3 sedes, 1 usuario por rol, ~20 registros.
4. `.env.staging` con la URL/key del proyecto nuevo; script `dev:staging` en
   package.json. `npm run dev` queda apuntando a staging por defecto y
   producción pasa a requerir un flag explícito.

**Esfuerzo:** medio día. **Riesgo:** nulo (no toca producción).

## 2. Router real (react-router-dom)

**Problema:** navegación 100% por estado local (`activeView` en App.jsx, ~33
vistas). Sin URLs compartibles, sin botón atrás, sin deep-links (el QR de
activos ya necesitó un hack con query params).

**Propuesta incremental (sin big bang):**
1. Instalar `react-router-dom`, envolver la app en `<BrowserRouter>`.
2. Fase A: mapear `activeView` ⇄ ruta con un hook puente (`useViewRoute`) —
   la navegación existente sigue funcionando, pero cada vista gana URL.
3. Fase B: migrar el `switch` gigante de App.jsx a `<Routes>` por módulo
   (bitácora, mantenimiento, flota, equipo, calidad).
4. Fase C: gating por rol como componente `<RequireRole>` en las rutas,
   reemplazando los checks dispersos.
5. Vercel ya sirve SPA con rewrite a index.html (verificar vercel.json).

**Esfuerzo:** fase A ~1 día; B+C ~2-3 días. **Riesgo:** bajo si se hace por fases.

## 3. Lógica compartida desktop/mobile

**Problema:** `src/mobile/` es un árbol paralelo completo. Cada regla de
negocio se implementa dos veces; ya hubo bugs de "arreglado en desktop,
roto en mobile" (fechas de Equipo, §3.14).

**Propuesta:** no unificar UI (la separación visual es una decisión válida),
sino extraer la LÓGICA a hooks compartidos en `src/hooks/`:
- `useTickets(sedeIds)`, `usePersonas(sedeIds)`, `useRequerimientos()`, etc.
  — cada uno encapsula query + filtrado por rol/sede + mutaciones.
- Regla de oro: un componente (desktop o mobile) no llama a `queries.js`
  directo; consume el hook. El hook es el único lugar donde vive la regla.
- Migrar módulo por módulo cuando se toque por otra razón (oportunista),
  empezando por los que ya tuvieron bugs espejo: Equipo y Tickets.

**Esfuerzo:** continuo/oportunista. **Riesgo:** bajo.

## 4. Pendientes que quedaron de la sesión 2026-07-08

- Crear remote de GitHub y pushear (el workflow CI ya existe en
  `.github/workflows/ci.yml` pero no corre sin remote). También da backup
  fuera de OneDrive — importante visto que OneDrive sirvió archivos truncados.
- Mantenimiento fase 2: scoping por sede en RLS (requiere staging → punto 1).
- Contraseña temporal universal `123456` del alta de usuarios: reemplazar por
  contraseña aleatoria por usuario (AUDITORIA_2026-07).
