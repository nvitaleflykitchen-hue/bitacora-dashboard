-- Evita que guardar una ficha con datos antiguos reabra un pedido ya recibido.
create or replace function bitacora_private.prevent_purchase_received_reopen()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, bitacora, bitacora_private
as $$
begin
  if old.recibido_at is not null and new.estado = 'En compra' then
    raise exception 'El requerimiento ya fue recibido en deposito y no puede volver a En compra';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_purchase_received_reopen on bitacora.requerimientos;
create trigger prevent_purchase_received_reopen
before update on bitacora.requerimientos
for each row execute function bitacora_private.prevent_purchase_received_reopen();
