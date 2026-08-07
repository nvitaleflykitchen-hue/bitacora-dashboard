import { jsPDF } from 'jspdf'

const clean = value => String(value || '').trim()

export function descargarPlanillaCapacitacion(capacitacion, asistentes = [], sedeNombre = '') {
  const presentes = asistentes.filter(item => item.estado !== 'ausente')
  const pages = Math.max(1, Math.ceil(presentes.length / 20))
  const doc = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' })

  for (let page = 0; page < pages; page += 1) {
    if (page) doc.addPage()
    const rows = presentes.slice(page * 20, page * 20 + 20)
    doc.setDrawColor(40)
    doc.setLineWidth(0.25)
    doc.rect(10, 8, 190, 20)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
    doc.text('PLANILLA DE ASISTENCIA', 105, 16, { align:'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    doc.text('Realizado por: Responsable de Recursos Humanos', 12, 25)
    doc.text('Aprobado por: Dirección', 105, 25, { align:'center' })
    doc.text(`Página ${page + 1} de ${pages}`, 198, 25, { align:'right' })

    const fields = [
      ['Tema', capacitacion.titulo], ['Sede', sedeNombre],
      ['Fecha', capacitacion.fecha], ['Hora', capacitacion.hora_inicio?.slice(0, 5)],
      ['Instructor', capacitacion.instructor_nombre],
      ['Tipo', capacitacion.instructor_tipo === 'externo' ? 'Externo' : 'Interno'],
      ['Área / procedencia', capacitacion.instructor_area || capacitacion.instructor_procedencia],
      ['Duración', capacitacion.duracion_minutos ? `${capacitacion.duracion_minutos} minutos` : ''],
      ['Material didáctico', capacitacion.material_entregado ? 'Entregado' : 'No indicado'],
      ['Planificación', capacitacion.planificada ? 'Planificada' : 'No planificada'],
    ]
    let y = 34
    doc.setFontSize(8)
    fields.forEach(([label, value], index) => {
      const x = index % 2 === 0 ? 10 : 105
      if (index % 2 === 0 && index) y += 8
      doc.setFont('helvetica', 'bold'); doc.text(`${label}:`, x, y)
      doc.setFont('helvetica', 'normal'); doc.text(clean(value) || '—', x + 27, y, { maxWidth:65 })
    })

    y += 12
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
    doc.rect(10, y, 12, 8); doc.rect(22, y, 120, 8); doc.rect(142, y, 58, 8)
    doc.text('N°', 16, y + 5, { align:'center' }); doc.text('NOMBRE Y APELLIDO', 82, y + 5, { align:'center' }); doc.text('FIRMA', 171, y + 5, { align:'center' })
    y += 8
    for (let index = 0; index < 20; index += 1) {
      const person = rows[index]
      doc.setFont('helvetica', 'normal')
      doc.rect(10, y, 12, 9); doc.rect(22, y, 120, 9); doc.rect(142, y, 58, 9)
      doc.text(String(page * 20 + index + 1), 16, y + 6, { align:'center' })
      if (person) doc.text(`${clean(person.persona?.apellido)} ${clean(person.persona?.nombre)}`.trim(), 25, y + 6)
      y += 9
    }
    y += 12
    doc.line(15, y, 90, y); doc.line(115, y, 190, y)
    doc.setFontSize(8)
    doc.text('Firma del responsable de RR. HH.', 52, y + 5, { align:'center' })
    doc.text('Firma del instructor', 152, y + 5, { align:'center' })
  }

  const name = clean(capacitacion.titulo).replace(/[^a-z0-9áéíóúñ]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  doc.save(`planilla-asistencia-${name || 'capacitacion'}.pdf`)
}
