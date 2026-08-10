import { format } from 'date-fns'
import { db, supabase } from './supabase'
import { crearDoc, fechaArchivo } from './pdfKit'
import { buildGestionScorecards } from './gestionKpis'

export const GESTION_REPORT_SECTIONS = [
  { id: 'operacion', label: 'Operación y novedades' },
  { id: 'escalamientos', label: 'Escalamientos' },
  { id: 'mantenimiento', label: 'Mantenimiento' },
  { id: 'flota', label: 'Flota' },
  { id: 'compras', label: 'Compras' },
  { id: 'calidad', label: 'Calidad, NC y CAPA' },
  { id: 'gestion', label: 'Tareas y gestión' },
  { id: 'rrhh', label: 'Equipo y RR. HH.' },
]

const ACTIVE_TICKET = new Set(['abierto', 'en_progreso'])
const ACTIVE_ESCALATION = new Set(['Pendiente', 'En gestión'])
const ACTIVE_PURCHASE = new Set(['Pendiente', 'Observado', 'Aprobado', 'Enviado', 'En compra', 'Recibido'])
const ACTIVE_CAPA = new Set(['Pendiente', 'En ejecución'])
const ACTIVE_TASK = new Set(['Pendiente', 'En proceso'])

function nextDay(date) {
  const result = new Date(`${date}T12:00:00`)
  result.setDate(result.getDate() + 1)
  return result.toISOString().slice(0, 10)
}

function applySedes(query, sedeIds, column = 'sede_id') {
  return query.in(column, sedeIds.map(Number))
}

function countBy(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || 'Sin dato'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

function statusRows(items, field = 'estado') {
  return Object.entries(countBy(items, field))
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => [label, count])
}

async function loadOperacion({ sedeIds, desde, hastaExclusivo }) {
  const { data, error } = await applySedes(
    db().from('registros')
      .select('id,sede_id,sede_nombre,estado_general,requiere_escalamiento,fecha_reporte')
      .gte('fecha_reporte', `${desde}T00:00:00`)
      .lt('fecha_reporte', `${hastaExclusivo}T00:00:00`),
    sedeIds,
  )
  if (error) throw error
  return data || []
}

async function loadEscalamientos({ sedeIds, desde, hastaExclusivo }) {
  const { data, error } = await applySedes(
    db().from('escalamientos')
      .select('id,sede_id,sede_nombre,estado,tipo,fecha_reporte,created_at,updated_at')
      .gte('created_at', `${desde}T00:00:00`)
      .lt('created_at', `${hastaExclusivo}T00:00:00`),
    sedeIds,
  )
  if (error) throw error
  return data || []
}

async function loadMantenimiento({ sedeIds, desde, hastaExclusivo }) {
  const { data, error } = await applySedes(
    supabase.from('mnt_tickets')
      .select('id,sede_id,sede,estado,prioridad,fecha_limite,created_at,updated_at')
      .gte('created_at', `${desde}T00:00:00`)
      .lt('created_at', `${hastaExclusivo}T00:00:00`),
    sedeIds,
  )
  if (error) throw error
  return data || []
}

async function loadFlota({ sedeIds, desde, hastaExclusivo }) {
  const [activosResult, novedadesResult] = await Promise.all([
    applySedes(
      supabase.from('mnt_activos')
        .select('id,sede_id,sede_nombre,nombre,estado,vencimiento_seguro,vencimiento_vtv,vencimiento_senasa,vencimiento_rmtsa')
        .eq('tipo', 'VEHICULO'),
      sedeIds,
    ),
    applySedes(
      db().from('vehiculo_novedades')
        .select('id,sede_id,sede_nombre,estado,tipo,fecha_reporte')
        .gte('fecha_reporte', desde)
        .lt('fecha_reporte', hastaExclusivo),
      sedeIds,
    ),
  ])
  if (activosResult.error) throw activosResult.error
  if (novedadesResult.error) throw novedadesResult.error
  return { activos: activosResult.data || [], novedades: novedadesResult.data || [] }
}

async function loadCompras({ sedeIds, desde, hastaExclusivo }) {
  const { data, error } = await applySedes(
    db().from('requerimientos')
      .select('id,sede_id,sede_nombre,estado,urgencia,created_at,updated_at')
      .gte('created_at', `${desde}T00:00:00`)
      .lt('created_at', `${hastaExclusivo}T00:00:00`),
    sedeIds,
  )
  if (error) throw error
  return data || []
}

