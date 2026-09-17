-- Fase 3: ampliar el maestro global y agregar configuracion Kiosco por sede.
-- IMPORTANTE: este archivo contiene GRANT/RLS y no debe aplicarse sin la
-- autorizacion explicita requerida por AGENTS.md.

begin;

alter table bitacora.sedes
  add column if not exists kiosk_enabled boolean not null default false;

comment on column bitacora.sedes.kiosk_enabled is
  'Habilita la operacion Kiosco/POS para esta sede. No concede acceso a usuarios.';

create sequence if not exists bitacora.product_internal_code_seq;
revoke all on sequence bitacora.product_internal_code_seq from anon;
grant usage,select on sequence bitacora.product_internal_code_seq to authenticated,service_role;

alter table bitacora.products
  add column if not exists internal_code text,
  add column if not exists stock_unit text not null default 'unidad';

alter table bitacora.products
  alter column internal_code set default ('ART-' || lpad(nextval('bitacora.product_internal_code_seq')::text, 6, '0'));

update bitacora.products
set internal_code = 'ART-' || lpad(nextval('bitacora.product_internal_code_seq')::text, 6, '0')
where internal_code is null;

alter table bitacora.products
  alter column internal_code set not null;

create unique index if not exists products_internal_code_uidx
  on bitacora.products (upper(internal_code));

do $$
begin
  if not exists (select 1 from pg_constraint where conname='products_internal_code_check') then
    alter table bitacora.products add constraint products_internal_code_check
      check (internal_code ~ '^[A-Z0-9][A-Z0-9._-]{2,39}$');
  end if;
  if not exists (select 1 from pg_constraint where conname='products_stock_unit_check') then
    alter table bitacora.products add constraint products_stock_unit_check
      check (length(trim(stock_unit)) between 1 and 30);
  end if;
end $$;

alter table bitacora.product_presentations
  add column if not exists stock_factor numeric not null default 1,
  add column if not exists active boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='product_presentations_stock_factor_check') then
    alter table bitacora.product_presentations add constraint product_presentations_stock_factor_check
      check (stock_factor > 0);
  end if;
end $$;

-- Completa factores de cajas/bultos existentes sin alterar los datos de
-- presentacion originales. Las unidades y packs sin cantidad quedan en 1.
update bitacora.product_presentations p
set stock_factor = coalesce(p.units_per_package::numeric, 1)
where p.stock_factor = 1
  and exists (
    select 1 from bitacora.product_barcodes b
    where b.presentation_id=p.id and b.packaging_level in ('box','case','pallet')
  );

create table if not exists bitacora.product_site_settings (
  id uuid primary key default gen_random_uuid(),
  sede_id integer not null references bitacora.sedes(id),
  product_id uuid not null references bitacora.products(id),
  presentation_id uuid not null,
  sale_price numeric,
  reference_cost numeric,
  stock_minimum numeric not null default 0,
  currency text not null default 'ARS',
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  foreign key (presentation_id, product_id)
    references bitacora.product_presentations(id, product_id),
  unique (sede_id, presentation_id),
  check (sale_price is null or sale_price >= 0),
  check (reference_cost is null or reference_cost >= 0),
  check (stock_minimum >= 0),
  check (currency ~ '^[A-Z]{3}$'),
  check (not active or sale_price > 0)
);

create index if not exists product_site_settings_product_sede_idx
  on bitacora.product_site_settings(product_id, sede_id);
create index if not exists product_site_settings_presentation_idx
  on bitacora.product_site_settings(presentation_id);
create index if not exists product_site_settings_sede_active_idx
  on bitacora.product_site_settings(sede_id, active, product_id);

drop trigger if exists product_site_settings_timestamp on bitacora.product_site_settings;
create trigger product_site_settings_timestamp before update on bitacora.product_site_settings
  for each row execute function bitacora.articulos_timestamp();

create or replace function bitacora.product_site_settings_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.id<>old.id or new.sede_id<>old.sede_id or new.product_id<>old.product_id or new.presentation_id<>old.presentation_id then
      raise exception 'No se puede cambiar la identidad de una configuracion Kiosco';
    end if;
    new.created_by:=old.created_by;
  else
    new.created_by:=auth.uid();
  end if;
  new.updated_by:=auth.uid();
  return new;
end;
$$;

revoke all on function bitacora.product_site_settings_guard() from public,anon;
drop trigger if exists product_site_settings_guard on bitacora.product_site_settings;
create trigger product_site_settings_guard before insert or update on bitacora.product_site_settings
  for each row execute function bitacora.product_site_settings_guard();

