import { describe, expect, it, vi } from 'vitest'
import { searchProducts, downloadProductsXlsx } from './productQueries'

vi.mock('xlsx', () => ({ utils:{ book_new:vi.fn(() => ({})), json_to_sheet:vi.fn(rows => ({ rows })), book_append_sheet:vi.fn(), }, writeFile:vi.fn() }))
const rpc = vi.fn()
vi.mock('./supabase', () => ({ db:() => ({ rpc }), supabase:{} }))

describe('exportación del maestro', () => {
  it('descarga detalle por código y fuentes en dos hojas', async () => {
    const xlsx = await import('xlsx')
    const product = { id:'p1', name:'Mayonesa', brand:'Dánica', updated_at:'2026-09-07T12:00:00Z', barcodes:[{ barcode:'17791620187218', barcode_type:'GTIN-14', packaging_level:'case', presentation_id:'pr1' }], presentations:[{ id:'pr1', presentation:'192 sobres x 8 g', net_quantity:8, net_unit:'g', units_per_package:192 }], sources:[{ provider:'Precialo', source_url:'https://precialo.com.ar/p/demo', retrieved_at:'2026-09-07T12:00:00Z' }] }
    rpc.mockResolvedValueOnce({ data:[product], error:null }).mockResolvedValueOnce({ data:[], error:null })
    await downloadProductsXlsx()
    expect(xlsx.utils.json_to_sheet).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ 'Código de barras':'17791620187218', 'Unidades por caja/bulto':192 })]))
    expect(xlsx.utils.json_to_sheet).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ Proveedor:'Precialo' })]))
    expect(xlsx.writeFile).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/maestro-articulos-.*\.xlsx$/), { bookType:'xlsx' })
  })
})
