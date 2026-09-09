import { describe, expect, it, vi } from 'vitest'
import { lookupSepa, normalizeSepaCatalogRow, parseSepaPresentation, sepaProductFromRow, validSepaBarcode } from '../../server/sepaProvider'

describe('catálogo SEPA', () => {
  const raw={ id_comercio:'60',id_producto:'7791620187211',productos_ean:'1',id_dun_14:'17791620187218',productos_descripcion:'Mayonesa DANICA caja x 192 sobres x 8 gr',productos_marca:'DANICA',unidad_venta:'192' }
  const commerce={ comercio_bandera_nombre:'Mayorista',comercio_ultima_actualizacion:'2026-09-06T05:19:36-03:00' }
  it('valida códigos y extrae presentación sin convertir IDs internos en GTIN', () => {
    expect(validSepaBarcode('17791620187218')).toBe('17791620187218')
    expect(validSepaBarcode('00000000000000')).toBeNull()
    expect(parseSepaPresentation('Aceite ARCOR x 900ml')).toMatchObject({ net_quantity:900,net_unit:'ml' })
    expect(normalizeSepaCatalogRow({ ...raw,productos_ean:'0' },commerce,'archivo').ean).toBeNull()
  })
  it('relaciona la unidad y la caja del mismo producto', () => {
    const row=normalizeSepaCatalogRow(raw,commerce,'archivo')
    const unit=sepaProductFromRow(row,'7791620187211')
    expect(unit).toMatchObject({ barcode:'7791620187211',packaging_level:'unit',source:{ source_code:'SEPA_WHOLESALE',confidence:0.9 } })
    expect(unit.related_barcodes[0]).toMatchObject({ barcode:'17791620187218',packaging_level:'case',units_per_package:192 })
    expect(sepaProductFromRow(row,'17791620187218').related_barcodes[0]).toMatchObject({ barcode:'7791620187211',packaging_level:'unit' })
  })
  it('consulta el RPC autenticado del catálogo', async () => {
    const fetchImpl=vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...normalizeSepaCatalogRow(raw,commerce,'archivo'),matched_level:'unit' })))
    const product=await lookupSepa('7791620187211',{ url:'https://example.supabase.co',key:'anon',authorization:'Bearer jwt',fetchImpl })
    expect(product.name).toContain('Mayonesa')
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt')
  })
})
