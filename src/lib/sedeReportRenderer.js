import { jsPDF } from 'jspdf'

// Strip control bytes from user-entered text before writing PDF streams.
// eslint-disable-next-line no-control-regex
const clean = value => String(value ?? '-').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[–—]/g, '-').replace(/→/g, '>')

// Preview and download share one immutable document without a second query.
export function crearInformeSedePDF(report) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 15, width = 180, bottom = 277
  let y = 19
  function nuevaPagina() { doc.addPage(); y = 19 }
  function texto(text, size = 9, bold = false, color = [45, 52, 62]) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color)
    const lines = doc.splitTextToSize(clean(text), width)
    for (const line of lines) {
      if (y + 5 > bottom) nuevaPagina()
      doc.text(line, margin, y); y += size * 0.43 + 1
    }
  }
  function titulo(label) {
    if (y + 28 > bottom) nuevaPagina()
    y += 5; texto(label, 11, true)
    doc.setDrawColor(47, 133, 58); doc.line(margin, y, margin + width, y); y += 5
  }
  function tabla(headers, rows, widths) {
    const sizes = widths || headers.map(() => width / headers.length)
    const lineHeight = 4, padding = 2
    function header() {
      doc.setFillColor(235, 240, 237); doc.rect(margin, y - 3, width, 10, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(35, 50, 40)
      let x = margin
      headers.forEach((label, i) => { doc.text(doc.splitTextToSize(clean(label), sizes[i] - padding * 2), x + padding, y, { lineHeightFactor: 1.3 }); x += sizes[i] })
      y += 11
    }
    if (y + 22 > bottom) nuevaPagina()
    header()
    for (const row of rows) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
      const cells = row.map((cell, i) => doc.splitTextToSize(clean(cell), sizes[i] - padding * 2))
      let offset = 0
      const count = Math.max(...cells.map(cell => cell.length))
      while (offset < count) {
        if (y + 8 > bottom) { nuevaPagina(); header() }
        const take = Math.min(count - offset, Math.floor((bottom - y - 3) / lineHeight))
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(45, 52, 62)
        let x = margin
        cells.forEach((cell, i) => { const lines = cell.slice(offset, offset + take); if (lines.length) doc.text(lines, x + padding, y, { lineHeightFactor: 1.42 }); x += sizes[i] })
        y += take * lineHeight + 3; offset += take
        doc.setDrawColor(225, 229, 234); doc.line(margin, y - 2, margin + width, y - 2)
      }
    }
    y += 3
  }
  texto('INFORME DE SEDE', 17, true); texto(report.sede.nombre || 'Sede', 13, true)
  texto(`Responsable: ${report.sede.responsable || 'Sin asignar'}`, 9)
  texto(`Reportes y evaluaciones: ${report.desde} al ${report.hasta}`, 9)
  texto(`Situación operativa y documental al ${report.hoy}. Generado: ${report.generado}`, 8)
  if (report.warnings.length) texto('INFORME PARCIAL: hay fuentes que no se pudieron consultar. No equivalen a cero.', 9, true, [155, 52, 36])
  titulo('Resumen de carga y situación operativa')
  tabla(['Área', 'Resultado'], report.summary.map(s => [s.area, s.valor]), [65, 115])
  texto('Los porcentajes se interpretan según el criterio de cada sección. La ausencia de registros no confirma cumplimiento.', 8)
  for (const section of report.sections) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    const noteHeight = doc.splitTextToSize(clean(section.note), width).length * 4.44
    // Keep the section title, its criterion and the start of its table together.
    if (y + Math.min(60 + noteHeight, 150) > bottom) nuevaPagina()
    titulo(section.title); texto(section.note, 8, false, section.error ? [155, 52, 36] : [85, 91, 99]); y += 2
    if (section.rows.length) tabla(section.columns, section.rows)
    else texto(section.error ? 'No se pudo consultar esta sección.' : 'Sin registros para detallar.', 9)
  }
  const total = doc.internal.getNumberOfPages()
  for (let page = 1; page <= total; page++) {
    doc.setPage(page); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 107, 116)
    doc.text(`${page} / ${total}`, 195, 288, { align: 'right' }); doc.text('Fly Gestión · Informe de sede', 15, 288)
  }
  return doc
}
export const nombreInformeSede = report => `Informe_Unidad_${String(report.sede.nombre || 'Sede').replace(/[^\w-]+/g, '_')}_${report.hoy.replaceAll('-', '')}.pdf`
