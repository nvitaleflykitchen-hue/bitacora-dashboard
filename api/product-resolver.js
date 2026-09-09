import { normalizeBarcode } from '../src/lib/productBarcode.js'
import { resolveExternal } from '../server/productProviders.js'
import { precialoUrl } from '../server/precialoProducts.js'
import { lookupSepa } from '../server/sepaProvider.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error:'Método no permitido' }) }
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  let configured = false
  try { configured = !!key && new URL(url).origin === 'https://mixyhfdlzjarvszinytk.supabase.co' } catch { /* invalid environment */ }
  if (!configured) return res.status(503).json({ error:'Resolución externa no configurada' })
  const authorization = req.headers.authorization || ''
  if (!authorization.startsWith('Bearer ')) return res.status(401).json({ error:'Iniciá sesión' })
  let barcode, sourceUrl
  try {
    barcode = normalizeBarcode(req.body?.barcode)
    if (req.body?.sourceUrl) sourceUrl = precialoUrl(req.body.sourceUrl)
  } catch (error) { return res.status(400).json({ error:error.message }) }
  try {
    // Verifies the caller with Supabase; never forwards their JWT to external providers.
    const userResponse = await fetch(`${url}/auth/v1/user`, {
      headers:{ apikey:key, Authorization:authorization }, signal:AbortSignal.timeout(5000),
    })
    if (!userResponse.ok) return res.status(401).json({ error:'Sesión vencida' })
    const access = await fetch(`${url}/rest/v1/rpc/articulos_puede_acceder`, {
      method:'POST', headers:{ apikey:key, Authorization:authorization, 'Content-Type':'application/json', 'Content-Profile':'bitacora' },
      body:JSON.stringify({ escritura:false }), signal:AbortSignal.timeout(5000),
    })
    if (!access.ok || await access.json() !== true) return res.status(403).json({ error:'Sin acceso al maestro de artículos' })
    let sepaProduct = null, sepaWarnings = []
    try { sepaProduct = await lookupSepa(barcode, { url, key, authorization }) }
    catch { sepaWarnings = ['SEPA mayorista: catálogo no disponible. Se continuó con las fuentes públicas.'] }
    if (req.body?.enrich === true) {
      const external = await resolveExternal(barcode, { enrich:true, sourceUrl })
      return res.status(200).json({ ...external, products:[...(sepaProduct ? [sepaProduct] : []), ...(external.products || [])], warnings:[...sepaWarnings,...(external.warnings || [])] })
    }
    if (sepaProduct) return res.status(200).json({ product:sepaProduct, warnings:[] })
    const external = await resolveExternal(barcode, { sourceUrl })
    return res.status(200).json({ ...external, warnings:[...sepaWarnings,...(external.warnings || [])] })
  } catch { return res.status(503).json({ error:'No se pudo consultar. Reintentá o completá el artículo manualmente.' }) }
}
