-- PENDIENTE DE AUTORIZACION. NO EJECUTAR SIN APROBACION EXPLICITA DEL USUARIO.
-- Proyecto permitido: mixyhfdlzjarvszinytk (cerdova-db).
-- Vincula una evidencia con una persona sin alterar su vínculo de gestión.
begin;

alter table bitacora.correos
  add column persona_id uuid references equipo.personas(id),
  add column sugerido_persona_id uuid references equipo.personas(id);

create index correos_persona_idx
  on bitacora.correos(persona_id, fecha_correo desc)
  where persona_id is not null;

-- Conserva el acceso por buzón y exige que el revisor también pueda ver
-- a la persona elegida bajo las políticas vigentes de equipo.personas.
alter policy correos_reviewer_update on bitacora.correos with check (
  exists(select 1 from bitacora.correo_buzon_miembros m
    where m.buzon_id=correos.buzon_id and m.user_id=(select auth.uid()) and m.puede_revisar)
  and (plan_id is null or exists(select 1 from bitacora.capa_planes p where p.id=correos.plan_id and p.auditoria_codigo like 'FK-GEST-%'))
  and (tarea_id is null or exists(select 1 from bitacora.tareas t where t.id=correos.tarea_id))
  and (compra_id is null or exists(select 1 from bitacora.requerimientos r where r.id=correos.compra_id))
  and (ticket_id is null or exists(select 1 from mantenimiento.tickets t where t.id=correos.ticket_id))
  and (persona_id is null or exists(select 1 from equipo.personas p where p.id=correos.persona_id))
);

grant update(persona_id) on bitacora.correos to authenticated;

-- El historial registra el vínculo humano además de la gestión.
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
