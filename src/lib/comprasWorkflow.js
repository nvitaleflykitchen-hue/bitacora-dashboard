import { db, supabase } from './supabase'
import { deleteAdjunto, uploadAdjunto } from './adjuntos'

export const purchaseTrackingUrl = token => `${window.location.origin}/?compra=${encodeURIComponent(token)}`

export function parsePurchaseTrackingValue(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (tokenPattern.test(raw)) return raw
  try {
    const url = new URL(raw, window.location.origin)
    const token = url.searchParams.get('compra')
    return tokenPattern.test(token || '') ? token : null
  } catch {
    return null
  }
}

function dataUrlBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1] || ''
  const binary = window.atob(base64)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

export async function stampPurchaseOrderPdf(file, trackingToken) {
  if (file?.type !== 'application/pdf' && !String(file?.name || '').toLowerCase().endsWith('.pdf')) {
    throw new Error('La orden de compra debe ser un archivo PDF.')
  }
  const [{ default:QRCode }, { PDFDocument, rgb }] = await Promise.all([import('qrcode'), import('pdf-lib')])
  const pdf = await PDFDocument.load(await file.arrayBuffer())
  const pages = pdf.getPages()
  if (!pages.length) throw new Error('El PDF no tiene páginas.')
  const page = pages[pages.length - 1]
  const { width, height } = page.getSize()
  const qrDataUrl = await QRCode.toDataURL(purchaseTrackingUrl(trackingToken), {
    width:700, margin:1, errorCorrectionLevel:'H', color:{ dark:'#000000', light:'#ffffff' },
  })
  const qr = await pdf.embedPng(dataUrlBytes(qrDataUrl))
  const size = Math.min(62, width * 0.115)
  const x = width - size - 24
  const y = Math.min(Math.max(158, height * 0.19), height - size - 24)
  page.drawRectangle({ x:x - 5, y:y - 5, width:size + 10, height:size + 10, color:rgb(1,1,1) })
  page.drawImage(qr, { x, y, width:size, height:size })
  const bytes = await pdf.save()
  const base = String(file.name || 'orden-de-compra.pdf').replace(/\.pdf$/i, '')
  return new File([bytes], `${base}_con_QR.pdf`, { type:'application/pdf', lastModified:Date.now() })
}

export async function getComprasProveedores({ includeInactive = false } = {}) {
  let query = db().from('compras_proveedores').select('*').order('razon_social')
  if (!includeInactive) query = query.eq('activo', true)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function saveComprasProveedor(payload, userId) {
  const clean = {
    razon_social:String(payload.razon_social || '').trim(),
    nombre_fantasia:String(payload.nombre_fantasia || '').trim() || null,
    cuit:String(payload.cuit || '').trim() || null,
    codigo:String(payload.codigo || '').trim() || null,
    contacto_nombre:String(payload.contacto_nombre || '').trim() || null,
    telefono:String(payload.telefono || '').trim() || null,
    whatsapp:String(payload.whatsapp || '').trim() || null,
    email:String(payload.email || '').trim() || null,
    direccion:String(payload.direccion || '').trim() || null,
    localidad:String(payload.localidad || '').trim() || null,
    provincia:String(payload.provincia || '').trim() || null,
    codigo_postal:String(payload.codigo_postal || '').trim() || null,
    condicion_iva:String(payload.condicion_iva || '').trim() || null,
    condicion_compra:String(payload.condicion_compra || '').trim() || null,
    notas:String(payload.notas || '').trim() || null,
    activo:payload.activo !== false,
    updated_by:userId,
    updated_at:new Date().toISOString(),
  }
  if (!clean.razon_social) throw new Error('La razón social es obligatoria.')
  const query = payload.id
    ? db().from('compras_proveedores').update(clean).eq('id', payload.id)
    : db().from('compras_proveedores').insert({ ...clean, created_by:userId })
  const { data, error } = await query.select().single()
  if (error) throw error
  return data
}

export async function aprobarRequerimientoCompra(id) {
  const { data, error } = await supabase.schema('bitacora').rpc('aprobar_requerimiento_compra', { p_requerimiento_id:id })
  if (error) throw error
  return data
}

export async function cargarOrdenCompra({ requerimiento, proveedorId, numero, fechaEstimada, notas, file, uploadedBy }) {
  if (!requerimiento?.seguimiento_token) throw new Error('El pedido todavía no tiene código de seguimiento.')
  if (!proveedorId) throw new Error('Seleccioná el proveedor.')
  const processed = await stampPurchaseOrderPdf(file, requerimiento.seguimiento_token)
  const attachment = await uploadAdjunto('orden_compra', requerimiento.id, processed, uploadedBy)
  try {
    const { data, error } = await supabase.schema('bitacora').rpc('registrar_orden_compra', {
      p_requerimiento_id:requerimiento.id,
      p_proveedor_id:proveedorId,
      p_adjunto_id:attachment.id,
      p_url:attachment.url,
      p_nombre:attachment.nombre,
      p_storage_path:attachment.storage_path,
      p_numero:String(numero || '').trim() || null,
      p_fecha_estimada:fechaEstimada || null,
      p_notas:String(notas || '').trim() || null,
    })
    if (error) throw error
    return data
  } catch (error) {
    await deleteAdjunto(attachment).catch(()=>{})
    throw error
  }
}

export async function marcarOrdenCompraEnviada(id) {
  const { data, error } = await supabase.schema('bitacora').rpc('marcar_orden_compra_enviada', { p_requerimiento_id:id })
  if (error) throw error
  return data
}

export async function escanearSeguimientoCompra(token) {
  const { data, error } = await supabase.schema('bitacora').rpc('escanear_seguimiento_compra', { p_token:token })
  if (error) throw error
  return data
}

function whatsappNumber(value) {
  const digits = String(value || '').replace(/\D/g, '').replace(/^0+/, '')
  if (!digits) return ''
  if (digits.startsWith('549')) return digits
  if (digits.startsWith('54')) return `549${digits.slice(2).replace(/^9/, '')}`
  return `549${digits.replace(/^9/, '')}`
}

function vendorMessage(proveedor, requerimiento) {
  return `Hola${proveedor?.contacto_nombre ? ` ${proveedor.contacto_nombre}` : ''}, compartimos la Orden de Compra ${requerimiento.orden_compra_numero || `del requerimiento #${requerimiento.numero || requerimiento.id}`}. El PDF incluye el QR de seguimiento.${requerimiento.orden_compra_url ? `\n\nDescargar orden: ${requerimiento.orden_compra_url}` : ''}\n\nFly Kitchen.`
}

export function vendorWhatsappHref(proveedor, requerimiento) {
  const number = whatsappNumber(proveedor?.whatsapp || proveedor?.telefono)
  return `https://wa.me/${number}?text=${encodeURIComponent(vendorMessage(proveedor, requerimiento))}`
}

export function vendorEmailHref(proveedor, requerimiento) {
  const subject = encodeURIComponent(`Orden de Compra ${requerimiento.orden_compra_numero || `#${requerimiento.numero || requerimiento.id}`}`)
  const body = encodeURIComponent(vendorMessage(proveedor, requerimiento))
  return `mailto:${proveedor?.email || ''}?subject=${subject}&body=${body}`
}

export async function getComprasEventos(requerimientoId) {
  const { data, error } = await db().from('compras_eventos').select('*').eq('requerimiento_id', requerimientoId).order('created_at', { ascending:false })
  if (error) throw error
  return data || []
}
