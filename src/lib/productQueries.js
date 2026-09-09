import { db, supabase } from './supabase'
import { ProductResolver } from './ProductResolver'
import { normalizeBarcode, safeImageUrl } from './productBarcode'
import * as XLSX from 'xlsx'

export async function findProduct(barcode, { signal } = {}) {
  let query = db().from('product_barcodes').select('*').eq('gtin_key', normalizeBarcode(barcode).padStart(14, '0')).maybeSingle()
  if (signal) query = query.abortSignal(signal)
  const { data:code, error } = await query
  if (error) throw new Error(`No se pudo consultar el maestro local: ${error.message}`)
  if (!code) return null
  const results = await Promise.all([
    db().from('products').select('*').eq('id', code.product_id).single(),
    db().from('product_presentations').select('*').eq('id', code.presentation_id).single(),
    db().from('product_sources').select('*').eq('product_id', code.product_id).order('recorded_at', { ascending:false }).limit(20),
    db().from('product_barcodes').select('*').eq('product_id', code.product_id).order('created_at'),
    db().from('product_presentations').select('*').eq('product_id', code.product_id).order('created_at'),
  ])
  for (const result of results) if (result.error) throw result.error
  const [product, presentation, sources, barcodes, presentations] = results.map(r => r.data)
  return { ...product, ...presentation, ...code, product_id:product.id, expected_updated_at:product.updated_at,
    updated_at:product.updated_at, sources, barcodes, presentations,
    related_barcodes:barcodes.filter(item => item.id !== code.id).map(item => {
      const relatedPresentation = presentations.find(value => value.id === item.presentation_id) || {}
      return { ...relatedPresentation, ...item }
    }), source:null }
}

