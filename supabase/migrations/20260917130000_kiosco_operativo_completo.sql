-- Kiosco/POS multisede: inventario trazable, reposiciones, relevamientos,
-- ventas, pagos, anulaciones y consultas operativas.
-- Contiene GRANT/RLS. Requiere autorizacion explicita antes de aplicarse.

begin;

create sequence if not exists bitacora.kiosk_sale_number_seq;
create sequence if not exists bitacora.kiosk_receipt_number_seq;
revoke all on sequence bitacora.kiosk_sale_number_seq, bitacora.kiosk_receipt_number_seq from anon, authenticated;
grant usage, select on sequence bitacora.kiosk_sale_number_seq, bitacora.kiosk_receipt_number_seq to service_role;

create table if not exists bitacora.product_site_inventory (
  sede_id integer not null references bitacora.sedes(id),
  product_id uuid not null references bitacora.products(id),
  presentation_id uuid not null,
  stock_current numeric not null default 0 check (stock_current >= 0),
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (sede_id, presentation_id),
  foreign key (presentation_id, product_id)
    references bitacora.product_presentations(id, product_id)
);

create table if not exists bitacora.inventory_receipts (
  id uuid primary key default gen_random_uuid(),
  sede_id integer not null references bitacora.sedes(id),
  operation_number text not null unique,
  status text not null default 'CONFIRMADA' check (status in ('BORRADOR','CONFIRMADA')),
  observation text,
  reference text,
  idempotency_key text not null unique,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (id, sede_id)
);

create table if not exists bitacora.inventory_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null,
  sede_id integer not null references bitacora.sedes(id),
  product_id uuid not null references bitacora.products(id),
  presentation_id uuid not null,
  barcode text,
  description text not null,
  presentation_quantity numeric not null check (presentation_quantity > 0),
  stock_factor numeric not null check (stock_factor > 0),
  base_quantity numeric not null check (base_quantity > 0),
  unit_cost numeric check (unit_cost is null or unit_cost >= 0),
  total_cost numeric check (total_cost is null or total_cost >= 0),
  created_at timestamptz not null default now(),
  foreign key (receipt_id, sede_id) references bitacora.inventory_receipts(id, sede_id),
  foreign key (presentation_id, product_id) references bitacora.product_presentations(id, product_id),
  unique (receipt_id, presentation_id)
);

create table if not exists bitacora.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  sede_id integer not null references bitacora.sedes(id),
  status text not null default 'EN_PROCESO' check (status in ('EN_PROCESO','FINALIZADO')),
  observation text,
  started_by uuid not null default auth.uid(),
  started_at timestamptz not null default now(),
  finalized_by uuid,
  finalized_at timestamptz,
  finalize_key text unique,
  unique (id, sede_id)
);

create unique index if not exists inventory_counts_one_open_per_site
  on bitacora.inventory_counts(sede_id) where status='EN_PROCESO';

create table if not exists bitacora.inventory_count_items (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null,
  sede_id integer not null references bitacora.sedes(id),
  product_id uuid not null references bitacora.products(id),
  presentation_id uuid not null,
  barcode text,
  description text not null,
  theoretical_at_count numeric not null check (theoretical_at_count >= 0),
  physical_quantity numeric not null check (physical_quantity >= 0),
  difference numeric,
  counted_at timestamptz not null default now(),
  counted_by uuid not null default auth.uid(),
  movement_watermark bigint not null default 0,
  adjustment_movement_id bigint,
  foreign key (count_id, sede_id) references bitacora.inventory_counts(id, sede_id),
  foreign key (presentation_id, product_id) references bitacora.product_presentations(id, product_id),
  unique (count_id, presentation_id)
);

create table if not exists bitacora.sales (
  id uuid primary key default gen_random_uuid(),
  sede_id integer not null references bitacora.sedes(id),
  operation_number text not null unique,
  status text not null default 'COMPLETADA' check (status in ('COMPLETADA','ANULADA')),
  subtotal numeric not null check (subtotal >= 0),
  total numeric not null check (total >= 0),
  currency text not null default 'ARS' check (currency ~ '^[A-Z]{3}$'),
  idempotency_key text not null unique,
  cashier_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  annulled_by uuid,
  annulled_at timestamptz,
  annulment_reason text,
  annulment_key text unique,
  unique (id, sede_id)
);

