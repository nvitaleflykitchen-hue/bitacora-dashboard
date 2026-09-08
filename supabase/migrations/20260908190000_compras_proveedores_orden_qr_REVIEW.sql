-- PROPUESTA PENDIENTE DE APROBACION EXPLICITA.
-- Proyecto destino exclusivo: mixyhfdlzjarvszinytk (cerdova-db).
-- Flujo: proveedores -> aprobacion admin -> OC con QR -> recepcion -> entrega.

create table if not exists bitacora.compras_proveedores (
  id uuid primary key default gen_random_uuid(),
  razon_social text not null,
  nombre_fantasia text,
  cuit text,
  codigo text,
  contacto_nombre text,
  telefono text,
  whatsapp text,
  email text,
  direccion text,
  localidad text,
  provincia text,
  codigo_postal text,
  condicion_iva text,
  condicion_compra text,
  notas text,
  activo boolean not null default true,
  created_by uuid references bitacora.perfiles(id),
  updated_by uuid references bitacora.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists compras_proveedores_cuit_uidx
  on bitacora.compras_proveedores (regexp_replace(cuit, '[^0-9]', '', 'g'))
  where cuit is not null and regexp_replace(cuit, '[^0-9]', '', 'g') <> '';
create index if not exists compras_proveedores_activo_nombre_idx
  on bitacora.compras_proveedores (activo, razon_social);

alter table bitacora.requerimientos
  add column if not exists proveedor_id uuid references bitacora.compras_proveedores(id),
  add column if not exists aprobado_por_id uuid references bitacora.perfiles(id),
  add column if not exists aprobado_por_nombre text,
  add column if not exists orden_compra_adjunto_id bigint references bitacora.adjuntos(id) on delete set null,
  add column if not exists orden_compra_url text,
  add column if not exists orden_compra_nombre text,
  add column if not exists orden_compra_storage_path text,
  add column if not exists seguimiento_token uuid not null default gen_random_uuid(),
  add column if not exists orden_compra_generada_por_id uuid references bitacora.perfiles(id),
  add column if not exists orden_compra_generada_por_nombre text,
  add column if not exists orden_compra_generada_at timestamptz,
  add column if not exists orden_compra_enviada_por_id uuid references bitacora.perfiles(id),
  add column if not exists orden_compra_enviada_por_nombre text,
  add column if not exists orden_compra_enviada_at timestamptz,
  add column if not exists recibido_por_id uuid references bitacora.perfiles(id),
  add column if not exists recibido_por_nombre text,
  add column if not exists cumplido_por_id uuid references bitacora.perfiles(id),
  add column if not exists cumplido_por_nombre text;

create unique index if not exists requerimientos_seguimiento_token_uidx
  on bitacora.requerimientos (seguimiento_token);

create table if not exists bitacora.compras_eventos (
  id uuid primary key default gen_random_uuid(),
  requerimiento_id integer not null references bitacora.requerimientos(id) on delete cascade,
  evento text not null check (evento in ('aprobado','orden_cargada','orden_enviada','recibido_deposito','entregado_solicitante')),
  actor_id uuid not null references bitacora.perfiles(id),
  actor_nombre text not null,
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists compras_eventos_requerimiento_fecha_idx
  on bitacora.compras_eventos (requerimiento_id, created_at desc);

alter table bitacora.compras_proveedores enable row level security;
alter table bitacora.compras_eventos enable row level security;

drop policy if exists compras_proveedores_select_gestion on bitacora.compras_proveedores;
create policy compras_proveedores_select_gestion on bitacora.compras_proveedores
  for select to authenticated
  using (
    bitacora_private.is_admin_or_editor()
    or bitacora_private.has_compras_permission('manage')
    or bitacora_private.has_compras_permission('supervise')
  );

drop policy if exists compras_proveedores_insert_gestion on bitacora.compras_proveedores;
create policy compras_proveedores_insert_gestion on bitacora.compras_proveedores
  for insert to authenticated
  with check (
    bitacora_private.is_admin_or_editor()
    or bitacora_private.has_compras_permission('manage')
    or bitacora_private.has_compras_permission('supervise')
  );

drop policy if exists compras_proveedores_update_gestion on bitacora.compras_proveedores;
create policy compras_proveedores_update_gestion on bitacora.compras_proveedores
  for update to authenticated
  using (
    bitacora_private.is_admin_or_editor()
    or bitacora_private.has_compras_permission('manage')
    or bitacora_private.has_compras_permission('supervise')
  )
  with check (
    bitacora_private.is_admin_or_editor()
    or bitacora_private.has_compras_permission('manage')
    or bitacora_private.has_compras_permission('supervise')
  );

drop policy if exists compras_eventos_select_scoped on bitacora.compras_eventos;
create policy compras_eventos_select_scoped on bitacora.compras_eventos
  for select to authenticated
  using (exists (
    select 1 from bitacora.requerimientos r
    where r.id = compras_eventos.requerimiento_id
      and bitacora_private.can_read_requerimiento(r.sede_id, r.solicitante_id, r.comprador_id, r.supervisor_compras_id, r.facturacion_responsable_id)
  ));

alter table bitacora.perfil_permisos drop constraint if exists perfil_permisos_accion_check;
alter table bitacora.perfil_permisos add constraint perfil_permisos_accion_check
  check (accion = any (array['request','manage','supervise','invoice','receive','report','manage_all']));
alter table bitacora.perfil_permisos drop constraint if exists perfil_permisos_scope_check;
alter table bitacora.perfil_permisos add constraint perfil_permisos_scope_check check (
  (modulo='compras' and accion = any(array['request','manage','supervise','invoice','receive']))
  or (modulo='personal' and accion='report')
  or (modulo='mantenimiento' and accion='manage_all')
);

create or replace function bitacora_private.is_purchase_admin_approver()
returns boolean language sql stable security definer
set search_path = pg_catalog, bitacora as $$
  select exists (
    select 1 from bitacora.perfiles p
    where p.id=auth.uid() and p.activo=true and p.rol='admin'
  );
$$;

create or replace function bitacora_private.protect_requerimiento_after_send()
returns trigger language plpgsql security definer
set search_path = pg_catalog, bitacora, bitacora_private as $$
declare
  old_is_sent boolean := old.estado in ('Enviado','En compra','Recibido','Cumplido','Rechazado','Cancelado');
  is_buyer boolean := bitacora_private.has_compras_permission('manage')
    or bitacora_private.has_compras_permission('supervise')
    or bitacora_private.is_admin_or_editor();
  is_supervisor boolean := bitacora_private.has_compras_permission('supervise')
    or bitacora_private.is_admin_or_editor();
  internal_transition boolean := current_setting('app.purchase_workflow_transition', true) = 'allowed';
  legacy_delivery_transition boolean := current_setting('app.confirming_purchase_delivery', true) = old.entrega_id::text;
begin
  if new.estado is distinct from old.estado and not internal_transition then
    if not (
      (old.estado='Pendiente' and new.estado in ('Observado','Aprobado','Rechazado','Cancelado'))
      or (old.estado='Observado' and new.estado in ('Pendiente','Rechazado','Cancelado'))
      or (old.estado='Aprobado' and new.estado in ('Observado','Rechazado','Cancelado'))
      or (old.estado='Enviado' and new.estado in ('En compra','Cancelado'))
      or (old.estado='En compra' and new.estado='Cancelado')
      or (old.estado='Recibido' and new.estado='En compra')
      or (old.estado='Recibido' and new.estado='Cumplido' and legacy_delivery_transition)
    ) then raise exception 'Transicion de estado de Compras no permitida: % -> %',old.estado,new.estado; end if;
    if old.estado='Pendiente' and new.estado='Aprobado' and not bitacora_private.is_purchase_admin_approver() then
      raise exception 'Solo un administrador puede aprobar el requerimiento';
    elsif old.estado='Observado' and new.estado='Pendiente' then
      if old.solicitante_id is distinct from auth.uid() and not bitacora_private.is_purchase_approver() then
        raise exception 'Solo el solicitante o un administrador puede reenviar el requerimiento';
      end if;
    elsif old.estado='Pendiente' and new.estado='Cancelado' then
      if old.solicitante_id is distinct from auth.uid() and not bitacora_private.is_purchase_approver() then
        raise exception 'Solo el solicitante o un administrador puede cancelar el requerimiento';
      end if;
    elsif old.estado in ('Pendiente','Observado','Aprobado') and not bitacora_private.is_purchase_approver() then
      raise exception 'Solo un administrador puede realizar esta transicion';
    elsif old.estado='Recibido' and new.estado='Cumplido' then
      if old.solicitante_id is distinct from auth.uid() and not bitacora_private.is_purchase_approver() then
        raise exception 'Solo el solicitante puede confirmar la entrega';
      end if;
    elsif not is_buyer then raise exception 'Solo Compras puede avanzar esta etapa'; end if;
  end if;

  if old_is_sent and (
    new.sede_id,new.sede_nombre,new.solicitante,new.solicitante_id,new.cantidad,new.unidad_medida,
    new.descripcion,new.periodo_consumo,new.justificacion,new.funcion,new.sector_maquina,
    new.proveedor_sugerido,new.tipo_compra,new.urgencia,new.fecha_necesidad
  ) is distinct from (
    old.sede_id,old.sede_nombre,old.solicitante,old.solicitante_id,old.cantidad,old.unidad_medida,
    old.descripcion,old.periodo_consumo,old.justificacion,old.funcion,old.sector_maquina,
    old.proveedor_sugerido,old.tipo_compra,old.urgencia,old.fecha_necesidad
  ) then raise exception 'Los datos originales no pueden modificarse despues del envio a Compras'; end if;

  if (new.comprador_id,new.supervisor_compras_id,new.facturacion_responsable_id) is distinct from
     (old.comprador_id,old.supervisor_compras_id,old.facturacion_responsable_id) and not is_supervisor then
    if not (bitacora_private.has_compras_permission('manage') and old.comprador_id is null and new.comprador_id=auth.uid()
      and new.supervisor_compras_id is not distinct from old.supervisor_compras_id
      and new.facturacion_responsable_id is not distinct from old.facturacion_responsable_id)
    then raise exception 'Solo un supervisor puede asignar responsables de Compras'; end if;
  end if;

  if not is_buyer and not internal_transition and (
    new.proveedor_id,new.proveedor_seleccionado,new.cotizacion_estado,new.orden_compra_numero,
    new.fecha_estimada_entrega,new.gestion_compras_notas,new.orden_compra_adjunto_id,
    new.orden_compra_url,new.orden_compra_nombre,new.orden_compra_storage_path
  ) is distinct from (
    old.proveedor_id,old.proveedor_seleccionado,old.cotizacion_estado,old.orden_compra_numero,
    old.fecha_estimada_entrega,old.gestion_compras_notas,old.orden_compra_adjunto_id,
    old.orden_compra_url,old.orden_compra_nombre,old.orden_compra_storage_path
  ) then raise exception 'Solo Compras puede modificar los campos de gestion'; end if;

  if not internal_transition and (
    new.seguimiento_token,new.aprobado_por_id,new.aprobado_por_nombre,new.aprobado_at,
    new.orden_compra_generada_por_id,new.orden_compra_generada_por_nombre,new.orden_compra_generada_at,
    new.orden_compra_enviada_por_id,new.orden_compra_enviada_por_nombre,new.orden_compra_enviada_at,
    new.recibido_por_id,new.recibido_por_nombre,new.cumplido_por_id,new.cumplido_por_nombre
  ) is distinct from (
    old.seguimiento_token,old.aprobado_por_id,old.aprobado_por_nombre,old.aprobado_at,
    old.orden_compra_generada_por_id,old.orden_compra_generada_por_nombre,old.orden_compra_generada_at,
    old.orden_compra_enviada_por_id,old.orden_compra_enviada_por_nombre,old.orden_compra_enviada_at,
    old.recibido_por_id,old.recibido_por_nombre,old.cumplido_por_id,old.cumplido_por_nombre
  ) then raise exception 'La trazabilidad de Compras solo puede registrarse mediante el flujo firmado'; end if;
  return new;
end;
$$;

create or replace function bitacora.aprobar_requerimiento_compra(p_requerimiento_id integer)
returns bitacora.requerimientos language plpgsql security definer
set search_path=pg_catalog,bitacora,bitacora_private as $$
declare v_r bitacora.requerimientos; v_actor bitacora.perfiles; v_now timestamptz:=now();
begin
  select * into v_actor from bitacora.perfiles where id=auth.uid() and activo=true;
  if v_actor.id is null or v_actor.rol<>'admin' then raise exception 'Solo un administrador puede aprobar'; end if;
  select * into v_r from bitacora.requerimientos where id=p_requerimiento_id for update;
  if v_r.id is null then raise exception 'Requerimiento inexistente'; end if;
  if v_r.estado<>'Pendiente' then raise exception 'El requerimiento debe estar Pendiente'; end if;
  perform set_config('app.purchase_workflow_transition','allowed',true);
  update bitacora.requerimientos set estado='Aprobado', aprobado_at=v_now,
    aprobado_por_id=v_actor.id, aprobado_por_nombre=coalesce(v_actor.nombre,v_actor.email),
    historial_estados=coalesce(historial_estados,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
      'de',v_r.estado,'a','Aprobado','actor_id',v_actor.id,'actor',coalesce(v_actor.nombre,v_actor.email),'fecha',v_now)),
    updated_at=v_now where id=v_r.id returning * into v_r;
  insert into bitacora.compras_eventos(requerimiento_id,evento,actor_id,actor_nombre)
    values(v_r.id,'aprobado',v_actor.id,coalesce(v_actor.nombre,v_actor.email));
  return v_r;
end; $$;

create or replace function bitacora.registrar_orden_compra(
  p_requerimiento_id integer,p_proveedor_id uuid,p_adjunto_id bigint,p_url text,
  p_nombre text,p_storage_path text,p_numero text default null,
  p_fecha_estimada date default null,p_notas text default null
) returns bitacora.requerimientos language plpgsql security definer
set search_path=pg_catalog,bitacora,bitacora_private as $$
declare v_r bitacora.requerimientos; v_actor bitacora.perfiles; v_p bitacora.compras_proveedores; v_now timestamptz:=now();
begin
  select * into v_actor from bitacora.perfiles where id=auth.uid() and activo=true;
  if v_actor.id is null or not (bitacora_private.is_admin_or_editor() or bitacora_private.has_compras_permission('manage') or bitacora_private.has_compras_permission('supervise')) then
    raise exception 'No tenes permiso para gestionar ordenes de compra'; end if;
  select * into v_p from bitacora.compras_proveedores where id=p_proveedor_id and activo=true;
  if v_p.id is null then raise exception 'Selecciona un proveedor activo'; end if;
  select * into v_r from bitacora.requerimientos where id=p_requerimiento_id for update;
  if v_r.estado<>'Aprobado' then raise exception 'La orden solo puede cargarse sobre un requerimiento aprobado'; end if;
  if p_adjunto_id is null or nullif(trim(p_url),'') is null then raise exception 'Falta la orden de compra procesada'; end if;
  if not exists (
    select 1 from bitacora.adjuntos a where a.id=p_adjunto_id and a.entity_type='orden_compra'
      and a.entity_id=v_r.id::text and a.url=p_url and a.storage_path is not distinct from p_storage_path
  ) then raise exception 'El adjunto no corresponde a este requerimiento'; end if;
  perform set_config('app.purchase_workflow_transition','allowed',true);
  update bitacora.requerimientos set proveedor_id=v_p.id,proveedor_seleccionado=v_p.razon_social,
    comprador_id=coalesce(comprador_id,v_actor.id),
    orden_compra_numero=nullif(trim(p_numero),''),orden_compra_adjunto_id=p_adjunto_id,
    fecha_estimada_entrega=p_fecha_estimada,gestion_compras_notas=nullif(trim(p_notas),''),
    orden_compra_url=p_url,orden_compra_nombre=p_nombre,orden_compra_storage_path=p_storage_path,
    orden_compra_generada_por_id=v_actor.id,orden_compra_generada_por_nombre=coalesce(v_actor.nombre,v_actor.email),
    orden_compra_generada_at=v_now,updated_at=v_now where id=v_r.id returning * into v_r;
  insert into bitacora.compras_eventos(requerimiento_id,evento,actor_id,actor_nombre,detalle)
    values(v_r.id,'orden_cargada',v_actor.id,coalesce(v_actor.nombre,v_actor.email),jsonb_build_object('adjunto_id',p_adjunto_id,'proveedor_id',v_p.id,'numero',p_numero));
  return v_r;
end; $$;

create or replace function bitacora.marcar_orden_compra_enviada(p_requerimiento_id integer)
returns bitacora.requerimientos language plpgsql security definer
set search_path=pg_catalog,bitacora,bitacora_private as $$
declare v_r bitacora.requerimientos; v_actor bitacora.perfiles; v_now timestamptz:=now();
begin
  select * into v_actor from bitacora.perfiles where id=auth.uid() and activo=true;
  if v_actor.id is null or not (bitacora_private.is_admin_or_editor() or bitacora_private.has_compras_permission('manage') or bitacora_private.has_compras_permission('supervise')) then
    raise exception 'No tenes permiso para enviar ordenes de compra'; end if;
  select * into v_r from bitacora.requerimientos where id=p_requerimiento_id for update;
  if v_r.estado<>'Aprobado' or v_r.orden_compra_adjunto_id is null or v_r.proveedor_id is null then
    raise exception 'La orden debe estar cargada y tener proveedor antes de enviarse'; end if;
  perform set_config('app.purchase_workflow_transition','allowed',true);
  update bitacora.requerimientos set estado='En compra',enviado_at=v_now,compra_iniciada_at=v_now,
    orden_compra_enviada_por_id=v_actor.id,orden_compra_enviada_por_nombre=coalesce(v_actor.nombre,v_actor.email),
    orden_compra_enviada_at=v_now,sla_dias=coalesce(sla_dias,case urgencia when 'alta' then 3 when 'baja' then 15 else 7 end),
    historial_estados=coalesce(historial_estados,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
      'de',v_r.estado,'a','En compra','actor_id',v_actor.id,'actor',coalesce(v_actor.nombre,v_actor.email),'fecha',v_now,'comentario','Orden enviada al proveedor')),
    updated_at=v_now where id=v_r.id returning * into v_r;
  insert into bitacora.compras_eventos(requerimiento_id,evento,actor_id,actor_nombre)
    values(v_r.id,'orden_enviada',v_actor.id,coalesce(v_actor.nombre,v_actor.email));
  return v_r;
