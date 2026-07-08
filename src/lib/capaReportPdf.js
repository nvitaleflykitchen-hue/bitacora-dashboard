import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { getAdjuntos } from './adjuntos'

// Generación de informe PDF de avance + evidencia para un plan de acción CAPA
// (agrupado por auditoria_codigo). Formato inspirado en el modelo de Plan de
// Acción CAPA provisto por el usuario (cabecera + cajas por acción + firmas).

const ESTADO_PDF = {
  'Pendiente':    'Pendiente',
  'En ejecución': 'En curso',
  'Completada':   'Cerrado',
  'Verificada':   'Cerrado',
}

const PHOSPHOR = [16, 122, 54]
const GRAY     = [90, 90, 90]
const LIGHT    = [232, 232, 232]

function splitHallazgoAccion(descripcion) {
  if (!descripcion) return { hallazgo: null, accion: null }
  const m = descripcion.match(/^Hallazgo:\s*(.*?)\s*Acci[oó]n:\s*(.*)$/s)
  if (m) return { hallazgo: m[1].trim(), accion: m[2].trim() }
  return { hallazgo: null, accion: descripcion.trim() }
}

function extractEvidenciaEsperada(notas) {
  if (!notas) return null
  const m = notas.match(/Evidencia de cierre esperada:\s*(.*?)(?:\.\s*Fuente:|$)/s)
  return m ? m[1].trim() : null
}

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

/**
 * @param {{ grupo: { auditoria_codigo: string, sede_nombre: string, items: object[] }, plan: object|null }} args
 */
