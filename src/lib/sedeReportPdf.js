import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { db, supabase } from './supabase'

const PHOSPHOR = [57, 255, 20]
const GRAY = [100, 100, 100]
const LIGHT = [240, 240, 240]

// Helper para colores de resultados
const RESULTADO_COLOR = {
  'Excelente': '#39FF14', // phosphor
  'Alto':      '#39FF14',
  'Aceptable': '#ffdd57', // warning
  'Bajo':      '#ff5050'  // danger
}

export async function generarInformeSedePDF({ sedeId, sedeNombre }) {
  // 1. Recopilar datos
  const fechaDesde = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0] // últimos 30 días

  const [
    { data: registros, error: errRegistros },
    { data: noConformidades, error: errNC },
    { data: tickets, error: errTickets },
    { data: capas, error: errCapas },
    { data: personas, error: errPersonas },
    { data: activos, error: errActivos },
  ] = await Promise.all([
    db().from('registros').select('id,fecha_reporte,estado_general,detalle_a,detalle_b,detalle_c,detalle_d,detalle_e,detalle_f,detalle_g,detalle_h').eq('sede_id', sedeId).gte('fecha_reporte', fechaDesde).order('fecha_reporte', { ascending: false }),
    db().from('no_conformidades').select('id,codigo,descripcion,estado,categoria,fecha_apertura,responsable').eq('sede_id', sedeId).not('estado', 'eq', 'Verificada').order('fecha_apertura', { ascending: false }),
    supabase.from('mnt_tickets').select('id,numero,descripcion,estado,prioridad,created_at').eq('sede_id', sedeId).not('estado', 'in', '(resuelto,rechazado)').order('created_at', { ascending: false }),
    db().from('capa').select('id,codigo,auditoria_codigo,estado,descripcion,fecha_limite,responsable').eq('sede_id', sedeId).not('estado', 'in', '(Completada,Verificada)'),
    supabase.from('v_personas').select('id,nombre,apellido,puesto,puntaje_promedio,incidentes,sede_ids').eq('activo', true),
    supabase.from('mnt_activos').select('id,nombre,tipo,estado').eq('sede_id', sedeId),
  ])

  // Diagnóstico: si alguna consulta falla (p.ej. columna renombrada), no tirar
  // el informe entero — lo dejamos seguir con esa sección vacía pero lo logueamos.
  for (const [label, err] of [['registros', errRegistros], ['no_conformidades', errNC], ['mnt_tickets', errTickets], ['capa', errCapas], ['v_personas', errPersonas], ['mnt_activos', errActivos]]) {
    if (err) console.error(`[informe sede] error consultando ${label}:`, err.message)
  }

  // Filtrar personas por sede en JS (la vista puede fallar con .contains)
  const personasSede = (personas || []).filter(p => p.sede_ids && p.sede_ids.includes(sedeId))
  const calcResultado = (score) => !score ? '-' : score >= 4.5 ? 'Excelente' : score >= 3.5 ? 'Alto' : score >= 2.5 ? 'Aceptable' : 'Bajo'

  // 2. Setup jsPDF
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginX = 15
  const contentW = pageW - marginX * 2
  let y = 18

  const checkPageBreak = (need) => {
    if (y + need > pageH - 20) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(`Página ${doc.internal.getNumberOfPages()}`, pageW - marginX, pageH - 10, { align: 'right' })
      doc.addPage()
      y = 18
    }
  }

  const drawTitle = (text, marginTop = 10) => {
    checkPageBreak(15)
    y += marginTop
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(30, 30, 30)
    doc.text(text, marginX, y)
    y += 2
    doc.setDrawColor(...PHOSPHOR)
    doc.setLineWidth(0.5)
    doc.line(marginX, y, marginX + contentW, y)
    y += 6
  }

  // ── Encabezado ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(20, 20, 20)
  doc.text('INFORME ESTADO DE UNIDAD PRODUCTIVA', pageW / 2, y, { align: 'center' })
  y += 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...GRAY)
  doc.text(`Sede: ${sedeNombre || 'Desconocida'}`, pageW / 2, y, { align: 'center' })
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')} — Datos últimos 30 días`, pageW / 2, y, { align: 'center' })
  y += 10

  // ── 1. Resumen Ejecutivo (KPIs) ──
  const cantRegistros = (registros || []).length
  const conIncidentes = (registros || []).filter(r => r.estado_general === 'Hay novedades' || r.estado_general === 'Operación condicionada').length
  const cantTickets = (tickets || []).length
  const cantNC = (noConformidades || []).length

  doc.setFillColor(...LIGHT)
  doc.rect(marginX, y, contentW, 16, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(30, 30, 30)
  doc.text('Resumen Operativo', marginX + 4, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Bitácoras llenadas: ${cantRegistros} (${conIncidentes} con novedades)`, marginX + 4, y + 12)
  doc.text(`Tickets Mantenimiento: ${cantTickets} abiertos`, marginX + contentW / 2, y + 6)
  doc.text(`No Conformidades: ${cantNC} activas`, marginX + contentW / 2, y + 12)

  y += 24

  // ── 2. Personal (Equipo) ──
  drawTitle('Equipo y Desempeño', 0)
  const equipo = personasSede || []
  if (equipo.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text('No hay personal activo asociado a esta sede.', marginX, y)
    y += 6
  } else {
    // Cabecera de tabla
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(40, 40, 40)
    doc.text('NOMBRE', marginX, y)
    doc.text('PUESTO', marginX + 50, y)
    doc.text('PUNTAJE', marginX + 110, y)
    doc.text('INCIDENTES', marginX + 140, y)
    y += 4

    doc.setFont('helvetica', 'normal')
    equipo.forEach(p => {
      checkPageBreak(6)
      const score = Math.min(5, p.puntaje_promedio || 0)
      doc.text(`${p.nombre} ${p.apellido}`, marginX, y)
      doc.text(doc.splitTextToSize(p.puesto || '-', 50)[0], marginX + 50, y)

      // Color según puntaje
      if (score > 0) {
        let r=100,g=100,b=100
        if (score >= 4.5) { r=57; g=255; b=20 }
        else if (score >= 3.0) { r=200; g=200; b=50 }
        else { r=255; g=80; b=80 }
        doc.setTextColor(r, g, b)
        doc.text(`${score.toFixed(1)} (${calcResultado(score)})`, marginX + 110, y)
        doc.setTextColor(40, 40, 40)
      } else {
        doc.text('-', marginX + 110, y)
      }

      doc.text(String(p.incidentes || 0), marginX + 140, y)
      y += 5
    })
  }

  // ── 3. Mantenimiento (Tickets y Activos) ──
  drawTitle('Mantenimiento')
  if (!tickets || tickets.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text('No hay tickets abiertos.', marginX, y)
    y += 6
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(40, 40, 40)
    doc.text('TICKET', marginX, y)
    doc.text('ESTADO', marginX + 100, y)
    doc.text('PRIORIDAD', marginX + 140, y)
    y += 4

    doc.setFont('helvetica', 'normal')
    tickets.forEach(t => {
      checkPageBreak(6)
      const titulo = `#${t.numero || '-'} ${t.descripcion || 'Sin descripción'}`
      doc.text(doc.splitTextToSize(titulo, 90)[0], marginX, y)
      doc.text(t.estado || '-', marginX + 100, y)
      doc.text(t.prioridad || '-', marginX + 140, y)
      y += 5
    })
  }

  // ── 4. No Conformidades y CAPA ──
  drawTitle('Calidad (NC y CAPA)')
  if ((!noConformidades || noConformidades.length === 0) && (!capas || capas.length === 0)) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text('No hay No Conformidades activas ni Planes CAPA en ejecución.', marginX, y)
    y += 6
  } else {
    if (noConformidades && noConformidades.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(40, 40, 40)
      doc.text(`No Conformidades (${noConformidades.length}):`, marginX, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      noConformidades.forEach(nc => {
        checkPageBreak(8)
        doc.text(`• ${nc.fecha_apertura ? format(new Date(nc.fecha_apertura), 'dd/MM/yy') : '-'} | ${nc.categoria || 'Sin categoría'} | Estado: ${nc.estado}`, marginX + 2, y)
        y += 4
        const lines = doc.splitTextToSize(nc.descripcion || '', contentW - 6)
        doc.setTextColor(100, 100, 100)
        doc.text(lines, marginX + 4, y)
        doc.setTextColor(40, 40, 40)
        y += lines.length * 3.5 + 2
      })
    }

    if (capas && capas.length > 0) {
      checkPageBreak(10)
      y += 3
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(40, 40, 40)
      doc.text(`Planes CAPA (${capas.length}):`, marginX, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      capas.forEach(c => {
        checkPageBreak(6)
        doc.text(`• ${c.codigo || c.auditoria_codigo || 'CAPA'} | Estado: ${c.estado}`, marginX + 2, y)
        y += 4
        if (c.descripcion) {
          const lines = doc.splitTextToSize(c.descripcion, contentW - 6)
          doc.setTextColor(100, 100, 100)
          doc.text(lines, marginX + 4, y)
          doc.setTextColor(40, 40, 40)
          y += lines.length * 3.5 + 2
        }
      })
    }
  }

  // ── 5. Novedades Recientes (Bitácora) ──
  drawTitle('Novedades Recientes (Bitácora)')
  const detalleDe = (r) => [r.detalle_a, r.detalle_b, r.detalle_c, r.detalle_d, r.detalle_e, r.detalle_f, r.detalle_g, r.detalle_h]
    .filter(Boolean).join('  |  ')
  const regNovedades = (registros || [])
    .filter(r => r.estado_general === 'Hay novedades' || r.estado_general === 'Operación condicionada')
  if (regNovedades.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text('No se registraron novedades en los últimos 30 días.', marginX, y)
    y += 6
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    regNovedades.slice(0, 10).forEach(r => { // max 10
      checkPageBreak(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(40, 40, 40)
      doc.text(`• ${format(new Date(r.fecha_reporte), 'dd/MM/yyyy')} — ${r.estado_general}:`, marginX, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      const lines = doc.splitTextToSize(detalleDe(r) || 'Sin detalle adicional', contentW - 4)
      doc.text(lines, marginX + 4, y)
      y += lines.length * 3.5 + 2
    })
  }

  // Paginación final
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(`Página ${doc.internal.getNumberOfPages()}`, pageW - marginX, pageH - 10, { align: 'right' })

  const nombreArchivo = `Informe_Unidad_${String(sedeNombre).replace(/[^\w-]+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`
  doc.save(nombreArchivo)
}
