import { db } from './supabase'
import { REQ_ESTADOS } from './estados'
import { crearDoc, fechaArchivo } from './pdfKit'

// Reporte de eficiencia de Compras (PDF) — general o por sede.
// Mide el embudo del circuito: tiempos por etapa, pendientes por urgencia,
// carga por comprador y cumplimiento de SLA.

const CERRADOS = new Set(['Cumplido', 'Rechazado', 'Cancelado'])
const URG_ORDEN = { alta: 0, media: 1, baja: 2 }
const diasEntre = (a, b) => (new Date(b) - new Date(a)) / 86400000
const diasDesde = f => Math.floor((Date.now() - new Date(f).getTime()) / 86400000)

// Fecha en que entró al estado actual (timestamps por etapa)
const TS_ESTADO = {
  Pendiente: 'created_at', Observado: 'observado_at', Aprobado: 'aprobado_at',
  Enviado: 'enviado_at', 'En compra': 'compra_iniciada_at', Recibido: 'recibido_at',
  Cumplido: 'cumplido_at', Rechazado: 'rechazado_at', Cancelado: 'cancelado_at',
}
const diasEnEstado = r => {
  const ts = r[TS_ESTADO[r.estado]] || r.updated_at || r.created_at
  return ts ? diasDesde(ts) : null
}
const slaVencido = r => {
  if (CERRADOS.has(r.estado) || !r.enviado_at || !r.sla_dias) return false
  return diasDesde(r.enviado_at) > Number(r.sla_dias)
}

