import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listProductMasterValues, saveProduct, validateProduct } from './productQueries'

const rpc = vi.hoisted(() => vi.fn())
const from = vi.hoisted(() => vi.fn())
vi.mock('./supabase', () => ({ db:() => ({ rpc, from }), supabase:{} }))

const complete = {
  product_id:'123e4567-e89b-12d3-a456-426614174000', barcode:'', name:'Vaso descartable',
  brand:'Marca prueba', stock_unit:'unidad', stock_factor:'1', packaging_level:'unit',
  net_quantity:'1', net_unit:'unidad', related_barcodes:[], status:'verified',
}

beforeEach(() => { rpc.mockReset(); from.mockReset() })

it('recupera todas las páginas del maestro cuando supera 500 opciones', async () => {
  const first = Array.from({ length:500 }, (_, index) => ({ id:String(index), name:`Marca ${index}` }))
  const second = [{ id:'500', name:'Marca 500' }]
  const range = vi.fn().mockResolvedValueOnce({ data:first, error:null }).mockResolvedValueOnce({ data:second, error:null })
  const query = { select:vi.fn(), order:vi.fn(), range }
  query.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  from.mockReturnValue(query)

  const values = await listProductMasterValues()
  expect(values).toHaveLength(501)
  expect(range).toHaveBeenNthCalledWith(1, 0, 499)
  expect(range).toHaveBeenNthCalledWith(2, 500, 999)
})

describe('artículos sin código y campos obligatorios', () => {
  it('permite guardar sin código y conserva la asociación de ingrediente en una sola operación', async () => {
    rpc.mockResolvedValue({ data:{ product_id:complete.product_id, presentation_id:'pr-1', barcode:'', updated_at:'2026-09-21T12:00:00Z' }, error:null })
    await saveProduct({ ...complete, ingredient_master_id:'00000000-0000-0000-0000-000000000090' })
    expect(rpc).toHaveBeenCalledWith('guardar_articulo_con_ingrediente', expect.objectContaining({ payload:expect.objectContaining({ barcode:'', ingredient_master_id:'00000000-0000-0000-0000-000000000090' }) }))
  })

  it.each([
    ['brand', '', 'marca'],
    ['stock_unit', '', 'unidad base'],
    ['packaging_level', 'unknown', 'nivel de empaque'],
    ['net_unit', '', 'unidad de contenido'],
    ['net_quantity', '', 'cantidad por unidad'],
  ])('rechaza %s vacío antes de escribir', (field, value, message) => {
    expect(() => validateProduct({ ...complete, [field]:value })).toThrow(message)
    expect(rpc).not.toHaveBeenCalled()
  })
})
