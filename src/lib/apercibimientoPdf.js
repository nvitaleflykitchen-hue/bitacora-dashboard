import { jsPDF } from 'jspdf'
import { FLY_KITCHEN_LOGO_PNG } from '../assets/flyKitchenLogo.js'

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const LEFT = 54
const RIGHT = 558

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
  doc.rect(LEFT, 161, RIGHT - LEFT, 258)
  drawLabel(
    doc,
    'SE NOTIFICA A UD. QUE SE HA RESUELTO APLICARLE UN APERCIBIMIENTO DISCIPLINARIO EN RAZÓN DE:',
    56,
    178,
    7
  )
  doc.line(LEFT, 188, RIGHT, 188)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const motivoLines = doc.splitTextToSize(text(form.motivo), RIGHT - LEFT - 24)
  doc.text(motivoLines.slice(0, 17), LEFT + 12, 211, { lineHeightFactor: 1.35 })

  doc.rect(LEFT, 426, RIGHT - LEFT, 159)
  drawLabel(doc, 'FIRMA DEL EMPLEADO:', 56, 449, 7)
  doc.line(LEFT, 452, RIGHT, 452)
  drawLabel(doc, 'ACLARACIÓN:', 56, 480, 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(empleado, 117, 480, { maxWidth: 420 })
  doc.line(LEFT, 484, RIGHT, 484)
  drawLabel(doc, 'DNI:', 56, 512, 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(text(persona.dni), 78, 512)
  doc.line(LEFT, 516, RIGHT, 516)
  drawLabel(doc, 'FIRMA Y SELLO DE LA AUTORIDAD:', 306, 580, 7)

  return doc
}

export function downloadApercibimientoPdf(persona, form) {
  const doc = createApercibimientoPdf(persona, form)
  doc.save(apercibimientoFilename(persona, form.fecha))
}
