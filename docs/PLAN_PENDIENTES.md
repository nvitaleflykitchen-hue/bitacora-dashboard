# Plan de pendientes — bitacora-dashboard

> Actualizado: 2026-07-08 (noche). Lo urgente del día quedó resuelto; esto es
> lo que espera turno, en orden sugerido. Nada de acá bloquea la operación.

## En espera de acción del usuario (no de código)

1. **Secretos VAPID** — cargar los 3 secretos en Supabase Edge Functions y
   `VITE_VAPID_PUBLIC_KEY` en Vercel (valores en `.env.vapid.local`), luego
   probar "Activar notificaciones" en un celular. Sin esto no hay push.
2. **Triage de escalamientos** — 106 pendientes (algunos de +8 días) y 40 "en
   gestión" viejos. Sesión única de limpieza: resolver, cancelar con motivo o
   convertir en tarea. Pedirle a Claude el listado priorizado cuando se agende.
3. **Revocar el token de GitHub** cuando no se necesiten más pushes de Claude
   (vence solo a los 30 días).

## Próxima tanda de trabajo (cuando el día a día lo permita)

4. **Staging** (medio día): proyecto Supabase gratuito con el esquema desde
   `supabase/migrations/` + datos mínimos; `npm run dev` apunta ahí. Es el
   prerrequisito para el resto de esta lista.
5. **Mantenimiento RLS fase 2**: scoping por sede en las 18 tablas (hoy
   cualquier autenticado lee/edita todo mantenimiento; solo DELETE está
   restringido). Requiere staging para probar sin riesgo.
6. **Contraseña temporal `123456`** del alta de usuarios → contraseña
   aleatoria por usuario (tocar edge function `create-user-direct` y el modal).
7. **Router real (react-router)** por fases — plan detallado en
   `PLAN_ARQUITECTURA.md` §2.
8. **Hooks compartidos desktop/mobile** — oportunista, al tocar cada módulo
   (`PLAN_ARQUITECTURA.md` §3).

## Monitoreo (sin fecha, revisar en el digest diario)

- **Cumplimiento de bitácora**: era 61% con 4 sedes fantasma; con las pausas
  el número real va a emerger esta semana. Meta razonable: >85% en 30 días.
- **Compras**: recién destrabado; medir tiempos por etapa a fin de julio.
- **Feedback de usuarios** sobre los cambios del 08/07 (RBAC + UX + mobile):
  juntar reclamos una semana y corregir en tanda.
