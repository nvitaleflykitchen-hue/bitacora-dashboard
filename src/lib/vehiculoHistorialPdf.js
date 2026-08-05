import { jsPDF } from 'jspdf'

const clean = value => String(value || '').trim()
const slug = value => clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'vehiculo'
const fecha = value => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR') : '-'
const dinero = value => Number(value) ? `$${Number(value).toLocaleString('es-AR')}` : '-'

export function vehiculoHistorialFilename(nombre) {
  return `historial_vehiculo_${slug(nombre)}_${new Date().toISOString().slice(0, 10)}.pdf`
}

export function crearHistorialVehiculoPdf({ vehiculo, tickets = [], novedades = [] }) {
  const doc = new jsPDF({ unit:'mm', format:'a4' })
  const margin = 15
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  let y = 18

  const footer = () => {
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(145)
    doc.text(`Fly Gestión - ${vehiculo}`, margin, pageH - 9)
    doc.text(`Página ${doc.internal.getNumberOfPages()}`, pageW - margin, pageH - 9, { align:'right' })
  }
  const ensure = needed => {
    if (y + needed <= pageH - 18) return
    footer(); doc.addPage(); y = 18
  }
  const heading = title => {
    ensure(14); y += 4
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(30)
    doc.text(title, margin, y); y += 2
    doc.setDrawColor(57,255,20); doc.setLineWidth(0.45); doc.line(margin,y,pageW-margin,y); y += 6
  }
  const paragraph = (text, { muted = false, bold = false } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(8); doc.setTextColor(muted ? 105 : 35)
    const lines = doc.splitTextToSize(clean(text) || '-', pageW - margin * 2)
    ensure(lines.length * 4 + 2); doc.text(lines, margin, y); y += lines.length * 4 + 2
  }

  doc.setFont('helvetica','bold'); doc.setFontSize(17); doc.setTextColor(25)
  doc.text('Historial del vehículo', pageW / 2, y, { align:'center' }); y += 8
  doc.setFontSize(13); doc.setTextColor(70); doc.text(clean(vehiculo), pageW / 2, y, { align:'center' }); y += 6
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(110)
  doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, pageW / 2, y, { align:'center' }); y += 10

  const abiertos = tickets.filter(t => !['resuelto','rechazado'].includes(String(t.estado).toLowerCase())).length
  const costo = tickets.reduce((sum,t) => sum + (Number(t.costo_real) || 0), 0)
  const km = tickets.reduce((max,t) => Math.max(max, Number(t.lectura_km) || 0), 0)
  const kpis = [['Tickets',tickets.length],['Abiertos',abiertos],['Novedades',novedades.length],['Último KM',km ? km.toLocaleString('es-AR') : '-']]
  const kw = (pageW - margin * 2) / kpis.length
  doc.setFillColor(242,242,242); doc.rect(margin,y,pageW-margin*2,18,'F')
  kpis.forEach(([label,value],i) => {
    const x = margin + kw * i + kw / 2
    doc.setFont('helvetica','bold'); doc.setFontSize(13)
    if (label === 'Abiertos' && value) doc.setTextColor(205,45,45)
    else doc.setTextColor(30,30,30)
    doc.text(String(value),x,y+8,{align:'center'})
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(100); doc.text(label.toUpperCase(),x,y+14,{align:'center'})
  })
  y += 23
  if (costo) paragraph(`Costo total registrado: ${dinero(costo)}`, { bold:true })

  heading('Tickets de mantenimiento')
  if (!tickets.length) paragraph('Sin tickets registrados.', { muted:true })
  tickets.forEach(t => {
    ensure(22)
    paragraph(`${fecha(t.created_at)}  |  Ticket #${t.numero || t.id}  |  ${clean(t.estado).toUpperCase()}  |  ${clean(t.prioridad).toUpperCase()}`, { bold:true })
    paragraph(`${clean(t.tipo) || 'Mantenimiento'} - ${clean(t.descripcion)}`)
    if (t.diagnostico) paragraph(`Diagnóstico / solución: ${t.diagnostico}`, { muted:true })
    paragraph(`Responsable/Taller: ${t.responsable || '-'}  |  KM: ${t.lectura_km ? Number(t.lectura_km).toLocaleString('es-AR') : '-'}  |  Costo: ${dinero(t.costo_real)}`, { muted:true })
    y += 2
  })

  heading('Novedades operativas')
  if (!novedades.length) paragraph('Sin novedades registradas.', { muted:true })
  novedades.forEach(n => {
    ensure(17)
    paragraph(`${fecha(n.fecha_reporte || n.created_at)}  |  ${clean(n.tipo) || 'Novedad'}  |  ${clean(n.estado) || '-'}`, { bold:true })
    paragraph(n.descripcion)
    paragraph(`Reportó: ${n.reportante || '-'}  |  Sede: ${n.sede_nombre || '-'}`, { muted:true })
    y += 2
  })

  footer()
  return doc
}

export function descargarHistorialVehiculoPdf(data) {
  const doc = crearHistorialVehiculoPdf(data)
  doc.save(vehiculoHistorialFilename(data.vehiculo))
}
