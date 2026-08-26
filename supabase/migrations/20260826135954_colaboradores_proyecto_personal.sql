alter table bitacora.capa_plan_miembros
  alter column perfil_id drop not null,
  add column if not exists persona_id uuid references equipo.personas(id) on delete cascade;

alter table bitacora.capa_plan_miembros
  drop constraint if exists capa_plan_miembro_identidad_check;

alter table bitacora.capa_plan_miembros
  add constraint capa_plan_miembro_identidad_check
  check (num_nonnulls(perfil_id, persona_id) = 1);

create unique index if not exists capa_plan_miembros_plan_persona_key
  on bitacora.capa_plan_miembros(plan_id, persona_id)
  where persona_id is not null;

create or replace function bitacora_private.notify_capa_plan_member()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_plan bitacora.capa_planes%rowtype;
begin
  if new.perfil_id is null then
    return new;
  end if;
  select * into v_plan from bitacora.capa_planes where id=new.plan_id;
  insert into bitacora.notificaciones(destinatario_id,modulo,entidad_tipo,entidad_id,titulo,cuerpo,prioridad,url,dedupe_key)
  values(new.perfil_id,'capa','capa_plan',v_plan.auditoria_codigo,'Te agregaron como colaborador',coalesce(v_plan.titulo,v_plan.objetivo,v_plan.auditoria_codigo),'media','/?view=proyectosGestion',concat('capa:miembro:',new.plan_id,':',new.perfil_id))
  on conflict(destinatario_id,dedupe_key) where dedupe_key is not null do nothing;
  return new;
end; $$;
