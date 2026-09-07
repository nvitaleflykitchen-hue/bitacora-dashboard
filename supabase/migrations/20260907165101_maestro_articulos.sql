-- Maestro global de artículos. No contiene stock ni movimientos.
-- PENDIENTE de autorización explícita antes de aplicar GRANT/RLS (AGENTS.md §0.3).
create table bitacora.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 500),
  description text, brand text, manufacturer text, category text, subcategory text,
  image_url text check (image_url is null or image_url = '' or image_url like 'https://%'),
  ingredients text, allergens text, nutrition_text text, country_of_origin text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create table bitacora.product_presentations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references bitacora.products(id),
  presentation text, net_quantity numeric check (net_quantity > 0),
  net_unit text, units_per_package integer check (units_per_package > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id, product_id)
);
create table bitacora.product_barcodes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references bitacora.products(id),
  presentation_id uuid not null,
  barcode text not null unique check (barcode ~ '^(\d{8}|\d{12,14})$'),
  gtin_key text generated always as (lpad(barcode,14,'0')) stored unique,
  barcode_type text not null check (barcode_type in ('EAN-8','UPC-A','EAN-13','GTIN-14')),
  packaging_level text not null default 'unknown' check (packaging_level in ('unit','case','unknown')),
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key(presentation_id, product_id) references bitacora.product_presentations(id, product_id),
  check (length(barcode) = case barcode_type when 'EAN-8' then 8 when 'UPC-A' then 12 when 'EAN-13' then 13 else 14 end)
);
create table bitacora.product_sources (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references bitacora.products(id),
  provider text not null, source_url text,
  raw_metadata jsonb not null default '{}'::jsonb,
  retrieved_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(), recorded_by uuid default auth.uid()
);
create index product_presentations_product_idx on bitacora.product_presentations(product_id);
create index product_barcodes_product_idx on bitacora.product_barcodes(product_id);
create index product_barcodes_presentation_idx on bitacora.product_barcodes(presentation_id, product_id);
create index product_sources_product_idx on bitacora.product_sources(product_id);
create index products_updated_idx on bitacora.products(updated_at desc, id);
comment on column bitacora.product_presentations.net_quantity is 'Contenido por unidad contenida; no representa existencias.';
comment on column bitacora.product_barcodes.gtin_key is 'Clave de equivalencia GTIN rellenada a 14 dígitos; conserva barcode original como texto.';

create function bitacora.articulos_puede_acceder(escritura boolean default false)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from bitacora.perfiles p
    where p.id = (select auth.uid()) and p.activo is true
      and p.rol = any(case when escritura
        then array['admin','editor','grupo','encargado','sede']
        else array['admin','editor','grupo','encargado','sede','consultor'] end)
      and lower(coalesce(p.email,'')) <> all(array[
        'tecnica@flykitchen.com.ar','fabifranco13@gmail.com','rrhh.higieneyseguridad.emp@gmail.com'])
  );
$$;
revoke all on function bitacora.articulos_puede_acceder(boolean) from public, anon;
grant execute on function bitacora.articulos_puede_acceder(boolean) to authenticated;

alter table bitacora.products enable row level security;
revoke all on bitacora.products from anon, authenticated;
grant select, insert, update on bitacora.products to authenticated;
create policy articulos_read on bitacora.products for select to authenticated
  using ((select bitacora.articulos_puede_acceder(false)));
create policy articulos_insert on bitacora.products for insert to authenticated
  with check ((select bitacora.articulos_puede_acceder(true)));
create policy articulos_update on bitacora.products for update to authenticated
  using ((select bitacora.articulos_puede_acceder(true)))
  with check ((select bitacora.articulos_puede_acceder(true)));
alter table bitacora.product_presentations enable row level security;
revoke all on bitacora.product_presentations from anon, authenticated;
grant select, insert, update on bitacora.product_presentations to authenticated;
create policy articulos_read on bitacora.product_presentations for select to authenticated
  using ((select bitacora.articulos_puede_acceder(false)));
create policy articulos_insert on bitacora.product_presentations for insert to authenticated
  with check ((select bitacora.articulos_puede_acceder(true)));
create policy articulos_update on bitacora.product_presentations for update to authenticated
  using ((select bitacora.articulos_puede_acceder(true)))
  with check ((select bitacora.articulos_puede_acceder(true)));
alter table bitacora.product_barcodes enable row level security;
revoke all on bitacora.product_barcodes from anon, authenticated;
grant select, insert, update on bitacora.product_barcodes to authenticated;
create policy articulos_read on bitacora.product_barcodes for select to authenticated
  using ((select bitacora.articulos_puede_acceder(false)));
create policy articulos_insert on bitacora.product_barcodes for insert to authenticated
  with check ((select bitacora.articulos_puede_acceder(true)));
create policy articulos_update on bitacora.product_barcodes for update to authenticated
  using ((select bitacora.articulos_puede_acceder(true)))
  with check ((select bitacora.articulos_puede_acceder(true)));
alter table bitacora.product_sources enable row level security;
revoke all on bitacora.product_sources from anon, authenticated;
grant select, insert on bitacora.product_sources to authenticated;
create policy articulos_read on bitacora.product_sources for select to authenticated
  using ((select bitacora.articulos_puede_acceder(false)));
create policy articulos_insert on bitacora.product_sources for insert to authenticated
  with check ((select bitacora.articulos_puede_acceder(true)));


create function bitacora.articulos_timestamp() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin new.updated_at := clock_timestamp(); return new; end;
$$;
create trigger products_timestamp before update on bitacora.products
  for each row execute function bitacora.articulos_timestamp();