create table if not exists bitacora.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null,
  sede_id integer not null references bitacora.sedes(id),
  product_id uuid not null references bitacora.products(id),
  presentation_id uuid not null,
  barcode text,
  description text not null,
  quantity numeric not null check (quantity > 0),
  stock_factor numeric not null check (stock_factor > 0),
  base_quantity numeric not null check (base_quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  subtotal numeric not null check (subtotal >= 0),
  created_at timestamptz not null default now(),
  foreign key (sale_id, sede_id) references bitacora.sales(id, sede_id),
  foreign key (presentation_id, product_id) references bitacora.product_presentations(id, product_id),
  unique (sale_id, presentation_id)
);

create table if not exists bitacora.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null,
  sede_id integer not null references bitacora.sedes(id),
  method text not null check (method in ('EFECTIVO','TARJETA','TRANSFERENCIA','OTRO')),
  amount numeric not null check (amount >= 0),
  received numeric check (received is null or received >= 0),
  change_amount numeric not null default 0 check (change_amount >= 0),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (sale_id, sede_id) references bitacora.sales(id, sede_id)
);

create table if not exists bitacora.inventory_movements (
  id bigserial primary key,
  sede_id integer not null references bitacora.sedes(id),
  product_id uuid not null references bitacora.products(id),
  presentation_id uuid not null,
  movement_type text not null check (movement_type in (
    'INGRESO','VENTA','AJUSTE_POSITIVO','AJUSTE_NEGATIVO','DEVOLUCION','ANULACION_VENTA'
  )),
  quantity_delta numeric not null check (quantity_delta <> 0),
  stock_before numeric not null check (stock_before >= 0),
  stock_after numeric not null check (stock_after >= 0),
  reference_type text not null,
  reference_id uuid not null,
  reference_item_id uuid,
  observation text,
  idempotency_key text not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (presentation_id, product_id) references bitacora.product_presentations(id, product_id),
  check (stock_after = stock_before + quantity_delta),
  check (
    (movement_type in ('INGRESO','AJUSTE_POSITIVO','DEVOLUCION','ANULACION_VENTA') and quantity_delta > 0)
    or (movement_type in ('VENTA','AJUSTE_NEGATIVO') and quantity_delta < 0)
  ),
  unique (idempotency_key, presentation_id, movement_type)
);

alter table bitacora.inventory_count_items
  drop constraint if exists inventory_count_items_adjustment_movement_id_fkey;
alter table bitacora.inventory_count_items
  add constraint inventory_count_items_adjustment_movement_id_fkey
  foreign key (adjustment_movement_id) references bitacora.inventory_movements(id);

create index if not exists product_site_inventory_product_idx on bitacora.product_site_inventory(sede_id, product_id);
create index if not exists inventory_receipts_site_date_idx on bitacora.inventory_receipts(sede_id, created_at desc);
create index if not exists inventory_receipt_items_receipt_idx on bitacora.inventory_receipt_items(receipt_id);
create index if not exists inventory_counts_site_date_idx on bitacora.inventory_counts(sede_id, started_at desc);
create index if not exists inventory_count_items_count_idx on bitacora.inventory_count_items(count_id);
create index if not exists sales_site_date_idx on bitacora.sales(sede_id, created_at desc);
create index if not exists sale_items_sale_idx on bitacora.sale_items(sale_id);
create index if not exists payments_sale_idx on bitacora.payments(sale_id);
create index if not exists inventory_movements_site_date_idx on bitacora.inventory_movements(sede_id, created_at desc, id desc);
create index if not exists inventory_movements_product_idx on bitacora.inventory_movements(sede_id, product_id, created_at desc);

