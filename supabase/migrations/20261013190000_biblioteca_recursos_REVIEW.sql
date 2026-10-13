-- REVIEW: aplicar exclusivamente en mixyhfdlzjarvszinytk, previa autorización.
begin;
create function bitacora.recurso_admin() returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from bitacora.perfiles p where p.id=auth.uid() and p.activo and p.rol='admin');
$$;
create function bitacora.recurso_visible(g integer) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from bitacora.perfiles p where p.id=auth.uid() and p.activo and
 (p.rol='admin' or (p.rol in ('editor','consultor','grupo','encargado','sede','operario','flota','deposito','mnt_editor') and
 (g is null or p.rol in ('editor','consultor') or (p.rol='grupo' and p.grupo_id=g) or exists(select 1 from bitacora.sedes s where s.grupo_id=g and s.id=any(p.sede_ids))))));
$$;
revoke all on function bitacora.recurso_admin(),bitacora.recurso_visible(integer) from public,anon;
grant execute on function bitacora.recurso_admin(),bitacora.recurso_visible(integer) to authenticated;
create table bitacora.biblioteca_recursos (
 id uuid primary key default gen_random_uuid(),
 titulo text not null check(length(trim(titulo)) between 1 and 200),
 descripcion text not null default '' check(length(descripcion)<=2000),
 categoria text not null default 'General' check(length(categoria) between 1 and 100),
 grupo_id integer references bitacora.grupos(id),
 url text check(url ~ '^https://[^[:space:]]+$' and length(url)<=2000),
 archivo_path text unique,
 archivo_nombre text,
 activo boolean not null default true,
 created_at timestamptz not null default now(),
 created_by uuid not null default auth.uid() references auth.users(id),
 check((url is not null)::integer+(archivo_path is not null)::integer=1),
 check(archivo_path is null or archivo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|docx|xlsx|png|jpg|jpeg)$')
);
alter table bitacora.biblioteca_recursos enable row level security;
revoke all on bitacora.biblioteca_recursos from anon,authenticated;
grant select,insert,update on bitacora.biblioteca_recursos to authenticated;
create policy recurso_read on bitacora.biblioteca_recursos for select to authenticated using (bitacora.recurso_admin() or (activo and bitacora.recurso_visible(grupo_id)));
create policy recurso_create on bitacora.biblioteca_recursos for insert to authenticated with check(bitacora.recurso_admin() and created_by=auth.uid() and (archivo_path is null or split_part(archivo_path,'/',1)=auth.uid()::text));
create policy recurso_edit on bitacora.biblioteca_recursos for update to authenticated using(bitacora.recurso_admin()) with check(bitacora.recurso_admin());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('biblioteca-recursos','biblioteca-recursos',false,20971520,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/png','image/jpeg']);
-- Restricciones limitadas al nuevo bucket: no afectan los demás adjuntos.
create policy recurso_file_read on storage.objects for select to authenticated using(bucket_id='biblioteca-recursos' and (bitacora.recurso_admin() or exists(select 1 from bitacora.biblioteca_recursos r where r.archivo_path=name and r.activo)));
create policy recurso_file_read_guard on storage.objects as restrictive for select to public using(bucket_id<>'biblioteca-recursos' or (auth.uid() is not null and (bitacora.recurso_admin() or exists(select 1 from bitacora.biblioteca_recursos r where r.archivo_path=name and r.activo))));
create policy recurso_file_add on storage.objects for insert to authenticated with check(bucket_id='biblioteca-recursos' and bitacora.recurso_admin() and split_part(name,'/',1)=auth.uid()::text);
create policy recurso_file_add_guard on storage.objects as restrictive for insert to public with check(bucket_id<>'biblioteca-recursos' or (auth.uid() is not null and bitacora.recurso_admin() and split_part(name,'/',1)=auth.uid()::text));
create policy recurso_file_no_replace on storage.objects as restrictive for update to public using(bucket_id<>'biblioteca-recursos') with check(bucket_id<>'biblioteca-recursos');
create policy recurso_file_cleanup on storage.objects for delete to authenticated using(bucket_id='biblioteca-recursos' and bitacora.recurso_admin() and not exists(select 1 from bitacora.biblioteca_recursos r where r.archivo_path=name));
create policy recurso_file_delete_guard on storage.objects as restrictive for delete to public using(bucket_id<>'biblioteca-recursos' or (auth.uid() is not null and bitacora.recurso_admin() and not exists(select 1 from bitacora.biblioteca_recursos r where r.archivo_path=name)));
notify pgrst,'reload schema';
commit;
