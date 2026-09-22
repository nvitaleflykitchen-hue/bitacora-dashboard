-- REVIEW: mostrar este SQL completo y obtener autorización explícita antes de aplicarlo.
-- Proyecto permitido: mixyhfdlzjarvszinytk. No altera ventas ni inventario.
begin;

alter table bitacora.product_presentations
  add column if not exists packaging_level text not null default 'unknown'
  check (packaging_level in ('unit','pack','box','case','pallet','unknown'));
update bitacora.product_presentations pr set packaging_level=b.packaging_level
from bitacora.product_barcodes b
where b.presentation_id=pr.id and b.is_primary and pr.packaging_level='unknown';

create table if not exists bitacora.product_master_values (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('brand','manufacturer','stock_unit')),
  name text not null check (length(trim(name)) between 1 and 150),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid()
);
create unique index if not exists product_master_values_kind_name_idx
  on bitacora.product_master_values(kind, lower(name));

insert into bitacora.product_master_values(kind,name)
select kind, name from (
  select 'brand'::text as kind, trim(brand) as name from bitacora.products
  union all select 'manufacturer', trim(manufacturer) from bitacora.products
  union all select 'stock_unit', trim(stock_unit) from bitacora.products
) existing
where name is not null and length(name) between 1 and 150
on conflict do nothing;

alter table bitacora.product_master_values enable row level security;
revoke all on bitacora.product_master_values from anon, authenticated;
grant select, insert, update on bitacora.product_master_values to authenticated;
drop policy if exists product_master_values_read on bitacora.product_master_values;
create policy product_master_values_read on bitacora.product_master_values
  for select to authenticated
  using ((select bitacora.articulos_puede_acceder(false)));
drop policy if exists product_master_values_insert on bitacora.product_master_values;
create policy product_master_values_insert on bitacora.product_master_values
  for insert to authenticated
  with check ((select bitacora.articulos_puede_acceder(true)));
drop policy if exists product_master_values_update on bitacora.product_master_values;
create policy product_master_values_update on bitacora.product_master_values
  for update to authenticated
  using ((select bitacora.articulos_puede_acceder(true)))
  with check ((select bitacora.articulos_puede_acceder(true)));
drop trigger if exists product_master_values_timestamp on bitacora.product_master_values;
create trigger product_master_values_timestamp before update on bitacora.product_master_values
  for each row execute function bitacora.articulos_timestamp();