create or replace function bitacora.kiosco_puede_operar(target_sede_id integer, accion text)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists (
    select 1
    from bitacora.perfiles p
    join bitacora.sedes s on s.id=target_sede_id
    where p.id=(select auth.uid()) and p.activo and s.activa and s.kiosk_enabled
      and (
        target_sede_id=any(coalesce(p.sede_ids,'{}'::integer[]))
        or (p.rol='grupo' and p.grupo_id is not null and p.grupo_id=s.grupo_id)
      )
      and case upper(coalesce(accion,''))
        when 'LEER' then p.rol=any(array['admin','editor','consultor','grupo','encargado','sede','deposito'])
        when 'VENDER' then p.rol=any(array['admin','editor','grupo','encargado','sede','deposito'])
        when 'REPONER' then p.rol=any(array['admin','editor','grupo','encargado','sede','deposito'])
        when 'RELEVAR' then p.rol=any(array['admin','editor','grupo','encargado','sede'])
        when 'ANULAR' then p.rol=any(array['admin','editor','grupo','encargado'])
        when 'CONFIGURAR' then p.rol=any(array['admin','editor','grupo','encargado'])
        else false
      end
  );
$$;

revoke all on function bitacora.kiosco_puede_operar(integer,text) from public,anon;
grant execute on function bitacora.kiosco_puede_operar(integer,text) to authenticated;

-- Las tablas operativas se leen por sede. Ningun cliente autenticado puede
-- mutar saldos o documentos directamente: todas las escrituras pasan por RPC.
do $$
declare t text;
begin
  foreach t in array array[
    'product_site_inventory','inventory_receipts','inventory_receipt_items',
    'inventory_counts','inventory_count_items','sales','sale_items','payments','inventory_movements'
  ] loop
    execute format('alter table bitacora.%I enable row level security',t);
    execute format('revoke all on bitacora.%I from anon,authenticated',t);
    execute format('grant select on bitacora.%I to authenticated',t);
    execute format('grant all on bitacora.%I to service_role',t);
    execute format('drop policy if exists kiosk_site_read on bitacora.%I',t);
    execute format(
      'create policy kiosk_site_read on bitacora.%I for select to authenticated using ((select bitacora.kiosco_puede_operar(sede_id,''LEER'')))',t
    );
  end loop;
end $$;

revoke all on sequence bitacora.inventory_movements_id_seq from anon,authenticated;
grant usage,select on sequence bitacora.inventory_movements_id_seq to service_role;

create or replace function bitacora.kiosco_catalogo(target_sede_id integer, termino text default '')
returns setof jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'product_id',p.id,'presentation_id',pr.id,'internal_code',p.internal_code,
    'name',p.name,'brand',p.brand,'category',p.category,'presentation',pr.presentation,
    'stock_unit',p.stock_unit,'stock_factor',pr.stock_factor,
    'sale_price',ss.sale_price,'reference_cost',ss.reference_cost,'stock_minimum',ss.stock_minimum,
    'currency',ss.currency,'active',ss.active,
    'stock_current',coalesce(inv.stock_current,0),
    'barcodes',coalesce((select jsonb_agg(b.barcode order by b.is_primary desc,b.created_at) from bitacora.product_barcodes b where b.presentation_id=pr.id),'[]'::jsonb)
  )
  from bitacora.product_site_settings ss
  join bitacora.products p on p.id=ss.product_id
  join bitacora.product_presentations pr on pr.id=ss.presentation_id and pr.product_id=p.id
  left join bitacora.product_site_inventory inv on inv.sede_id=ss.sede_id and inv.presentation_id=ss.presentation_id
  where ss.sede_id=target_sede_id
    and bitacora.kiosco_puede_operar(target_sede_id,'LEER')
    and p.status<>'inactive' and pr.active
    and (
      length(trim(coalesce(termino,'')))=0
      or position(lower(trim(termino)) in lower(concat_ws(' ',p.internal_code,p.name,p.brand,p.category,pr.presentation)))>0
      or exists(select 1 from bitacora.product_barcodes b where b.presentation_id=pr.id and position(trim(termino) in b.barcode)>0)
    )
  order by p.name,pr.presentation,pr.id
  limit 100;
$$;

