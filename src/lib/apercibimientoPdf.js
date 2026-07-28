import { jsPDF } from 'jspdf'
import { FLY_KITCHEN_LOGO_PNG } from '../assets/flyKitchenLogo.js'

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const LEFT = 54
const RIGHT = 558
const NOTICE_TOP = 161
const NOTICE_MIN_BOTTOM = 419
const NOTICE_MAX_BOTTOM = 584
const NOTICE_TEXT_Y = 211
const CONTINUATION_TEXT_Y = 82
const PAGE_CONTENT_BOTTOM = 738
const SIGNATURE_HEIGHT = 159
const SIGNATURE_GAP = 7

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim()
}

export function formatApercibimientoDate(value) {
  if (!value) return ''
  const [datePart] = String(value).split('T')
  const [year, month, day] = datePart.split('-')
  return year && month && day ? `${day}/${month}/${year}` : String(value)
}

export function apercibimientoFilename(persona = {}, fecha = '') {
  const nombre = `${text(persona.apellido)}-${text(persona.nombre)}`
    .replace(/^-|-$/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'empleado'
  return `apercibimiento-${nombre}-${fecha || 'sin-fecha'}.pdf`
}

function drawLabel(doc, label, x, y, size = 7) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(size)
  doc.setTextColor(0, 0, 0)
  doc.text(label, x, y)
}

function drawLogo(doc) {
  doc.addImage(FLY_KITCHEN_LOGO_PNG, 'PNG', 60, 43, 136, 52.8)
}

export function calculateApercibimientoLayout(doc, motivo) {
  const maxWidth = RIGHT - LEFT - 24
  const lineHeightFactor = 1.3
  const fontSize = 9.5
  const lineHeight = fontSize * lineHeightFactor
  doc.setFontSize(fontSize)
  // jsPDF puede conservar saltos de párrafo dentro de un elemento del array.
  // Al dibujarlo, esos saltos sí consumen renglones, por lo que deben entrar
  // también en el cálculo de altura para evitar que el texto invada las firmas.
  const lines = doc
    .splitTextToSize(text(motivo), maxWidth)
    .flatMap((line) => String(line).split(/\r?\n/))
  const onePageCapacity = Math.floor((NOTICE_MAX_BOTTOM - 14 - NOTICE_TEXT_Y) / lineHeight) + 1

  if (lines.length <= onePageCapacity) {
    const textBottom = NOTICE_TEXT_Y + Math.max(0, lines.length - 1) * lineHeight
    const noticeBottom = Math.max(NOTICE_MIN_BOTTOM, textBottom + 14)
    return {
      fontSize,
      lineHeightFactor,
      pages: [lines],
      noticeBottom,
      signatureTop: noticeBottom + SIGNATURE_GAP,
    }
  }

  const firstPageCapacity = Math.floor((PAGE_CONTENT_BOTTOM - NOTICE_TEXT_Y) / lineHeight) + 1
  const continuationCapacity = Math.floor((PAGE_CONTENT_BOTTOM - CONTINUATION_TEXT_Y) / lineHeight) + 1
  const finalPageCapacity = Math.floor(
    (NOTICE_MAX_BOTTOM - 14 - CONTINUATION_TEXT_Y) / lineHeight
  ) + 1
  const pages = [lines.slice(0, firstPageCapacity)]
  let remaining = lines.slice(firstPageCapacity)

  while (remaining.length > finalPageCapacity) {
    const take = Math.min(continuationCapacity, remaining.length - finalPageCapacity)
    pages.push(remaining.slice(0, take))
    remaining = remaining.slice(take)
  }
  pages.push(remaining)

  const finalTextBottom = CONTINUATION_TEXT_Y + Math.max(0, remaining.length - 1) * lineHeight
  const noticeBottom = Math.max(NOTICE_MIN_BOTTOM, finalTextBottom + 14)
  return {
    fontSize,
    lineHeightFactor,
    pages,
    noticeBottom,
    signatureTop: noticeBottom + SIGNATURE_GAP,
  }
}