export async function generarInformeCapaPDF({ grupo, plan }) {
  const items = grupo.items || []

  const adjuntosPorItem = await Promise.all(
    items.map(it => getAdjuntos('capa', it.id).catch(() => []))
  )

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginX = 15
  const contentW = pageW - marginX * 2
  let y = 18

  const footerPagina = () => {
    const n = doc.internal.getNumberOfPages()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(150, 150, 150)
    doc.text(`Generado automáticamente · ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, marginX, pageH - 10)
    doc.text(`Página ${n}`, pageW - marginX, pageH - 10, { align: 'right' })
  }

  const checkPageBreak = (need) => {
    if (y + need > pageH - 20) {
      footerPagina()
      doc.addPage()
      y = 18
    }
  }

  // ── Encabezado ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(20, 20, 20)
  doc.text('PLAN DE ACCIÓN CORRECTIVA / PREVENTIVA (CAPA)', pageW / 2, y, { align: 'center' })
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...GRAY)
  doc.text(`Auditoría ${grupo.auditoria_codigo || 'sin código'} — ${grupo.sede_nombre || ''}`, pageW / 2, y, { align: 'center' })
  y += 9

  // ── Tabla de metadatos del plan ──
  const filasInfo = [
    ['Empresa prestataria',        plan?.empresa_prestataria || '—'],
    ['Responsable del comedor',    plan?.responsable_comedor || '—'],
    ['Elaboró',                    plan?.elaboro || '—'],
    ['Fecha de auditoría',         plan?.fecha_auditoria ? format(new Date(plan.fecha_auditoria), 'dd/MM/yyyy') : '—'],
    ['% Cumplimiento informado',   plan?.cumplimiento_informado != null ? `${plan.cumplimiento_informado}%` : '—'],
  ]
  const colLabelW = 55
  doc.setFontSize(9)
  filasInfo.forEach(([label, val]) => {
    doc.setFillColor(...LIGHT)
    doc.rect(marginX, y - 4, contentW, 6.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 40)
    doc.text(label, marginX + 2, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(val), marginX + colLabelW, y)
    y += 6.5
  })

  // Objetivo / Alcance (texto libre, ancho completo)
  ;[['Objetivo', plan?.objetivo], ['Alcance', plan?.alcance]].forEach(([label, val]) => {
    if (!val) return
    y += 3
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)
    checkPageBreak(8)
    doc.text(`${label}:`, marginX, y)
    y += 4.5
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(val, contentW)
    checkPageBreak(lines.length * 4.2)
    doc.text(lines, marginX, y)
    y += lines.length * 4.2
  })

  // ── Avance general ──
  const total = items.length
  const cerradas = items.filter(i => ['Completada', 'Verificada'].includes(i.estado)).length
  const pct = total > 0 ? Math.round((cerradas / total) * 100) : 0
  y += 5
  checkPageBreak(14)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(20, 20, 20)
  doc.text(`Avance del plan: ${cerradas} de ${total} acciones cerradas (${pct}%)`, marginX, y)
  y += 3
  doc.setDrawColor(180, 180, 180)
  doc.setFillColor(235, 235, 235)
  doc.roundedRect(marginX, y, contentW, 4, 1, 1, 'FD')
  if (pct > 0) {
    doc.setFillColor(...PHOSPHOR)
    doc.roundedRect(marginX, y, Math.max(contentW * (pct / 100), 4), 4, 1, 1, 'F')
  }
  y += 11

  // ── Acciones (una "caja" por acción CAPA) ──
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx]
    const { hallazgo, accion } = splitHallazgoAccion(it.descripcion)
    const evidenciaEsperada = extractEvidenciaEsperada(it.notas)
    const notasLibres = evidenciaEsperada ? null : it.notas
    const adjuntos = adjuntosPorItem[idx] || []
    const estadoPdf = ESTADO_PDF[it.estado] || it.estado

    checkPageBreak(20)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...PHOSPHOR)
    doc.text(it.codigo || `Acción ${idx + 1}`, marginX, y + 4)

    // Checkbox de estado: Pendiente / En curso / Cerrado, alineado a la derecha
    const estados = ['Pendiente', 'En curso', 'Cerrado']
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    let cx = marginX + contentW
    estados.slice().reverse().forEach(e => {
      const marcado = e === estadoPdf
      const w = doc.getTextWidth(e) + 8
      cx -= w
      doc.setDrawColor(120, 120, 120)
      doc.rect(cx, y + 1.5, 3, 3)
      if (marcado) {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(20, 20, 20)
        doc.text('X', cx + 0.5, y + 4)
      }
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text(e, cx + 4.5, y + 4)
    })

    y += 8

    const escribirCampo = (label, valor) => {
      if (!valor) return
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'bold')
      const labelTxt = `${label}: `
      const labelW = doc.getTextWidth(labelTxt)
      const lines = doc.splitTextToSize(String(valor), Math.max(contentW - 4 - labelW, 40))
      checkPageBreak(lines.length * 4.2 + 2)
      doc.setTextColor(30, 30, 30)
      doc.text(labelTxt, marginX, y)
      doc.setFont('helvetica', 'normal')
      doc.text(lines, marginX + labelW, y)
      y += lines.length * 4.2 + 1.3
    }

    escribirCampo('Hallazgo', hallazgo)
    escribirCampo('Acción correctiva', accion)
    escribirCampo('Responsable', it.responsable)
    escribirCampo('Plazo objetivo', it.fecha_limite ? format(new Date(it.fecha_limite), 'dd/MM/yyyy') : null)
    escribirCampo('Evidencia de cierre esperada', evidenciaEsperada)
    escribirCampo('Notas de avance', notasLibres)

    // Evidencia adjunta (archivos/links cargados en la app)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    checkPageBreak(6)
    doc.text('Evidencia adjunta:', marginX, y)
    y += 4.5

    if (adjuntos.length === 0) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text('Sin evidencia adjunta registrada en la app.', marginX + 2, y)
      y += 5
    } else {
      for (const a of adjuntos) {
        const esImagen = a.tipo === 'archivo' && a.mime_type?.startsWith('image/')
        if (esImagen) {
          const dataUrl = await fetchImageAsDataUrl(a.url)
          if (dataUrl) {
            checkPageBreak(34)
            try {
              doc.addImage(dataUrl, imageFormatFromMime(a.mime_type), marginX + 2, y, 40, 30)
            } catch {
              // imagen no soportada por el codificador del PDF: se omite la miniatura
            }
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7.5)
            doc.setTextColor(90, 90, 90)
            doc.text(doc.splitTextToSize(a.nombre, contentW - 48), marginX + 46, y + 5)
            y += 32
            continue
          }
        }
        checkPageBreak(5)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(40, 80, 160)
        doc.textWithLink(`• ${a.nombre}`, marginX + 2, y, { url: a.url })
        y += 4.5
      }
    }

    // Separador entre acciones
    y += 2
    checkPageBreak(4)
    doc.setDrawColor(225, 225, 225)
    doc.line(marginX, y, marginX + contentW, y)
    y += 6
  }

  // ── Disclaimer + firmas ──
  checkPageBreak(40)
  y += 2
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(110, 110, 110)
  const disclaimer = doc.splitTextToSize(
    'Este informe fue generado automáticamente por el sistema a partir de los datos de avance y evidencia ' +
    'registrados en la app al momento de su descarga. No reemplaza la validación presencial del auditor.',
    contentW
  )
  doc.text(disclaimer, marginX, y)
  y += disclaimer.length * 3.6 + 12

  checkPageBreak(16)
  doc.setDrawColor(120, 120, 120)
  doc.line(marginX, y, marginX + 70, y)
  doc.line(marginX + contentW - 70, y, marginX + contentW, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(60, 60, 60)
  doc.text('Firma responsable del comedor', marginX, y + 5)
  doc.text('Firma auditor / Calidad', marginX + contentW - 70, y + 5)

  footerPagina()

  const base = grupo.auditoria_codigo || grupo.sede_nombre || 'plan'
  const nombreArchivo = `Plan_Accion_CAPA_${String(base).replace(/[^\w-]+/g, '_')}.pdf`
  doc.save(nombreArchivo)
}