create or replace function bitacora.confirmar_reposicion(payload jsonb, idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare
  sid integer:=nullif(payload->>'sede_id','')::integer;
  receipt bitacora.inventory_receipts;
  item jsonb; setting bitacora.product_site_settings; pres bitacora.product_presentations; prod bitacora.products;
  inv bitacora.product_site_inventory; line_id uuid; qty numeric; factor numeric; delta numeric; new_cost numeric;
begin
  if sid is null or length(trim(coalesce(idempotency_key,'')))<8 then raise exception 'Reposicion incompleta'; end if;
  if not bitacora.kiosco_puede_operar(sid,'REPONER') then raise exception 'Sin permiso para reponer en esta sede'; end if;
  select * into receipt from bitacora.inventory_receipts where inventory_receipts.idempotency_key=confirmar_reposicion.idempotency_key;
  if found then return to_jsonb(receipt); end if;
  if jsonb_array_length(coalesce(payload->'items','[]'::jsonb))=0 then raise exception 'Agrega al menos un articulo'; end if;
  insert into bitacora.inventory_receipts(sede_id,operation_number,status,observation,reference,idempotency_key,created_by,confirmed_at)
  values(sid,'REP-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('bitacora.kiosk_receipt_number_seq')::text,6,'0'),
    'CONFIRMADA',nullif(trim(payload->>'observation'),''),nullif(trim(payload->>'reference'),''),idempotency_key,auth.uid(),now())
  returning * into receipt;
  for item in select value from jsonb_array_elements(payload->'items') order by value->>'presentation_id' loop
    qty:=nullif(item->>'quantity','')::numeric;
    new_cost:=nullif(item->>'unit_cost','')::numeric;
    if qty is null or qty<=0 or new_cost<0 then raise exception 'Cantidad o costo invalido'; end if;
    select ss.* into setting from bitacora.product_site_settings ss
      where ss.sede_id=sid and ss.presentation_id=(item->>'presentation_id')::uuid for update;
    if not found then raise exception 'El articulo no esta configurado para esta sede'; end if;
    select * into pres from bitacora.product_presentations where id=setting.presentation_id and active;
    select * into prod from bitacora.products where id=setting.product_id and status<>'inactive';
    if pres.id is null or prod.id is null then raise exception 'Articulo o presentacion inactiva'; end if;
    factor:=pres.stock_factor; delta:=qty*factor;
    insert into bitacora.product_site_inventory(sede_id,product_id,presentation_id) values(sid,prod.id,pres.id)
      on conflict(sede_id,presentation_id) do nothing;
    select * into inv from bitacora.product_site_inventory where sede_id=sid and presentation_id=pres.id for update;
    insert into bitacora.inventory_receipt_items(receipt_id,sede_id,product_id,presentation_id,barcode,description,presentation_quantity,stock_factor,base_quantity,unit_cost,total_cost)
    values(receipt.id,sid,prod.id,pres.id,nullif(item->>'barcode',''),prod.name,qty,factor,delta,new_cost,
      case when new_cost is null then null else new_cost*qty end) returning id into line_id;
    update bitacora.product_site_inventory set stock_current=inv.stock_current+delta,version=version+1,updated_at=now()
      where sede_id=sid and presentation_id=pres.id;
    insert into bitacora.inventory_movements(sede_id,product_id,presentation_id,movement_type,quantity_delta,stock_before,stock_after,
      reference_type,reference_id,reference_item_id,observation,idempotency_key,created_by)
    values(sid,prod.id,pres.id,'INGRESO',delta,inv.stock_current,inv.stock_current+delta,'REPOSICION',receipt.id,line_id,
      receipt.observation,idempotency_key,auth.uid());
    if new_cost is not null and bitacora.kiosco_puede_operar(sid,'CONFIGURAR') then
      update bitacora.product_site_settings set reference_cost=new_cost,updated_by=auth.uid() where id=setting.id;
    end if;
  end loop;
  return to_jsonb(receipt);
end;
$$;

create or replace function bitacora.iniciar_relevamiento(target_sede_id integer, observacion text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result bitacora.inventory_counts;
begin
  if not bitacora.kiosco_puede_operar(target_sede_id,'RELEVAR') then raise exception 'Sin permiso para relevar esta sede'; end if;
  select * into result from bitacora.inventory_counts where sede_id=target_sede_id and status='EN_PROCESO' order by started_at desc limit 1;
  if not found then
    insert into bitacora.inventory_counts(sede_id,observation,started_by) values(target_sede_id,nullif(trim(observacion),''),auth.uid()) returning * into result;
  end if;
  return to_jsonb(result);
end;
$$;

create or replace function bitacora.guardar_linea_relevamiento(
  target_count_id uuid,target_presentation_id uuid,cantidad_fisica numeric,codigo text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare header bitacora.inventory_counts; pres bitacora.product_presentations; prod bitacora.products;
  inv bitacora.product_site_inventory; watermark bigint; result bitacora.inventory_count_items;
begin
  if cantidad_fisica<0 then raise exception 'La cantidad fisica no puede ser negativa'; end if;
  select * into header from bitacora.inventory_counts where id=target_count_id for update;
  if not found or header.status<>'EN_PROCESO' then raise exception 'El relevamiento no esta abierto'; end if;
  if not bitacora.kiosco_puede_operar(header.sede_id,'RELEVAR') then raise exception 'Sin permiso para este relevamiento'; end if;
  select * into pres from bitacora.product_presentations where id=target_presentation_id and active;
  select * into prod from bitacora.products where id=pres.product_id and status<>'inactive';
  if pres.id is null or prod.id is null then raise exception 'Articulo no disponible'; end if;
  if not exists(select 1 from bitacora.product_site_settings ss where ss.sede_id=header.sede_id and ss.presentation_id=pres.id) then
    raise exception 'El articulo no esta configurado en esta sede';
  end if;
  insert into bitacora.product_site_inventory(sede_id,product_id,presentation_id) values(header.sede_id,prod.id,pres.id)
    on conflict(sede_id,presentation_id) do nothing;
  select * into inv from bitacora.product_site_inventory where sede_id=header.sede_id and presentation_id=pres.id for update;
  select coalesce(max(id),0) into watermark from bitacora.inventory_movements where sede_id=header.sede_id and presentation_id=pres.id;
  insert into bitacora.inventory_count_items(count_id,sede_id,product_id,presentation_id,barcode,description,theoretical_at_count,
    physical_quantity,counted_at,counted_by,movement_watermark)
  values(header.id,header.sede_id,prod.id,pres.id,nullif(codigo,''),prod.name,inv.stock_current,cantidad_fisica,now(),auth.uid(),watermark)
  on conflict(count_id,presentation_id) do update set barcode=excluded.barcode,description=excluded.description,
    theoretical_at_count=excluded.theoretical_at_count,physical_quantity=excluded.physical_quantity,counted_at=now(),
    counted_by=auth.uid(),movement_watermark=excluded.movement_watermark,difference=null,adjustment_movement_id=null
  returning * into result;
  return to_jsonb(result);
end;
$$;

create or replace function bitacora.finalizar_relevamiento(target_count_id uuid, idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare header bitacora.inventory_counts; line bitacora.inventory_count_items; inv bitacora.product_site_inventory;
  delta numeric; after_stock numeric; movement_id bigint;
begin
  if length(trim(coalesce(idempotency_key,'')))<8 then raise exception 'Identificador de cierre invalido'; end if;
  select * into header from bitacora.inventory_counts where id=target_count_id for update;
  if not found then raise exception 'Relevamiento inexistente'; end if;
  if header.status='FINALIZADO' then return to_jsonb(header); end if;
  if not bitacora.kiosco_puede_operar(header.sede_id,'RELEVAR') then raise exception 'Sin permiso para finalizar'; end if;
  if not exists(select 1 from bitacora.inventory_count_items where count_id=header.id) then raise exception 'El relevamiento no tiene conteos'; end if;
  for line in select * from bitacora.inventory_count_items where count_id=header.id order by presentation_id loop
    select * into inv from bitacora.product_site_inventory where sede_id=header.sede_id and presentation_id=line.presentation_id for update;
    delta:=line.physical_quantity-line.theoretical_at_count;
    after_stock:=inv.stock_current+delta;
    if after_stock<0 then raise exception 'No se puede cerrar: % quedaria con stock negativo. Volve a contarlo.',line.description; end if;
    movement_id:=null;
    if delta<>0 then
      update bitacora.product_site_inventory set stock_current=after_stock,version=version+1,updated_at=now()
        where sede_id=header.sede_id and presentation_id=line.presentation_id;
      insert into bitacora.inventory_movements(sede_id,product_id,presentation_id,movement_type,quantity_delta,stock_before,stock_after,
        reference_type,reference_id,reference_item_id,observation,idempotency_key,created_by)
      values(header.sede_id,line.product_id,line.presentation_id,case when delta>0 then 'AJUSTE_POSITIVO' else 'AJUSTE_NEGATIVO' end,
        delta,inv.stock_current,after_stock,'RELEVAMIENTO',header.id,line.id,header.observation,idempotency_key,auth.uid()) returning id into movement_id;
    end if;
    update bitacora.inventory_count_items set difference=delta,adjustment_movement_id=movement_id where id=line.id;
  end loop;
  update bitacora.inventory_counts set status='FINALIZADO',finalized_by=auth.uid(),finalized_at=now(),finalize_key=idempotency_key
    where id=header.id returning * into header;
  return to_jsonb(header);
end;
$$;

create or replace function bitacora.confirmar_venta(payload jsonb, idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare sid integer:=nullif(payload->>'sede_id','')::integer; method text:=upper(trim(payload->>'payment_method'));
  sale bitacora.sales; item jsonb; setting bitacora.product_site_settings; pres bitacora.product_presentations; prod bitacora.products;
  inv bitacora.product_site_inventory; line_id uuid; qty numeric; delta numeric; line_total numeric; total_amount numeric:=0;
  received_amount numeric; change_value numeric;
begin
  if sid is null or length(trim(coalesce(idempotency_key,'')))<8 then raise exception 'Venta incompleta'; end if;
  if not bitacora.kiosco_puede_operar(sid,'VENDER') then raise exception 'Sin permiso para vender en esta sede'; end if;
  select * into sale from bitacora.sales where sales.idempotency_key=confirmar_venta.idempotency_key;
  if found then return to_jsonb(sale); end if;
  if not (method=any(array['EFECTIVO','TARJETA','TRANSFERENCIA','OTRO'])) then raise exception 'Medio de pago invalido'; end if;
  if jsonb_array_length(coalesce(payload->'items','[]'::jsonb))=0 then raise exception 'La venta no tiene articulos'; end if;
  insert into bitacora.sales(sede_id,operation_number,status,subtotal,total,idempotency_key,cashier_id)
  values(sid,'VTA-'||to_char(current_date,'YYYYMMDD')||'-'||lpad(nextval('bitacora.kiosk_sale_number_seq')::text,6,'0'),
    'COMPLETADA',0,0,idempotency_key,auth.uid()) returning * into sale;
  for item in select value from jsonb_array_elements(payload->'items') order by value->>'presentation_id' loop
    qty:=nullif(item->>'quantity','')::numeric;
    if qty is null or qty<=0 then raise exception 'Cantidad de venta invalida'; end if;
    select ss.* into setting from bitacora.product_site_settings ss where ss.sede_id=sid
      and ss.presentation_id=(item->>'presentation_id')::uuid for update;
    if not found or not setting.active or coalesce(setting.sale_price,0)<=0 then raise exception 'Articulo no disponible para vender'; end if;
    select * into pres from bitacora.product_presentations where id=setting.presentation_id and active;
    select * into prod from bitacora.products where id=setting.product_id and status<>'inactive';
    if pres.id is null or prod.id is null then raise exception 'Articulo inactivo'; end if;
    delta:=qty*pres.stock_factor; line_total:=qty*setting.sale_price; total_amount:=total_amount+line_total;
    insert into bitacora.product_site_inventory(sede_id,product_id,presentation_id) values(sid,prod.id,pres.id)
      on conflict(sede_id,presentation_id) do nothing;
    select * into inv from bitacora.product_site_inventory where sede_id=sid and presentation_id=pres.id for update;
    if inv.stock_current<delta then raise exception 'Stock insuficiente para %. Disponible: %',prod.name,inv.stock_current; end if;
    insert into bitacora.sale_items(sale_id,sede_id,product_id,presentation_id,barcode,description,quantity,stock_factor,base_quantity,unit_price,subtotal)
    values(sale.id,sid,prod.id,pres.id,nullif(item->>'barcode',''),prod.name,qty,pres.stock_factor,delta,setting.sale_price,line_total)
    returning id into line_id;
    update bitacora.product_site_inventory set stock_current=inv.stock_current-delta,version=version+1,updated_at=now()
      where sede_id=sid and presentation_id=pres.id;
    insert into bitacora.inventory_movements(sede_id,product_id,presentation_id,movement_type,quantity_delta,stock_before,stock_after,
      reference_type,reference_id,reference_item_id,idempotency_key,created_by)
    values(sid,prod.id,pres.id,'VENTA',-delta,inv.stock_current,inv.stock_current-delta,'VENTA',sale.id,line_id,idempotency_key,auth.uid());
  end loop;
  received_amount:=case when method='EFECTIVO' then nullif(payload->>'received','')::numeric else total_amount end;
  if method='EFECTIVO' and coalesce(received_amount,0)<total_amount then raise exception 'El importe recibido no alcanza'; end if;
  change_value:=greatest(coalesce(received_amount,total_amount)-total_amount,0);
  update bitacora.sales set subtotal=total_amount,total=total_amount where id=sale.id returning * into sale;
  insert into bitacora.payments(sale_id,sede_id,method,amount,received,change_amount,created_by)
  values(sale.id,sid,method,total_amount,received_amount,change_value,auth.uid());
  return to_jsonb(sale)||jsonb_build_object('payment_method',method,'received',received_amount,'change_amount',change_value);
end;
$$;

create or replace function bitacora.anular_venta(target_sale_id uuid, motivo text, idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare sale bitacora.sales; line bitacora.sale_items; inv bitacora.product_site_inventory;
begin
  if length(trim(coalesce(motivo,'')))<3 then raise exception 'Indica el motivo de anulacion'; end if;
  if length(trim(coalesce(idempotency_key,'')))<8 then raise exception 'Identificador de anulacion invalido'; end if;
  select * into sale from bitacora.sales where id=target_sale_id for update;
  if not found then raise exception 'Venta inexistente'; end if;
  if not bitacora.kiosco_puede_operar(sale.sede_id,'ANULAR') then raise exception 'Sin permiso para anular esta venta'; end if;
  if sale.status='ANULADA' then return to_jsonb(sale); end if;
  for line in select * from bitacora.sale_items where sale_id=sale.id order by presentation_id loop
    select * into inv from bitacora.product_site_inventory where sede_id=sale.sede_id and presentation_id=line.presentation_id for update;
    update bitacora.product_site_inventory set stock_current=inv.stock_current+line.base_quantity,version=version+1,updated_at=now()
      where sede_id=sale.sede_id and presentation_id=line.presentation_id;
    insert into bitacora.inventory_movements(sede_id,product_id,presentation_id,movement_type,quantity_delta,stock_before,stock_after,
      reference_type,reference_id,reference_item_id,observation,idempotency_key,created_by)
    values(sale.sede_id,line.product_id,line.presentation_id,'ANULACION_VENTA',line.base_quantity,inv.stock_current,
      inv.stock_current+line.base_quantity,'ANULACION_VENTA',sale.id,line.id,trim(motivo),idempotency_key,auth.uid());
  end loop;
  update bitacora.sales set status='ANULADA',annulled_by=auth.uid(),annulled_at=now(),annulment_reason=trim(motivo),annulment_key=idempotency_key
    where id=sale.id returning * into sale;
  return to_jsonb(sale);
end;
$$;

create or replace function bitacora.kiosco_ventas(target_sede_id integer, desde date default current_date, hasta date default current_date)
returns setof jsonb language sql stable security definer set search_path='' as $$
  select to_jsonb(s)||jsonb_build_object(
    'payment_method',(select p.method from bitacora.payments p where p.sale_id=s.id order by p.created_at limit 1),
    'item_count',(select coalesce(sum(si.quantity),0) from bitacora.sale_items si where si.sale_id=s.id)
  )
  from bitacora.sales s
  where s.sede_id=target_sede_id and bitacora.kiosco_puede_operar(target_sede_id,'LEER')
    and s.created_at>=coalesce(desde,current_date)::timestamptz
    and s.created_at<(coalesce(hasta,current_date)+1)::timestamptz
  order by s.created_at desc limit 500;
$$;

create or replace function bitacora.kiosco_venta_detalle(target_sale_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sale bitacora.sales;
begin
  select * into sale from bitacora.sales where id=target_sale_id;
  if not found or not bitacora.kiosco_puede_operar(sale.sede_id,'LEER') then raise exception 'Venta no disponible'; end if;
  return to_jsonb(sale)||jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at) from bitacora.sale_items i where i.sale_id=sale.id),'[]'::jsonb),
    'payments',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from bitacora.payments p where p.sale_id=sale.id),'[]'::jsonb)
  );
end;
$$;

create or replace function bitacora.kiosco_reposiciones(target_sede_id integer, limite integer default 100)
returns setof jsonb language sql stable security definer set search_path='' as $$
  select to_jsonb(r)||jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at) from bitacora.inventory_receipt_items i where i.receipt_id=r.id),'[]'::jsonb)
  ) from bitacora.inventory_receipts r
  where r.sede_id=target_sede_id and bitacora.kiosco_puede_operar(target_sede_id,'LEER')
  order by r.created_at desc limit greatest(1,least(coalesce(limite,100),500));