-- Todo acceso operativo requiere alcance territorial explicito. Incluso admin
-- y editor deben tener la sede en perfiles.sede_ids; grupo usa su grupo_id.
create or replace function bitacora.kiosco_sede_en_alcance(
  target_sede_id integer,
  escritura boolean default false
)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists (
    select 1
    from bitacora.perfiles p
    join bitacora.sedes s on s.id=target_sede_id
    where p.id=(select auth.uid())
      and p.activo is true
      and s.activa is true
      and s.kiosk_enabled is true
      and p.rol = any(case when escritura
        then array['admin','editor','grupo','encargado']
        else array['admin','editor','consultor','grupo','encargado','sede','deposito']
      end)
      and (
        target_sede_id=any(coalesce(p.sede_ids,'{}'::integer[]))
        or (p.rol='grupo' and p.grupo_id is not null and s.grupo_id=p.grupo_id)
      )
  );
$$;

revoke all on function bitacora.kiosco_sede_en_alcance(integer,boolean) from public,anon;
grant execute on function bitacora.kiosco_sede_en_alcance(integer,boolean) to authenticated;

alter table bitacora.product_site_settings enable row level security;
revoke all on bitacora.product_site_settings from anon,authenticated;
grant select,insert,update on bitacora.product_site_settings to authenticated;
grant all on bitacora.product_site_settings to service_role;

drop policy if exists product_site_settings_read on bitacora.product_site_settings;
create policy product_site_settings_read on bitacora.product_site_settings
  for select to authenticated
  using ((select bitacora.kiosco_sede_en_alcance(sede_id,false)));

drop policy if exists product_site_settings_insert on bitacora.product_site_settings;
create policy product_site_settings_insert on bitacora.product_site_settings
  for insert to authenticated
  with check ((select bitacora.kiosco_sede_en_alcance(sede_id,true)));

drop policy if exists product_site_settings_update on bitacora.product_site_settings;
create policy product_site_settings_update on bitacora.product_site_settings
  for update to authenticated
  using ((select bitacora.kiosco_sede_en_alcance(sede_id,true)))
  with check ((select bitacora.kiosco_sede_en_alcance(sede_id,true)));

create or replace function bitacora.listar_sedes_kiosco()
returns table(id integer,nombre text,tipo text)
language sql stable security invoker set search_path='' as $$
  select s.id,s.nombre,s.tipo
  from bitacora.sedes s
  where bitacora.kiosco_sede_en_alcance(s.id,false)
  order by s.nombre,s.id;
$$;

revoke all on function bitacora.listar_sedes_kiosco() from public,anon;
grant execute on function bitacora.listar_sedes_kiosco() to authenticated;

