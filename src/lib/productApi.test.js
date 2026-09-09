// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../../api/product-resolver'
function response() { return { setHeader:vi.fn(), status:vi.fn().mockReturnThis(), json:vi.fn().mockReturnThis() } }
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('API autenticada de artículos', () => {
  it('rechaza método inválido', async () => {
    const res = response(); await handler({ method:'GET' }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })
  it('no consulta proveedores sin sesión', async () => {
    vi.stubEnv('VITE_SUPABASE_URL','https://mixyhfdlzjarvszinytk.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY','test')
    const fetchMock = vi.fn(); vi.stubGlobal('fetch',fetchMock)
    const res=response(); await handler({ method:'POST', headers:{}, body:{ barcode:'012345678905' } },res)
    expect(res.status).toHaveBeenCalledWith(401); expect(fetchMock).not.toHaveBeenCalled()
  })
  it('no consulta proveedores con perfil sin acceso', async () => {
    vi.stubEnv('VITE_SUPABASE_URL','https://mixyhfdlzjarvszinytk.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY','test')
    const fetchMock=vi.fn().mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response('false')); vi.stubGlobal('fetch',fetchMock)
    const res=response(); await handler({ method:'POST',headers:{ authorization:'Bearer test' },body:{ barcode:'012345678905' } },res)
    expect(res.status).toHaveBeenCalledWith(403); expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('devuelve SEPA antes de consultar fuentes públicas', async () => {
    vi.stubEnv('VITE_SUPABASE_URL','https://mixyhfdlzjarvszinytk.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY','test')
    const row={ ean:'7791620187211',package_barcode:'17791620187218',name:'Mayonesa Dánica',brand:'Dánica',presentation:'Caja x 192 sobres x 8 g',net_quantity:8,net_unit:'g',units_per_package:192,source_dataset:'sepa-prueba',source_commerce_id:'60',source_product_id:'7791620187211' }
    const fetchMock=vi.fn().mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response('true')).mockResolvedValueOnce(new Response(JSON.stringify(row)))
    vi.stubGlobal('fetch',fetchMock)
    const res=response(); await handler({ method:'POST',headers:{ authorization:'Bearer test' },body:{ barcode:'7791620187211' } },res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ product:expect.objectContaining({ name:'Mayonesa Dánica',packaging_level:'unit' }) }))
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