$$;

create or replace function bitacora.kiosco_relevamientos(target_sede_id integer, limite integer default 100)
returns setof jsonb language sql stable security definer set search_path='' as $$
  select to_jsonb(c)||jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.description) from bitacora.inventory_count_items i where i.count_id=c.id),'[]'::jsonb)
  ) from bitacora.inventory_counts c
  where c.sede_id=target_sede_id and bitacora.kiosco_puede_operar(target_sede_id,'LEER')
  order by c.started_at desc limit greatest(1,least(coalesce(limite,100),500));
$$;

create or replace function bitacora.kiosco_movimientos(target_sede_id integer, termino text default '', limite integer default 200)
returns setof jsonb language sql stable security definer set search_path='' as $$
  select to_jsonb(m)||jsonb_build_object('name',p.name,'internal_code',p.internal_code,'presentation',pr.presentation)
  from bitacora.inventory_movements m
  join bitacora.products p on p.id=m.product_id
  join bitacora.product_presentations pr on pr.id=m.presentation_id
  where m.sede_id=target_sede_id and bitacora.kiosco_puede_operar(target_sede_id,'LEER')
    and (length(trim(coalesce(termino,'')))=0 or position(lower(trim(termino)) in lower(concat_ws(' ',p.name,p.internal_code,m.movement_type,m.reference_type)))>0)
  order by m.created_at desc,m.id desc limit greatest(1,least(coalesce(limite,200),1000));