create or replace function bitacora.guardar_valor_maestro_articulo(payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  value_id uuid:=nullif(payload->>'id','')::uuid;
  value_kind text:=payload->>'kind';
  value_name text:=trim(coalesce(payload->>'name',''));
  value_active boolean:=coalesce((payload->>'active')::boolean,true);
  previous bitacora.product_master_values;
  saved bitacora.product_master_values;
begin
  if not bitacora.articulos_puede_acceder(true) then raise exception 'Sin permiso para editar maestros de artículos'; end if;
  if value_kind not in ('brand','manufacturer','stock_unit') or length(value_name) not between 1 and 150 then
    raise exception 'Tipo o nombre de maestro inválido';
  end if;
  if value_id is null then
    insert into bitacora.product_master_values(kind,name,active)
    values(value_kind,value_name,value_active) returning * into saved;
  else
    select * into previous from bitacora.product_master_values where id=value_id for update;
    if not found or previous.kind<>value_kind then raise exception 'Valor de maestro inexistente'; end if;
    update bitacora.product_master_values
      set name=value_name,active=value_active,updated_by=auth.uid()
      where id=value_id returning * into saved;
    if previous.name<>value_name then
      case value_kind
        when 'brand' then
          update bitacora.products set brand=value_name where lower(trim(brand))=lower(previous.name);
        when 'manufacturer' then
          update bitacora.products set manufacturer=value_name where lower(trim(manufacturer))=lower(previous.name);
        when 'stock_unit' then
          update bitacora.products set stock_unit=value_name where lower(trim(stock_unit))=lower(previous.name);
      end case;
    end if;
  end if;
  return to_jsonb(saved);
end;
$$;
revoke all on function bitacora.guardar_valor_maestro_articulo(jsonb) from public, anon;
grant execute on function bitacora.guardar_valor_maestro_articulo(jsonb) to authenticated;

create or replace function bitacora.guardar_articulo_sin_codigo(payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  pid uuid:=nullif(payload->>'product_id','')::uuid;
  prid uuid:=nullif(payload->>'presentation_id','')::uuid;
  expected timestamptz:=nullif(payload->>'expected_updated_at','')::timestamptz;
  current_product bitacora.products;
  source jsonb:=payload->'source';
  factor numeric:=coalesce(nullif(payload->>'stock_factor','')::numeric,1);
  quantity numeric:=nullif(payload->>'net_quantity','')::numeric;
  package_count integer:=nullif(payload->>'units_per_package','')::integer;
begin
  if not bitacora.articulos_puede_acceder(true) then raise exception 'Sin permiso para guardar artículos'; end if;
  if pid is null or nullif(trim(coalesce(payload->>'barcode','')),'') is not null then raise exception 'Identificador o código inválido'; end if;
  if length(trim(coalesce(payload->>'name',''))) not between 1 and 500 then raise exception 'Ingresá el nombre del artículo'; end if;
  if length(trim(coalesce(payload->>'brand','')))=0 then raise exception 'Seleccioná una marca'; end if;
  if length(trim(coalesce(payload->>'stock_unit',''))) not between 1 and 30 then raise exception 'Seleccioná la unidad base de stock'; end if;
  if payload->>'packaging_level' not in ('unit','pack','box','case','pallet') then raise exception 'Seleccioná el nivel de empaque'; end if;
  if length(trim(coalesce(payload->>'net_unit','')))=0 or quantity is null or quantity<=0 then
    raise exception 'Ingresá la cantidad por unidad y su unidad de contenido';
  end if;
  if factor<=0 or (package_count is not null and package_count<=0) then raise exception 'Factor o cantidad por bulto inválidos'; end if;
  if coalesce(jsonb_array_length(coalesce(payload->'related_barcodes','[]'::jsonb)),0)>0 then
    raise exception 'Los códigos adicionales requieren una presentación con código de barras';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(pid::text,0));
  select * into current_product from bitacora.products where id=pid for update;
  if found then
    if expected is null or current_product.updated_at<>expected then
      raise exception 'Otro usuario modificó este artículo. Volvé a abrirlo antes de guardar.';
    end if;
    if prid is null or not exists (
      select 1 from bitacora.product_presentations where id=prid and product_id=pid
    ) then raise exception 'La presentación no pertenece al artículo'; end if;
    if exists (select 1 from bitacora.product_barcodes where product_id=pid) then
      raise exception 'Este artículo tiene un código de barras. Abrilo desde el maestro para editarlo.';
    end if;
    update bitacora.products set
      name=trim(payload->>'name'),description=payload->>'description',brand=trim(payload->>'brand'),
      manufacturer=payload->>'manufacturer',category=payload->>'category',subcategory=payload->>'subcategory',
      image_url=payload->>'image_url',ingredients=payload->>'ingredients',allergens=payload->>'allergens',
      nutrition_text=payload->>'nutrition_text',country_of_origin=payload->>'country_of_origin',
      status=coalesce(nullif(payload->>'status',''),'verified'),supplier_id=nullif(payload->>'supplier_id','')::uuid,
      rne=payload->>'rne',rnpa=payload->>'rnpa',storage_conditions=payload->>'storage_conditions',
      stock_unit=trim(payload->>'stock_unit') where id=pid;
    update bitacora.product_presentations set
      presentation=payload->>'presentation',net_quantity=quantity,net_unit=trim(payload->>'net_unit'),
      units_per_package=package_count,stock_factor=factor,packaging_level=payload->>'packaging_level',
      active=coalesce((payload->>'presentation_active')::boolean,true) where id=prid;
  else
    if expected is not null then raise exception 'El artículo ya no existe. Actualizá el maestro.'; end if;
    insert into bitacora.products(
      id,name,description,brand,manufacturer,category,subcategory,image_url,ingredients,allergens,
      nutrition_text,country_of_origin,status,supplier_id,rne,rnpa,storage_conditions,stock_unit
    ) values (
      pid,trim(payload->>'name'),payload->>'description',trim(payload->>'brand'),payload->>'manufacturer',
      payload->>'category',payload->>'subcategory',payload->>'image_url',payload->>'ingredients',
      payload->>'allergens',payload->>'nutrition_text',payload->>'country_of_origin',
      coalesce(nullif(payload->>'status',''),'verified'),nullif(payload->>'supplier_id','')::uuid,
      payload->>'rne',payload->>'rnpa',payload->>'storage_conditions',trim(payload->>'stock_unit')
    );
    insert into bitacora.product_presentations(
      product_id,presentation,net_quantity,net_unit,units_per_package,stock_factor,active,packaging_level
    ) values (
      pid,payload->>'presentation',quantity,trim(payload->>'net_unit'),package_count,factor,
      coalesce((payload->>'presentation_active')::boolean,true),payload->>'packaging_level'
    ) returning id into prid;
  end if;

  insert into bitacora.product_sources(
    product_id,provider,source_url,raw_metadata,retrieved_at,source_code,source_reference,
    confidence,verified,last_checked_at
  ) values (
    pid,coalesce(nullif(source->>'provider',''),'Carga manual'),source->>'source_url',
    coalesce(source->'raw_metadata','{}'::jsonb),coalesce((source->>'retrieved_at')::timestamptz,now()),
    'MANUAL',source->>'source_reference',1,true,now()
  );
  select * into current_product from bitacora.products where id=pid;
  return jsonb_build_object(
    'product_id',pid,'presentation_id',prid,'barcode','',
    'internal_code',current_product.internal_code,'updated_at',current_product.updated_at
  );
end;
$$;
revoke all on function bitacora.guardar_articulo_sin_codigo(jsonb) from public, anon;
grant execute on function bitacora.guardar_articulo_sin_codigo(jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
