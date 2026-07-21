-- Supervisión, colaboradores y eliminación controlada de proyectos.
-- GRANT/RLS aprobados explícitamente por el usuario el 2026-07-20.
begin;

alter table bitacora.capa_planes
  add column if not exists titulo text,
  add column if not exists supervisor_id uuid references bitacora.perfiles(id) on delete set null;

update bitacora.capa_planes set titulo=objetivo where titulo is null;
create index if not exists capa_planes_supervisor_idx on bitacora.capa_planes(supervisor_id);

create table if not exists bitacora.capa_plan_miembros (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references bitacora.capa_planes(id) on delete cascade,
  perfil_id uuid not null references bitacora.perfiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(plan_id,perfil_id)
);
alter table bitacora.capa_plan_miembros enable row level security;

drop policy if exists capa_plan_miembros_select on bitacora.capa_plan_miembros;
create policy capa_plan_miembros_select on bitacora.capa_plan_miembros for select to authenticated
using (perfil_id=(select auth.uid()) or exists(select 1 from bitacora.perfiles p where p.id=(select auth.uid()) and p.activo=true and p.rol in ('admin','editor','consultor')));
drop policy if exists capa_plan_miembros_insert on bitacora.capa_plan_miembros;
create policy capa_plan_miembros_insert on bitacora.capa_plan_miembros for insert to authenticated
with check (exists(select 1 from bitacora.perfiles p where p.id=(select auth.uid()) and p.activo=true and p.rol in ('admin','editor')));
drop policy if exists capa_plan_miembros_delete on bitacora.capa_plan_miembros;
create policy capa_plan_miembros_delete on bitacora.capa_plan_miembros for delete to authenticated
using (exists(select 1 from bitacora.perfiles p where p.id=(select auth.uid()) and p.activo=true and p.rol in ('admin','editor')));
grant select,insert,delete on bitacora.capa_plan_miembros to authenticated;

drop policy if exists capa_planes_delete on bitacora.capa_planes;
create policy capa_planes_delete on bitacora.capa_planes for delete to authenticated
using (exists(select 1 from bitacora.perfiles p where p.id=(select auth.uid()) and p.activo=true and p.rol in ('admin','editor')));
grant delete on bitacora.capa_planes to authenticated;

create or replace function bitacora_private.notify_capa_plan_people()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.supervisor_id is not null and (tg_op='INSERT' or new.supervisor_id is distinct from old.supervisor_id) then
    insert into bitacora.notificaciones(destinatario_id,modulo,entidad_tipo,entidad_id,titulo,cuerpo,prioridad,url,dedupe_key)
    values(new.supervisor_id,'capa','capa_plan',new.auditoria_codigo,'Supervisión de proyecto asignada',coalesce(new.titulo,new.objetivo,new.auditoria_codigo),'media','/?view=proyectosGestion',concat('capa:supervisor:',new.id,':',new.supervisor_id))
    on conflict(destinatario_id,dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end; $$;
revoke all on function bitacora_private.notify_capa_plan_people() from public,anon,authenticated;
drop trigger if exists notify_capa_plan_people on bitacora.capa_planes;
create trigger notify_capa_plan_people after insert or update of supervisor_id on bitacora.capa_planes
for each row execute function bitacora_private.notify_capa_plan_people();

create or replace function bitacora_private.notify_capa_plan_member()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_plan bitacora.capa_planes%rowtype;
begin
  select * into v_plan from bitacora.capa_planes where id=new.plan_id;
  insert into bitacora.notificaciones(destinatario_id,modulo,entidad_tipo,entidad_id,titulo,cuerpo,prioridad,url,dedupe_key)
  values(new.perfil_id,'capa','capa_plan',v_plan.auditoria_codigo,'Te agregaron como colaborador',coalesce(v_plan.titulo,v_plan.objetivo,v_plan.auditoria_codigo),'media','/?view=proyectosGestion',concat('capa:miembro:',new.plan_id,':',new.perfil_id))
  on conflict(destinatario_id,dedupe_key) where dedupe_key is not null do nothing;
  return new;
end; $$;
revoke all on function bitacora_private.notify_capa_plan_member() from public,anon,authenticated;
drop trigger if exists notify_capa_plan_member on bitacora.capa_plan_miembros;
create trigger notify_capa_plan_member after insert on bitacora.capa_plan_miembros
for each row execute function bitacora_private.notify_capa_plan_member();

update bitacora.capa_planes
set supervisor_id='1678439f-be97-43cb-959f-a6e4988c311c', updated_at=now()
where auditoria_codigo='FK-GEST-RELOCALIZACION-OPERATIVA-2026-07-20-B28042';

commit;