export const productResolver = new ProductResolver({ findLocal:findProduct, providers:[{
  name:'Fuentes externas',
  async lookup(barcode, { signal }) {
    const { data:{ session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Sesión vencida')
    const response = await fetch('/api/product-resolver', {
      method:'POST', signal, headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}` },
      body:JSON.stringify({ barcode }),
    })
    if (!response.ok) throw new Error('No se pudieron consultar las fuentes externas')
    return response.json()
  },
}] })

export async function enrichProduct(barcode, { signal, sourceUrl = '' } = {}) {
  const { data:{ session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sesión vencida')
  const response = await fetch('/api/product-resolver', {
    method:'POST', signal, headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}` },
    body:JSON.stringify({ barcode:normalizeBarcode(barcode), enrich:true, sourceUrl:sourceUrl.trim() }),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => ({}))
    throw new Error(result.error || 'No se pudieron consultar las fuentes adicionales.')
  }
  return response.json()
}

export async function searchProducts(termino, pagina = 0) {
  const { data, error } = await db().rpc('buscar_articulos', { termino:termino.slice(0,200), pagina })
  if (error) throw error
  return data || []
}

export async function downloadProductsXlsx(termino = '') {
  const all = []
  for (let page = 0; page < 100000; page += 1) {
    const rows = await searchProducts(termino, page)
    all.push(...rows)
    if (rows.length < 30) break
  }
  const detail = all.flatMap(product => (product.barcodes?.length ? product.barcodes : [{ barcode:'' }]).map(code => {
    const presentation = product.presentations?.find(item => item.id === code.presentation_id) || product.presentations?.[0] || {}
    return {
      'ID producto':product.id, 'Código de barras':String(code.barcode || ''), 'Tipo de código':code.barcode_type || '',
      'Nivel de empaque':code.packaging_level || '', 'Nombre':product.name || '', 'Descripción':product.description || '',
      'Marca':product.brand || '', 'Fabricante':product.manufacturer || '', 'Categoría':product.category || '',
      'Subcategoría':product.subcategory || '', 'Presentación':presentation.presentation || '',
      'Contenido unitario':presentation.net_quantity ?? '', 'Unidad':presentation.net_unit || '',
      'Unidades por caja/bulto':presentation.units_per_package ?? '', 'Imagen':product.image_url || '',
      'Ingredientes':product.ingredients || '', 'Alérgenos':product.allergens || '',
      'Información nutricional':product.nutrition_text || '', 'País de origen':product.country_of_origin || '',
      'Estado de verificación':product.status || '', 'RNE':product.rne || '', 'RNPA':product.rnpa || '',
      'Condiciones de conservación':product.storage_conditions || '',
      'Actualizado':product.updated_at || '',
    }
  }))
  const sources = all.flatMap(product => (product.sources || []).map(source => ({
    'ID producto':product.id, 'Proveedor':source.provider || '', 'URL fuente':source.source_url || '',
    'Código de fuente':source.source_code || '', 'Referencia':source.source_reference || '',
    'Confianza':source.confidence ?? '', 'Verificado':source.verified ?? '',
    'Consultado':source.retrieved_at || '', 'Registrado':source.recorded_at || '',
  })))
  const book = XLSX.utils.book_new()
  const articlesSheet = XLSX.utils.json_to_sheet(detail)
  const sourcesSheet = XLSX.utils.json_to_sheet(sources)
  articlesSheet['!cols'] = [12,18,12,16,28,30,18,22,20,20,18,24,14,12,20,42,35,24,35,28,22].map(w => ({ wch:w }))
  sourcesSheet['!cols'] = [{wch:40},{wch:24},{wch:60},{wch:24},{wch:24}]
  XLSX.utils.book_append_sheet(book, articlesSheet, 'Artículos')
  XLSX.utils.book_append_sheet(book, sourcesSheet, 'Fuentes')
  const stamp = new Date().toISOString().slice(0,10)
  XLSX.writeFile(book, `maestro-articulos-${stamp}.xlsx`, { bookType:'xlsx' })
  return { count:detail.length, sources:sources.length }
}

export function validateProduct(form) {
  normalizeBarcode(form.barcode)
  if (!form.name?.trim()) throw new Error('Completá el nombre del artículo.')
  if (form.name.trim().length > 500) throw new Error('El nombre no puede superar 500 caracteres.')
  if (form.image_url && !safeImageUrl(form.image_url)) throw new Error('La imagen debe tener una dirección HTTPS válida.')
  if (form.net_quantity !== '' && form.net_quantity != null && (!Number.isFinite(Number(form.net_quantity)) || Number(form.net_quantity) <= 0)) throw new Error('El contenido unitario debe ser mayor que cero.')
  if (form.units_per_package !== '' && form.units_per_package != null && (!Number.isInteger(Number(form.units_per_package)) || Number(form.units_per_package) <= 0)) throw new Error('Las unidades por bulto deben ser un entero mayor que cero.')
  if (form.net_quantity && !form.net_unit) throw new Error('Indicá la unidad del contenido.')
  return form
}

export async function saveProduct(form) {
  validateProduct(form)
  const fields = ['product_id','expected_updated_at','barcode','name','description','brand','manufacturer','category','subcategory','image_url','ingredients','allergens','nutrition_text','country_of_origin','presentation','net_quantity','net_unit','units_per_package','packaging_level','supplier_id','rne','rnpa','storage_conditions','related_barcodes','source']
  const payload = Object.fromEntries(fields.map(key => [key, form[key] ?? null]))
  payload.status = form.status === 'inactive' ? 'inactive' : 'verified'
  const { data, error } = await db().rpc('guardar_articulo', { payload })
  if (error) throw error
  const recorded = form.source || { provider:'Carga manual', retrieved_at:data.updated_at }
  return { ...form, ...data, status:payload.status, expected_updated_at:data.updated_at, source:null, sources:[recorded, ...(form.sources || [])].slice(0,20) }
}

export async function recordBarcodeSearch({ barcode, found, sourceCode, durationMs, errorMessage = '' }) {
  const payload = { barcode:normalizeBarcode(barcode), found:Boolean(found), source_code:sourceCode || 'UNKNOWN',
    duration_ms:Math.max(0,Math.round(Number(durationMs) || 0)), error_message:String(errorMessage || '').slice(0,1000) }
  const { error } = await db().rpc('registrar_busqueda_articulo', { payload })
  if (error) throw error
}
