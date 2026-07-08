# Reclutamiento / selección de personal

Estado: implementación frontend lista; esquema Supabase pendiente de aprobación/aplicación.

## Flujo cubierto

1. Crear solicitud de personal desde Equipo → Selección.
2. Generar texto para enviar al grupo de WhatsApp `Búsquedas🔎 (Reclutamiento y selección)`.
3. Cargar candidatos y adjuntar CVs.
4. Registrar ficha de entrevista.
5. Cargar evaluación breve: `apto`, `no apto` o `reserva`.
6. Marcar si requiere psicológico/dirección.
7. Registrar preocupacional.
8. Coordinar fecha de ingreso e inducción.
9. Imprimir ficha de entrevista y ficha de alta con el formato visual de los PDFs entregados.

## Archivos principales

- `src/views/equipo/ReclutamientoBoard.jsx`: tablero y formularios.
- `src/lib/reclutamientoPdf.js`: generación de PDF con plantilla visual.
- `public/templates/reclutamiento/ficha_entrevista.png`: fondo derivado del PDF de entrevista.
- `public/templates/reclutamiento/ficha_alta.png`: fondo derivado del PDF de alta.
- `supabase/migrations/20260629_reclutamiento_rrhh_REVIEW.sql`: tablas y políticas propuestas.

## Base de datos pendiente

No se aplicó SQL contra Supabase porque no hay staging y el repo exige confirmación explícita antes de cambios de `GRANT`/`RLS`.

Para activar el tablero real hay que revisar y aplicar:

```text
supabase/migrations/20260629_reclutamiento_rrhh_REVIEW.sql
```

Mientras ese SQL no esté aplicado, la pestaña `Selección` muestra un aviso de esquema faltante.
