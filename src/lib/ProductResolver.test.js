import { describe, it, expect, vi } from 'vitest'
import { ProductResolver } from './ProductResolver'
import { normalizeBarcode, barcodeType, validCheckDigit } from './productBarcode'
import { normalizeFacts, resolveExternal } from '../../server/productProviders'

describe('relevamiento de productos', () => {
  it('conserva ceros iniciales y tipos GTIN sin inferir contenido', () => {
    expect(normalizeBarcode(' 012345678905 ')).toBe('012345678905')
    expect(barcodeType('17791620187218')).toBe('GTIN-14')
    expect(validCheckDigit('3017620422003')).toBe(true)
    expect(validCheckDigit('3017620422004')).toBe(false)
    expect(() => normalizeBarcode(12345678)).toThrow()
    expect(() => normalizeBarcode('123 45678')).toThrow()
  })
  it('evita llamadas externas cuando el código ya está guardado', async () => {
    const lookup = vi.fn()
    const resolver = new ProductResolver({ findLocal:vi.fn().mockResolvedValue({ name:'Guardado' }), providers:[{ lookup }] })
    expect((await resolver.resolve('012345678905')).origin).toBe('local')
    expect(lookup).not.toHaveBeenCalled()
  })
  it('no confunde un error local con producto desconocido', async () => {
    const lookup = vi.fn()
    const resolver = new ProductResolver({ findLocal:vi.fn().mockRejectedValue(new Error('Sin conexión')), providers:[{ lookup }] })
    await expect(resolver.resolve('012345678905')).rejects.toThrow('Sin conexión')
    expect(lookup).not.toHaveBeenCalled()
  })
  it('continúa ante fuente vacía o caída, conservando advertencias', async () => {
    const resolver = new ProductResolver({ findLocal:async () => null, providers:[
      { name:'Una', lookup:async () => { throw new Error('caída') } },
      { name:'Dos', lookup:async () => ({ product:null }) },
      { name:'Tres', lookup:async () => ({ product:{ name:'Encontrado' } }) },
    ] })
    const result = await resolver.resolve('012345678905')
    expect(result.product.name).toBe('Encontrado'); expect(result.warnings).toHaveLength(1)
  })
  it('deja desconocidos sin resultados inventados', async () => {
    const resolver = new ProductResolver({ findLocal:async () => null, providers:[{ lookup:async () => null }] })
    expect(await resolver.resolve('012345678905')).toMatchObject({ product:null, origin:'unknown' })
  })
  it('no inventa fabricante, origen ni unidades del bulto', () => {
    const result = normalizeFacts({ product_name:'Mayonesa', brands:'Dánica', countries:'Argentina', quantity:'192 x 8 g', product_quantity:1536 }, { name:'Prueba', host:'example.com' }, '17791620187218')
    expect(result).toMatchObject({ manufacturer:'', country_of_origin:'', net_quantity:'', units_per_package:'', packaging_level:'unknown', presentation:'192 x 8 g' })
    expect(result.source.raw_metadata.product_quantity).toBe(1536)
  })
  it('el adaptador rechaza productos con otro código y prueba el siguiente', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ status:1, code:'99999999', product:{ product_name:'Ajeno' } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status:1, code:'012345678905', product:{ product_name:'Correcto' } })))
    const result = await resolveExternal('012345678905', { fetchImpl, providers:[{ name:'A',host:'a.test' },{ name:'B',host:'b.test' }] })
    expect(result.product.name).toBe('Correcto'); expect(result.warnings).toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
