-- Fase 1 del maestro de artículos: catálogo SEPA, trazabilidad y códigos relacionados.
-- REVIEW: contiene GRANT/RLS. No aplicar en producción sin autorización explícita.

alter table bitacora.products
  add column if not exists status text not null default 'verified'
    check (status in ('pending','verified','inactive')),
  add column if not exists supplier_id uuid references bitacora.compras_proveedores(id),
  add column if not exists rne text,
  add column if not exists rnpa text,
  add column if not exists storage_conditions text;

alter table bitacora.product_barcodes
  add column if not exists parent_barcode_id uuid references bitacora.product_barcodes(id),
  add column if not exists verified boolean not null default false;
alter table bitacora.product_barcodes drop constraint if exists product_barcodes_packaging_level_check;
alter table bitacora.product_barcodes add constraint product_barcodes_packaging_level_check
  check (packaging_level in ('unit','pack','box','case','pallet','unknown'));
create index if not exists product_barcodes_parent_idx on bitacora.product_barcodes(parent_barcode_id);

alter table bitacora.product_sources
  add column if not exists source_code text not null default 'MANUAL'
    check (source_code in ('INTERNAL','SEPA','SEPA_WHOLESALE','GS1','OPEN_FOOD_FACTS','OPEN_PRODUCTS_FACTS','OPEN_BEAUTY_FACTS','MANUAL','SUPPLIER','WEB')),
  add column if not exists source_reference text,
  add column if not exists confidence numeric not null default 0.5 check (confidence between 0 and 1),
  add column if not exists verified boolean not null default false,
  add column if not exists last_checked_at timestamptz;

update bitacora.product_sources set
  source_code=case
    when lower(provider)='open food facts' then 'OPEN_FOOD_FACTS'
    when lower(provider)='open products facts' then 'OPEN_PRODUCTS_FACTS'
    when lower(provider)='open beauty facts' then 'OPEN_BEAUTY_FACTS'
    when lower(provider) like '%manual%' then 'MANUAL'
    else 'WEB' end,
  confidence=case when lower(provider) like '%manual%' then 1 else 0.8 end,
  verified=true,
  last_checked_at=coalesce(retrieved_at,recorded_at);

create table if not exists bitacora.sepa_products (
  id bigint generated always as identity primary key,
  source_dataset text not null,
  source_commerce_id text not null,
  source_product_id text not null,
  commerce_name text,
  ean text check (ean is null or ean ~ '^(\d{8}|\d{12,14})$'),
  ean_gtin_key text generated always as (case when ean is null then null else lpad(ean,14,'0') end) stored,
  package_barcode text check (package_barcode is null or package_barcode ~ '^(\d{8}|\d{12,14})$'),
  package_gtin_key text generated always as (case when package_barcode is null then null else lpad(package_barcode,14,'0') end) stored,
  name text not null,
  brand text,
  presentation text,
  net_quantity numeric check (net_quantity is null or net_quantity > 0),
  net_unit text,
  units_per_package integer check (units_per_package is null or units_per_package > 0),
  raw_metadata jsonb not null default '{}'::jsonb,
  dataset_updated_at timestamptz,
  imported_at timestamptz not null default now(),
  check (ean is not null or package_barcode is not null)
);
create unique index if not exists sepa_products_source_uidx on bitacora.sepa_products
  (source_dataset,source_commerce_id,source_product_id,coalesce(ean,''),coalesce(package_barcode,''));
create index if not exists sepa_products_ean_idx on bitacora.sepa_products(ean_gtin_key) where ean_gtin_key is not null;
create index if not exists sepa_products_package_idx on bitacora.sepa_products(package_gtin_key) where package_gtin_key is not null;

create table if not exists bitacora.barcode_search_log (
  id uuid primary key default gen_random_uuid(),
  barcode text not null check (barcode ~ '^(\d{8}|\d{12,14})$'),
  gtin_key text generated always as (lpad(barcode,14,'0')) stored,
  found boolean not null,
  source_code text not null,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error_message text,
  user_id uuid not null default auth.uid(),
  searched_at timestamptz not null default now()
);
create index if not exists barcode_search_log_code_idx on bitacora.barcode_search_log(gtin_key,searched_at desc);

alter table bitacora.sepa_products enable row level security;
alter table bitacora.barcode_search_log enable row level security;
revoke all on bitacora.sepa_products, bitacora.barcode_search_log from anon, authenticated;
grant select on bitacora.sepa_products to authenticated;
grant insert on bitacora.barcode_search_log to authenticated;
grant all on bitacora.sepa_products to service_role;
grant usage,select on sequence bitacora.sepa_products_id_seq to service_role;
drop policy if exists sepa_products_read on bitacora.sepa_products;
create policy sepa_products_read on bitacora.sepa_products for select to authenticated
  using ((select bitacora.articulos_puede_acceder(false)));
drop policy if exists barcode_search_log_insert on bitacora.barcode_search_log;
create policy barcode_search_log_insert on bitacora.barcode_search_log for insert to authenticated
  with check (user_id=(select auth.uid()) and (select bitacora.articulos_puede_acceder(false)));

