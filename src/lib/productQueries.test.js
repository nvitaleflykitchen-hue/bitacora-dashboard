import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveProduct, validateProduct } from './productQueries'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('./supabase', () => ({ db:() => ({ rpc }), supabase:{} }))

const complete = {
  product_id:'123e4567-e89b-12d3-a456-426614174000', barcode:'', name:'Vaso descartable',
  brand:'Marca prueba', stock_unit:'unidad', stock_factor:'1', packaging_level:'unit',
  net_quantity:'1', net_unit:'unidad', related_barcodes:[], status:'verified',
}

beforeEach(() => rpc.mockReset())

describe('artículos sin código y campos obligatorios', () => {
  it('permite guardar sin código y usa la operación manual', async () => {
    rpc.mockResolvedValue({ data:{ product_id:complete.product_id, presentation_id:'pr-1', barcode:'', updated_at:'2026-09-21T12:00:00Z' }, error:null })
    await saveProduct(complete)
    expect(rpc).toHaveBeenCalledWith('guardar_articulo_sin_codigo', expect.objectContaining({ payload:expect.objectContaining({ barcode:'' }) }))
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