create or replace function bitacora.guardar_configuracion_kiosco_articulo(payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  sid integer:=nullif(payload->>'sede_id','')::integer;
  pid uuid:=nullif(payload->>'product_id','')::uuid;
  prid uuid:=nullif(payload->>'presentation_id','')::uuid;
  price numeric:=nullif(payload->>'sale_price','')::numeric;
  cost numeric:=nullif(payload->>'reference_cost','')::numeric;
  minimum numeric:=coalesce(nullif(payload->>'stock_minimum','')::numeric,0);
  enabled boolean:=coalesce((payload->>'active')::boolean,false);
  result bitacora.product_site_settings;
begin
  if sid is null or pid is null or prid is null then raise exception 'Configuracion incompleta'; end if;
  if not bitacora.kiosco_sede_en_alcance(sid,true) then raise exception 'Sin permiso para configurar esta sede'; end if;
  if price is not null and price<0 or cost is not null and cost<0 or minimum<0 then
    raise exception 'Precio, costo y minimo no pueden ser negativos';
  end if;
  if enabled and coalesce(price,0)<=0 then raise exception 'El precio de venta debe ser mayor que cero'; end if;
  if not exists(select 1 from bitacora.product_presentations p where p.id=prid and p.product_id=pid and p.active) then
    raise exception 'La presentacion no pertenece al articulo o esta inactiva';
  end if;

  insert into bitacora.product_site_settings(
    sede_id,product_id,presentation_id,sale_price,reference_cost,stock_minimum,currency,active,created_by,updated_by
  ) values(
    sid,pid,prid,price,cost,minimum,coalesce(nullif(upper(payload->>'currency'),''),'ARS'),enabled,auth.uid(),auth.uid()
  )
  on conflict(sede_id,presentation_id) do update set
    sale_price=excluded.sale_price,
    reference_cost=excluded.reference_cost,
    stock_minimum=excluded.stock_minimum,
    currency=excluded.currency,
    active=excluded.active,
    updated_by=auth.uid()
  returning * into result;
  return to_jsonb(result);
end;
$$;

revoke all on function bitacora.guardar_configuracion_kiosco_articulo(jsonb) from public,anon;
grant execute on function bitacora.guardar_configuracion_kiosco_articulo(jsonb) to authenticated;

create or replace function bitacora.guardar_articulo(payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  pid uuid:=(payload->>'product_id')::uuid; prid uuid; code text:=trim(payload->>'barcode');
  existing bitacora.product_barcodes; current_product bitacora.products; source jsonb:=payload->'source';
  related jsonb; related_code text; related_presentation_id uuid; related_existing bitacora.product_barcodes; case_barcode_id uuid;
  factor numeric:=coalesce(nullif(payload->>'stock_factor','')::numeric,nullif(payload->>'units_per_package','')::numeric,1);
begin
  if not bitacora.articulos_puede_acceder(true) then raise exception 'Sin permiso para guardar artículos'; end if;
  if pid is null or code is null or code !~ '^(\d{8}|\d{12,14})$' then raise exception 'Código o identificador inválido'; end if;
  if length(trim(coalesce(payload->>'name','')))=0 then raise exception 'El nombre es obligatorio'; end if;
  if factor<=0 then raise exception 'El factor de stock debe ser mayor que cero'; end if;
  perform pg_advisory_xact_lock(hashtextextended(lpad(code,14,'0'),0));
  select * into existing from bitacora.product_barcodes where gtin_key=lpad(code,14,'0');
  if found then
    if existing.product_id<>pid then raise exception 'El código ya fue guardado. Buscalo nuevamente para editarlo.'; end if;
    select * into current_product from bitacora.products where id=pid for update;
    if nullif(payload->>'expected_updated_at','') is null then raise exception 'El artículo ya se guardó. Volvé a buscar el código para revisar su versión actual.'; end if;
    if current_product.updated_at<>(payload->>'expected_updated_at')::timestamptz then raise exception 'Otro usuario modificó este artículo. Volvé a abrirlo antes de guardar.'; end if;
    prid:=existing.presentation_id;
    update bitacora.products set name=trim(payload->>'name'),description=payload->>'description',brand=payload->>'brand',
      manufacturer=payload->>'manufacturer',category=payload->>'category',subcategory=payload->>'subcategory',image_url=payload->>'image_url',
      ingredients=payload->>'ingredients',allergens=payload->>'allergens',nutrition_text=payload->>'nutrition_text',country_of_origin=payload->>'country_of_origin',
      status=coalesce(nullif(payload->>'status',''),'verified'),supplier_id=nullif(payload->>'supplier_id','')::uuid,rne=payload->>'rne',rnpa=payload->>'rnpa',
      storage_conditions=payload->>'storage_conditions',stock_unit=coalesce(nullif(trim(payload->>'stock_unit'),''),stock_unit) where id=pid;
    update bitacora.product_presentations set presentation=payload->>'presentation',net_quantity=nullif(payload->>'net_quantity','')::numeric,
      net_unit=payload->>'net_unit',units_per_package=nullif(payload->>'units_per_package','')::integer,stock_factor=factor,
      active=coalesce((payload->>'presentation_active')::boolean,true) where id=prid;
    update bitacora.product_barcodes set packaging_level=coalesce(payload->>'packaging_level','unknown'),verified=true where id=existing.id;
  else
    if nullif(payload->>'expected_updated_at','') is not null then raise exception 'El código ya no corresponde al artículo'; end if;
    insert into bitacora.products(id,name,description,brand,manufacturer,category,subcategory,image_url,ingredients,allergens,nutrition_text,country_of_origin,status,supplier_id,rne,rnpa,storage_conditions,stock_unit)
    values(pid,trim(payload->>'name'),payload->>'description',payload->>'brand',payload->>'manufacturer',payload->>'category',payload->>'subcategory',payload->>'image_url',
      payload->>'ingredients',payload->>'allergens',payload->>'nutrition_text',payload->>'country_of_origin',coalesce(nullif(payload->>'status',''),'verified'),
      nullif(payload->>'supplier_id','')::uuid,payload->>'rne',payload->>'rnpa',payload->>'storage_conditions',coalesce(nullif(trim(payload->>'stock_unit'),''),'unidad'));
    insert into bitacora.product_presentations(product_id,presentation,net_quantity,net_unit,units_per_package,stock_factor,active)
    values(pid,payload->>'presentation',nullif(payload->>'net_quantity','')::numeric,payload->>'net_unit',nullif(payload->>'units_per_package','')::integer,
      factor,coalesce((payload->>'presentation_active')::boolean,true)) returning id into prid;
    insert into bitacora.product_barcodes(product_id,presentation_id,barcode,barcode_type,packaging_level,verified)
    values(pid,prid,code,case length(code) when 8 then 'EAN-8' when 12 then 'UPC-A' when 13 then 'EAN-13' else 'GTIN-14' end,
      coalesce(payload->>'packaging_level','unknown'),true) returning * into existing;
  end if;

  for related in select value from jsonb_array_elements(coalesce(payload->'related_barcodes','[]'::jsonb)) loop
    related_code:=trim(related->>'barcode');
    if related_code is null or related_code !~ '^(\d{8}|\d{12,14})$' or lpad(related_code,14,'0')=lpad(code,14,'0') then continue; end if;
    perform pg_advisory_xact_lock(hashtextextended(lpad(related_code,14,'0'),0));
    select * into related_existing from bitacora.product_barcodes where gtin_key=lpad(related_code,14,'0');
    if found then
      if related_existing.product_id<>pid then raise exception 'El código relacionado % ya pertenece a otro artículo.',related_code; end if;
      update bitacora.product_presentations set
        presentation=coalesce(nullif(related->>'presentation',''),presentation),
        net_quantity=coalesce(nullif(related->>'net_quantity','')::numeric,net_quantity),
        net_unit=coalesce(nullif(related->>'net_unit',''),net_unit),
        units_per_package=coalesce(nullif(related->>'units_per_package','')::integer,units_per_package),
        stock_factor=coalesce(nullif(related->>'stock_factor','')::numeric,nullif(related->>'units_per_package','')::numeric,stock_factor)
      where id=related_existing.presentation_id;
      update bitacora.product_barcodes set
        packaging_level=coalesce(nullif(related->>'packaging_level',''),packaging_level),verified=true
      where id=related_existing.id;
    else
      insert into bitacora.product_presentations(product_id,presentation,net_quantity,net_unit,units_per_package,stock_factor)
      values(pid,related->>'presentation',nullif(related->>'net_quantity','')::numeric,related->>'net_unit',nullif(related->>'units_per_package','')::integer,
        coalesce(nullif(related->>'stock_factor','')::numeric,nullif(related->>'units_per_package','')::numeric,1))
      returning id into related_presentation_id;
      insert into bitacora.product_barcodes(product_id,presentation_id,barcode,barcode_type,packaging_level,is_primary,verified)
      values(pid,related_presentation_id,related_code,case length(related_code) when 8 then 'EAN-8' when 12 then 'UPC-A' when 13 then 'EAN-13' else 'GTIN-14' end,
        coalesce(related->>'packaging_level','unknown'),false,true) returning * into related_existing;
    end if;
  end loop;
  select id into case_barcode_id from bitacora.product_barcodes where product_id=pid and packaging_level in ('box','case') order by is_primary desc,created_at limit 1;
  if case_barcode_id is not null then update bitacora.product_barcodes set parent_barcode_id=case_barcode_id where product_id=pid and packaging_level in ('unit','pack') and id<>case_barcode_id; end if;

  insert into bitacora.product_sources(product_id,provider,source_url,raw_metadata,retrieved_at,source_code,source_reference,confidence,verified,last_checked_at)
  values(pid,coalesce(nullif(source->>'provider',''),'Carga manual'),source->>'source_url',coalesce(source->'raw_metadata','{}'::jsonb),
    coalesce((source->>'retrieved_at')::timestamptz,now()),coalesce(nullif(source->>'source_code',''),'MANUAL'),source->>'source_reference',
    coalesce((source->>'confidence')::numeric,case when source is null then 1 else 0.5 end),true,now());
  select * into current_product from bitacora.products where id=pid;
  return jsonb_build_object('product_id',pid,'presentation_id',prid,'barcode',code,'internal_code',current_product.internal_code,'updated_at',current_product.updated_at);
end;
$$;

create or replace function bitacora.buscar_articulos(termino text default '',pagina integer default 0)
returns setof jsonb language sql stable security invoker set search_path='' as $$
  select to_jsonb(p) || jsonb_build_object(
    'barcodes',coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at) from bitacora.product_barcodes b where b.product_id=p.id),'[]'::jsonb),
    'presentations',coalesce((select jsonb_agg(to_jsonb(pr) order by pr.created_at) from bitacora.product_presentations pr where pr.product_id=p.id),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(to_jsonb(s) order by s.recorded_at desc) from bitacora.product_sources s where s.product_id=p.id),'[]'::jsonb))
  from bitacora.products p
  where length(trim(coalesce(termino,'')))=0
    or position(lower(trim(termino)) in lower(concat_ws(' ',p.internal_code,p.name,p.brand,p.category,p.rne,p.rnpa)))>0
    or exists(select 1 from bitacora.product_barcodes b where b.product_id=p.id and position(trim(termino) in b.barcode)>0)
  order by p.updated_at desc,p.id
  limit 30 offset greatest(0,least(coalesce(pagina,0),100000))*30;
$$;

revoke all on function bitacora.buscar_articulos(text,integer) from public,anon;
grant execute on function bitacora.buscar_articulos(text,integer) to authenticated;

notify pgrst,'reload schema';

commit;
