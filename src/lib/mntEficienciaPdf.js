import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { supabase } from './supabase'
import { SLA_HS } from './estados'

// Reporte de eficiencia de Mantenimiento (PDF) — general o por sede.
// Pensado para la revisión semanal de pendientes: KPIs arriba, tabla por sede
// (solo en modo general) y el detalle de tickets abiertos ordenado por
// prioridad y antigüedad.

const PHOSPHOR = [57, 255, 20]
const GRAY = [100, 100, 100]
const LIGHT = [240, 240, 240]
const RED = [220, 60, 60]
const AMBER = [217, 140, 20]

const PRIORIDAD_ORDEN = { critica: 0, alta: 1, media: 2, baja: 3 }

const horasAbierto = t => (Date.now() - new Date(t.created_at).getTime()) / 3600000
const slaVencido = t => horasAbierto(t) > (SLA_HS[t.prioridad] ?? 168)
const diasAbierto = t => Math.floor(horasAbierto(t) / 24)

export async function generarReporteEficienciaMnt({ sedeId = null, sedeNombre = null } = {}) {
  // 1. Datos
  let abiertosQ = supabase.from('mnt_tickets')
    .select('id,numero,descripcion,estado,prioridad,tipo,created_at,responsable_id,sede_id,sede_nombre,fecha_limite')
    .not('estado', 'in', '(resuelto,rechazado)')
  let cerradosQ = supabase.from('mnt_tickets')
    .select('id,created_at,fecha_cierre,sede_id')
    .eq('estado', 'resuelto')
    .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
  if (sedeId) {
    abiertosQ = abiertosQ.eq('sede_id', Number(sedeId))
    cerradosQ = cerradosQ.eq('sede_id', Number(sedeId))
  }
  const [{ data: abiertos, error: e1 }, { data: cerrados30, error: e2 }, { data: responsables }] = await Promise.all([
    abiertosQ, cerradosQ,
    supabase.from('mnt_responsables').select('id,nombre').eq('activo', true),
  ])
  if (e1) throw e1
  if (e2) throw e2

  const respName = id => (responsables || []).find(r => r.id === id)?.nombre || null
  const tickets = (abiertos || []).sort((a, b) =>
    (PRIORIDAD_ORDEN[a.prioridad] ?? 9) - (PRIORIDAD_ORDEN[b.prioridad] ?? 9) || new Date(a.created_at) - new Date(b.created_at))

  // KPIs
  const sinResponsable = tickets.filter(t => !t.responsable_id).length
  const fueraSla = tickets.filter(slaVencido).length
  const mas30d = tickets.filter(t => diasAbierto(t) > 30).length
  const resueltosConCierre = (cerrados30 || []).filter(t => t.fecha_cierre)
  const diasPromResolucion = resueltosConCierre.length
    ? Math.round(resueltosConCierre.reduce((acc, t) =>
        acc + (new Date(t.fecha_cierre) - new Date(t.created_at)) / 86400000, 0) / resueltosConCierre.length)
    : null

  // 2. PDF
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginX = 15
  const contentW = pageW - marginX * 2
  let y = 18

  const pagina = () => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 150, 150)
    doc.text(`Página ${doc.internal.getNumberOfPages()}`, pageW - marginX, pageH - 10, { align: 'right' })
  }
  const checkPageBreak = need => {
    if (y + need > pageH - 20) { pagina(); doc.addPage(); y = 18 }
  }
  const drawTitle = (text, marginTop = 8) => {
    checkPageBreak(15)
    y += marginTop
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 30, 30)
    doc.text(text, marginX, y)
    y += 2
    doc.setDrawColor(...PHOSPHOR); doc.setLineWidth(0.5)
    doc.line(marginX, y, marginX + contentW, y)
    y += 6
  }

  // Encabezado
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20, 20, 20)
  doc.text('REPORTE DE EFICIENCIA — MANTENIMIENTO', pageW / 2, y, { align: 'center' })
  y += 7
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...GRAY)
  doc.text(sedeId ? `Sede: ${sedeNombre || sedeId}` : 'General — todas las sedes', pageW / 2, y, { align: 'center' })
  y += 5
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')} — Pendientes a la fecha + resolución últimos 30 días`, pageW / 2, y, { align: 'center' })
  y += 10

  // KPIs
  const kpis = [
    ['Abiertos', tickets.length],
    ['Sin responsable', sinResponsable],
    ['Fuera de SLA', fueraSla],
    ['Abiertos +30 días', mas30d],
    ['Días prom. resolución (30d)', diasPromResolucion ?? '—'],
  ]
  const kw = contentW / kpis.length
  doc.setFillColor(...LIGHT)
  doc.rect(marginX, y, contentW, 18, 'F')
  kpis.forEach(([label, val], i) => {
    const cx = marginX + kw * i + kw / 2
    const alerta = (label === 'Sin responsable' || label === 'Fuera de SLA' || label === 'Abiertos +30 días') && Number(val) > 0
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
    doc.setTextColor(...(alerta ? RED : [30, 30, 30]))
    doc.text(String(val), cx, y + 8, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...GRAY)
    doc.text(label.toUpperCase(), cx, y + 14, { align: 'center' })
  })
  y += 24

  // Resumen por sede (solo modo general)
  if (!sedeId) {
    drawTitle('Resumen por sede')
    const porSede = {}
    tickets.forEach(t => {
      const k = t.sede_nombre || `Sede ${t.sede_id}`
      porSede[k] = porSede[k] || { total: 0, sinResp: 0, sla: 0, viejos: 0 }
      porSede[k].total++
      if (!t.responsable_id) porSede[k].sinResp++
      if (slaVencido(t)) porSede[k].sla++
      if (diasAbierto(t) > 30) porSede[k].viejos++
    })
    const cols = [80, 25, 30, 25, 25]
    const headers = ['Sede', 'Abiertos', 'Sin resp.', 'F. SLA', '+30d']
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(60, 60, 60)
    let x = marginX
    headers.forEach((h, i) => { doc.text(h, x, y); x += cols[i] })
    y += 4
    doc.setFont('helvetica', 'normal')
    Object.entries(porSede).sort((a, b) => b[1].total - a[1].total).forEach(([nombre, s]) => {
      checkPageBreak(6)
      x = marginX
      doc.setTextColor(30, 30, 30)
      const vals = [nombre.slice(0, 45), s.total, s.sinResp, s.sla, s.viejos]
      vals.forEach((v, i) => { doc.text(String(v), x, y); x += cols[i] })
      y += 5
    })
    if (!Object.keys(porSede).length) {
      doc.setTextColor(...GRAY); doc.text('Sin tickets abiertos.', marginX, y); y += 5
    }
  }

  // Detalle de pendientes
  drawTitle(`Pendientes (${tickets.length})`)
  if (!tickets.length) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY)
    doc.text('No hay tickets abiertos. Buen trabajo.', marginX, y)
    y += 6
  } else {
    const cols = sedeId ? [14, 88, 0, 22, 34, 12, 10] : [14, 60, 34, 20, 30, 12, 10]
    const headers = sedeId
      ? ['#', 'Descripción', '', 'Prioridad', 'Responsable', 'Días', 'SLA']
      : ['#', 'Descripción', 'Sede', 'Prioridad', 'Responsable', 'Días', 'SLA']
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(60, 60, 60)
    let x = marginX
    headers.forEach((h, i) => { if (cols[i]) { doc.text(h, x, y); x += cols[i] } })
    y += 4
    tickets.forEach(t => {
      checkPageBreak(6)
      x = marginX
      const resp = respName(t.responsable_id)
      const fila = sedeId
        ? [t.numero ?? '—', (t.descripcion || '').slice(0, 60), null, t.prioridad, resp || 'SIN ASIGNAR', diasAbierto(t), slaVencido(t) ? 'VENC' : 'ok']
        : [t.numero ?? '—', (t.descripcion || '').slice(0, 40), (t.sede_nombre || '').slice(0, 22), t.prioridad, resp || 'SIN ASIGNAR', diasAbierto(t), slaVencido(t) ? 'VENC' : 'ok']
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
      fila.forEach((v, i) => {
        if (v === null || !cols[i]) return
        if (i === 4 && !resp) { doc.setTextColor(...AMBER); doc.setFont('helvetica', 'bold') }
        else if (i === 6 && v === 'VENC') { doc.setTextColor(...RED); doc.setFont('helvetica', 'bold') }
        else if (i === 3 && (v === 'critica' || v === 'alta')) { doc.setTextColor(...RED) }
        else { doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'normal') }
        doc.text(String(v), x, y)
        x += cols[i]
      })
      y += 5
    })
  }

  pagina()
  const nombre = sedeId
    ? `eficiencia-mnt-${(sedeNombre || sedeId).toString().toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyyMMdd')}.pdf`
    : `eficiencia-mnt-general-${format(new Date(), 'yyyyMMdd')}.pdf`
  doc.save(nombre)
  return nombre
}
