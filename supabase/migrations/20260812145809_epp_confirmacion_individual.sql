-- Confirmación individual de Uniformes/EPP.
-- REQUIERE AUTORIZACIÓN EXPLÍCITA ANTES DE APLICAR.

alter table equipo.epp_envio_items
  add column if not exists qr_token uuid not null default gen_random_uuid(),
  add column if not exists confirmado_at timestamptz;

create unique index if not exists epp_envio_items_qr_token_uidx
  on equipo.epp_envio_items(qr_token);

create or replace function equipo.obtener_entrega_epp_por_token(p_token uuid)
returns table (
  item_id uuid, persona_id uuid, colaborador text, producto text, codigo text,
  talle text, cantidad integer, estado text, sede text, confirmado_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select i.id,p.id,concat_ws(' ',p.nombre,p.apellido),c.nombre,c.codigo,
         i.talle,i.cantidad,i.estado,s.nombre,i.confirmado_at
  from equipo.epp_envio_items i
  join equipo.personas p on p.id=i.persona_id
  join equipo.epp_catalogo c on c.id=i.producto_id
  join equipo.epp_envios e on e.id=i.envio_id
  join bitacora.sedes s on s.id=e.sede_id
  join bitacora.perfiles perfil on perfil.id=(select auth.uid()) and perfil.activo
  where i.qr_token=p_token
    and (p.perfil_id=(select auth.uid()) or perfil.rol in ('admin','editor'));
$$;

create or replace function equipo.confirmar_entrega_epp(p_token uuid)
returns table (entrega_id uuid, confirmado_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item equipo.epp_envio_items%rowtype;
  v_sede_id integer;
  v_entrega_id uuid;
  v_confirmado_at timestamptz;
begin
  if (select auth.uid()) is null then raise exception 'Debés ingresar con tu usuario Fly'; end if;

  select i.* into v_item
  from equipo.epp_envio_items i
  join equipo.personas p on p.id=i.persona_id
  where i.qr_token=p_token and p.perfil_id=(select auth.uid())
  for update of i;

  if not found then raise exception 'La entrega no corresponde a tu usuario'; end if;

  select e.sede_id into v_sede_id from equipo.epp_envios e where e.id=v_item.envio_id;
  v_confirmado_at=now();

  insert into equipo.epp_entregas_personal(
    envio_item_id,persona_id,producto_id,sede_id,talle,cantidad,estado,
    conformidad,entregado_at,confirmado_at
  ) values (
    v_item.id,v_item.persona_id,v_item.producto_id,v_sede_id,v_item.talle,
    v_item.cantidad,'confirmado','conforme',v_confirmado_at,v_confirmado_at
  )
  on conflict(envio_item_id,persona_id) do update
    set estado='confirmado',conformidad='conforme',confirmado_at=excluded.confirmado_at
  returning id into v_entrega_id;

  update equipo.epp_envio_items
    set estado='confirmado',confirmado_at=v_confirmado_at
    where id=v_item.id;

  insert into equipo.epp_validaciones(entrega_id,persona_id,metodo,resultado,validado_at)
    values(v_entrega_id,v_item.persona_id,'usuario_fly','confirmado',v_confirmado_at);

  insert into equipo.epp_eventos(envio_id,entrega_id,tipo,actor_id,detalle)
    values(v_item.envio_id,v_entrega_id,'entrega_personal_confirmada',(select auth.uid()),'Recepción confirmada por el colaborador');

  return query select v_entrega_id,v_confirmado_at;
end;
$$;

revoke all on function equipo.obtener_entrega_epp_por_token(uuid) from public,anon;
revoke all on function equipo.confirmar_entrega_epp(uuid) from public,anon;
grant execute on function equipo.obtener_entrega_epp_por_token(uuid) to authenticated;
grant execute on function equipo.confirmar_entrega_epp(uuid) to authenticated;
