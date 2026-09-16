// @vitest-environment node
// Real Postgres engine in memory. No connection to production.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
let pg
const actor = '00000000-0000-0000-0000-000000000001'
const productId = '00000000-0000-0000-0000-000000000010'
const payload = { product_id:productId, barcode:'17791620187218', name:'Mayonesa Dánica', presentation:'Caja de sobres', net_quantity:8, net_unit:'g', units_per_package:192, packaging_level:'case',
  related_barcodes:[{ barcode:'7791620187211',presentation:'Sobre 8 g',net_quantity:8,net_unit:'g',packaging_level:'unit' }] }
const save = p => pg.query('select bitacora.guardar_articulo($1::jsonb) as result', [JSON.stringify(p)])
beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(`create schema auth; create schema bitacora;
    create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
    create table bitacora.perfiles(id uuid primary key, rol text, email text, activo boolean, sede_ids integer[] default '{}', grupo_id integer);
    create table bitacora.sedes(id integer primary key, nombre text not null, tipo text not null, activa boolean not null default true, grupo_id integer);
    insert into bitacora.sedes(id,nombre,tipo) values (1,'Kiosco Centro','Comedor'),(2,'Kiosco Norte','Comedor');
    insert into bitacora.perfiles(id,rol,email,activo,sede_ids) values ('${actor}','admin','admin@example.test',true,array[1]);
    grant usage on schema auth,bitacora to authenticated,anon;
    grant select on bitacora.perfiles,bitacora.sedes to authenticated;
    select set_config('test.user','${actor}',false);`)
  await pg.exec(readFileSync(new URL('../../supabase/migrations/20260907165101_maestro_articulos.sql', import.meta.url), 'utf8'))
  await pg.exec('create table bitacora.compras_proveedores(id uuid primary key); grant usage on schema bitacora to service_role;')
  await pg.exec(readFileSync(new URL('../../supabase/migrations/20260909110000_extend_product_master_phase1_REVIEW.sql', import.meta.url), 'utf8'))
  await pg.exec(readFileSync(new URL('../../supabase/migrations/20260916221133_articulos_kiosco_multisede_phase3.sql', import.meta.url), 'utf8'))
}, 60000)
afterAll(async () => { await pg?.close() })
describe('maestro SQL', () => {
  it('guarda caja y código como texto sin duplicar un reintento', async () => {
    await pg.exec('set role authenticated')
    await save(payload); await expect(save(payload)).rejects.toThrow('ya se guardó')
    const { rows } = await pg.query('select b.barcode,b.parent_barcode_id,p.net_quantity,p.units_per_package from bitacora.product_barcodes b join bitacora.product_presentations p on p.id=b.presentation_id order by b.barcode')
    expect(rows).toHaveLength(2)
    expect(rows.find(row => row.barcode==='17791620187218')).toMatchObject({ net_quantity:'8',units_per_package:192,parent_barcode_id:null })
    expect(rows.find(row => row.barcode==='7791620187211').parent_barcode_id).toBeTruthy()
  })
  it('rechaza duplicados y revierte escrituras parciales', async () => {
    await expect(save({ ...payload, product_id:'00000000-0000-0000-0000-000000000011' })).rejects.toThrow('ya fue guardado')
    await expect(save({ ...payload, product_id:'00000000-0000-0000-0000-000000000012', barcode:'012345678905', units_per_package:-1 })).rejects.toThrow()
    expect((await pg.query('select count(*)::int as n from bitacora.products')).rows[0].n).toBe(1)
  })
  it('protege ediciones concurrentes y guarda cambios de presentación', async () => {
    const before = (await pg.query('select updated_at::text as stamp from bitacora.products where id=$1', [productId])).rows[0].stamp
    await save({ ...payload, expected_updated_at:before, units_per_package:200 })
    await expect(save({ ...payload, expected_updated_at:before })).rejects.toThrow('Otro usuario')
  })
  it('reconoce equivalencias UPC/EAN sin perder el código original', async () => {
    const other = { ...payload, product_id:'00000000-0000-0000-0000-000000000013', barcode:'012345678905', related_barcodes:[] }
    await save(other)
    await expect(save({ ...other, product_id:'00000000-0000-0000-0000-000000000014', barcode:'0012345678905' })).rejects.toThrow('ya fue guardado')
    expect((await pg.query("select barcode from bitacora.product_barcodes where gtin_key='00012345678905'")).rows[0].barcode).toBe('012345678905')
  })
  it('busca por nombre, marca, categoría y código sin interpretación SQL del texto', async () => {
    for (const term of ['Dánica','17791620187218']) expect((await pg.query('select * from bitacora.buscar_articulos($1,0)', [term])).rows.length).toBeGreaterThan(0)
    expect((await pg.query('select * from bitacora.buscar_articulos($1,0)', ["%' OR 1=1 --"])).rows).toHaveLength(0)
  })
  it('encuentra EAN y DUN-14 relacionados en el catálogo SEPA y registra búsquedas', async () => {
    await pg.exec("reset role; insert into bitacora.sepa_products(source_dataset,source_commerce_id,source_product_id,ean,package_barcode,name,brand,units_per_package) values('sepa-prueba','60','7791620187211','7791620187211','17791620187218','Mayonesa Dánica','Dánica',192); set role authenticated;")
    const result=(await pg.query("select bitacora.buscar_producto_sepa('7791620187211') as value")).rows[0].value
    expect(result).toMatchObject({ ean:'7791620187211',package_barcode:'17791620187218',matched_level:'unit' })
    await pg.query("select bitacora.registrar_busqueda_articulo($1::jsonb)",[JSON.stringify({ barcode:'7791620187211',found:true,source_code:'SEPA_WHOLESALE',duration_ms:12 })])
    await pg.exec('reset role')
    expect((await pg.query('select count(*)::int as n from bitacora.barcode_search_log')).rows[0].n).toBe(1)
    await pg.exec('set role authenticated')
  })
  it('consultor solo lee y perfiles inactivos no acceden', async () => {
    await pg.exec("reset role; update bitacora.perfiles set rol='consultor'; set role authenticated;")
    expect((await pg.query('select count(*)::int as n from bitacora.products')).rows[0].n).toBe(2)
    await expect(save(payload)).rejects.toThrow('Sin permiso')
    await pg.exec('reset role; update bitacora.perfiles set activo=false; set role authenticated;')
    expect((await pg.query('select * from bitacora.products')).rows).toHaveLength(0)
    await pg.exec('reset role; set role anon;')
    await expect(pg.query('select * from bitacora.products')).rejects.toThrow('permission denied')
  })
  it('genera código interno y configura Kiosco solo para sedes habilitadas y asignadas', async () => {
    await pg.exec("reset role; update bitacora.perfiles set rol='admin',activo=true,sede_ids=array[1]; update bitacora.sedes set kiosk_enabled=true; set role authenticated;")
    const product = (await pg.query('select internal_code,stock_unit from bitacora.products where id=$1',[productId])).rows[0]
    expect(product.internal_code).toMatch(/^ART-\d{6,}$/)
    expect(product.stock_unit).toBe('unidad')
    expect((await pg.query('select * from bitacora.buscar_articulos($1,0)',[product.internal_code])).rows).toHaveLength(1)
    expect((await pg.query('select stock_factor from bitacora.product_presentations where product_id=$1 order by stock_factor desc limit 1',[productId])).rows[0].stock_factor).toBe('200')
    expect((await pg.query('select * from bitacora.listar_sedes_kiosco()')).rows.map(row=>row.id)).toEqual([1])
    const presentationId=(await pg.query('select presentation_id from bitacora.product_barcodes where product_id=$1 and barcode=$2',[productId,payload.barcode])).rows[0].presentation_id
    const config={ sede_id:1,product_id:productId,presentation_id:presentationId,sale_price:3200,reference_cost:2100,stock_minimum:5,active:true }
    const saved=(await pg.query('select bitacora.guardar_configuracion_kiosco_articulo($1::jsonb) as value',[JSON.stringify(config)])).rows[0].value
    expect(saved).toMatchObject({ sede_id:1,sale_price:3200,reference_cost:2100,stock_minimum:5,active:true })
    await expect(pg.query('select bitacora.guardar_configuracion_kiosco_articulo($1::jsonb)',[JSON.stringify({ ...config,sede_id:2 })])).rejects.toThrow('Sin permiso')
  })
})
