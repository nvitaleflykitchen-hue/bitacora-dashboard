import { normalizeBarcode, validCheckDigit } from '../src/lib/productBarcode.js'

const gtinKey = code => String(code || '').padStart(14, '0')
const clean = value => String(value || '').replace(/\s+/g, ' ').trim()

export function validSepaBarcode(value) {
  const raw = clean(value)
  if (!raw || /^0+$/.test(raw)) return null
  try {
    const code = normalizeBarcode(raw)
    return validCheckDigit(code) ? code : null
  } catch { return null }
}

export function parseSepaPresentation(description) {
  const text = clean(description)
  const matches = [...text.matchAll(/(?:^|\s)(?:x|por)\s*(\d+(?:[.,]\d+)?)\s*(kg|kgr?|gr?|mg|ml|cc|l|lt)(?=\b|\s|$)/gi)]
  const match = matches.at(-1)
  if (!match) return { presentation:text, net_quantity:null, net_unit:null }
  const units = { k:'kg', kgr:'kg', gr:'g', cc:'ml', lt:'l' }
  return { presentation:text, net_quantity:Number(match[1].replace(',','.')), net_unit:units[match[2].toLowerCase()] || match[2].toLowerCase() }
}

export function normalizeSepaCatalogRow(row, commerce = {}, sourceDataset = '') {
  const ean = String(row.productos_ean || '') === '1' ? validSepaBarcode(row.id_producto) : null
  const packageBarcode = validSepaBarcode(row.id_dun_14)
  if (!ean && !packageBarcode) return null
  const description = clean(row.productos_descripcion)
  if (!description) return null
  const parsed = parseSepaPresentation(description)
  const units = Number(row.unidad_venta)
  return {
    source_dataset:clean(sourceDataset), source_commerce_id:clean(row.id_comercio || commerce.id_comercio),
    source_product_id:clean(row.id_producto), commerce_name:clean(commerce.comercio_bandera_nombre || commerce.comercio_razon_social),
    ean, package_barcode:packageBarcode, name:description, brand:clean(row.productos_marca),
    ...parsed, units_per_package:Number.isInteger(units) && units > 1 ? units : null,
    dataset_updated_at:commerce.comercio_ultima_actualizacion || null,
    raw_metadata:{ id_bandera:row.id_bandera || null, source_schema:'SEPA mayorista', comercio_version_sepa:commerce.comercio_version_sepa || null },
  }
}

export function sepaProductFromRow(row, barcode) {
  if (!row) return null
  const scanned = normalizeBarcode(barcode)
  const isUnit = row.ean && gtinKey(row.ean) === gtinKey(scanned)
  const mainLevel = isUnit ? 'unit' : 'case'
  const related = []
  if (row.ean && gtinKey(row.ean) !== gtinKey(scanned)) related.push({
    barcode:row.ean, packaging_level:'unit', presentation:row.presentation,
    net_quantity:row.net_quantity, net_unit:row.net_unit, units_per_package:null,
  })
  if (row.package_barcode && gtinKey(row.package_barcode) !== gtinKey(scanned)) related.push({
    barcode:row.package_barcode, packaging_level:'case', presentation:row.presentation,
    net_quantity:row.net_quantity, net_unit:row.net_unit, units_per_package:row.units_per_package,
  })
  return {
    barcode:scanned, name:row.name, brand:row.brand || '', presentation:row.presentation || row.name,
    net_quantity:row.net_quantity ?? '', net_unit:row.net_unit || '',
    units_per_package:isUnit ? '' : (row.units_per_package ?? ''), packaging_level:mainLevel,
    status:'pending', related_barcodes:related,
    source:{ provider:'SEPA / Precios Claros mayorista', source_code:'SEPA_WHOLESALE',
      source_reference:`${row.source_dataset}:${row.source_commerce_id}:${row.source_product_id}`,
      confidence:0.9, verified:false, retrieved_at:row.dataset_updated_at || row.imported_at || new Date().toISOString(),
      raw_metadata:{ dataset:row.source_dataset, commerce:row.commerce_name, related_codes:[row.ean,row.package_barcode].filter(Boolean) } },
  }
}

export async function lookupSepa(barcode, { url, key, authorization, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`${url}/rest/v1/rpc/buscar_producto_sepa`, {
    method:'POST', headers:{ apikey:key, Authorization:authorization, 'Content-Type':'application/json', 'Content-Profile':'bitacora' },
    body:JSON.stringify({ codigo:normalizeBarcode(barcode) }), signal:AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error('No se pudo consultar el catálogo SEPA')
  return sepaProductFromRow(await response.json(), barcode)
}
