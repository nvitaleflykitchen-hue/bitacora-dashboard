-- AUTORIZADO («TE AUTORIZO») y aplicado 2026-09-16. No volver a ejecutar.
-- Proyecto destino exclusivo: mixyhfdlzjarvszinytk (cerdova-db).
-- Permite asociar un correo a una persona activa del módulo Equipo.
begin;

alter table bitacora.correos
  add column if not exists persona_id uuid references equipo.personas(id);

alter table bitacora.correos drop constraint if exists correos_destino_check;
alter table bitacora.correos add constraint correos_destino_check check (
  (estado='vinculado' and num_nonnulls(plan_id,tarea_id,compra_id,ticket_id,persona_id)=1)
  or (estado<>'vinculado' and num_nonnulls(plan_id,tarea_id,compra_id,ticket_id,persona_id)=0)
);

create index if not exists correos_persona_idx
  on bitacora.correos(persona_id) where persona_id is not null;

alter policy correos_reviewer_update on bitacora.correos with check (
  exists(select 1 from bitacora.correo_buzon_miembros m
    where m.buzon_id=correos.buzon_id and m.user_id=(select auth.uid()) and m.puede_revisar)
  and (plan_id is null or exists(select 1 from bitacora.capa_planes p where p.id=correos.plan_id and p.auditoria_codigo like 'FK-GEST-%'))
  and (tarea_id is null or exists(select 1 from bitacora.tareas t where t.id=correos.tarea_id))
  and (compra_id is null or exists(select 1 from bitacora.requerimientos r where r.id=correos.compra_id))
  and (ticket_id is null or exists(select 1 from mantenimiento.tickets t where t.id=correos.ticket_id))
  and (persona_id is null or exists(select 1 from equipo.personas p where p.id=correos.persona_id and p.activo=true))
);

grant update(persona_id) on bitacora.correos to authenticated;

create or replace function bitacora_private.correo_audit_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare previo jsonb; siguiente jsonb;
begin
  siguiente=jsonb_build_object('estado',new.estado,'plan_id',new.plan_id,
    'tarea_id',new.tarea_id,'compra_id',new.compra_id,'ticket_id',new.ticket_id,
    'persona_id',new.persona_id);
  if tg_op='UPDATE' then
    previo=jsonb_build_object('estado',old.estado,'plan_id',old.plan_id,
      'tarea_id',old.tarea_id,'compra_id',old.compra_id,'ticket_id',old.ticket_id,
      'persona_id',old.persona_id);
  end if;
  if tg_op='INSERT' or previo is distinct from siguiente then
    insert into bitacora.correo_historial(correo_id,actor_id,antes,despues)
    values(new.id,auth.uid(),previo,siguiente);
  end if;
  return new;
end $$;

commit;
