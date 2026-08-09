import { jsPDF } from 'jspdf'
import { FLY_KITCHEN_LOGO_PNG } from '../assets/flyKitchenLogo.js'

const clean = value => String(value || '').trim()
const PAGE_ROWS = 20

const formatDate = value => {
  if (!value) return ''
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : String(value)
}

const drawText = (doc, text, x, y, options = {}) => {
  doc.text(clean(text), x, y, options)
}

function drawCheckbox(doc, x, y, checked) {
  doc.rect(x, y - 3, 3.2, 3.2)
  if (checked) {
    doc.setLineWidth(0.45)
    doc.line(x + 0.6, y - 1.5, x + 1.35, y - 0.6)
    doc.line(x + 1.35, y - 0.6, x + 2.75, y - 2.7)
    doc.setLineWidth(0.22)
  }
}

function drawHeader(doc, page, pages) {
  const left = 14
  const right = 196
  const top = 12
  const headerBottom = 42
  const logoRight = 62
  const metaLeft = 148

  doc.setDrawColor(45)
  doc.setLineWidth(0.22)
  doc.line(left, 32, right, 32)
  // El separador del logo pertenece sólo a la fila superior. Si baja hasta
  // la fila de responsables, atraviesa el texto "Responsable de recursos".
  doc.line(logoRight, top, logoRight, 32)
  doc.line(metaLeft, top, metaLeft, 40)
  doc.line(76, 32, 76, headerBottom)
  doc.line(metaLeft, 32, metaLeft, headerBottom)

  doc.addImage(FLY_KITCHEN_LOGO_PNG, 'PNG', 17, 15, 41, 14)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Planilla de asistencia', 105, 26, { align:'center' })

  doc.setFontSize(7.5)
  doc.text('Emisión:', 150, 18)
  doc.text('Rev.:', 150, 23)
  doc.text('Fecha:', 150, 28)
  doc.setFont('helvetica', 'normal')
  doc.text('13/04/2021', 166, 18)
  doc.text('01', 166, 23)
  doc.text('13/04/2021', 166, 28)

  doc.setFontSize(7.2)
  doc.setFont('helvetica', 'bold')
  doc.text('Realizado por:', 18, 36.5)
  doc.setFont('helvetica', 'normal')
  doc.text('Responsable de recursos', 38, 36.5)
  doc.text('humanos', 46, 40, { align:'center' })
  doc.setFont('helvetica', 'bold')
  doc.text('Aprobado por:', 95, 37.5)
  doc.setFont('helvetica', 'normal')
  doc.text('Dirección', 118, 37.5)
  doc.setFont('helvetica', 'bold')
  doc.text(`Página ${page + 1} de ${pages}`, 172, 37.5, { align:'center' })
}

