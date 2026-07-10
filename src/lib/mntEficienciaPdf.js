import { supabase } from './supabase'
import { SLA_HS } from './estados'
import { crearDoc, fechaArchivo } from './pdfKit'

// Reporte de eficiencia de Mantenimiento (PDF) — general o por sede.
// Secciones: KPIs, carga por responsable, categorías con más fallas,
// resolución 30d (MTTR por prioridad), preventivo, costos y pendientes.

const PRIORIDAD_ORDEN = { critica: 0, alta: 1, media: 2, baja: 3 }
const horasAbierto = t => (Date.now() - new Date(t.created_at).getTime()) / 3600000
const slaVencido = t => horasAbierto(t) > (SLA_HS[t.prioridad] ?? 168)
const diasAbierto = t => Math.floor(horasAbierto(t) / 24)

export async function generarReporteEficienciaMnt({ sedeId = null, sedeNombre = null } = {}) {
  // ── Datos ──
  const desde30 = new Date(Date.now() - 30 * 86400000).toISOString()
  let abiertosQ = supabase.from('mnt_tickets')
    .select('id,numero,descripcion,estado,prioridad,tipo,categoria,created_at,responsable_id,sede_id,sede,fecha_limite,costo_real,costo_estimado')
    .not('estado', 'in', '(resuelto,rechazado)')
  let cerradosQ = supabase.from('mnt_tickets')
    .select('id,prioridad,tipo,categoria,created_at,fecha_cierre,sede_id,costo_real')
    .eq('estado', 'resuelto').gte('created_at', desde30)
  let planesQ = supabase.from('mnt_planes').select('id,nombre,proxima_fecha,activo,sede_id').eq('activo', true)
  if (sedeId) {
    abiertosQ = abiertosQ.eq('sede_id', Number(sedeId))
    cerradosQ = cerradosQ.eq('sede_id', Number(sedeId))
    planesQ = planesQ.eq('sede_id', Number(sedeId))
  }
  const [{ data: abiertos, error: e1 }, { data: cerrados30, error: e2 }, { data: planes }, { data: responsables }] =
    await Promise.all([abiertosQ, cerradosQ, planesQ, supabase.from('mnt_responsables').select('id,nombre').eq('activo', true)])
  if (e1) throw e1
  if (e2) throw e2

  const respName = id => (responsables || []).find(r => r.id === id)?.nombre || null
  const tickets = (abiertos || []).sort((a, b) =>
    (PRIORIDAD_ORDEN[a.prioridad] ?? 9) - (PRIORIDAD_ORDEN[b.prioridad] ?? 9) || new Date(a.created_at) - new Date(b.created_at))
  const cerrados = cerrados30 || []

  // ── KPIs ──
  const sinResponsable = tickets.filter(t => !t.responsable_id).length
  const fueraSla = tickets.filter(slaVencido).length
  const mas30d = tickets.filter(t => diasAbierto(t) > 30).length
  const conCierre = cerrados.filter(t => t.fecha_cierre)
  const mttrGlobal = conCierre.length
    ? Math.round(conCierre.reduce((a, t) => a + (new Date(t.fecha_cierre) - new Date(t.created_at)) / 86400000, 0) / conCierre.length)
    : null

  const ctx = crearDoc()
  ctx.encabezado('REPORTE DE EFICIENCIA — MANTENIMIENTO',
    sedeId ? `Sede: ${sedeNombre || sedeId}` : 'General — todas las sedes',
    'Pendientes a la fecha + resolución últimos 30 días')

  ctx.filaKpis([
    ['Abiertos', tickets.length],
    ['Sin responsable', sinResponsable, sinResponsable > 0],
    ['Fuera de SLA', fueraSla, fueraSla > 0],
    ['+30 días', mas30d, mas30d > 0],
    ['Resueltos 30d', cerrados.length],
    ['MTTR 30d (días)', mttrGlobal ?? '—'],
  ])

  // ── Carga por responsable (accountability semanal) ──
  ctx.titulo('Carga por responsable')
  const porResp = {}
  tickets.forEach(t => {
    const k = respName(t.responsable_id) || 'SIN ASIGNAR'
    porResp[k] = porResp[k] || { total: 0, sla: 0, criticas: 0, viejos: 0 }
    porResp[k].total++
    if (slaVencido(t)) porResp[k].sla++
    if (t.prioridad === 'critica' || t.prioridad === 'alta') porResp[k].criticas++
    if (diasAbierto(t) > 30) porResp[k].viejos++
  })
  ctx.tabla([70, 25, 30, 30, 25],
    ['Responsable', 'Abiertos', 'Fuera SLA', 'Alta/Crítica', '+30d'],
    Object.entries(porResp).sort((a, b) => b[1].total - a[1].total).map(([nombre, s]) => [
      { v: nombre.slice(0, 40), bold: nombre === 'SIN ASIGNAR', color: nombre === 'SIN ASIGNAR' ? 'ambar' : undefined },
      s.total,
      { v: s.sla, color: s.sla > 0 ? 'rojo' : 'verde' },
      s.criticas,
      { v: s.viejos, color: s.viejos > 0 ? 'ambar' : undefined },
    ]))

  // ── Categorías con más fallas (abiertos + resueltos 30d) ──
  ctx.titulo('Categorías con más tickets (abiertos + resueltos 30d)')
  const porCat = {}
  ;[...tickets, ...cerrados].forEach(t => {
    const k = t.categoria || 'Sin categoría'
    porCat[k] = (porCat[k] || 0) + 1
  })
  ctx.tabla([100, 30],
    ['Categoría', 'Tickets'],
    Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, n]) => [c.slice(0, 55), n]))

  // ── Resolución 30 días: MTTR por prioridad + mezcla correctivo/preventivo ──
  ctx.titulo('Resolución últimos 30 días')
  const filasMttr = ['critica', 'alta', 'media', 'baja'].map(pr => {
    const del = conCierre.filter(t => t.prioridad === pr)
    const mttr = del.length
      ? (del.reduce((a, t) => a + (new Date(t.fecha_cierre) - new Date(t.created_at)) / 86400000, 0) / del.length).toFixed(1)
      : null
    const slaDias = (SLA_HS[pr] / 24).toFixed(1)
    return [pr, del.length, mttr ?? '—',
      { v: `${slaDias}d`, color: mttr !== null && Number(mttr) > SLA_HS[pr] / 24 ? 'rojo' : 'verde' }]
  })
  ctx.tabla([40, 30, 40, 40], ['Prioridad', 'Resueltos', 'MTTR (días)', 'SLA objetivo'], filasMttr)
  const correctivos = [...tickets, ...cerrados].filter(t => t.tipo === 'correctivo').length
  const preventivos = [...tickets, ...cerrados].filter(t => t.tipo === 'preventivo').length
  const totalTipo = correctivos + preventivos
  if (totalTipo) {
    ctx.salto(8)
    ctx.doc.setFont('helvetica', 'normal'); ctx.doc.setFontSize(8); ctx.doc.setTextColor(80, 80, 80)
    ctx.doc.text(`Mezcla: ${Math.round(100 * correctivos / totalTipo)}% correctivo / ${Math.round(100 * preventivos / totalTipo)}% preventivo. (Más preventivo = menos incendios.)`, ctx.marginX, ctx.y)
    ctx.y += 6
  }

  // ── Preventivo: planes vencidos / próximos ──
  const hoy = new Date().toISOString().slice(0, 10)
  const en7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const planesVencidos = (planes || []).filter(p => p.proxima_fecha && p.proxima_fecha < hoy)
  const planesProximos = (planes || []).filter(p => p.proxima_fecha >= hoy && p.proxima_fecha <= en7)
  ctx.titulo('Planes preventivos')
  ctx.tabla([90, 40],
    ['Estado', 'Cantidad'],
    [
      [{ v: 'Vencidos', color: planesVencidos.length ? 'rojo' : undefined }, { v: planesVencidos.length, color: planesVencidos.length ? 'rojo' : 'verde', bold: true }],
      ['Vencen en 7 días', { v: planesProximos.length, color: planesProximos.length ? 'ambar' : 'verde' }],
      ['Activos totales', (planes || []).length],
    ])

  // ── Costos del período ──
  const costoAbiertos = tickets.reduce((a, t) => a + (Number(t.costo_estimado) || 0), 0)
  const costoCerrados = cerrados.reduce((a, t) => a + (Number(t.costo_real) || 0), 0)
  if (costoAbiertos || costoCerrados) {
    ctx.titulo('Costos')
    ctx.tabla([90, 50], ['Concepto', 'Monto'], [
      ['Costo real resueltos (30d)', `$ ${costoCerrados.toLocaleString('es-AR')}`],
      ['Costo estimado de abiertos', `$ ${costoAbiertos.toLocaleString('es-AR')}`],
    ])
  }

  // ── Detalle de pendientes ──
  ctx.titulo(`Pendientes (${tickets.length})`)
  const cols = sedeId ? [12, 76, 0, 20, 32, 12, 12] : [12, 52, 30, 20, 30, 12, 12]
  const headers = ['#', 'Descripción', sedeId ? '' : 'Sede', 'Prioridad', 'Responsable', 'Días', 'SLA'].filter((_, i) => cols[i])
  ctx.tabla(cols.filter(Boolean), headers,
    tickets.map(t => {
      const resp = respName(t.responsable_id)
      const base = [
        t.numero ?? '—',
        (t.descripcion || '').slice(0, sedeId ? 55 : 38),
        sedeId ? null : (t.sede || '').slice(0, 18),
        { v: t.prioridad, color: ['critica', 'alta'].includes(t.prioridad) ? 'rojo' : undefined },
        { v: resp || 'SIN ASIGNAR', color: resp ? undefined : 'ambar', bold: !resp },
        diasAbierto(t),
        { v: slaVencido(t) ? 'VENC' : 'ok', color: slaVencido(t) ? 'rojo' : 'verde', bold: slaVencido(t) },
      ]
      return base.filter(c => c !== null)
    }),
    { vacio: 'No hay tickets abiertos. Buen trabajo.' })

  const nombre = sedeId
    ? `eficiencia-mnt-${(sedeNombre || sedeId).toString().toLowerCase().replace(/\s+/g, '-')}-${fechaArchivo()}.pdf`
    : `eficiencia-mnt-general-${fechaArchivo()}.pdf`
  ctx.guardar(nombre)
  return nombre
}
