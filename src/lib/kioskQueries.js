import { db } from './supabase'

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

export async function listKioskCatalog(sedeId, term = '') {
  return unwrap(await db().rpc('kiosco_catalogo', {
    target_sede_id:Number(sedeId), termino:String(term || '').slice(0,200),
  })) || []
}

export async function getKioskIndicators(sedeId) {
  return unwrap(await db().rpc('kiosco_indicadores', { target_sede_id:Number(sedeId) })) || {}
}

export async function confirmReceipt({ sedeId, items, observation = '', reference = '', idempotencyKey = crypto.randomUUID() }) {
  return unwrap(await db().rpc('confirmar_reposicion', {
    payload:{ sede_id:Number(sedeId), items, observation, reference },
    idempotency_key:idempotencyKey,
  }))
}

export async function startInventoryCount(sedeId, observation = '') {
  return unwrap(await db().rpc('iniciar_relevamiento', {
    target_sede_id:Number(sedeId), observacion:observation,
  }))
}

export async function saveInventoryCountLine({ countId, presentationId, physicalQuantity, barcode = '' }) {
  return unwrap(await db().rpc('guardar_linea_relevamiento', {
    target_count_id:countId,
    target_presentation_id:presentationId,
    cantidad_fisica:Number(physicalQuantity),
    codigo:barcode || null,
  }))
}

export async function finalizeInventoryCount(countId, idempotencyKey = crypto.randomUUID()) {
  return unwrap(await db().rpc('finalizar_relevamiento', {
    target_count_id:countId, idempotency_key:idempotencyKey,
  }))
}

export async function confirmSale({ sedeId, items, paymentMethod, received, idempotencyKey = crypto.randomUUID() }) {
  return unwrap(await db().rpc('confirmar_venta', {
    payload:{ sede_id:Number(sedeId), items, payment_method:paymentMethod, received },
    idempotency_key:idempotencyKey,
  }))
}

export async function annulSale(saleId, reason, idempotencyKey = crypto.randomUUID()) {
  return unwrap(await db().rpc('anular_venta', {
    target_sale_id:saleId, motivo:reason, idempotency_key:idempotencyKey,
  }))
}

export async function listSales(sedeId, from, to) {
  return unwrap(await db().rpc('kiosco_ventas', {
    target_sede_id:Number(sedeId), desde:from, hasta:to,
  })) || []
}

export async function getSaleDetail(saleId) {
  return unwrap(await db().rpc('kiosco_venta_detalle', { target_sale_id:saleId }))
}

export async function listReceipts(sedeId, limit = 100) {
  return unwrap(await db().rpc('kiosco_reposiciones', { target_sede_id:Number(sedeId), limite:limit })) || []
}

export async function listInventoryCounts(sedeId, limit = 100) {
  return unwrap(await db().rpc('kiosco_relevamientos', { target_sede_id:Number(sedeId), limite:limit })) || []
}

export async function listInventoryMovements(sedeId, term = '', limit = 200) {
  return unwrap(await db().rpc('kiosco_movimientos', {
    target_sede_id:Number(sedeId), termino:String(term || '').slice(0,200), limite:limit,
  })) || []
}

export function money(value, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', { style:'currency', currency, maximumFractionDigits:2 }).format(Number(value) || 0)
}

export function localDate(value) {
  return value ? new Date(value).toLocaleString('es-AR') : '—'
}
