-- REVIEW: presentar este SQL completo antes de aplicarlo a mixyhfdlzjarvszinytk.
-- Amplía tablas y funciones existentes; no altera políticas RLS ni permisos de tablas.
begin;

alter table bitacora.product_master_values drop constraint product_master_values_kind_check;
alter table bitacora.product_master_values add constraint product_master_values_kind_check
  check (kind in ('brand','manufacturer','stock_unit','category','subcategory','ingredient','presentation'));
alter table bitacora.product_master_values
  add column parent_id uuid references bitacora.product_master_values(id),
  add column unit text;
alter table bitacora.product_master_values add constraint product_master_values_shape_check
  check (
    (kind = 'subcategory' and parent_id is not null or kind <> 'subcategory' and parent_id is null)
    and (kind = 'ingredient' and unit in ('g','kg','mg','ml','l','unidad','m','cm')
      or kind <> 'ingredient' and unit is null)
  );
drop index bitacora.product_master_values_kind_name_idx;
create unique index product_master_values_kind_name_idx
  on bitacora.product_master_values(kind,lower(name)) where kind <> 'subcategory';
create unique index product_master_values_subcategory_name_idx
  on bitacora.product_master_values(parent_id,lower(name)) where kind = 'subcategory';

alter table bitacora.products
  add column ingredient_master_id uuid references bitacora.product_master_values(id);
create index products_ingredient_master_id_idx on bitacora.products(ingredient_master_id)
  where ingredient_master_id is not null;

-- Conservar como opciones los textos ya utilizados en fichas actuales.
insert into bitacora.product_master_values(kind,name)
select distinct 'category',trim(category) from bitacora.products
where length(trim(coalesce(category,''))) between 1 and 150
on conflict do nothing;
insert into bitacora.product_master_values(kind,name,parent_id)
select distinct 'subcategory',trim(p.subcategory),m.id
from bitacora.products p join bitacora.product_master_values m
  on m.kind='category' and lower(m.name)=lower(trim(p.category))
where length(trim(coalesce(p.subcategory,''))) between 1 and 150
on conflict do nothing;
insert into bitacora.product_master_values(kind,name)
select distinct 'presentation',trim(presentation) from bitacora.product_presentations
where length(trim(coalesce(presentation,''))) between 1 and 150
on conflict do nothing;

create or replace function bitacora.guardar_valor_maestro_articulo(payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  value_id uuid:=nullif(payload->>'id','')::uuid;
  value_kind text:=payload->>'kind';
  value_name text:=trim(coalesce(payload->>'name',''));
  value_active boolean:=coalesce((payload->>'active')::boolean,true);
  value_parent uuid:=nullif(payload->>'parent_id','')::uuid;
  value_unit text:=nullif(trim(coalesce(payload->>'unit','')),'');
  previous bitacora.product_master_values;
  saved bitacora.product_master_values;
  old_category text;
  new_category text;
begin
  if not bitacora.articulos_puede_acceder(true) then raise exception 'Sin permiso para editar maestros de artículos'; end if;
  if value_kind not in ('brand','manufacturer','stock_unit','category','subcategory','ingredient','presentation')
     or length(value_name) not between 1 and 150 then
    raise exception 'Tipo o nombre de maestro inválido';
  end if;
  if value_kind='subcategory' then
    select name into new_category from bitacora.product_master_values
      where id=value_parent and kind='category';
    if new_category is null then raise exception 'Seleccioná una categoría válida'; end if;
  elsif value_parent is not null then
    raise exception 'Este maestro no acepta categoría padre';
  end if;
  if value_kind='ingredient' then
    if value_unit not in ('g','kg','mg','ml','l','unidad','m','cm') or value_unit is null then
      raise exception 'Seleccioná una unidad de ingrediente válida';
    end if;
  elsif value_unit is not null then
    raise exception 'Sólo un ingrediente puede definir unidad de contenido';
  end if;
  if value_id is null then
    insert into bitacora.product_master_values(kind,name,active,parent_id,unit)
    values(value_kind,value_name,value_active,value_parent,value_unit) returning * into saved;
  else
    select * into previous from bitacora.product_master_values where id=value_id for update;
    if not found or previous.kind<>value_kind then raise exception 'Valor de maestro inexistente'; end if;
    if value_kind='ingredient' and previous.unit is distinct from value_unit and exists (
      select 1 from bitacora.products where ingredient_master_id=value_id
    ) then raise exception 'La unidad ya se utiliza en artículos. Convertí sus cantidades antes de cambiarla.'; end if;
    if value_kind='subcategory' then
      select name into old_category from bitacora.product_master_values where id=previous.parent_id;
    end if;
    update bitacora.product_master_values
      set name=value_name,active=value_active,parent_id=value_parent,unit=value_unit,updated_by=auth.uid()
      where id=value_id returning * into saved;
    if previous.name<>value_name or previous.parent_id is distinct from value_parent then
      case value_kind
        when 'brand' then
          update bitacora.products set brand=value_name where lower(trim(brand))=lower(previous.name);
        when 'manufacturer' then
          update bitacora.products set manufacturer=value_name where lower(trim(manufacturer))=lower(previous.name);
        when 'stock_unit' then
          update bitacora.products set stock_unit=value_name where lower(trim(stock_unit))=lower(previous.name);
        when 'category' then
          update bitacora.products set category=value_name where lower(trim(category))=lower(previous.name);
        when 'subcategory' then
          update bitacora.products set category=new_category,subcategory=value_name
            where lower(trim(category))=lower(old_category)
              and lower(trim(subcategory))=lower(previous.name);
        when 'presentation' then
          update bitacora.product_presentations set presentation=value_name
            where lower(trim(presentation))=lower(previous.name);
        else null;
      end case;
    end if;
  end if;
  return to_jsonb(saved);
end;
$$;

-- El guardado de artículo y de la asociación ocurre en la misma transacción.
create function bitacora.guardar_articulo_con_ingrediente(payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  ingredient_id uuid:=nullif(payload->>'ingredient_master_id','')::uuid;
  ingredient_unit text;
  ingredient_active boolean;
  saved jsonb;
  product_stamp timestamptz;
begin
  if ingredient_id is not null then
    select unit,active into ingredient_unit,ingredient_active
      from bitacora.product_master_values where id=ingredient_id and kind='ingredient';
    if not found then raise exception 'Seleccioná un ingrediente válido del maestro'; end if;
    if not ingredient_active and not exists (
      select 1 from bitacora.products where id=nullif(payload->>'product_id','')::uuid
        and ingredient_master_id=ingredient_id
    ) then raise exception 'El ingrediente seleccionado está inactivo'; end if;
    if ingredient_unit is distinct from payload->>'net_unit' then
      raise exception 'La unidad de contenido debe coincidir con la del ingrediente asociado';
    end if;
  end if;
  if nullif(trim(coalesce(payload->>'barcode','')),'') is null then
    saved:=bitacora.guardar_articulo_sin_codigo(payload);
  else
    saved:=bitacora.guardar_articulo(payload);
  end if;
  update bitacora.products set ingredient_master_id=ingredient_id
    where id=(saved->>'product_id')::uuid
      and ingredient_master_id is distinct from ingredient_id;
  select updated_at into product_stamp from bitacora.products where id=(saved->>'product_id')::uuid;
  return jsonb_set(saved,'{updated_at}',to_jsonb(product_stamp));
end;
$$;
revoke all on function bitacora.guardar_articulo_con_ingrediente(jsonb) from public,anon;
grant execute on function bitacora.guardar_articulo_con_ingrediente(jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