export async function generarReporteEficienciaCompras({ sedeId = null, sedeNombre = null } = {}) {
  // ── Datos ──
  const desde90 = new Date(Date.now() - 90 * 86400000).toISOString()
  let q = db().from('requerimientos')
    .select('id,numero,descripcion,estado,urgencia,sede_id,sede_nombre,solicitante,comprador_id,proveedor_seleccionado,sla_dias,created_at,updated_at,aprobado_at,enviado_at,compra_iniciada_at,recibido_at,cumplido_at,observado_at,rechazado_at,cancelado_at,fecha_necesidad')
    .gte('created_at', desde90)
  if (sedeId) q = q.eq('sede_id', Number(sedeId))
  const [{ data: reqs, error }, { data: perfiles }] = await Promise.all([
    q, db().from('perfiles').select('id,nombre').eq('activo', true),
  ])
  if (error) throw error

  const nombreDe = id => (perfiles || []).find(p => p.id === id)?.nombre || null
  const todos = reqs || []
  const abiertos = todos.filter(r => !CERRADOS.has(r.estado))
    .sort((a, b) => (URG_ORDEN[a.urgencia] ?? 9) - (URG_ORDEN[b.urgencia] ?? 9) || new Date(a.created_at) - new Date(b.created_at))
  const cumplidos = todos.filter(r => r.estado === 'Cumplido')

  // ── KPIs ──
  const sinComprador = abiertos.filter(r => ['Enviado', 'En compra'].includes(r.estado) && !r.comprador_id).length
  const vencidos = abiertos.filter(slaVencido).length
  const cicloCompleto = cumplidos.filter(r => r.cumplido_at)
  const diasCicloProm = cicloCompleto.length
    ? Math.round(cicloCompleto.reduce((a, r) => a + diasEntre(r.created_at, r.cumplido_at), 0) / cicloCompleto.length)
    : null

  const ctx = crearDoc()
  ctx.encabezado('REPORTE DE EFICIENCIA — COMPRAS',
    sedeId ? `Sede: ${sedeNombre || sedeId}` : 'General — todas las sedes',
    'Requerimientos de los últimos 90 días')

  ctx.filaKpis([
    ['Abiertos', abiertos.length],
    ['Sin comprador', sinComprador, sinComprador > 0],
    ['SLA vencido', vencidos, vencidos > 0],
    ['Cumplidos 90d', cumplidos.length],
    ['Ciclo prom. (días)', diasCicloProm ?? '—'],
  ])

  // ── Embudo por estado ──
  ctx.titulo('Embudo — dónde está cada requerimiento')
  ctx.tabla([50, 30, 50],
    ['Estado', 'Cantidad', 'Días prom. en el estado'],
    REQ_ESTADOS.map(estado => {
      const del = todos.filter(r => r.estado === estado)
      if (!del.length) return null
      const conDias = del.map(diasEnEstado).filter(d => d !== null)
      const prom = conDias.length ? Math.round(conDias.reduce((a, b) => a + b, 0) / conDias.length) : null
      const alerta = !CERRADOS.has(estado) && prom !== null && prom > 7
      return [estado, del.length, { v: prom !== null ? `${prom}d` : '—', color: alerta ? 'rojo' : undefined }]
    }).filter(Boolean))

  // ── Tiempos promedio por etapa (los que la atravesaron) ──
  ctx.titulo('Tiempos por etapa del circuito')
  const etapa = (desde, hasta, label) => {
    const del = todos.filter(r => r[desde] && r[hasta])
    if (!del.length) return [label, '—', { v: 'sin datos', color: undefined }]
    const prom = (del.reduce((a, r) => a + diasEntre(r[desde], r[hasta]), 0) / del.length).toFixed(1)
    return [label, del.length, { v: `${prom} días`, color: Number(prom) > 5 ? 'ambar' : 'verde' }]
  }
  ctx.tabla([70, 30, 40],
    ['Etapa', 'Casos', 'Promedio'],
    [
      etapa('created_at', 'aprobado_at', 'Creación → Aprobación'),
      etapa('aprobado_at', 'enviado_at', 'Aprobación → Envío a Compras'),
      etapa('enviado_at', 'recibido_at', 'Envío → Recibido'),
      etapa('recibido_at', 'cumplido_at', 'Recibido → Cumplido'),
    ])

  // ── Carga por comprador ──
  ctx.titulo('Carga por comprador (Enviado / En compra)')
  const porComprador = {}
  abiertos.filter(r => ['Enviado', 'En compra', 'Recibido'].includes(r.estado)).forEach(r => {
    const k = nombreDe(r.comprador_id) || 'SIN ASIGNAR'
    porComprador[k] = porComprador[k] || { total: 0, vencidos: 0 }
    porComprador[k].total++
    if (slaVencido(r)) porComprador[k].vencidos++
  })
  ctx.tabla([80, 30, 35],
    ['Comprador', 'En gestión', 'SLA vencido'],
    Object.entries(porComprador).sort((a, b) => b[1].total - a[1].total).map(([nombre, s]) => [
      { v: nombre.slice(0, 45), bold: nombre === 'SIN ASIGNAR', color: nombre === 'SIN ASIGNAR' ? 'ambar' : undefined },
      s.total,
      { v: s.vencidos, color: s.vencidos > 0 ? 'rojo' : 'verde' },
    ]),
    { vacio: 'Nada en bandeja de Compras ahora mismo.' })

  // ── Pendientes detallados ──
  ctx.titulo(`Pendientes (${abiertos.length})`)
  const cols = sedeId ? [12, 70, 0, 20, 24, 30, 16] : [12, 48, 28, 18, 24, 28, 14]
  const headers = ['#', 'Descripción', sedeId ? '' : 'Sede', 'Urgencia', 'Estado', 'Comprador', 'Días'].filter((_, i) => cols[i])
  ctx.tabla(cols.filter(Boolean), headers,
    abiertos.map(r => {
      const comprador = nombreDe(r.comprador_id)
      const necesitaComprador = ['Enviado', 'En compra'].includes(r.estado)
      const base = [
        r.numero ?? '—',
        (r.descripcion || '').slice(0, sedeId ? 50 : 34),
        sedeId ? null : (r.sede_nombre || '').slice(0, 16),
        { v: r.urgencia || '—', color: r.urgencia === 'alta' ? 'rojo' : undefined },
        { v: r.estado, color: slaVencido(r) ? 'rojo' : undefined },
        { v: comprador || (necesitaComprador ? 'SIN ASIGNAR' : '—'), color: !comprador && necesitaComprador ? 'ambar' : undefined, bold: !comprador && necesitaComprador },
        { v: `${diasEnEstado(r) ?? '—'}d`, color: slaVencido(r) ? 'rojo' : undefined },
      ]
      return base.filter(c => c !== null)
    }),
    { vacio: 'No hay requerimientos abiertos.' })

  const nombre = sedeId
    ? `eficiencia-compras-${(sedeNombre || sedeId).toString().toLowerCase().replace(/\s+/g, '-')}-${fechaArchivo()}.pdf`
    : `eficiencia-compras-general-${fechaArchivo()}.pdf`
  ctx.guardar(nombre)
  return nombre
}
