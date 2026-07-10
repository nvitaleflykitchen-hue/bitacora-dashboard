import { jsPDF } from 'jspdf'
import { format } from 'date-fns'

// Kit común para los reportes PDF de eficiencia (Mantenimiento, Compras).
// Mantiene una estructura idéntica entre reportes: encabezado, fila de KPIs,
// títulos de sección con línea fósforo, tablas simples y pie de página.

export const COLORES = {
  phosphor: [57, 255, 20],
  gris: [100, 100, 100],
  claro: [240, 240, 240],
  rojo: [220, 60, 60],
  ambar: [217, 140, 20],
  texto: [30, 30, 30],
}

export function crearDoc() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginX = 15
  const contentW = pageW - marginX * 2
  const ctx = { doc, pageW, pageH, marginX, contentW, y: 18 }

  ctx.pie = () => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 150, 150)
    doc.text(`Página ${doc.internal.getNumberOfPages()}`, pageW - marginX, pageH - 10, { align: 'right' })
  }
  ctx.salto = need => {
    if (ctx.y + need > pageH - 20) { ctx.pie(); doc.addPage(); ctx.y = 18 }
  }
  ctx.encabezado = (titulo, subtitulo, nota) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20, 20, 20)
    doc.text(titulo, pageW / 2, ctx.y, { align: 'center' })
    ctx.y += 7
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...COLORES.gris)
    doc.text(subtitulo, pageW / 2, ctx.y, { align: 'center' })
    ctx.y += 5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}${nota ? ' — ' + nota : ''}`, pageW / 2, ctx.y, { align: 'center' })
    ctx.y += 10
  }
  ctx.titulo = (text, marginTop = 8) => {
    ctx.salto(15)
    ctx.y += marginTop
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...COLORES.texto)
    doc.text(text, marginX, ctx.y)
    ctx.y += 2
    doc.setDrawColor(...COLORES.phosphor); doc.setLineWidth(0.5)
    doc.line(marginX, ctx.y, marginX + contentW, ctx.y)
    ctx.y += 6
  }
  // kpis: array de [label, valor, esAlerta]
  ctx.filaKpis = kpis => {
    const kw = contentW / kpis.length
    doc.setFillColor(...COLORES.claro)
    doc.rect(marginX, ctx.y, contentW, 18, 'F')
    kpis.forEach(([label, val, alerta], i) => {
      const cx = marginX + kw * i + kw / 2
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
      doc.setTextColor(...(alerta ? COLORES.rojo : COLORES.texto))
      doc.text(String(val), cx, ctx.y + 8, { align: 'center' })
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...COLORES.gris)
      doc.text(String(label).toUpperCase(), cx, ctx.y + 14, { align: 'center' })
    })
    ctx.y += 24
  }
  // tabla: cols = anchos mm, headers = strings, filas = arrays de celdas
  // celda: valor simple, o { v, color: 'rojo'|'ambar'|'verde', bold }
  ctx.tabla = (cols, headers, filas, { fontSize = 7.5, vacio = 'Sin datos.' } = {}) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(fontSize); doc.setTextColor(60, 60, 60)
    let x = marginX
    headers.forEach((h, i) => { doc.text(h, x, ctx.y); x += cols[i] })
    ctx.y += 4
    if (!filas.length) {
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...COLORES.gris)
      doc.text(vacio, marginX, ctx.y); ctx.y += 5
      return
    }
    filas.forEach(fila => {
      ctx.salto(6)
      x = marginX
      fila.forEach((celda, i) => {
        const c = (celda && typeof celda === 'object') ? celda : { v: celda }
        const color = c.color === 'rojo' ? COLORES.rojo : c.color === 'ambar' ? COLORES.ambar
          : c.color === 'verde' ? [30, 140, 30] : COLORES.texto
        doc.setFont('helvetica', c.bold ? 'bold' : 'normal'); doc.setFontSize(fontSize)
        doc.setTextColor(...color)
        doc.text(String(c.v ?? '—'), x, ctx.y)
        x += cols[i]
      })
      ctx.y += 5
    })
  }
  ctx.guardar = nombre => { ctx.pie(); doc.save(nombre) }
  return ctx
}

export const hoyISO = () => new Date().toISOString().slice(0, 10)
export const dias = ms => Math.floor(ms / 86400000)
export const fechaArchivo = () => format(new Date(), 'yyyyMMdd')
