import jsPDF from 'jspdf'

const LETTER_WIDTH = 612
const LETTER_HEIGHT = 792

const TEMPLATE_ENTREVISTA = '/templates/reclutamiento/ficha_entrevista.png'
const TEMPLATE_ALTA = '/templates/reclutamiento/ficha_alta.png'

function value(v, fallback = '') {
  return v === null || v === undefined ? fallback : String(v)
}

function formatDate(value) {
  if (!value) return ''
  const [datePart] = String(value).split('T')
  const parts = datePart.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return String(value)
}

function fullName(candidate = {}, entrevista = {}) {
  return value(entrevista.nombre_apellido || candidate.nombre_apellido).trim()
}

async function imageToDataUrl(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo cargar la plantilla PDF (${url})`)
  const blob = await res.blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function createPdf(templateDataUrl) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  pdf.addImage(templateDataUrl, 'PNG', 0, 0, LETTER_WIDTH, LETTER_HEIGHT)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(20, 20, 20)
  return pdf
}

function draw(pdf, text, x, y, opts = {}) {
  const fontSize = opts.size || 8
  pdf.setFont('helvetica', opts.bold ? 'bold' : 'normal')
  pdf.setFontSize(fontSize)
  let safe = value(text)
  if (!safe) return

  if (opts.singleLine) {
    safe = safe.replace(/\r?\n/g, ' / ')
  }

  if (opts.singleLine && opts.maxWidth) {
    const minSize = opts.minSize || 6
    let fittedSize = fontSize
    while (fittedSize > minSize && pdf.getTextWidth(safe) > opts.maxWidth) {
      fittedSize -= 0.5
      pdf.setFontSize(fittedSize)
    }

    let fitted = safe
    if (pdf.getTextWidth(fitted) > opts.maxWidth) {
      while (fitted.length > 1 && pdf.getTextWidth(`${fitted}...`) > opts.maxWidth) {
        fitted = fitted.slice(0, -1)
      }
      fitted = `${fitted.trimEnd()}...`
    }
    pdf.text(fitted, x, y)
    return
  }
  if (opts.maxWidth) {
    let lines = pdf.splitTextToSize(safe, opts.maxWidth)
    if (opts.maxLines && lines.length > opts.maxLines) {
      lines = lines.slice(0, opts.maxLines)
      let last = lines[lines.length - 1]
      while (last.length > 1 && pdf.getTextWidth(`${last}...`) > opts.maxWidth) {
        last = last.slice(0, -1)
      }
      lines[lines.length - 1] = `${last.trimEnd()}...`
    }
    pdf.text(lines, x, y, { lineHeightFactor: opts.lineHeightFactor || 1.12 })
    return
  }
  pdf.text(safe, x, y)
}

function check(pdf, active, x, y) {
  if (!active) return
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text('X', x, y)
}

function normalizeStudy(v) {
  return value(v).toLowerCase()
}

function normalizeMobility(v) {
  const values = Array.isArray(v) ? v : value(v).split(',').map(x => x.trim())
  return values.map(x => x.toLowerCase())
}

function isYes(v) {
  if (v === true) return true
  return ['si', 'sí', 'yes', 'true', '1'].includes(value(v).trim().toLowerCase())
}

export async function generateFichaEntrevistaPdf({ candidate = {}, solicitud = {}, entrevista = {} }) {
  const template = await imageToDataUrl(TEMPLATE_ENTREVISTA)
  const pdf = createPdf(template)
  const study = normalizeStudy(entrevista.nivel_estudio)
  const mobility = normalizeMobility(entrevista.movilidad)

  draw(pdf, formatDate(entrevista.fecha_entrevista), 420, 127, { size: 8, maxWidth: 82, singleLine: true })
  draw(pdf, fullName(candidate, entrevista), 183, 149, { size: 8, maxWidth: 320, singleLine: true })
  draw(pdf, entrevista.dni || candidate.dni, 183, 171, { size: 8, maxWidth: 112, singleLine: true })
  draw(pdf, entrevista.cuil || candidate.cuil, 440, 171, { size: 8, maxWidth: 65, singleLine: true })
  draw(pdf, entrevista.estado_civil, 183, 193, { size: 8, maxWidth: 320, singleLine: true })
  draw(pdf, entrevista.hijos_menores, 183, 215, { size: 8, maxWidth: 112, singleLine: true })
  draw(pdf, entrevista.edades_hijos, 360, 215, { size: 8, maxWidth: 140, singleLine: true })
  draw(pdf, entrevista.domicilio, 183, 237, { size: 8, maxWidth: 112, singleLine: true })
  draw(pdf, entrevista.piso, 340, 237, { size: 8, maxWidth: 64, singleLine: true })
  draw(pdf, entrevista.departamento, 445, 237, { size: 8, maxWidth: 58, singleLine: true })
  draw(pdf, entrevista.barrio, 183, 259, { size: 8, maxWidth: 112, singleLine: true })
  draw(pdf, entrevista.ciudad, 340, 259, { size: 8, maxWidth: 64, singleLine: true })
  draw(pdf, entrevista.codigo_postal, 445, 259, { size: 8, maxWidth: 58, singleLine: true })
  draw(pdf, formatDate(entrevista.fecha_nacimiento), 183, 281, { size: 8, maxWidth: 112, singleLine: true })
  draw(pdf, entrevista.nacionalidad, 390, 281, { size: 8, maxWidth: 113, singleLine: true })
  draw(pdf, entrevista.celular || candidate.celular, 183, 303, { size: 8, maxWidth: 112, singleLine: true })
  draw(pdf, entrevista.celular_alternativo, 390, 303, { size: 8, maxWidth: 113, singleLine: true })
  draw(pdf, entrevista.email || candidate.email, 183, 325, { size: 8, maxWidth: 320, singleLine: true })

  check(pdf, study.includes('primario'), 184, 344)
  check(pdf, study.includes('secundario'), 261, 344)
  check(pdf, study.includes('terciario'), 345, 344)
  check(pdf, study.includes('universitario'), 437, 344)

  draw(pdf, entrevista.estudios_cursados, 183, 367, { size: 8, maxWidth: 115, singleLine: true })
  check(pdf, isYes(entrevista.estudia_actualmente), 408, 367)

  check(pdf, mobility.some(x => x.includes('transporte')), 184, 389)
  check(pdf, mobility.includes('auto'), 300, 389)
  check(pdf, mobility.includes('moto'), 359, 389)
  check(pdf, mobility.some(x => x.includes('camin')), 437, 389)

  draw(pdf, entrevista.carnet_conducir, 183, 411, { size: 8, maxWidth: 112, singleLine: true })
  draw(pdf, entrevista.disponibilidad_horaria, 410, 411, { size: 8, maxWidth: 93, singleLine: true })
  draw(pdf, entrevista.enfermedades_cronicas, 183, 433, { size: 8, maxWidth: 320, singleLine: true })
  draw(pdf, entrevista.talle_pantalon, 250, 455, { size: 8, maxWidth: 25, singleLine: true })
  draw(pdf, entrevista.talle_camisa, 365, 455, { size: 8, maxWidth: 28, singleLine: true })
  draw(pdf, entrevista.talle_calzado, 450, 455, { size: 8, maxWidth: 45, singleLine: true })
  check(pdf, isYes(entrevista.carnet_sanitario), 61, 477)
  check(pdf, isYes(entrevista.antecedentes_penales), 186, 477)
  draw(pdf, entrevista.recomendado_por || candidate.recomendado_por, 183, 499, { size: 8, maxWidth: 320, singleLine: true })
  draw(pdf, entrevista.entrevistador, 160, 548, { size: 8, maxWidth: 343, singleLine: true })
  draw(pdf, entrevista.observaciones || candidate.notas, 56, 566, {
    size: 7.5,
    maxWidth: 448,
    maxLines: 15,
    lineHeightFactor: 1.18,
  })

  const filename = `ficha_entrevista_${fullName(candidate, entrevista) || 'candidato'}.pdf`
  pdf.save(filename.replace(/[\\/:*?"<>|]+/g, '_'))
}

export async function generateFichaAltaPdf({ candidate = {}, solicitud = {}, entrevista = {} }) {
  const template = await imageToDataUrl(TEMPLATE_ALTA)
  const pdf = createPdf(template)
  const fechaAlta = formatDate(candidate.fecha_alta || candidate.fecha_ingreso)

  draw(pdf, fechaAlta, 475, 148, { size: 8, maxWidth: 72, singleLine: true })
  draw(pdf, solicitud.responsable || entrevista.entrevistador, 234, 177, { size: 9, maxWidth: 315, singleLine: true })
  draw(pdf, fullName(candidate, entrevista), 234, 201, { size: 9, maxWidth: 315, singleLine: true })
  draw(pdf, entrevista.cuil || candidate.cuil, 234, 224, { size: 9, maxWidth: 315, singleLine: true })
  draw(pdf, fechaAlta, 234, 246, { size: 9, maxWidth: 315, singleLine: true })
  draw(pdf, solicitud.sede_nombre || solicitud.sede?.nombre, 234, 267, { size: 9, maxWidth: 315, singleLine: true })
  draw(pdf, solicitud.horas_semanales, 234, 286, { size: 9, maxWidth: 315, singleLine: true })
  draw(pdf, solicitud.horario, 234, 306, { size: 9, maxWidth: 315, singleLine: true })
  draw(pdf, [solicitud.categoria, solicitud.puesto].filter(Boolean).join(' - ') || solicitud.puesto, 234, 328, { size: 9, maxWidth: 315, singleLine: true })
  draw(pdf, solicitud.sueldo_especificaciones, 234, 350, { size: 9, maxWidth: 315, singleLine: true })
  draw(pdf, solicitud.motivo || solicitud.periodo_necesidad, 234, 373, { size: 9, maxWidth: 315, singleLine: true })

  const filename = `ficha_alta_${fullName(candidate, entrevista) || 'candidato'}.pdf`
  pdf.save(filename.replace(/[\\/:*?"<>|]+/g, '_'))
}