create trigger presentations_timestamp before update on bitacora.product_presentations
  for each row execute function bitacora.articulos_timestamp();
revoke all on function bitacora.articulos_timestamp() from public, anon;

create function bitacora.guardar_articulo(payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  pid uuid := (payload->>'product_id')::uuid;
  prid uuid;
  code text := trim(payload->>'barcode');
  existing bitacora.product_barcodes;
  current_product bitacora.products;
  source jsonb := payload->'source';
begin
  if not bitacora.articulos_puede_acceder(true) then raise exception 'Sin permiso para guardar artículos'; end if;
  if pid is null or code is null or code !~ '^(\d{8}|\d{12,14})$' then raise exception 'Código o identificador inválido'; end if;
  if length(trim(coalesce(payload->>'name',''))) = 0 then raise exception 'El nombre es obligatorio'; end if;
  -- Serializes competing requests for the same GTIN, including leading-zero aliases.
  perform pg_advisory_xact_lock(hashtextextended(lpad(code,14,'0'),0));
  select * into existing from bitacora.product_barcodes where gtin_key=lpad(code,14,'0');
  if found then
    if existing.product_id <> pid then raise exception 'El código ya fue guardado. Buscalo nuevamente para editarlo.'; end if;
    select * into current_product from bitacora.products where id=pid for update;
    if nullif(payload->>'expected_updated_at','') is null then
      -- An ambiguous create must be reread, never acknowledge unsaved later edits.
      raise exception 'El artículo ya se guardó. Volvé a buscar el código para revisar su versión actual.';
    end if;
    if current_product.updated_at <> (payload->>'expected_updated_at')::timestamptz then
      raise exception 'Otro usuario modificó este artículo. Volvé a abrirlo antes de guardar.';
    end if;
    prid := existing.presentation_id;
    update bitacora.products set name=trim(payload->>'name'),description=payload->>'description',
      brand=payload->>'brand',manufacturer=payload->>'manufacturer',category=payload->>'category',
      subcategory=payload->>'subcategory',image_url=payload->>'image_url',ingredients=payload->>'ingredients',
      allergens=payload->>'allergens',nutrition_text=payload->>'nutrition_text',country_of_origin=payload->>'country_of_origin'
      where id=pid;
    update bitacora.product_presentations set presentation=payload->>'presentation',
      net_quantity=nullif(payload->>'net_quantity','')::numeric,net_unit=payload->>'net_unit',
      units_per_package=nullif(payload->>'units_per_package','')::integer where id=prid;
    update bitacora.product_barcodes set packaging_level=coalesce(payload->>'packaging_level','unknown') where id=existing.id;
  else
    if nullif(payload->>'expected_updated_at','') is not null then raise exception 'El código ya no corresponde al artículo'; end if;
    insert into bitacora.products(id,name,description,brand,manufacturer,category,subcategory,image_url,ingredients,allergens,nutrition_text,country_of_origin)
      values(pid,trim(payload->>'name'),payload->>'description',payload->>'brand',payload->>'manufacturer',
      payload->>'category',payload->>'subcategory',payload->>'image_url',payload->>'ingredients',
      payload->>'allergens',payload->>'nutrition_text',payload->>'country_of_origin');
    insert into bitacora.product_presentations(product_id,presentation,net_quantity,net_unit,units_per_package)
      values(pid,payload->>'presentation',nullif(payload->>'net_quantity','')::numeric,payload->>'net_unit',
        nullif(payload->>'units_per_package','')::integer) returning id into prid;
    insert into bitacora.product_barcodes(product_id,presentation_id,barcode,barcode_type,packaging_level)
      values(pid,prid,code,case length(code) when 8 then 'EAN-8' when 12 then 'UPC-A' when 13 then 'EAN-13' else 'GTIN-14' end,
        coalesce(payload->>'packaging_level','unknown'));
  end if;
  insert into bitacora.product_sources(product_id,provider,source_url,raw_metadata,retrieved_at)
    values(pid,coalesce(nullif(source->>'provider',''),'Carga manual'),source->>'source_url',
      coalesce(source->'raw_metadata','{}'::jsonb),coalesce((source->>'retrieved_at')::timestamptz,now()));
  select * into current_product from bitacora.products where id=pid;
  return jsonb_build_object('product_id',pid,'barcode',code,'updated_at',current_product.updated_at);
end;
$$;
revoke all on function bitacora.guardar_articulo(jsonb) from public, anon;
grant execute on function bitacora.guardar_articulo(jsonb) to authenticated;

create function bitacora.buscar_articulos(termino text default '', pagina integer default 0)
returns setof jsonb language sql stable security invoker set search_path = '' as $$
  select to_jsonb(p) || jsonb_build_object(
    'barcodes',coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at) from bitacora.product_barcodes b where b.product_id=p.id),'[]'::jsonb),
    'presentations',coalesce((select jsonb_agg(to_jsonb(pr) order by pr.created_at) from bitacora.product_presentations pr where pr.product_id=p.id),'[]'::jsonb))
  from bitacora.products p
  where length(trim(coalesce(termino,'')))=0
    or position(lower(trim(termino)) in lower(concat_ws(' ',p.name,p.brand,p.category)))>0
    or exists(select 1 from bitacora.product_barcodes b where b.product_id=p.id and position(trim(termino) in b.barcode)>0)
  order by p.updated_at desc,p.id
  limit 30 offset greatest(0,least(coalesce(pagina,0),100000))*30;
$$;
revoke all on function bitacora.buscar_articulos(text,integer) from public, anon;
grant execute on function bitacora.buscar_articulos(text,integer) to authenticated;
notify pgrst, 'reload schema';