async function loadCalidad({ sedeIds, desde, hastaExclusivo }) {
  const [ncResult, capaResult, auditsResult] = await Promise.all([
    applySedes(
      db().from('no_conformidades')
        .select('id,sede_id,sede_nombre,estado,categoria,created_at,updated_at')
        .gte('created_at', `${desde}T00:00:00`)
        .lt('created_at', `${hastaExclusivo}T00:00:00`),
      sedeIds,
    ),
    applySedes(
      db().from('capa')
        .select('id,sede_id,sede_nombre,estado,prioridad,fecha_limite,created_at,updated_at')
        .gte('created_at', `${desde}T00:00:00`)
        .lt('created_at', `${hastaExclusivo}T00:00:00`),
      sedeIds,
    ),
    applySedes(
      db().from('auditorias_internas')
        .select('id,sede_id,estado,resultado,porcentaje_cumplimiento,created_at,updated_at')
        .gte('created_at', `${desde}T00:00:00`)
        .lt('created_at', `${hastaExclusivo}T00:00:00`),
      sedeIds,
    ),
  ])
  if (ncResult.error) throw ncResult.error
  if (capaResult.error) throw capaResult.error
  if (auditsResult.error) throw auditsResult.error
  return { nc: ncResult.data || [], capa: capaResult.data || [], auditorias: auditsResult.data || [] }
}

async function loadGestion({ sedeIds, desde, hastaExclusivo }) {
  const { data, error } = await applySedes(
    db().from('tareas')
      .select('id,sede_id,estado,prioridad,fecha_limite,created_at,updated_at')
      .gte('created_at', `${desde}T00:00:00`)
      .lt('created_at', `${hastaExclusivo}T00:00:00`),
    sedeIds,
  )
  if (error) throw error
  return data || []
}

async function loadRrhh({ sedeIds, desde, hastaExclusivo }) {
  const { data: personas, error } = await supabase.schema('equipo').from('personas')
    .select('id,nombre,apellido,activo,sede_ids,fecha_ingreso,fecha_baja')
    .overlaps('sede_ids', sedeIds.map(Number))
  if (error) throw error
  const personaIds = (personas || []).map(persona => persona.id)
  if (!personaIds.length) return { personas: [], evaluaciones: [], historial: [] }
  const [evalResult, historyResult] = await Promise.all([
    supabase.schema('equipo').from('evaluaciones')
      .select('id,persona_id,resultado_global,puntaje_calculado,fecha_evaluacion')
      .in('persona_id', personaIds)
      .gte('fecha_evaluacion', desde)
      .lt('fecha_evaluacion', hastaExclusivo),
    supabase.schema('equipo').from('historial_personal')
      .select('id,persona_id,tipo,fecha,anulada')
      .in('persona_id', personaIds)
      .gte('fecha', desde)
      .lt('fecha', hastaExclusivo)
      .eq('anulada', false),
  ])
  if (evalResult.error) throw evalResult.error
  if (historyResult.error) throw historyResult.error
  return { personas: personas || [], evaluaciones: evalResult.data || [], historial: historyResult.data || [] }
}

async function loadDocumentacion({ sedeIds }) {
  const [personasResult, vehiculosResult] = await Promise.all([
    supabase.schema('equipo').from('personas')
      .select('id,nombre,apellido,sede_ids,activo')
      .eq('activo', true)
      .overlaps('sede_ids', sedeIds.map(Number)),
    applySedes(
      supabase.from('mnt_activos').select('id,nombre,sede_id,sede_nombre,estado').eq('tipo', 'VEHICULO'),
      sedeIds,
    ),
  ])
  if (personasResult.error) throw personasResult.error
  if (vehiculosResult.error) throw vehiculosResult.error
  const personas = personasResult.data || []
  const vehiculos = vehiculosResult.data || []
  const queries = [
    personas.length ? db().from('documentacion_items').select('*').eq('entity_type', 'persona').in('entity_id', personas.map(item => String(item.id))) : Promise.resolve({ data:[], error:null }),
    vehiculos.length ? db().from('documentacion_items').select('*').eq('entity_type', 'vehiculo').in('entity_id', vehiculos.map(item => String(item.id))) : Promise.resolve({ data:[], error:null }),
    db().from('documentacion_items').select('*').eq('entity_type', 'sede').in('entity_id', sedeIds.map(String)),
  ]
  const [personaDocs, vehiculoDocs, sedeDocs] = await Promise.all(queries)
  const error = personaDocs.error || vehiculoDocs.error || sedeDocs.error
  if (error) throw error
  return {
    personas,
    vehiculos,
    sedes: sedeIds.map(id => ({ id })),
    items: [...(personaDocs.data || []), ...(vehiculoDocs.data || []), ...(sedeDocs.data || [])],
  }
}

