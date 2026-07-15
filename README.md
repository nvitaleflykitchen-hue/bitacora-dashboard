# Fly Gestión — Fly Kitchen

App interna de gestión operativa de sedes (comedores, hospitales, aeropuertos):
bitácora diaria, escalamientos, no conformidades, CAPA, tareas, mantenimiento
de activos, flota, compras y RRHH.

**Producción:** [flykitchen.com.ar](https://flykitchen.com.ar) · deploy automático desde `main` vía Vercel.

## Stack

React 18 + Vite · Tailwind · Supabase (Postgres + Auth + Edge Functions) · jsPDF

## Desarrollo

```bash
npm install
npm run dev      # ⚠ apunta a la base de PRODUCCIÓN (no hay staging aún)
npm run check    # lint + tests + build (obligatorio antes de push)
```

## Documentación

Todo el detalle vive en [`docs/`](docs/): arquitectura, esquema de base,
reglas de negocio, issues conocidos y backlog priorizado. Para agentes de IA:
leer [`AGENTS.md`](AGENTS.md) **antes** de tocar nada.
