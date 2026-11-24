-- PENDIENTE DE AUTORIZACION. Solo mixyhfdlzjarvszinytk.
-- No modifica permisos ni politicas de tablas existentes.
begin;
create table bitacora.comedor_qr (
  sede_id integer primary key references bitacora.sedes(id),
  token uuid not null unique default gen_random_uuid(),
  activo boolean not null default false,
  coordinacion jsonb not null,
  gerencia jsonb not null,
  updated_at timestamptz not null default now()
);
create table bitacora.comedor_novedades (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  sede_id integer not null references bitacora.sedes(id),
  request_id uuid not null unique,
  nombre text not null check (length(nombre) between 1 and 100),
  empresa text not null default '' check (length(empresa)<=120),
  contacto text not null default '' check (length(contacto)<=160),
  items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 8),
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index comedor_novedades_sede_fecha on bitacora.comedor_novedades(sede_id,created_at desc);
create index comedor_novedades_limite on bitacora.comedor_novedades(ip_hash,created_at desc);
alter table bitacora.comedor_qr enable row level security;
alter table bitacora.comedor_novedades enable row level security;
revoke all on bitacora.comedor_qr,bitacora.comedor_novedades from public,anon,authenticated;
grant select,insert,update on bitacora.comedor_qr to service_role;
grant select,insert on bitacora.comedor_novedades to service_role;
grant usage,select on sequence bitacora.comedor_novedades_numero_seq to service_role;

-- Invoker: solo el servidor validado puede ejecutar. Sin SECURITY DEFINER.
create function bitacora.recibir_novedad_comedor(p_token uuid,p_request_id uuid,p_nombre text,p_empresa text,p_contacto text,p_items jsonb,p_ip_hash text)
returns bigint language plpgsql security invoker set search_path='' as $$
declare v_sede integer; v_numero bigint;
begin
  select q.sede_id into v_sede from bitacora.comedor_qr q join bitacora.sedes s on s.id=q.sede_id where q.token=p_token and q.activo and s.activa;
  if v_sede is null then raise exception 'QR no disponible'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash,0));
  select numero into v_numero from bitacora.comedor_novedades where request_id=p_request_id and sede_id=v_sede;
  if v_numero is not null then return v_numero; end if;
  if (select count(*) from bitacora.comedor_novedades where ip_hash=p_ip_hash and created_at>now()-interval '10 minutes')>=10 then raise exception 'Limite de envios'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) i where coalesce(i->>'tema','') not in ('a','b','c','d','e','f','g','h') or length(trim(coalesce(i->>'detalle',''))) not between 5 and 2000) then raise exception 'Detalle invalido'; end if;
  insert into bitacora.comedor_novedades(sede_id,request_id,nombre,empresa,contacto,items,ip_hash)
  values(v_sede,p_request_id,p_nombre,p_empresa,p_contacto,p_items,p_ip_hash) returning numero into v_numero;
  return v_numero;
end $$;
revoke all on function bitacora.recibir_novedad_comedor(uuid,uuid,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function bitacora.recibir_novedad_comedor(uuid,uuid,text,text,text,jsonb,text) to service_role;
commit;
