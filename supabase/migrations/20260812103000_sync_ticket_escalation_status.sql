-- Mantiene alineado el estado de un escalamiento con su ticket de Mantenimiento.
-- Aplicado en producción el 2026-08-12 con autorización explícita.

create or replace function mantenimiento.sincronizar_estado_escalamiento()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_estado text;
begin
  if new.escalamiento_id is null then
    return new;
  end if;

  v_estado := case lower(new.estado)
    when 'en_progreso' then 'En gestión'
    when 'resuelto' then 'Resuelto'
    when 'cerrado' then 'Resuelto'
    when 'rechazado' then 'Resuelto'
    else 'Pendiente'
  end;

  update bitacora.escalamientos
     set estado = v_estado,
         updated_at = now()
   where id = new.escalamiento_id
     and estado is distinct from v_estado;

  return new;
end;
$$;

drop trigger if exists trg_sincronizar_estado_escalamiento
on mantenimiento.tickets;

create trigger trg_sincronizar_estado_escalamiento
after insert or update of estado, escalamiento_id
on mantenimiento.tickets
for each row
execute function mantenimiento.sincronizar_estado_escalamiento();

-- Alinea los registros vinculados que existían antes de crear el trigger.
update bitacora.escalamientos e
set estado = case
      when lower(t.estado) = 'en_progreso' then 'En gestión'
      when lower(t.estado) in ('resuelto', 'cerrado', 'rechazado') then 'Resuelto'
      else 'Pendiente'
    end,
    updated_at = now()
from mantenimiento.tickets t
where t.escalamiento_id = e.id
  and e.estado is distinct from case
      when lower(t.estado) = 'en_progreso' then 'En gestión'
      when lower(t.estado) in ('resuelto', 'cerrado', 'rechazado') then 'Resuelto'
      else 'Pendiente'
    end;
