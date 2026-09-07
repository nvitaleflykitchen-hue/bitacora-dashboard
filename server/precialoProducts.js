import { load } from 'cheerio'
import { safeImageUrl } from '../src/lib/productBarcode.js'
import { parsePresentation } from './productNormalization.js'

// Verified discovery references, not hardcoded product data. Every lookup must
// fetch the current page and match the code in that product's own attributes.
const references = {
  '17791620187218':'https://precialo.com.ar/p/mayonesa-danica-sch-192-u-8-g',
}
export function precialoUrl(value) {
  const url = new URL(value)
  if (url.origin !== 'https://precialo.com.ar' || !/^\/p\/[a-z0-9-]+\/?$/.test(url.pathname) || url.username || url.password || url.search || url.hash) throw new Error('Usá un enlace de ficha https://precialo.com.ar/p/...')
  return url.href
}
export function parsePrecialo(html, barcode, sourceUrl) {
  const $ = load(html)
  const documents = []
  $('script[type="application/ld+json"]').each((_, el) => {
    try { const data = JSON.parse($(el).text()); documents.push(...(Array.isArray(data) ? data : data['@graph'] || [data])) } catch { /* malformed structured data */ }
  })
  const product = documents.find(d => d['@type'] === 'Product')
  if (!product?.name) return null
  const attributes = $('p').filter((_,el) => $(el).text().trim() === 'MultipleEan').parent().next().text()
  const codes = [...attributes.matchAll(/(?<!\d)\d{8,14}(?!\d)/g)].map(m => m[0])
  for (const key of ['gtin','gtin8','gtin12','gtin13','gtin14']) if (product[key]) codes.push(String(product[key]))
  if (!codes.includes(barcode)) return null
  const crumbs = documents.find(d => d['@type'] === 'BreadcrumbList')?.itemListElement || []
  const packaging = parsePresentation(product.name, barcode)
  return {
    barcode, name:product.name, description:product.description || '',
    brand:typeof product.brand === 'string' ? product.brand : product.brand?.name || '',
    manufacturer:typeof product.manufacturer === 'string' ? product.manufacturer : product.manufacturer?.name || '',
    category:crumbs.at(-2)?.name || crumbs.at(-1)?.name || '', subcategory:crumbs.length > 1 ? crumbs.at(-1)?.name || '' : '',
    image_url:safeImageUrl(Array.isArray(product.image) ? product.image[0] : product.image),
    presentation:packaging.units_per_package ? `${packaging.units_per_package} unidades de ${packaging.net_quantity} ${packaging.net_unit}` : '',
    ...packaging,
    source:{ provider:'Precialo', source_url:precialoUrl(sourceUrl), retrieved_at:new Date().toISOString(),
      raw_metadata:{ product, listed_codes:codes, breadcrumbs:crumbs, matched_barcode:barcode } },
  }
}
export async function lookupPrecialo(barcode, { sourceUrl, fetchImpl = fetch } = {}) {
  const reference = sourceUrl || references[barcode]
  if (!reference) return { product:null, warnings:[] }
  const url = precialoUrl(reference)
  try {
    const response = await fetchImpl(url, { redirect:'error', signal:AbortSignal.timeout(6000), headers:{ 'User-Agent':'FlyGestion-ProductResolver/1.1', Accept:'text/html' } })
    if (!response.ok) throw new Error('Fuente no disponible')
    const html = await response.text()
    if (html.length > 2000000) throw new Error('Respuesta demasiado grande')
    const product = parsePrecialo(html, barcode, url)
    return { product, warnings:product ? [] : ['Precialo: la ficha no confirma este código exacto. No se importaron datos.'] }
  } catch { return { product:null, warnings:['Precialo: no se pudo consultar la ficha. Reintentá más tarde.'] } }
}
