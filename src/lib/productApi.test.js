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
})