$$;

create or replace function bitacora.kiosco_indicadores(target_sede_id integer)
returns jsonb language sql stable security definer set search_path='' as $$
  select case when bitacora.kiosco_puede_operar(target_sede_id,'LEER') then jsonb_build_object(
    'sales_today',coalesce((select sum(total) from bitacora.sales where sede_id=target_sede_id and status='COMPLETADA' and created_at>=current_date),0),
    'operations_today',(select count(*) from bitacora.sales where sede_id=target_sede_id and status='COMPLETADA' and created_at>=current_date),
    'units_today',coalesce((select sum(i.quantity) from bitacora.sale_items i join bitacora.sales s on s.id=i.sale_id where s.sede_id=target_sede_id and s.status='COMPLETADA' and s.created_at>=current_date),0),
    'low_stock',(select count(*) from bitacora.product_site_settings ss left join bitacora.product_site_inventory inv on inv.sede_id=ss.sede_id and inv.presentation_id=ss.presentation_id where ss.sede_id=target_sede_id and ss.active and coalesce(inv.stock_current,0)<=ss.stock_minimum)
  ) else '{}'::jsonb end;
$$;

do $$
declare signature text;
begin
  foreach signature in array array[
    'kiosco_catalogo(integer,text)',
    'confirmar_reposicion(jsonb,text)',
    'iniciar_relevamiento(integer,text)',
    'guardar_linea_relevamiento(uuid,uuid,numeric,text)',
    'finalizar_relevamiento(uuid,text)',
    'confirmar_venta(jsonb,text)',
    'anular_venta(uuid,text,text)',
    'kiosco_ventas(integer,date,date)',
    'kiosco_venta_detalle(uuid)',
    'kiosco_reposiciones(integer,integer)',
    'kiosco_relevamientos(integer,integer)',
    'kiosco_movimientos(integer,text,integer)',
    'kiosco_indicadores(integer)'
  ] loop
    execute format('revoke all on function bitacora.%s from public,anon',signature);
    execute format('grant execute on function bitacora.%s to authenticated,service_role',signature);
  end loop;
end $$;

notify pgrst,'reload schema';
commit;