function drawTrainingData(doc, capacitacion, sedeNombre) {
  const left = 14
  const right = 196
  const split = 128
  const top = 48

  doc.setLineWidth(0.22)
  doc.rect(left, top, right - left, 28)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Temas:', left + 1.5, top + 9)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  drawText(doc, capacitacion.titulo, left + 15, top + 9, { maxWidth:160 })
  if (sedeNombre) {
    doc.setFont('helvetica', 'bold')
    doc.text('Sede:', left + 1.5, top + 20)
    doc.setFont('helvetica', 'normal')
    drawText(doc, sedeNombre, left + 15, top + 20, { maxWidth:160 })
  }

  doc.rect(left, 76, right - left, 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Fecha:', left + 1.5, 81.5)
  doc.setFont('helvetica', 'normal')
  drawText(doc, formatDate(capacitacion.fecha), left + 15, 81.5)
  if (capacitacion.hora_inicio) drawText(doc, `Hora: ${String(capacitacion.hora_inicio).slice(0, 5)}`, left + 55, 81.5)

  doc.rect(left, 84, split - left, 9)
  doc.rect(split, 84, right - split, 9)
  doc.setFontSize(8)
  doc.text('Docente, Apellido y Nombre:', left + 1.5, 89.8)
  doc.setFont('helvetica', 'bold')
  drawText(doc, 'MATERIAL DIDÁCTICO ENTREGADO', (split + right) / 2, 89.8, { align:'center' })

  doc.rect(left, 93, split - left, 9)
  doc.rect(split, 93, right - split, 9)
  doc.setFont('helvetica', 'normal')
  drawText(doc, capacitacion.instructor_nombre, left + 45, 89.8, { maxWidth:67 })
  doc.text('Interno', left + 1.5, 98.8)
  drawCheckbox(doc, left + 13, 99, capacitacion.instructor_tipo !== 'externo')
  doc.text('Área:', left + 20, 98.8)
  drawText(doc, capacitacion.instructor_area, left + 31, 98.8, { maxWidth:80 })
  doc.text(capacitacion.material_entregado ? 'Sí' : 'No', split + 3, 98.8)

  doc.rect(left, 102, split - left, 9)
  doc.rect(split, 102, right - split, 9)
  doc.text('Externo', left + 1.5, 107.8)
  drawCheckbox(doc, left + 14.5, 108, capacitacion.instructor_tipo === 'externo')
  doc.text('Procedencia:', left + 22, 107.8)
  drawText(doc, capacitacion.instructor_procedencia, left + 44, 107.8, { maxWidth:67 })

  doc.rect(left, 111, split - left, 9)
  doc.rect(split, 111, right - split, 9)
  const duration = capacitacion.duracion_minutos ? `${capacitacion.duracion_minutos} minutos` : ''
  drawText(doc, `Duración: ${duration}`, left + 1.5, 116.8)
  doc.text('Planificada', split + 3, 116.8)
  drawCheckbox(doc, split + 23, 117, Boolean(capacitacion.planificada))
  doc.text('No planificada', split + 31, 116.8)
  drawCheckbox(doc, split + 55, 117, capacitacion.planificada === false)
}

function drawAttendanceTable(doc, rows, page) {
  const left = 14
  const numberRight = 22
  const nameRight = 106
  const right = 196
  let y = 125

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.rect(left, y, nameRight - left, 10)
  doc.rect(nameRight, y, right - nameRight, 10)
  doc.text('NOMBRE Y APELLIDO', (left + nameRight) / 2, y + 6.5, { align:'center' })
  doc.text('FIRMA', (nameRight + right) / 2, y + 6.5, { align:'center' })
  y += 10

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  const rowHeight = 6.5
  for (let index = 0; index < PAGE_ROWS; index += 1) {
    const person = rows[index]
    doc.rect(left, y, numberRight - left, rowHeight)
    doc.rect(numberRight, y, nameRight - numberRight, rowHeight)
    doc.rect(nameRight, y, right - nameRight, rowHeight)
    doc.text(String(page * PAGE_ROWS + index + 1), (left + numberRight) / 2, y + 4.4, { align:'center' })
    if (person) {
      const fullName = `${clean(person.persona?.apellido)}, ${clean(person.persona?.nombre)}`.replace(/^,\s*|,\s*$/g, '')
      drawText(doc, fullName, numberRight + 2, y + 4.4, { maxWidth:nameRight - numberRight - 4 })
    }
    y += rowHeight
  }

  doc.rect(left, y, 91, 12)
  doc.rect(105, y, 91, 12)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text('Firma del Responsable de RRHH', 59.5, y + 10.5, { align:'center' })
  doc.text('Firma del Instructor', 150.5, y + 10.5, { align:'center' })
}

export function crearPlanillaCapacitacionPdf(capacitacion, asistentes = [], sedeNombre = '') {
  const presentes = asistentes.filter(item => item.estado !== 'ausente')
  const pages = Math.max(1, Math.ceil(presentes.length / PAGE_ROWS))
  const doc = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' })

  for (let page = 0; page < pages; page += 1) {
    if (page) doc.addPage()
    const rows = presentes.slice(page * PAGE_ROWS, page * PAGE_ROWS + PAGE_ROWS)
    drawHeader(doc, page, pages)
    drawTrainingData(doc, capacitacion, sedeNombre)
    drawAttendanceTable(doc, rows, page)
  }
  return doc
}

export function descargarPlanillaCapacitacion(capacitacion, asistentes = [], sedeNombre = '') {
  const doc = crearPlanillaCapacitacionPdf(capacitacion, asistentes, sedeNombre)
  const name = clean(capacitacion.titulo).replace(/[^a-z0-9áéíóúñ]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  doc.save(`planilla-asistencia-${name || 'capacitacion'}.pdf`)
}