const LOADERS = {
  operacion: loadOperacion,
  escalamientos: loadEscalamientos,
  mantenimiento: loadMantenimiento,
  flota: loadFlota,
  compras: loadCompras,
  calidad: loadCalidad,
  gestion: loadGestion,
  rrhh: loadRrhh,
  documentacion: loadDocumentacion,
}

export async function loadGestionGeneralReportData({ sedeIds, desde, hasta, sections }) {
  const hastaExclusivo = nextDay(hasta)
  const requested = Array.from(new Set([...sections, 'documentacion']))
  const entries = await Promise.all(requested.map(async section => [
    section,
    await LOADERS[section]({ sedeIds, desde, hastaExclusivo }),
  ]))
  return Object.fromEntries(entries)
}

function paragraph(ctx, text) {
  ctx.salto(14)
  const lines = ctx.doc.splitTextToSize(text, ctx.contentW)
  ctx.doc.setFont('helvetica', 'normal')
  ctx.doc.setFontSize(8.5)
  ctx.doc.setTextColor(45, 45, 45)
  ctx.doc.text(lines, ctx.marginX, ctx.y)
  ctx.y += lines.length * 4.2 + 2
}

function sedeBreakdown(items) {
  const rows = {}
  items.forEach(item => {
    const name = item.sede_nombre || item.sede || 'Sin sede'
    rows[name] = (rows[name] || 0) + 1
  })
  return Object.entries(rows).sort((a, b) => b[1] - a[1]).map(([name, count]) => [name.slice(0, 55), count])
}

