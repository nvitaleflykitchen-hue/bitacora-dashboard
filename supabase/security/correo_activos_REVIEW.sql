-- AUTORIZADO («SI AUTORIZO») y aplicado 2026-10-19. No volver a ejecutar.
-- Exclusivamente mixyhfdlzjarvszinytk (cerdova-db).
-- Basada en columnas, constraint, política y auditoría inspeccionados el 2026-10-19.
-- Aplicar antes de publicar el frontend. No modifica vínculos existentes.
-- Conserva acceso por membresía del buzón y personas adicionales.
begin;
alter table bitacora.correos
  add column activo_id uuid references mantenimiento.activos(id);

alter table bitacora.correos drop constraint correos_destino_check;
alter table bitacora.correos add constraint correos_destino_check check (
  (estado='vinculado' and num_nonnulls(
    plan_id,tarea_id,compra_id,ticket_id,persona_id,grupo_id,sede_id,vehiculo_id,id_proyecto_id,activo_id
  )=1)
  or (estado<>'vinculado' and num_nonnulls(
    plan_id,tarea_id,compra_id,ticket_id,persona_id,grupo_id,sede_id,vehiculo_id,id_proyecto_id,activo_id
  )=0)
);
create index correos_activo_idx on bitacora.correos(activo_id) where activo_id is not null;

alter policy correos_reviewer_update on bitacora.correos with check (
  exists(select 1 from bitacora.correo_buzon_miembros m
    where m.buzon_id=correos.buzon_id and m.user_id=(select auth.uid()) and m.puede_revisar)
  and (plan_id is null or exists(select 1 from bitacora.capa_planes p
    where p.id=correos.plan_id and p.estado<>'obsoleto'))
  and (tarea_id is null or exists(select 1 from bitacora.tareas t where t.id=correos.tarea_id))
  and (compra_id is null or exists(select 1 from bitacora.requerimientos r where r.id=correos.compra_id))
  and (ticket_id is null or exists(select 1 from mantenimiento.tickets t where t.id=correos.ticket_id))
  and (persona_id is null or exists(select 1 from equipo.personas p where p.id=correos.persona_id and p.activo=true))
  and not exists(
    select 1 from unnest(correos.persona_ids) selected_persona_id
    where not exists(
      select 1 from equipo.personas p
      where p.id=selected_persona_id and p.activo=true
    )
  )
  and (grupo_id is null or exists(select 1 from bitacora.grupos g where g.id=correos.grupo_id and g.activo=true))
  and (sede_id is null or exists(select 1 from bitacora.sedes s where s.id=correos.sede_id and s.activa=true))
  and (vehiculo_id is null or exists(select 1 from mantenimiento.activos a
    where a.id=correos.vehiculo_id and a.tipo='VEHICULO'))
  and (activo_id is null or exists(select 1 from mantenimiento.activos a
    where a.id=correos.activo_id and a.tipo is distinct from 'VEHICULO'))
  and (id_proyecto_id is null or exists(select 1 from bitacora.id_proyectos p
    where p.id=correos.id_proyecto_id and p.situacion not in ('Completado','Cancelado')))
);


grant update(activo_id) on bitacora.correos to authenticated;

create or replace function bitacora_private.correo_audit_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare previo jsonb; siguiente jsonb;
begin
  siguiente=jsonb_build_object(
    'estado',new.estado,'plan_id',new.plan_id,'tarea_id',new.tarea_id,
    'compra_id',new.compra_id,'ticket_id',new.ticket_id,'persona_id',new.persona_id,
    'persona_ids',new.persona_ids,'grupo_id',new.grupo_id,'sede_id',new.sede_id,
    'activo_id',new.activo_id,'vehiculo_id',new.vehiculo_id,'id_proyecto_id',new.id_proyecto_id
  );
  if tg_op='UPDATE' then
    previo=jsonb_build_object(
      'estado',old.estado,'plan_id',old.plan_id,'tarea_id',old.tarea_id,
      'compra_id',old.compra_id,'ticket_id',old.ticket_id,'persona_id',old.persona_id,
      'persona_ids',old.persona_ids,'grupo_id',old.grupo_id,'sede_id',old.sede_id,
      'activo_id',old.activo_id,'vehiculo_id',old.vehiculo_id,'id_proyecto_id',old.id_proyecto_id
    );
  end if;
  if tg_op='INSERT' or previo is distinct from siguiente then
    insert into bitacora.correo_historial(correo_id,actor_id,antes,despues)
    values(new.id,auth.uid(),previo,siguiente);
  end if;
  return new;
end $$;


notify pgrst, 'reload schema';
commit;
