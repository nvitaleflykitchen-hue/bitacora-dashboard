-- Ampliación no destructiva del proceso de compras.
-- Proyecto destino exclusivo: mixyhfdlzjarvszinytk (cerdova-db).
-- No modifica datos existentes, RLS, GRANTs ni políticas.

alter table bitacora.requerimientos
  add column if not exists aprobado_at timestamptz,
  add column if not exists compra_iniciada_at timestamptz,
  add column if not exists recibido_at timestamptz,
  add column if not exists cumplido_at timestamptz,
  add column if not exists observado_at timestamptz,
  add column if not exists rechazado_at timestamptz,
  add column if not exists cancelado_at timestamptz,
  add column if not exists fecha_compromiso date,
  add column if not exists observacion_aprobacion text,
  add column if not exists sla_dias integer,
  add column if not exists historial_estados jsonb not null default '[]'::jsonb;

-- La tabla tenía un CHECK con el flujo anterior. Se reemplaza por el dominio
-- aprobado; si existiera algún valor desconocido, PostgreSQL aborta el cambio.
alter table bitacora.requerimientos
  drop constraint if exists requerimientos_estado_check;

alter table bitacora.requerimientos
  add constraint requerimientos_estado_check check (
    estado in (
      'Pendiente', 'Observado', 'Aprobado', 'Enviado', 'En compra',
      'Recibido', 'Cumplido', 'Rechazado', 'Cancelado'
    )
  );

comment on column bitacora.requerimientos.cumplido_at is
  'Fecha de entrega y validación final por la sede. Cierra el reloj iniciado en enviado_at.';

comment on column bitacora.requerimientos.sla_dias is
  'SLA congelado al enviar a Compras: alta 3, media 7, baja 15 días hábiles.';

comment on column bitacora.requerimientos.historial_estados is
  'Eventos append-only administrados por la aplicación: estado anterior/nuevo, comentario, actor y fecha.';