export function createGestionGeneralReportPdf({ data, sedes, desde, hasta, sections }) {
  const ctx = crearDoc()
  const labels = Object.fromEntries(GESTION_REPORT_SECTIONS.map(item => [item.id, item.label]))
  const sedeLabel = sedes.length <= 4 ? sedes.map(sede => sede.nombre).join(', ') : `${sedes.length} sedes seleccionadas`
  ctx.encabezado(
    'INFORME GENERAL DE GESTIÓN',
    sedeLabel,
    `Período: ${format(new Date(`${desde}T12:00:00`), 'dd/MM/yyyy')} al ${format(new Date(`${hasta}T12:00:00`), 'dd/MM/yyyy')}`,
  )

  ctx.titulo('Alcance del informe', 0)
  paragraph(ctx, sections.map(section => labels[section]).join(' · '))

  const scorecards = buildGestionScorecards({ data, sedes, desde, hasta })
  ctx.titulo('Índice global de gestión')
  ctx.filaKpis([
    ['Índice global', scorecards.global.score == null ? 'S/D' : `${scorecards.global.score}%`],
    ...scorecards.global.dimensions.slice(0, 3).map(item => [item.label, item.score == null ? 'S/D' : `${item.score}%`, item.score != null && item.score < 70]),
  ])
  ctx.tabla([72, 25, 25, 25, 25], ['Sede', 'Índice', 'Cumpl.', 'Doc.', 'Gestión'],
    scorecards.bySede.map(item => [
      item.label.slice(0, 32),
      item.score == null ? 'S/D' : `${item.score}%`,
      item.dimensions[0].score == null ? 'S/D' : `${item.dimensions[0].score}%`,
      item.dimensions[1].score == null ? 'S/D' : `${item.dimensions[1].score}%`,
      item.dimensions[2].score == null ? 'S/D' : `${item.dimensions[2].score}%`,
    ]),
  )

  ctx.titulo('Control documental y vencimientos')
  ctx.tabla([45, 20, 20, 20, 22, 22, 22],
    ['Alcance', 'Controlados', 'Vigentes', 'Próx. 30 d', 'Vencidos', 'Pendientes', 'Sin cargar'],
    scorecards.global.documentation.map(item => [
      ({persona:'Personal', vehiculo:'Vehículos', sede:'Sedes'})[item.type],
      item.entities,
      item.vigente,
      item.proximo7 + item.proximo15 + item.proximo30,
      item.vencido,
      item.pendiente + item.observado,
      item.sinCargar,
    ]),
  )

  if (data.operacion) {
    const novedades = data.operacion.filter(item => !['Sin novedades', 'Sin novedad', 'OK'].includes(item.estado_general)).length
    const escalados = data.operacion.filter(item => item.requiere_escalamiento).length
    ctx.titulo('Operación y novedades')
    ctx.filaKpis([['Reportes', data.operacion.length], ['Con novedades', novedades, novedades > 0], ['Escalados', escalados, escalados > 0]])
    ctx.tabla([145, 30], ['Sede', 'Reportes'], sedeBreakdown(data.operacion))
  }

  if (data.escalamientos) {
    const activos = data.escalamientos.filter(item => ACTIVE_ESCALATION.has(item.estado)).length
    ctx.titulo('Escalamientos')
    ctx.filaKpis([['Generados', data.escalamientos.length], ['Activos', activos, activos > 0], ['Resueltos', data.escalamientos.filter(item => item.estado === 'Resuelto').length]])
    ctx.tabla([120, 35], ['Estado', 'Cantidad'], statusRows(data.escalamientos))
  }

  if (data.mantenimiento) {
    const activos = data.mantenimiento.filter(item => ACTIVE_TICKET.has(item.estado)).length
    const criticos = data.mantenimiento.filter(item => item.prioridad === 'critica').length
    ctx.titulo('Mantenimiento')
    ctx.filaKpis([['Tickets creados', data.mantenimiento.length], ['Abiertos', activos, activos > 0], ['Críticos', criticos, criticos > 0]])
    ctx.tabla([120, 35], ['Estado', 'Cantidad'], statusRows(data.mantenimiento))
  }

  if (data.flota) {
    const today = new Date().toISOString().slice(0, 10)
    const vencidos = data.flota.activos.filter(item =>
      ['vencimiento_seguro', 'vencimiento_vtv', 'vencimiento_senasa', 'vencimiento_rmtsa']
        .some(field => item[field] && item[field] < today),
    ).length
    ctx.titulo('Flota')
    ctx.filaKpis([['Vehículos', data.flota.activos.length], ['Novedades', data.flota.novedades.length], ['Doc. vencida', vencidos, vencidos > 0]])
    ctx.tabla([145, 30], ['Sede', 'Novedades'], sedeBreakdown(data.flota.novedades), { vacio: 'Sin novedades vehiculares en el período.' })
  }

  if (data.compras) {
    const activas = data.compras.filter(item => ACTIVE_PURCHASE.has(item.estado)).length
    const urgentes = data.compras.filter(item => item.urgencia === 'alta' && ACTIVE_PURCHASE.has(item.estado)).length
    ctx.titulo('Compras')
    ctx.filaKpis([['Solicitudes', data.compras.length], ['Activas', activas, activas > 0], ['Urgentes', urgentes, urgentes > 0]])
    ctx.tabla([120, 35], ['Estado', 'Cantidad'], statusRows(data.compras))
  }

  if (data.calidad) {
    const capaActivas = data.calidad.capa.filter(item => ACTIVE_CAPA.has(item.estado)).length
    ctx.titulo('Calidad, no conformidades y CAPA')
    ctx.filaKpis([['NC creadas', data.calidad.nc.length], ['CAPA creadas', data.calidad.capa.length], ['CAPA activas', capaActivas, capaActivas > 0], ['Auditorías', data.calidad.auditorias.length]])
    ctx.tabla([70, 45, 35], ['Tipo', 'Estado', 'Cantidad'], [
      ...statusRows(data.calidad.nc).map(row => ['NC', ...row]),
      ...statusRows(data.calidad.capa).map(row => ['CAPA', ...row]),
    ])
  }

  if (data.gestion) {
    const activas = data.gestion.filter(item => ACTIVE_TASK.has(item.estado)).length
    ctx.titulo('Tareas y gestión')
    ctx.filaKpis([['Tareas creadas', data.gestion.length], ['Activas', activas, activas > 0], ['Resueltas', data.gestion.filter(item => item.estado === 'Resuelto').length]])
    ctx.tabla([120, 35], ['Estado', 'Cantidad'], statusRows(data.gestion))
  }

  if (data.rrhh) {
    const promedio = data.rrhh.evaluaciones.length
      ? (data.rrhh.evaluaciones.reduce((sum, item) => sum + Number(item.puntaje_calculado || 0), 0) / data.rrhh.evaluaciones.length).toFixed(2)
      : '—'
    ctx.titulo('Equipo y RR. HH.')
    ctx.filaKpis([
      ['Personas activas', data.rrhh.personas.filter(item => item.activo).length],
      ['Evaluaciones', data.rrhh.evaluaciones.length],
      ['Puntaje prom.', promedio],
      ['Novedades', data.rrhh.historial.length],
    ])
    ctx.tabla([120, 35], ['Resultado', 'Cantidad'], statusRows(data.rrhh.evaluaciones, 'resultado_global'), { vacio: 'Sin evaluaciones en el período.' })
  }

  return ctx
}

export async function generarInformeGestionGeneralPDF(options) {
  const data = await loadGestionGeneralReportData({ ...options, sections:GESTION_REPORT_SECTIONS.map(item => item.id) })
  const ctx = createGestionGeneralReportPdf({ ...options, data })
  const name = `informe-gestion-${options.desde}-${options.hasta}-${fechaArchivo()}.pdf`
  ctx.guardar(name)
  return name
}
