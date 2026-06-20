-- PROPUESTA PENDIENTE DE APROBACIÓN EXPLÍCITA.
-- Proyecto destino exclusivo: mixyhfdlzjarvszinytk (cerdova-db).
-- Crea almacenamiento de dispositivos y bandeja personal. No modifica datos existentes.

create table if not exists bitacora.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  device_label text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_active_idx
  on bitacora.push_subscriptions (user_id, active);

create table if not exists bitacora.notificaciones (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references auth.users(id) on delete cascade,
  modulo text not null,
  entidad_tipo text not null,
  entidad_id text,
  titulo text not null,
  cuerpo text not null,
  prioridad text not null default 'alta',
  url text,
  dedupe_key text,
  leida_at timestamptz,
  atendida_at timestamptz,
  enviada_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists notificaciones_destinatario_dedupe_uidx
  on bitacora.notificaciones (destinatario_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists notificaciones_destinatario_fecha_idx
  on bitacora.notificaciones (destinatario_id, created_at desc);

alter table bitacora.push_subscriptions enable row level security;
alter table bitacora.notificaciones enable row level security;

drop policy if exists push_subscriptions_select_own on bitacora.push_subscriptions;
create policy push_subscriptions_select_own
  on bitacora.push_subscriptions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists push_subscriptions_insert_own on bitacora.push_subscriptions;
create policy push_subscriptions_insert_own
  on bitacora.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists push_subscriptions_update_own on bitacora.push_subscriptions;
create policy push_subscriptions_update_own
  on bitacora.push_subscriptions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists push_subscriptions_delete_own on bitacora.push_subscriptions;
create policy push_subscriptions_delete_own
  on bitacora.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists notificaciones_select_own on bitacora.notificaciones;
create policy notificaciones_select_own
  on bitacora.notificaciones for select to authenticated
  using (destinatario_id = auth.uid());

drop policy if exists notificaciones_update_own on bitacora.notificaciones;
create policy notificaciones_update_own
  on bitacora.notificaciones for update to authenticated
  using (destinatario_id = auth.uid())
  with check (destinatario_id = auth.uid());

-- No se crea política INSERT/DELETE para usuarios. Sólo la Edge Function con
-- service_role crea notificaciones; el usuario únicamente lee y marca las propias.
