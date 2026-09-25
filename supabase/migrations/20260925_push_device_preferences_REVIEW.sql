-- REVISAR Y AUTORIZAR ANTES DE APLICAR.
-- Proyecto exclusivo: mixyhfdlzjarvszinytk (cerdova-db).
-- Preferencias de cada dispositivo. NULL en site_ids significa todas las sedes
-- autorizadas para ese usuario; nunca amplía sus permisos.
alter table bitacora.push_subscriptions
  add column if not exists event_types text[] not null default array[
    'mantenimiento', 'compras', 'tareas', 'escalamientos',
    'no_conformidades', 'comentario', 'anuncio'
  ]::text[],
  add column if not exists site_ids integer[] default null,
  add column if not exists sound_enabled boolean not null default true;
