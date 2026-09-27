// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'

let pg
const actor = '00000000-0000-0000-0000-000000000001'
const productId = '00000000-0000-0000-0000-000000000020'
const migration = name => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8')
const master = payload => pg.query('select bitacora.guardar_valor_maestro_articulo($1::jsonb) as value', [JSON.stringify(payload)])

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(`create schema auth; create schema bitacora;
    create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
    create table bitacora.perfiles(id uuid primary key, rol text, email text, activo boolean, sede_ids integer[] default '{}', grupo_id integer);
    create table bitacora.sedes(id integer primary key, nombre text not null, tipo text not null, activa boolean not null default true, grupo_id integer);
    insert into bitacora.sedes(id,nombre,tipo) values (1,'Kiosco Centro','Comedor');
    insert into bitacora.perfiles(id,rol,email,activo,sede_ids) values ('${actor}','admin','admin@example.test',true,array[1]);
    grant usage on schema auth,bitacora to authenticated,anon;
    grant select on bitacora.perfiles,bitacora.sedes to authenticated;
    select set_config('test.user','${actor}',false);`)
  await pg.exec(migration('20260907165101_maestro_articulos.sql'))
  await pg.exec('create table bitacora.compras_proveedores(id uuid primary key); grant usage on schema bitacora to service_role;')
  for (const name of [
    '20260909110000_extend_product_master_phase1_REVIEW.sql',
    '20260916224011_articulos_kiosco_multisede_phase3.sql',
    '20260917130000_kiosco_operativo_completo.sql',
    '20260921170000_articulos_sin_codigo_maestros_REVIEW.sql',
    '20260927222116_article_taxonomy_ingredient_master.sql',
  ]) await pg.exec(migration(name))
  await pg.exec('set role authenticated')
}, 60000)
afterAll(async () => { await pg?.close() })

describe('maestros de artículos e ingrediente asociado', () => {
  it('relaciona subcategoría con categoría y guarda unidad del ingrediente', async () => {
    const category = (await master({kind:'category',name:'Harinas',active:true})).rows[0].value
    const subcategory = (await master({kind:'subcategory',name:'Trigo',parent_id:category.id,active:true})).rows[0].value
    const ingredient = (await master({kind:'ingredient',name:'Harina 000',unit:'kg',active:true})).rows[0].value
    const presentation = (await master({kind:'presentation',name:'Bolsa 1 kg',active:true})).rows[0].value
    expect(subcategory.parent_id).toBe(category.id)
    expect(ingredient.unit).toBe('kg')
    await expect(master({kind:'subcategory',name:'Sin categoría',active:true})).rejects.toThrow('Seleccioná una categoría')
    const payload = {product_id:productId,barcode:'',name:'Harina Morixe 000',brand:'Morixe',category:'Harinas',subcategory:'Trigo',ingredient_master_id:ingredient.id,presentation:'Bolsa 1 kg',stock_unit:'unidad',net_quantity:1,net_unit:'kg',packaging_level:'unit',stock_factor:1}
    const saved = (await pg.query('select bitacora.guardar_articulo_con_ingrediente($1::jsonb) as value',[JSON.stringify(payload)])).rows[0].value
    expect(saved.product_id).toBe(productId)
    const product = (await pg.query('select ingredient_master_id,category,subcategory from bitacora.products where id=$1',[productId])).rows[0]
    expect(product).toMatchObject({ ingredient_master_id:ingredient.id,category:'Harinas',subcategory:'Trigo' })
    await expect(pg.query('select bitacora.guardar_articulo_con_ingrediente($1::jsonb)',[JSON.stringify({...payload,product_id:'00000000-0000-0000-0000-000000000021',net_unit:'g'})])).rejects.toThrow('unidad de contenido')
    await expect(master({id:ingredient.id,kind:'ingredient',name:'Harina 000',unit:'g',active:true})).rejects.toThrow('ya se utiliza')
    const coded = { ...payload,product_id:'00000000-0000-0000-0000-000000000022',barcode:'012345678905' }
    await pg.query('select bitacora.guardar_articulo_con_ingrediente($1::jsonb)',[JSON.stringify(coded)])
    expect((await pg.query('select ingredient_master_id from bitacora.products where id=$1',[coded.product_id])).rows[0].ingredient_master_id).toBe(ingredient.id)
    await master({id:category.id,kind:'category',name:'Harinas y premezclas',active:true})
    expect((await pg.query('select category from bitacora.products where id=$1',[productId])).rows[0].category).toBe('Harinas y premezclas')
    await master({id:presentation.id,kind:'presentation',name:'Bolsa de 1 kg',active:true})
    expect((await pg.query('select presentation from bitacora.product_presentations where product_id=$1',[productId])).rows[0].presentation).toBe('Bolsa de 1 kg')
  })
})
