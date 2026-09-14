-- AUTORIZADO («autorizo») y aplicado 2026-09-10. No volver a ejecutar. Proyecto: mixyhfdlzjarvszinytk.
-- Amplía los destinos de evidencia; conserva los miembros y originales privados.
begin;
alter table bitacora.correos
  add column tarea_id integer references bitacora.tareas(id),
  add column compra_id integer references bitacora.requerimientos(id),
  add column ticket_id uuid references mantenimiento.tickets(id),
  add column sugerido_tarea_id integer references bitacora.tareas(id),
  add column sugerido_compra_id integer references bitacora.requerimientos(id),
  add column sugerido_ticket_id uuid references mantenimiento.tickets(id);
alter table bitacora.correos drop constraint correos_check;
alter table bitacora.correos add constraint correos_destino_check check (
  (estado='vinculado' and num_nonnulls(plan_id,tarea_id,compra_id,ticket_id)=1)
  or (estado<>'vinculado' and num_nonnulls(plan_id,tarea_id,compra_id,ticket_id)=0)
);
alter table bitacora.correos add constraint correos_sugerencia_check check (
  num_nonnulls(sugerido_plan_id,sugerido_tarea_id,sugerido_compra_id,sugerido_ticket_id)<=1
);
create index correos_tarea_idx on bitacora.correos(tarea_id) where tarea_id is not null;
create index correos_compra_idx on bitacora.correos(compra_id) where compra_id is not null;
create index correos_ticket_idx on bitacora.correos(ticket_id) where ticket_id is not null;

-- Sólo revisores del buzón; cada destino debe ser visible para el usuario
-- bajo los permisos y RLS ya existentes del módulo correspondiente.
alter policy correos_reviewer_update on bitacora.correos with check (
  exists(select 1 from bitacora.correo_buzon_miembros m
    where m.buzon_id=correos.buzon_id and m.user_id=(select auth.uid()) and m.puede_revisar)
  and (plan_id is null or exists(select 1 from bitacora.capa_planes p where p.id=correos.plan_id and p.auditoria_codigo like 'FK-GEST-%'))
  and (tarea_id is null or exists(select 1 from bitacora.tareas t where t.id=correos.tarea_id))
  and (compra_id is null or exists(select 1 from bitacora.requerimientos r where r.id=correos.compra_id))
  and (ticket_id is null or exists(select 1 from mantenimiento.tickets t where t.id=correos.ticket_id))
);
grant update(tarea_id,compra_id,ticket_id) on bitacora.correos to authenticated;

-- El trigger existente registra también cambios de módulo y destino.
create or replace function bitacora_private.correo_audit_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare previo jsonb; siguiente jsonb;
begin
  siguiente=jsonb_build_object('estado',new.estado,'plan_id',new.plan_id,
    'tarea_id',new.tarea_id,'compra_id',new.compra_id,'ticket_id',new.ticket_id);
  if tg_op='UPDATE' then
    previo=jsonb_build_object('estado',old.estado,'plan_id',old.plan_id,
      'tarea_id',old.tarea_id,'compra_id',old.compra_id,'ticket_id',old.ticket_id);
  end if;
  if tg_op='INSERT' or previo is distinct from siguiente then
    insert into bitacora.correo_historial(correo_id,actor_id,antes,despues)
    values(new.id,auth.uid(),previo,siguiente);
  end if;
  return new;
end $$;
commit;
