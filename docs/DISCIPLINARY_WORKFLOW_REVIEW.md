# Flujo disciplinario — propuesta para revisión

> Estado: aplicado en `mixyhfdlzjarvszinytk` el 2026-07-20 con confirmación explícita.

## Alcance

- `admin` y `encargado` pueden iniciar una solicitud de apercibimiento.
- El encargado ve únicamente las solicitudes que creó para personal de sus sedes.
- Los administradores ven y revisan todas las solicitudes.
- Solo un administrador puede aprobar, rechazar y confirmar la notificación.
- El antecedente se inserta en `equipo.historial_personal` únicamente cuando un
  administrador confirma que el trabajador fue notificado.
- Una medida preventiva urgente se documenta junto con la solicitud, pero no se trata
  como sanción ni se incorpora por sí sola al historial.

## Estados

```text
pendiente_aprobacion → aprobado → notificado
                    ↘ rechazado
                    ↘ cancelado
```

## Datos registrados

- persona y fecha del hecho;
- descripción objetiva;
- descargo del trabajador;
- testigos/evidencia;
- fundamento legal y texto propuesto;
- urgencia y medida preventiva adoptada;
- autor, administrador revisor, fecha y observaciones;
- vínculo al antecedente formal después de la notificación.

## Seguridad

La migración crea `equipo.solicitudes_disciplinarias` con RLS activo desde el inicio y
sin permisos para `anon`. También reemplaza la política de escritura general de
`equipo.historial_personal`: las sanciones (`apercibimiento`, `suspension` y
`llamado_atencion`) quedan reservadas a administradores; los otros roles conservan sus
operaciones no disciplinarias dentro del alcance por sede ya existente.

SQL aplicado:
[`supabase/migrations/20260720235102_disciplinary_approval_workflow_REVIEW.sql`](../supabase/migrations/20260720235102_disciplinary_approval_workflow_REVIEW.sql)
