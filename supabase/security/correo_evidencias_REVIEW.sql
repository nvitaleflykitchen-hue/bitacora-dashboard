-- APROBADO y aplicado en mixyhfdlzjarvszinytk el 2026-09-10.
-- Autorización explícita del usuario: «si autorizo». No volver a ejecutar.
-- Acceso inicial exclusivo de Nicolás Vitale. Sin cambios a políticas existentes.
begin;

create table bitacora.correo_buzones (
  id uuid primary key,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create table bitacora.correo_buzon_miembros (
  buzon_id uuid not null references bitacora.correo_buzones(id),
  user_id uuid not null references auth.users(id),
  puede_revisar boolean not null default false,
  primary key (buzon_id,user_id)
);
create table bitacora.correos (
  id uuid primary key,
  buzon_id uuid not null references bitacora.correo_buzones(id),
  carpeta text not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  message_id text not null default '',
  referencias jsonb not null default '[]',
  asunto text not null,
  remitente text not null,
  destinatarios jsonb not null default '[]',
  fecha_correo timestamptz,
  cuerpo text not null default '',
  original_path text not null,
  adjuntos jsonb not null default '[]',
  estado text not null default 'pendiente' check (estado in ('pendiente','vinculado','ignorado')),
  plan_id uuid references bitacora.capa_planes(id),
  sugerido_plan_id uuid references bitacora.capa_planes(id),
  tipo text not null default 'otro' check (tipo in ('solicitud','presupuesto','aprobacion','seguimiento','cierre','otro')),
  resumen text,
  motivo text,
  nueva_gestion text,
  ai_estado text not null default 'pendiente' check (ai_estado in ('pendiente','lista','error')),
  ai_modelo text,
  ai_error text,
  ai_intentos integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(buzon_id,sha256),
  check ((estado='vinculado') = (plan_id is not null)),
  check (original_path = buzon_id::text || '/' || id::text || '/original.eml')
);
create index correos_bandeja_idx on bitacora.correos(buzon_id,estado,created_at desc);
create index correos_plan_idx on bitacora.correos(plan_id,fecha_correo);
create index correos_hilo_idx on bitacora.correos(buzon_id,message_id);
create index correos_ai_idx on bitacora.correos(buzon_id,ai_estado,ai_intentos);

create table bitacora.correo_historial (
  id bigint generated always as identity primary key,
  correo_id uuid not null references bitacora.correos(id),
  actor_id uuid default auth.uid(),
  antes jsonb,
  despues jsonb not null,
  created_at timestamptz not null default now()
);
create index correo_historial_correo_idx on bitacora.correo_historial(correo_id,created_at);

alter table bitacora.correo_buzones enable row level security;
alter table bitacora.correo_buzon_miembros enable row level security;
alter table bitacora.correos enable row level security;
alter table bitacora.correo_historial enable row level security;

create policy correo_miembros_self on bitacora.correo_buzon_miembros for select to authenticated
using (user_id=(select auth.uid()));
create policy correo_buzones_member on bitacora.correo_buzones for select to authenticated
using (exists(select 1 from bitacora.correo_buzon_miembros m where m.buzon_id=id and m.user_id=(select auth.uid())));
create policy correos_member_read on bitacora.correos for select to authenticated
using (exists(select 1 from bitacora.correo_buzon_miembros m where m.buzon_id=correos.buzon_id and m.user_id=(select auth.uid())));
create policy correos_reviewer_update on bitacora.correos for update to authenticated
using (exists(select 1 from bitacora.correo_buzon_miembros m where m.buzon_id=correos.buzon_id and m.user_id=(select auth.uid()) and m.puede_revisar))
with check (
  exists(select 1 from bitacora.correo_buzon_miembros m where m.buzon_id=correos.buzon_id and m.user_id=(select auth.uid()) and m.puede_revisar)
  and (plan_id is null or exists(select 1 from bitacora.capa_planes p where p.id=plan_id and p.auditoria_codigo like 'FK-GEST-%'))
);
create policy correo_historial_read on bitacora.correo_historial for select to authenticated
using (exists(select 1 from bitacora.correos c where c.id=correo_id));

-- Trigger privilegiado sólo para el historial: no es una API invocable.
create or replace function bitacora_private.correo_audit_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    insert into bitacora.correo_historial(correo_id,actor_id,despues)
    values(new.id,auth.uid(),jsonb_build_object('estado',new.estado,'plan_id',new.plan_id));
  elsif old.estado is distinct from new.estado or old.plan_id is distinct from new.plan_id then
    insert into bitacora.correo_historial(correo_id,actor_id,antes,despues)
    values(new.id,auth.uid(),jsonb_build_object('estado',old.estado,'plan_id',old.plan_id),jsonb_build_object('estado',new.estado,'plan_id',new.plan_id));
  end if;
  return new;
end $$;
revoke all on function bitacora_private.correo_audit_change() from public,anon,authenticated;
create trigger correo_audit after insert or update on bitacora.correos
for each row execute function bitacora_private.correo_audit_change();

create or replace function bitacora_private.correo_touch()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  new.updated_at=clock_timestamp();
  return new;
end $$;
revoke all on function bitacora_private.correo_touch() from public,anon,authenticated;
create trigger correo_touch before update on bitacora.correos
for each row execute function bitacora_private.correo_touch();

-- Ningún cliente puede insertar correos, alterar originales ni otorgarse acceso.
revoke all on bitacora.correo_buzones,bitacora.correo_buzon_miembros,bitacora.correos,bitacora.correo_historial from public,anon,authenticated;
grant select on bitacora.correo_buzones,bitacora.correo_buzon_miembros,bitacora.correos,bitacora.correo_historial to authenticated;
grant update(estado,plan_id) on bitacora.correos to authenticated;
grant all on bitacora.correo_buzones,bitacora.correo_buzon_miembros,bitacora.correos,bitacora.correo_historial to service_role;
grant usage,select on sequence bitacora.correo_historial_id_seq to service_role;

insert into storage.buckets(id,name,public,file_size_limit)
values('correos-evidencias','correos-evidencias',false,52428800);
create policy correo_original_member_read on storage.objects for select to authenticated
using (
  bucket_id='correos-evidencias' and exists (
    select 1 from bitacora.correos c
    where (storage.foldername(name))[1]=c.buzon_id::text
      and (storage.foldername(name))[2]=c.id::text
      and (name=c.original_path or exists(select 1 from jsonb_array_elements(c.adjuntos) a where a->>'path'=name))
  )
);

insert into bitacora.correo_buzones(id,nombre)
values('a6bba28b-a681-4e24-b25f-c3bcaf9d33bf','Correo operativo de Nicolás');
insert into bitacora.correo_buzon_miembros(buzon_id,user_id,puede_revisar)
values('a6bba28b-a681-4e24-b25f-c3bcaf9d33bf','626b2a44-be84-4b3e-a03f-505eaf9d195e',true);
commit;
