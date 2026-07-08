import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { getAdjuntos } from './adjuntos'
import { FLY_KITCHEN_LOGO_PNG } from '../assets/flyKitchenLogo'

// Informe PDF de una No Conformidad (NC).
// Formato basado en el modelo "Informe de No Conformidad" provisto por el usuario:
// encabezado con logo Fly Kitchen + título + REV, datos del hallazgo, detalle,
// causa raíz, evidencia fotográfica (adjuntos de la app), plan CAPA asociado,
// acción/disposición, tabla de control de cambios y firmas.

const ORANGE = [237, 137, 22]   // naranja Fly Kitchen
const DARK    = [20, 20, 20]
const GRAY    = [90, 90, 90]
const LIGHT   = [236, 236, 236]
const LINE    = [200, 200, 200]

const LOGO_RATIO = 340 / 132   // relación real del PNG del logo

function imageFormatFromMime(mime) {
  if (!mime) return 'JPEG'
  if (mime.includes('png'))  return 'PNG'
  if (mime.includes('webp')) return 'WEBP'
  return 'JPEG'
}

async function fetchImageAsDataUrl(url) {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function fmt(d) {
  if (!d) return '—'
  try { return format(new Date(d), 'dd/MM/yyyy') } catch { return String(d) }
}

/**
 * Genera y descarga el informe PDF de una No Conformidad.
 * @param {object} nc  Fila de bitacora.no_conformidades (con codigo, descripcion, causa_raiz, etc.)
 * @param {object} [opts]
 * @param {string} [opts.creadorNombre]  Nombre resuelto de created_by
 * @param {Array}  [opts.capa]           Acciones CAPA asociadas (si no vienen en nc.capa)
 */
export async function generarInformeNoConformidadPDF(nc, opts = {}) {
  const creadorNombre = opts.creadorNombre || nc.creadorNombre || nc.created_by || '—'
  const capa = opts.capa || nc.capa || []

  const adjuntos = await getAdjuntos('no_conformidad', nc.id).catch(() => [])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginX = 15
  const contentW = pageW - marginX * 2
  let y = 14

  const footer = () => {
    const n = doc.internal.getNumberOfPages()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(150, 150, 150)
    doc.text(`Informe generado automáticamente · ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, marginX, pageH - 10)
    doc.text(`Página ${n}`, pageW - marginX, pageH - 10, { align: 'right' })
  }

  const checkPageBreak = (need) => {
    if (y + need > pageH - 18) {
      footer()
      doc.addPage()
      y = 16
    }
  }

  // ─── Encabezado con logo + título (recuadro tipo membrete) ───────────────
  const headH = 24
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.3)
  doc.rect(marginX, y, contentW, headH)
  // separadores de columnas: logo | centro | meta
  const logoColW = 52
  const metaColW = 48
  doc.line(marginX + logoColW, y, marginX + logoColW, y + headH)
  doc.line(marginX + contentW - metaColW, y, marginX + contentW - metaColW, y + headH)

  // logo
  const logoW = 40
  const logoH = logoW / LOGO_RATIO
  try {
    doc.addImage(FLY_KITCHEN_LOGO_PNG, 'PNG', marginX + (logoColW - logoW) / 2, y + (headH - logoH) / 2, logoW, logoH)
  } catch { /* si el logo no carga, se omite */ }

  // centro: título + subtítulo
  const cx = marginX + logoColW + 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...DARK)
  doc.text('Informe de No Conformidad (NC)', cx, y + 9)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  doc.text('Gestión de Calidad · Recepción y Proveedores', cx, y + 15)
  doc.setTextColor(...ORANGE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('FLY KITCHEN — Empresa de Catering', cx, y + 20.5)

  // meta derecha: REV / creación
  const mx = marginX + contentW - metaColW + 3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(60, 60, 60)
  doc.text('REV: 00', mx, y + 8)
  doc.text('Creación: 06/2026', mx, y + 13)
  doc.text('Norma: ISO 9001:2015', mx, y + 18)

  y += headH + 8

  // ─── Identificación de la NC ─────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...DARK)
  doc.text(nc.codigo || 'NC sin código', marginX, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(`Estado: ${nc.estado || '—'}   ·   Categoría: ${nc.categoria || '—'}`, marginX, y + 5.5)
  y += 12

  // ─── Sección helper ──────────────────────────────────────────────────────
  const sectionTitle = (txt) => {
    checkPageBreak(12)
    doc.setFillColor(...ORANGE)
    doc.rect(marginX, y - 4, 2.5, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...DARK)
    doc.text(txt, marginX + 5, y)
    y += 6
  }

  const kvRow = (label, val) => {
    doc.setFillColor(...LIGHT)
    doc.rect(marginX, y - 4, contentW, 6.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)
    doc.text(label, marginX + 2, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(val ?? '—'), marginX + 55, y)
    y += 6.7
  }

  const paragraph = (val) => {
    if (!val) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(130, 130, 130)
      checkPageBreak(6)
      doc.text('Sin información registrada.', marginX, y); y += 6; return
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(35, 35, 35)
    const lines = doc.splitTextToSize(String(val), contentW)
    for (const ln of lines) {
      checkPageBreak(5)
      doc.text(ln, marginX, y)
      y += 4.6
    }
    y += 2
  }

  // ─── Datos del hallazgo y registro ───────────────────────────────────────
  sectionTitle('Datos del Hallazgo y Registro')
  kvRow('Código NC:', nc.codigo)
  kvRow('Fecha de apertura:', fmt(nc.fecha_apertura))
  kvRow('Sede / Origen:', nc.sede_nombre || 'No asignada')
  kvRow('Categoría:', nc.categoria)
  kvRow('Responsable:', nc.responsable)
  kvRow('Creado por:', creadorNombre)
  if (nc.fecha_cierre) kvRow('Fecha de cierre:', fmt(nc.fecha_cierre))
  y += 4

  // ─── Datos de producto / proveedor (solo campos cargados) ────────────────
  const productoRows = [
    ['Producto:', nc.producto],
    ['Marca:', nc.marca],
    ['Lote:', nc.lote],
    ['Presentación:', nc.presentacion],
    ['Proveedor:', nc.proveedor],
    ['Fecha de recepción:', nc.fecha_recepcion ? fmt(nc.fecha_recepcion) : null],
    ['Vencimiento:', nc.vencimiento ? fmt(nc.vencimiento) : null],
  ].filter(([, v]) => v)
  if (productoRows.length > 0) {
    sectionTitle('Datos de Producto / Proveedor')
    productoRows.forEach(([label, val]) => kvRow(label, val))
    y += 4
  }

  // ─── Detalle de la No Conformidad ────────────────────────────────────────
  sectionTitle('Detalle de la No Conformidad')
  paragraph(nc.descripcion)

  // ─── Causa raíz ──────────────────────────────────────────────────────────
  if (nc.causa_raiz) {
    sectionTitle('Causa Raíz')
    paragraph(nc.causa_raiz)
  }

  // ─── Evidencia fotográfica ───────────────────────────────────────────────
  sectionTitle('Registro Fotográfico de Evidencia')
  const imagenes = adjuntos.filter(a => a.tipo === 'archivo' && a.mime_type?.startsWith('image/'))
  const otros    = adjuntos.filter(a => !(a.tipo === 'archivo' && a.mime_type?.startsWith('image/')))
  if (adjuntos.length === 0) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(130, 130, 130)
    checkPageBreak(6)
    doc.text('Sin evidencia adjunta registrada en la app.', marginX, y); y += 6
  } else {
    // imágenes en grilla de 2 columnas
    const imgW = 82, imgH = 58, gap = contentW - imgW * 2
    let col = 0
    for (const a of imagenes) {
      const dataUrl = await fetchImageAsDataUrl(a.url)
      if (!dataUrl) continue
      if (col === 0) checkPageBreak(imgH + 8)
      const px = marginX + col * (imgW + gap)
      try {
        doc.addImage(dataUrl, imageFormatFromMime(a.mime_type), px, y, imgW, imgH)
        doc.setDrawColor(...LINE); doc.rect(px, y, imgW, imgH)
      } catch { /* formato no soportado: se omite */ }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(110, 110, 110)
      doc.text(doc.splitTextToSize(a.nombre || 'Evidencia', imgW), px, y + imgH + 3.5)
      col++
      if (col === 2) { col = 0; y += imgH + 9 }
    }
    if (col === 1) y += imgH + 9
    // adjuntos no-imagen como links
    for (const a of otros) {
      checkPageBreak(5)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(40, 80, 160)
      if (a.url) doc.textWithLink(`• ${a.nombre || 'Adjunto'}`, marginX, y, { url: a.url })
      else doc.text(`• ${a.nombre || 'Adjunto'}`, marginX, y)
      y += 4.5
    }
  }
  y += 3

  // ─── Plan CAPA asociado ──────────────────────────────────────────────────
  if (capa && capa.length > 0) {
    sectionTitle(`Plan de Acción Correctiva / Preventiva (CAPA) — ${capa.length}`)
    doc.setFontSize(8.5)
    for (const c of capa) {
      checkPageBreak(7)
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK)
      const cod = `${c.codigo || 'CAPA'} [${c.tipo || '—'}] `
      doc.text(cod, marginX, y)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60)
      const w = doc.getTextWidth(cod)
      const lines = doc.splitTextToSize(`${c.descripcion || ''}  ·  Estado: ${c.estado || '—'}`, contentW - w)
      doc.text(lines, marginX + w, y)
      y += Math.max(lines.length * 4.2, 4.6) + 1.5
    }
    y += 3
  }

  // ─── Acción inmediata / disposición ──────────────────────────────────────
  sectionTitle('Acción y Disposición')
  const cerrada = ['Cerrada', 'Verificada'].includes(nc.estado)
  kvRow('Estado actual:', nc.estado)
  kvRow('Acción inmediata:', cerrada ? 'No conformidad tratada / cerrada' : 'En gestión — ver plan CAPA')
  kvRow('Disposición final:', nc.fecha_cierre ? `Cerrada el ${fmt(nc.fecha_cierre)}` : 'Pendiente de cierre')
  y += 6

  // ─── Firmas ──────────────────────────────────────────────────────────────
  checkPageBreak(20)
  doc.setDrawColor(120, 120, 120)
  doc.line(marginX, y, marginX + 70, y)
  doc.line(marginX + contentW - 70, y, marginX + contentW, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60, 60, 60)
  doc.text('Responsable de Calidad', marginX, y + 5)
  doc.text('Responsable de Planta / Sede', marginX + contentW - 70, y + 5)
  y += 14

  // ─── Control de cambios ──────────────────────────────────────────────────
  checkPageBreak(18)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GRAY)
  doc.text('CONTROL DE CAMBIOS', marginX, y); y += 4
  const cols = [24, 18, 90, contentW - 132]
  const headers = ['Fecha', 'Versión', 'Descripción del cambio', 'Elabora']
  let hx = marginX
  doc.setFillColor(...LIGHT); doc.rect(marginX, y - 3.5, contentW, 6, 'F')
  doc.setFontSize(7.5); doc.setTextColor(50, 50, 50)
  headers.forEach((h, i) => { doc.text(h, hx + 1.5, y); hx += cols[i] })
  y += 6
  doc.setFont('helvetica', 'normal'); doc.setTextColor(70, 70, 70)
  hx = marginX
  ;['01/06/26', '00', 'Creación del documento', 'Responsable de Calidad'].forEach((v, i) => {
    doc.text(doc.splitTextToSize(v, cols[i] - 2), hx + 1.5, y); hx += cols[i]
  })
  doc.setDrawColor(...LINE)
  doc.rect(marginX, y - 9.5, contentW, 12)

  footer()

  const base = (nc.codigo || 'NC').replace(/[^\w-]+/g, '_')
  doc.save(`Informe_No_Conformidad_${base}.pdf`)
}
