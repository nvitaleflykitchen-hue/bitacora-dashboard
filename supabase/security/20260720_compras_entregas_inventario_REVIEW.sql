-- APLICADO CON APROBACIÓN EXPLÍCITA DEL USUARIO EL 2026-07-20.
-- Conservado como fuente auditable de la migración compras_entregas_inventario.
-- Proyecto permitido: mixyhfdlzjarvszinytk (cerdova-db).
-- Proyecto prohibido: hmyzuuujyurvyuusvyzp (OCTOPUS COQUINARIA).
--
-- Agrega lotes de entrega, aceptación autenticada de custodia y alta automática
-- de activos/stock. No borra datos. Sí crea GRANT/RLS/políticas: revisar antes.

begin;

alter table bitacora.requerimientos
  add column if not exists destino_inventario text not null default 'insumo',
  add column if not exists categoria_inventario text,
  add column if not exists entrega_id uuid,
  add column if not exists inventario_tipo text,
  add column if not exists inventario_id uuid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='requerimientos_destino_inventario_check') then
    alter table bitacora.requerimientos add constraint requerimientos_destino_inventario_check
      check (destino_inventario in ('activo','insumo','no_inventariable'));
  end if;
end $$;

create table if not exists bitacora.compras_entregas (
  id uuid primary key default gen_random_uuid(),
  sede_id integer not null references bitacora.sedes(id),
  contacto_id uuid references bitacora.contactos(id),
  estado text not null default 'preparado' check (estado in ('preparado','avisado','confirmado','cancelado')),
  preparado_por uuid not null references bitacora.perfiles(id),
  preparado_at timestamptz not null default now(),
  avisado_por uuid references bitacora.perfiles(id),
  avisado_at timestamptz,
  retirado_por uuid references bitacora.perfiles(id),
  retirado_nombre text,
  retirado_at timestamptz,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table bitacora.requerimientos
  drop constraint if exists requerimientos_entrega_id_fkey;
alter table bitacora.requerimientos
  add constraint requerimientos_entrega_id_fkey foreign key (entrega_id)
  references bitacora.compras_entregas(id) on delete restrict;

create index if not exists requerimientos_entrega_id_idx on bitacora.requerimientos(entrega_id);
create index if not exists compras_entregas_sede_estado_idx on bitacora.compras_entregas(sede_id,estado);

alter table bitacora.compras_entregas enable row level security;
revoke all on bitacora.compras_entregas from anon, authenticated;
grant select on bitacora.compras_entregas to authenticated;

drop policy if exists compras_entregas_select_scoped on bitacora.compras_entregas;
create policy compras_entregas_select_scoped on bitacora.compras_entregas
for select to authenticated using (
  bitacora_private.has_compras_permission('manage')
  or bitacora_private.has_compras_permission('supervise')
  or bitacora_private.sede_in_user_scope(sede_id)
  or exists (
    select 1 from bitacora.contactos c
    where c.id=contacto_id and c.perfil_id=auth.uid() and c.activo=true
  )
);

-- Extiende únicamente la rama Recibido -> Cumplido del trigger existente.
-- La excepción solo se activa dentro del RPC, que fija el ID exacto del lote
-- después de validar usuario, sede/contacto y bloquear las filas.
do $migration$
declare v_src text;
begin
  select prosrc into v_src
  from pg_proc
  where oid='bitacora_private.protect_requerimiento_after_send()'::regprocedure;
  if position('if old.solicitante_id is distinct from auth.uid() and not is_buyer then' in v_src)=0 then
    raise exception 'No se encontró la versión esperada de protect_requerimiento_after_send(); abortando sin cambios';
  end if;
  v_src := replace(
    v_src,
    'if old.solicitante_id is distinct from auth.uid() and not is_buyer then',
    'if current_setting(''app.confirming_purchase_delivery'', true) is distinct from old.entrega_id::text and old.solicitante_id is distinct from auth.uid() and not is_buyer then'
  );
  execute format(
    'create or replace function bitacora_private.protect_requerimiento_after_send() returns trigger language plpgsql security definer set search_path=pg_catalog,bitacora,bitacora_private as %L',
    v_src
  );
end $migration$;

create or replace function public.crear_entrega_compras(
  p_sede_id integer, p_requerimiento_ids integer[], p_contacto_id uuid default null
) returns uuid
language plpgsql security definer
set search_path=pg_catalog,public,bitacora,bitacora_private
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not (
    bitacora_private.has_compras_permission('manage')
    or bitacora_private.has_compras_permission('supervise')
    or bitacora_private.is_admin_or_editor()
  ) then raise exception 'Solo Compras puede preparar un retiro'; end if;
  if coalesce(cardinality(p_requerimiento_ids),0)=0 then raise exception 'El lote no tiene artículos'; end if;
  if exists (
    select 1 from bitacora.requerimientos r
    where r.id=any(p_requerimiento_ids)
      and (r.sede_id is distinct from p_sede_id or r.estado<>'Recibido' or r.entrega_id is not null)
  ) or (select count(*) from bitacora.requerimientos r where r.id=any(p_requerimiento_ids))<>cardinality(p_requerimiento_ids)
  then raise exception 'Todos los artículos deben estar Recibidos, pertenecer a la misma sede y no integrar otro lote'; end if;

  insert into bitacora.compras_entregas(sede_id,contacto_id,preparado_por)
  values(p_sede_id,p_contacto_id,auth.uid()) returning id into v_id;
  update bitacora.requerimientos set entrega_id=v_id,updated_at=now()
    where id=any(p_requerimiento_ids);
  return v_id;
end $$;

create or replace function public.registrar_aviso_entrega_compras(p_entrega_id uuid)
returns uuid language plpgsql security definer
set search_path=pg_catalog,public,bitacora,bitacora_private
as $$
begin
  if auth.uid() is null or not (
    bitacora_private.has_compras_permission('manage')
    or bitacora_private.has_compras_permission('supervise')
    or bitacora_private.is_admin_or_editor()
  ) then raise exception 'Solo Compras puede registrar el aviso'; end if;
  update bitacora.compras_entregas set estado='avisado',avisado_por=auth.uid(),avisado_at=now(),updated_at=now()
    where id=p_entrega_id and estado in ('preparado','avisado');
  if not found then raise exception 'Lote inexistente o no disponible'; end if;
  return p_entrega_id;
end $$;

create or replace function public.confirmar_entrega_compras(
  p_entrega_id uuid, p_items jsonb, p_observaciones text default null
) returns uuid language plpgsql security definer
set search_path=pg_catalog,public,bitacora,mantenimiento,bitacora_private
as $$
declare
  v_entrega bitacora.compras_entregas%rowtype;
  v_perfil bitacora.perfiles%rowtype;
  v_req bitacora.requerimientos%rowtype;
  v_insumo uuid;
  v_activo uuid;
  v_cantidad numeric;
  v_n integer;
begin
  if auth.uid() is null then raise exception 'Debés iniciar sesión para aceptar la custodia'; end if;
  select * into v_entrega from bitacora.compras_entregas where id=p_entrega_id for update;
  if not found or v_entrega.estado<>'avisado' then raise exception 'El lote no está avisado o ya fue confirmado'; end if;
  select * into v_perfil from bitacora.perfiles where id=auth.uid() and activo=true;
  if not found then raise exception 'Perfil inactivo o inexistente'; end if;
  if not (
    bitacora_private.sede_in_user_scope(v_entrega.sede_id)
    or bitacora_private.has_compras_permission('manage')
    or bitacora_private.has_compras_permission('supervise')
    or exists(select 1 from bitacora.contactos c where c.id=v_entrega.contacto_id and c.perfil_id=auth.uid() and c.activo=true)
  ) then raise exception 'No sos responsable de esta sede o retiro'; end if;

  perform set_config('app.confirming_purchase_delivery',p_entrega_id::text,true);

  for v_req in select * from bitacora.requerimientos where entrega_id=p_entrega_id and estado='Recibido' for update loop
    v_cantidad := coalesce((select (x->>'cantidad')::numeric from jsonb_array_elements(p_items) x where (x->>'requerimiento_id')::integer=v_req.id),v_req.cantidad,1);
    if v_cantidad<>coalesce(v_req.cantidad,1) then raise exception 'La primera versión requiere confirmar la cantidad completa del requerimiento %',v_req.numero; end if;

    if v_req.destino_inventario='activo' then
      for v_n in 1..greatest(1,ceil(v_cantidad)::integer) loop
        insert into mantenimiento.activos(tipo,nombre,categoria,sede_id,sede_nombre,sede,estado,fecha_compra,proveedor_compra,notas)
        values('EQUIPO',v_req.descripcion,v_req.categoria_inventario,v_req.sede_id,v_req.sede_nombre,v_req.sede_nombre,'operativo',current_date,v_req.proveedor_seleccionado,
          concat('Alta automática desde requerimiento #',coalesce(v_req.numero,v_req.id))) returning id into v_activo;
      end loop;
      update bitacora.requerimientos set inventario_tipo='activo',inventario_id=v_activo where id=v_req.id;
    elsif v_req.destino_inventario='insumo' then
      select id into v_insumo from mantenimiento.insumos
        where sede_id=v_req.sede_id and lower(nombre)=lower(v_req.descripcion) limit 1 for update;
      if v_insumo is null then
        insert into mantenimiento.insumos(nombre,unidad,categoria,stock_actual,stock_minimo,sede_id)
        values(v_req.descripcion,v_req.unidad_medida,v_req.categoria_inventario,0,0,v_req.sede_id) returning id into v_insumo;
      end if;
      update mantenimiento.insumos set stock_actual=coalesce(stock_actual,0)+v_cantidad,updated_at=now() where id=v_insumo;
      insert into mantenimiento.movimientos_insumo(insumo_id,tipo,cantidad,motivo,realizado_por)
        values(v_insumo,'entrada',v_cantidad,concat('Compra #',coalesce(v_req.numero,v_req.id),' · retiro ',p_entrega_id),v_perfil.nombre);
      update bitacora.requerimientos set inventario_tipo='insumo',inventario_id=v_insumo where id=v_req.id;
    end if;

    -- El trigger protect_requerimiento_after_send conserva su validación: el
    -- receptor debe ser solicitante, Compras o un perfil autorizado actualmente.
    update bitacora.requerimientos set estado='Cumplido',cumplido_at=now(),updated_at=now() where id=v_req.id;
  end loop;

  update bitacora.compras_entregas set estado='confirmado',retirado_por=auth.uid(),retirado_nombre=v_perfil.nombre,
    retirado_at=now(),observaciones=nullif(trim(p_observaciones),''),updated_at=now() where id=p_entrega_id;
  return p_entrega_id;
end $$;

revoke all on function public.crear_entrega_compras(integer,integer[],uuid) from public,anon;
revoke all on function public.registrar_aviso_entrega_compras(uuid) from public,anon;
revoke all on function public.confirmar_entrega_compras(uuid,jsonb,text) from public,anon;
grant execute on function public.crear_entrega_compras(integer,integer[],uuid) to authenticated;
grant execute on function public.registrar_aviso_entrega_compras(uuid) to authenticated;
grant execute on function public.confirmar_entrega_compras(uuid,jsonb,text) to authenticated;

comment on table bitacora.compras_entregas is 'Lotes físicos retirados desde Central; registra aviso, aceptación autenticada y transferencia de custodia.';
comment on column bitacora.requerimientos.destino_inventario is 'Destino automático al confirmar retiro: activo, insumo o no inventariable.';

-- Antes de COMMIT verificar en BEGIN/ROLLBACK:
-- 1. Compras prepara un lote únicamente con requerimientos Recibido de una sede.
-- 2. Un usuario fuera de la sede no puede leer ni confirmar el lote.
-- 3. El responsable confirma y se crea exactamente un movimiento/activo.
-- 4. Repetir confirmar no duplica stock ni activos.
-- 5. Un error de inventario revierte también Cumplido y la custodia.
commit;
