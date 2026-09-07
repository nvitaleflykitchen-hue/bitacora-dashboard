import { safeImageUrl } from '../src/lib/productBarcode.js'

export const PRODUCT_PROVIDERS = [
  { name:'Open Food Facts', host:'world.openfoodfacts.org' },
  { name:'Open Products Facts', host:'world.openproductsfacts.org' },
  { name:'Open Beauty Facts', host:'world.openbeautyfacts.org' },
]
const fields = 'code,product_name,product_name_es,generic_name,generic_name_es,brands,categories,quantity,product_quantity,product_quantity_unit,image_front_url,ingredients_text,ingredients_text_es,allergens,origins,nutriments,nutrition_data_per,serving_size,last_modified_t'
const str = v => typeof v === 'string' ? v.slice(0, 20000) : ''

export function normalizeFacts(product, provider, barcode, now = new Date().toISOString()) {
  if (!product || typeof product !== 'object' || !str(product.product_name_es || product.product_name).trim()) return null
  // Do not map selling countries to origin or brand to manufacturer.
  // Quantity is kept as the provider's label; contained-unit quantities require review.
  const nutrition = Object.entries(product.nutriments || {}).filter(([key, value]) =>
    (key.endsWith('_100g') || key.endsWith('_serving')) && typeof value === 'number' && Number.isFinite(value)
  ).map(([key, value]) => `${key}: ${value} ${str(product.nutriments[key.replace(/_(100g|serving)$/, '_unit')])}`.trim()).join('\n')
  return {
    barcode, name:str(product.product_name_es || product.product_name),
    description:str(product.generic_name_es || product.generic_name), brand:str(product.brands),
    manufacturer:'', category:str(product.categories), subcategory:'',
    image_url:safeImageUrl(product.image_front_url), ingredients:str(product.ingredients_text_es || product.ingredients_text),
    allergens:str(product.allergens), country_of_origin:str(product.origins),
    nutrition_text:nutrition ? `Base informada: ${str(product.nutrition_data_per) || 'ver etiqueta'}. Porción: ${str(product.serving_size) || 'sin dato'}.\n${nutrition}` : '',
    presentation:str(product.quantity), packaging_level:'unknown', net_quantity:'', net_unit:'', units_per_package:'',
    source:{ provider:provider.name, source_url:`https://${provider.host}/product/${barcode}`,
      raw_metadata:product, retrieved_at:now, license:'ODbL (datos), CC BY-SA (imágenes)' },
  }
}

export async function resolveExternal(barcode, { fetchImpl = fetch, providers = PRODUCT_PROVIDERS } = {}) {
  const warnings = []
  for (const provider of providers) {
    try {
      const response = await fetchImpl(`https://${provider.host}/api/v2/product/${barcode}.json?fields=${fields}`, {
        headers:{ 'User-Agent':'FlyGestion-ProductResolver/1.0 (https://github.com/nvitaleflykitchen-hue/bitacora-dashboard)', Accept:'application/json' },
        signal:AbortSignal.timeout(6000), redirect:'error',
      })
      if (response.status === 404) continue
      if (!response.ok) throw new Error('Proveedor no disponible')
      const raw = await response.text()
      if (raw.length > 500000) throw new Error('Respuesta demasiado grande')
      const body = JSON.parse(raw)
      if (Number(body.status) === 0) continue
      // A provider must return this exact GTIN (leading zero padding is equivalent).
      const returned = String(body.code || body.product?.code || '')
      if (!/^\d{8,14}$/.test(returned) || returned.padStart(14, '0') !== barcode.padStart(14, '0')) throw new Error('Código diferente')
      const product = normalizeFacts(body.product, provider, barcode)
      if (product) return { product, warnings }
    } catch {
      warnings.push(`${provider.name}: consulta no disponible. No se confirmó si el producto existe en esta fuente.`)
    }
  }
  return { product:null, warnings }
}
