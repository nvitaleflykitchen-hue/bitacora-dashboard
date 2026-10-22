-- PROPUESTA PENDIENTE DE APROBACIÓN. Solo proyecto mixyhfdlzjarvszinytk.
-- Estado OAuth independiente: no modifica tablas de negocio ni sus políticas.
begin;
create table bitacora.mcp_oauth_clients (
  id uuid primary key,
  encrypted_metadata text not null,
  created_at timestamptz not null default now()
);
create table bitacora.mcp_oauth_grants (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references bitacora.mcp_oauth_clients(id),
  request_hash text unique,
  request_expires_at timestamptz not null,
  redirect_uri text not null,
  challenge text not null,
  state text,
  resource text not null,
  owner_id uuid,
  sedes integer[] not null,
  code_hash text unique,
  code_expires_at timestamptz,
  access_hash text unique,
  access_expires_at timestamptz,
  refresh_hash text unique,
  refresh_expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index mcp_oauth_clients_created_at on bitacora.mcp_oauth_clients(created_at);
alter table bitacora.mcp_oauth_clients enable row level security;
alter table bitacora.mcp_oauth_grants enable row level security;
revoke all on bitacora.mcp_oauth_clients, bitacora.mcp_oauth_grants from public, anon, authenticated;
grant select, insert, update, delete on bitacora.mcp_oauth_clients, bitacora.mcp_oauth_grants to service_role;
commit;