create or replace function bitacora.buscar_producto_sepa(codigo text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select to_jsonb(s) || jsonb_build_object(
    'matched_code',case when s.ean_gtin_key=lpad(trim(codigo),14,'0') then s.ean else s.package_barcode end,
    'matched_level',case when s.ean_gtin_key=lpad(trim(codigo),14,'0') then 'unit' else 'case' end)
  from bitacora.sepa_products s
  where trim(codigo) ~ '^(\d{8}|\d{12,14})$'
    and (s.ean_gtin_key=lpad(trim(codigo),14,'0') or s.package_gtin_key=lpad(trim(codigo),14,'0'))
  order by s.dataset_updated_at desc nulls last,s.imported_at desc,s.id
  limit 1;
$$;
revoke all on function bitacora.buscar_producto_sepa(text) from public, anon;
grant execute on function bitacora.buscar_producto_sepa(text) to authenticated;

create or replace function bitacora.registrar_busqueda_articulo(payload jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare code text:=trim(payload->>'barcode');
begin
  if not bitacora.articulos_puede_acceder(false) then raise exception 'Sin acceso al maestro de artículos'; end if;
  if code !~ '^(\d{8}|\d{12,14})$' then raise exception 'Código inválido'; end if;
  insert into bitacora.barcode_search_log(barcode,found,source_code,duration_ms,error_message,user_id)
  values(code,coalesce((payload->>'found')::boolean,false),left(coalesce(nullif(payload->>'source_code',''),'UNKNOWN'),40),
    nullif(payload->>'duration_ms','')::integer,left(payload->>'error_message',1000),auth.uid());
end;
$$;
revoke all on function bitacora.registrar_busqueda_articulo(jsonb) from public, anon;
grant execute on function bitacora.registrar_busqueda_articulo(jsonb) to authenticated;

create or replace function bitacora.guardar_articulo(payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  pid uuid:=(payload->>'product_id')::uuid; prid uuid; code text:=trim(payload->>'barcode');
  existing bitacora.product_barcodes; current_product bitacora.products; source jsonb:=payload->'source';
  related jsonb; related_code text; related_presentation_id uuid; related_existing bitacora.product_barcodes; case_barcode_id uuid;
begin
  if not bitacora.articulos_puede_acceder(true) then raise exception 'Sin permiso para guardar artículos'; end if;
  if pid is null or code is null or code !~ '^(\d{8}|\d{12,14})$' then raise exception 'Código o identificador inválido'; end if;
  if length(trim(coalesce(payload->>'name','')))=0 then raise exception 'El nombre es obligatorio'; end if;
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
      storage_conditions=payload->>'storage_conditions' where id=pid;
    update bitacora.product_presentations set presentation=payload->>'presentation',net_quantity=nullif(payload->>'net_quantity','')::numeric,
      net_unit=payload->>'net_unit',units_per_package=nullif(payload->>'units_per_package','')::integer where id=prid;
    update bitacora.product_barcodes set packaging_level=coalesce(payload->>'packaging_level','unknown'),verified=true where id=existing.id;
  else
    if nullif(payload->>'expected_updated_at','') is not null then raise exception 'El código ya no corresponde al artículo'; end if;
    insert into bitacora.products(id,name,description,brand,manufacturer,category,subcategory,image_url,ingredients,allergens,nutrition_text,country_of_origin,status,supplier_id,rne,rnpa,storage_conditions)
    values(pid,trim(payload->>'name'),payload->>'description',payload->>'brand',payload->>'manufacturer',payload->>'category',payload->>'subcategory',payload->>'image_url',
      payload->>'ingredients',payload->>'allergens',payload->>'nutrition_text',payload->>'country_of_origin',coalesce(nullif(payload->>'status',''),'verified'),
      nullif(payload->>'supplier_id','')::uuid,payload->>'rne',payload->>'rnpa',payload->>'storage_conditions');
    insert into bitacora.product_presentations(product_id,presentation,net_quantity,net_unit,units_per_package)
    values(pid,payload->>'presentation',nullif(payload->>'net_quantity','')::numeric,payload->>'net_unit',nullif(payload->>'units_per_package','')::integer) returning id into prid;
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
    else
      insert into bitacora.product_presentations(product_id,presentation,net_quantity,net_unit,units_per_package)
      values(pid,related->>'presentation',nullif(related->>'net_quantity','')::numeric,related->>'net_unit',nullif(related->>'units_per_package','')::integer)
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
  return jsonb_build_object('product_id',pid,'barcode',code,'updated_at',current_product.updated_at);
end;
$$;
revoke all on function bitacora.guardar_articulo(jsonb) from public, anon;
grant execute on function bitacora.guardar_articulo(jsonb) to authenticated;

create or replace function bitacora.buscar_articulos(termino text default '',pagina integer default 0)
returns setof jsonb language sql stable security invoker set search_path='' as $$
  select to_jsonb(p) || jsonb_build_object(
    'barcodes',coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at) from bitacora.product_barcodes b where b.product_id=p.id),'[]'::jsonb),
    'presentations',coalesce((select jsonb_agg(to_jsonb(pr) order by pr.created_at) from bitacora.product_presentations pr where pr.product_id=p.id),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(to_jsonb(s) order by s.recorded_at desc) from bitacora.product_sources s where s.product_id=p.id),'[]'::jsonb))
  from bitacora.products p
  where length(trim(coalesce(termino,'')))=0
    or position(lower(trim(termino)) in lower(concat_ws(' ',p.name,p.brand,p.category,p.rne,p.rnpa)))>0
    or exists(select 1 from bitacora.product_barcodes b where b.product_id=p.id and position(trim(termino) in b.barcode)>0)
  order by p.updated_at desc,p.id
  limit 30 offset greatest(0,least(coalesce(pagina,0),100000))*30;
$$;
revoke all on function bitacora.buscar_articulos(text,integer) from public,anon;
grant execute on function bitacora.buscar_articulos(text,integer) to authenticated;

notify pgrst,'reload schema';