function drawSignatureBlock(doc, persona, empleado, signatureTop) {
  doc.rect(LEFT, signatureTop, RIGHT - LEFT, SIGNATURE_HEIGHT)
  drawLabel(doc, 'FIRMA DEL EMPLEADO:', 56, signatureTop + 23, 7)
  doc.line(LEFT, signatureTop + 26, RIGHT, signatureTop + 26)
  drawLabel(doc, 'ACLARACIÓN:', 56, signatureTop + 54, 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(empleado, 117, signatureTop + 54, { maxWidth: 420 })
  doc.line(LEFT, signatureTop + 58, RIGHT, signatureTop + 58)
  drawLabel(doc, 'DNI:', 56, signatureTop + 86, 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(text(persona.dni), 78, signatureTop + 86)
  doc.line(LEFT, signatureTop + 90, RIGHT, signatureTop + 90)
  drawLabel(doc, 'FIRMA Y SELLO DE LA AUTORIDAD:', 306, signatureTop + 154, 7)
}

function drawContinuationHeader(doc, empleado, pageNumber, totalPages) {
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(1)
  doc.rect(LEFT, 36, RIGHT - LEFT, 28)
  drawLabel(doc, 'CONTINUACIÓN DEL APERCIBIMIENTO:', 60, 53, 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(empleado, 235, 53, { maxWidth: 245 })
  doc.text(`${pageNumber}/${totalPages}`, RIGHT - 8, 53, { align: 'right' })
}

export function createApercibimientoPdf(persona = {}, form = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const empleado = `${text(persona.nombre)} ${text(persona.apellido)}`.trim()
  const fecha = formatApercibimientoDate(form.fecha)

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(1)

  doc.rect(LEFT, 40, RIGHT - LEFT, 56)
  doc.line(202, 40, 202, 96)
  drawLogo(doc)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(0, 0, 0)
  doc.text('NOTIFICACIÓN DE LLAMADO DE ATENCIÓN CON', 380, 64, { align: 'center' })
  doc.text('OBSERVACIÓN ESCRITA', 380, 82, { align: 'center' })

  drawLabel(doc, 'FECHA:', 454, 110, 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(fecha, 496, 110)

  doc.rect(LEFT, 118, RIGHT - LEFT, 30)
  doc.line(405, 118, 405, 148)
  drawLabel(doc, 'EMPLEADO:', 56, 132, 7)
  drawLabel(doc, 'LEG:', 408, 132, 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(empleado, 105, 132, { maxWidth: 294 })
  doc.text(text(persona.legajo), 433, 132, { maxWidth: 119 })

  doc.setFillColor(0, 0, 0)
  doc.rect(LEFT, 148, RIGHT - LEFT, 13, 'F')
  const layout = calculateApercibimientoLayout(doc, form.motivo)
  const isSinglePage = layout.pages.length === 1
  const firstNoticeBottom = isSinglePage ? layout.noticeBottom : PAGE_CONTENT_BOTTOM
  doc.rect(LEFT, NOTICE_TOP, RIGHT - LEFT, firstNoticeBottom - NOTICE_TOP)
  drawLabel(
    doc,
    'SE NOTIFICA A UD. QUE SE HA RESUELTO APLICARLE UN APERCIBIMIENTO DISCIPLINARIO EN RAZÓN DE:',
    56,
    178,
    7
  )
  doc.line(LEFT, 188, RIGHT, 188)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(layout.fontSize)
  doc.text(layout.pages[0], LEFT + 12, NOTICE_TEXT_Y, {
    lineHeightFactor: layout.lineHeightFactor,
  })

  if (isSinglePage) {
    drawSignatureBlock(doc, persona, empleado, layout.signatureTop)
  } else {
    layout.pages.slice(1).forEach((pageLines, index) => {
      doc.addPage('letter', 'portrait')
      const pageNumber = index + 2
      drawContinuationHeader(doc, empleado, pageNumber, layout.pages.length)
      const isLastPage = pageNumber === layout.pages.length
      const noticeBottom = isLastPage ? layout.noticeBottom : PAGE_CONTENT_BOTTOM
      doc.rect(LEFT, 70, RIGHT - LEFT, noticeBottom - 70)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(layout.fontSize)
      doc.text(pageLines, LEFT + 12, CONTINUATION_TEXT_Y, {
        lineHeightFactor: layout.lineHeightFactor,
      })
      if (isLastPage) drawSignatureBlock(doc, persona, empleado, layout.signatureTop)
    })
  }

  return doc
}

export function downloadApercibimientoPdf(persona, form) {
  const doc = createApercibimientoPdf(persona, form)
  doc.save(apercibimientoFilename(persona, form.fecha))
}