end; $$;

create or replace function bitacora.escanear_seguimiento_compra(p_token uuid)
returns bitacora.requerimientos language plpgsql security definer
set search_path=pg_catalog,bitacora,bitacora_private as $$
declare v_r bitacora.requerimientos; v_actor bitacora.perfiles; v_now timestamptz:=now(); v_nombre text; v_dest uuid;
begin
  select * into v_actor from bitacora.perfiles where id=auth.uid() and activo=true;
  if v_actor.id is null then raise exception 'Usuario no autorizado'; end if;
  v_nombre:=coalesce(v_actor.nombre,v_actor.email);
  select * into v_r from bitacora.requerimientos where seguimiento_token=p_token for update;
  if v_r.id is null then raise exception 'Codigo de seguimiento invalido'; end if;
  perform set_config('app.purchase_workflow_transition','allowed',true);
  if v_r.estado='En compra' then
    if not (v_actor.rol in ('admin','editor') or bitacora_private.has_compras_permission('receive')) then
      raise exception 'No tenes permiso para recibir mercaderia'; end if;
    update bitacora.requerimientos set estado='Recibido',recibido_at=v_now,recibido_por_id=v_actor.id,recibido_por_nombre=v_nombre,
      historial_estados=coalesce(historial_estados,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
        'de','En compra','a','Recibido','actor_id',v_actor.id,'actor',v_nombre,'fecha',v_now,'comentario','Mercaderia recibida y guardada en deposito')),
      updated_at=v_now where id=v_r.id returning * into v_r;
    insert into bitacora.compras_eventos(requerimiento_id,evento,actor_id,actor_nombre)
      values(v_r.id,'recibido_deposito',v_actor.id,v_nombre);
    foreach v_dest in array array[v_r.solicitante_id,v_r.comprador_id,v_r.aprobado_por_id] loop
      if v_dest is not null and v_dest<>v_actor.id then
        insert into bitacora.notificaciones(destinatario_id,modulo,entidad_tipo,entidad_id,titulo,cuerpo,prioridad,url,dedupe_key)
        values(v_dest,'compras','requerimiento',v_r.id::text,'Pedido recibido en deposito',
          format('El pedido #%s fue recibido por %s y esta guardado en deposito.',coalesce(v_r.numero::text,v_r.id::text),v_nombre),
          'media','/?view=requerimientos&targetType=requerimiento&targetId='||v_r.id,
          'compras:recibido:'||v_r.id||':'||v_dest) on conflict do nothing;
      end if;
    end loop;
    insert into bitacora.notificaciones(destinatario_id,modulo,entidad_tipo,entidad_id,titulo,cuerpo,prioridad,url,dedupe_key)
    select p.id,'compras','requerimiento',v_r.id::text,'Pedido recibido en deposito',
      format('El pedido #%s fue recibido por %s y esta guardado en deposito.',coalesce(v_r.numero::text,v_r.id::text),v_nombre),
      'media','/?view=requerimientos&targetType=requerimiento&targetId='||v_r.id,
      'compras:recibido:'||v_r.id||':'||p.id
    from bitacora.perfiles p
    where p.activo=true and p.id<>v_actor.id and (
      p.rol in ('admin','editor') or exists (
        select 1 from bitacora.perfil_permisos pp where pp.perfil_id=p.id and pp.modulo='compras' and pp.accion in ('manage','supervise') and pp.activo=true
      )
    ) on conflict do nothing;
  elsif v_r.estado='Recibido' then
    if v_r.solicitante_id is distinct from v_actor.id and v_actor.rol<>'admin' then
      raise exception 'Solo el solicitante puede confirmar la entrega final'; end if;
    update bitacora.requerimientos set estado='Cumplido',cumplido_at=v_now,cumplido_por_id=v_actor.id,cumplido_por_nombre=v_nombre,
      historial_estados=coalesce(historial_estados,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
        'de','Recibido','a','Cumplido','actor_id',v_actor.id,'actor',v_nombre,'fecha',v_now,'comentario','Entrega confirmada por el solicitante')),
      updated_at=v_now where id=v_r.id returning * into v_r;
    insert into bitacora.compras_eventos(requerimiento_id,evento,actor_id,actor_nombre)
      values(v_r.id,'entregado_solicitante',v_actor.id,v_nombre);
  else raise exception 'El pedido no esta en una etapa que admita lectura: %',v_r.estado; end if;
  return v_r;
end; $$;

revoke all on bitacora.compras_proveedores from anon;
revoke all on bitacora.compras_eventos from anon;
grant select,insert,update on bitacora.compras_proveedores to authenticated;
grant select on bitacora.compras_eventos to authenticated;
revoke all on function bitacora.aprobar_requerimiento_compra(integer) from public;
revoke all on function bitacora.registrar_orden_compra(integer,uuid,bigint,text,text,text,text,date,text) from public;
revoke all on function bitacora.marcar_orden_compra_enviada(integer) from public;
revoke all on function bitacora.escanear_seguimiento_compra(uuid) from public;
grant execute on function bitacora.aprobar_requerimiento_compra(integer) to authenticated;
grant execute on function bitacora.registrar_orden_compra(integer,uuid,bigint,text,text,text,text,date,text) to authenticated;
grant execute on function bitacora.marcar_orden_compra_enviada(integer) to authenticated;
grant execute on function bitacora.escanear_seguimiento_compra(uuid) to authenticated;

comment on column bitacora.requerimientos.aprobado_por_nombre is 'Firma digital interna: identidad autenticada registrada por RPC junto con aprobado_at.';
