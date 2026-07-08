-- Rescate de perfil para invitación enviada/no visible.
-- Ejecutar en Supabase SQL Editor del proyecto correcto: mixyhfdlzjarvszinytk (cerdova-db).
-- No crea un usuario Auth nuevo. Solo vincula el perfil si el usuario ya existe en auth.users.

-- 1) Diagnóstico: Auth user y perfil operativo.
select
  'auth.users' as origen,
  u.id,
  u.email,
  u.created_at,
  u.invited_at,
  u.email_confirmed_at,
  u.last_sign_in_at
from auth.users u
where lower(u.email) = lower('tecnica@flykitchen.com.ar');

select
  'bitacora.perfiles' as origen,
  p.id,
  p.nombre,
  p.email,
  p.telefono,
  p.rol,
  p.activo,
  p.created_at,
  p.updated_at
from bitacora.perfiles p
where lower(p.email) = lower('tecnica@flykitchen.com.ar');

-- 2) Si el primer SELECT devuelve un usuario y el segundo no, ejecutar esto:
insert into bitacora.perfiles (
  id,
  nombre,
  email,
  telefono,
  rol,
  activo,
  sede_ids,
  grupo_id,
  created_at,
  updated_at
)
select
  u.id,
  'Técnica Flykitchen',
  lower(u.email),
  '+54 9 3514 02-5335',
  'editor',
  true,
  '{}'::integer[],
  null,
  now(),
  now()
from auth.users u
where lower(u.email) = lower('tecnica@flykitchen.com.ar')
on conflict (id) do update set
  nombre = excluded.nombre,
  email = excluded.email,
  telefono = excluded.telefono,
  rol = excluded.rol,
  activo = true,
  updated_at = now()
returning id, nombre, email, telefono, rol, activo;
