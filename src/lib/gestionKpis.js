import { PERSONA_DOCUMENTACION_TEMPLATE, SEDE_DOCUMENTACION_TEMPLATE, VEHICULO_DOCUMENTACION_TEMPLATE } from './documentacion'

export const GESTION_DIMENSIONS = [
  { id:'cumplimiento', label:'Cumplimiento', weight:30 },
  { id:'documentacion', label:'Documentación', weight:20 },
  { id:'gestion', label:'Gestión', weight:25 },
  { id:'compromiso', label:'Compromiso operativo', weight:15 },
  { id:'mejora', label:'Mejora continua', weight:10 },
]

const FINAL = {
  tareas:new Set(['Resuelto']),
  mantenimiento:new Set(['resuelto']),
  compras:new Set(['Cumplido']),
  escalamientos:new Set(['Resuelto']),
  capa:new Set(['Completada','Verificada']),
  nc:new Set(['Cerrada']),
}

const clamp = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
const ratio = (ok, total) => total > 0 ? clamp((ok / total) * 100) : null
const inSede = (item, sedeId) => sedeId == null || String(item?.sede_id) === String(sedeId)
const completed = (items, type) => items.filter(item => FINAL[type].has(item.estado)).length

const DOC_TEMPLATES = { persona:PERSONA_DOCUMENTACION_TEMPLATE, vehiculo:VEHICULO_DOCUMENTACION_TEMPLATE, sede:SEDE_DOCUMENTACION_TEMPLATE }

function documentSummary(data, type, entities, hasta) {
  const items = (data.documentacion?.items || []).filter(item => item.entity_type === type)
  const itemMap = new Map(items.map(item => [`${item.entity_id}|${item.codigo}`, item]))
  const result = { type, entities:entities.length, total:0, vigente:0, proximo7:0, proximo15:0, proximo30:0, vencido:0, observado:0, pendiente:0, sinCargar:0 }
  const end = new Date(`${hasta}T12:00:00`)
  entities.forEach(entity => DOC_TEMPLATES[type].forEach(expected => {
    const item = itemMap.get(`${entity.id}|${expected.codigo}`)
    if (item?.estado === 'no_aplica') return
    result.total += 1
    if (!item) { result.sinCargar += 1; return }
    const expiration = item.fecha_vencimiento ? new Date(`${item.fecha_vencimiento}T12:00:00`) : null
    const days = expiration ? Math.ceil((expiration - end) / 86400000) : null
    if (item.estado === 'vencido' || (days != null && days < 0)) result.vencido += 1
    else if (item.estado === 'observado') result.observado += 1
    else if (item.estado === 'pendiente') result.pendiente += 1
    else if (item.estado === 'vigente') {
      result.vigente += 1
      if (days != null && days <= 7) result.proximo7 += 1
      else if (days != null && days <= 15) result.proximo15 += 1
      else if (days != null && days <= 30) result.proximo30 += 1
    }
  }))
  result.score = ratio(result.vigente, result.total)
  return result
}

function metric(label, ok, total, inverse = false) {
  const raw = ratio(ok, total)
  return { label, numerator:ok, denominator:total, score:raw == null ? null : inverse ? 100 - raw : raw }
}

function averageMetrics(metrics) {
  const applicable = metrics.filter(item => item.score != null)
  return applicable.length ? clamp(applicable.reduce((sum, item) => sum + item.score, 0) / applicable.length) : null
}

function calendarDays(desde, hasta) {
  let count = 0
  const current = new Date(`${desde}T12:00:00`)
  const end = new Date(`${hasta}T12:00:00`)
  const today = new Date()
  const effectiveEnd = end > today ? today : end
  while (current <= effectiveEnd) {
    count += 1
    current.setDate(current.getDate() + 1)
  }
  return count
}

function buildOne(data, sede, desde, hasta, totalSedes = 1) {
  const sedeId = sede?.id ?? null
  const tareas = (data.gestion || []).filter(item => inSede(item, sedeId))
  const tickets = (data.mantenimiento || []).filter(item => inSede(item, sedeId))
  const compras = (data.compras || []).filter(item => inSede(item, sedeId))
  const escalados = (data.escalamientos || []).filter(item => inSede(item, sedeId))
  const capa = (data.calidad?.capa || []).filter(item => inSede(item, sedeId))
  const nc = (data.calidad?.nc || []).filter(item => inSede(item, sedeId))
  const auditorias = (data.calidad?.auditorias || []).filter(item => inSede(item, sedeId) && ['Finalizada','Cerrada'].includes(item.estado))
  const vehiculos = (data.flota?.activos || []).filter(item => inSede(item, sedeId))
  const reportes = (data.operacion || []).filter(item => inSede(item, sedeId))
  const docPeople = (data.documentacion?.personas || []).filter(item => sedeId == null || (item.sede_ids || []).map(String).includes(String(sedeId)))
  const docVehicles = (data.documentacion?.vehiculos || []).filter(item => inSede(item, sedeId))
  const docSites = sedeId == null ? (data.documentacion?.sedes || []) : (data.documentacion?.sedes || []).filter(item => String(item.id) === String(sedeId))
  const documentation = [
    documentSummary(data, 'persona', docPeople, hasta),
    documentSummary(data, 'vehiculo', docVehicles, hasta),
    documentSummary(data, 'sede', docSites, hasta),
  ]

  const tareasConPlazo = tareas.filter(item => item.fecha_limite)
  const ticketsConPlazo = tickets.filter(item => item.fecha_limite)
  const cumplimientoMetrics = [
    metric('Tareas resueltas', completed(tareasConPlazo, 'tareas'), tareasConPlazo.length),
    metric('Tickets resueltos', completed(ticketsConPlazo, 'mantenimiento'), ticketsConPlazo.length),
    metric('Compras cumplidas', completed(compras, 'compras'), compras.length),
  ]

  const docTotal = documentation.reduce((sum, item) => sum + item.total, 0)
  const docCargada = documentation.reduce((sum, item) => sum + item.total - item.sinCargar, 0)
  const docVigente = documentation.reduce((sum, item) => sum + item.vigente, 0)
  const documentacionMetrics = [
    metric('Documentación cargada', docCargada, docTotal),
    metric('Documentación vigente', docVigente, docTotal),
  ]

  const allGestion = [
    ...tareas.map(item => ({...item,_type:'tareas'})),
    ...tickets.map(item => ({...item,_type:'mantenimiento'})),
    ...compras.map(item => ({...item,_type:'compras'})),
    ...escalados.map(item => ({...item,_type:'escalamientos'})),
    ...nc.map(item => ({...item,_type:'nc'})),
  ]
  const gestionClosed = allGestion.filter(item => FINAL[item._type].has(item.estado)).length
  const overdueOpen = allGestion.filter(item => item.fecha_limite && item.fecha_limite.slice(0,10) < hasta && !FINAL[item._type].has(item.estado)).length
  const gestionMetrics = [
    metric('Casos cerrados', gestionClosed, allGestion.length),
    metric('Sin vencimientos pendientes', overdueOpen, allGestion.length, true),
  ]

  const expectedDays = calendarDays(desde, hasta) * (sedeId == null ? totalSedes : 1)
  const reportingDays = new Set(reportes.map(item => {
    const date = String(item.fecha_reporte || '').slice(0,10)
    return date ? (sedeId == null ? String(item.sede_id) + '|' + date : date) : null
  }).filter(Boolean)).size
  const compromisoMetrics = [metric(sedeId == null ? 'Sede-días con reporte' : 'Días con reporte', reportingDays, expectedDays)]

  const auditScores = auditorias.map(item => Number(item.porcentaje_cumplimiento)).filter(Number.isFinite)
  const auditAverage = auditScores.length ? clamp(auditScores.reduce((sum, value) => sum + value, 0) / auditScores.length) : null
  const mejoraMetrics = [
    metric('CAPA completadas/verificadas', completed(capa, 'capa'), capa.length),
    { label:'Cumplimiento de auditorías', numerator:auditScores.length ? Math.round(auditScores.reduce((a,b)=>a+b,0)) : 0, denominator:auditScores.length ? auditScores.length * 100 : 0, score:auditAverage },
  ]

  const groups = { cumplimiento:cumplimientoMetrics, documentacion:documentacionMetrics, gestion:gestionMetrics, compromiso:compromisoMetrics, mejora:mejoraMetrics }
  const dimensions = GESTION_DIMENSIONS.map(definition => ({ ...definition, score:averageMetrics(groups[definition.id]), metrics:groups[definition.id] }))
  const applicable = dimensions.filter(item => item.score != null)
  const applicableWeight = applicable.reduce((sum, item) => sum + item.weight, 0)
  const score = applicableWeight ? clamp(applicable.reduce((sum, item) => sum + item.score * item.weight, 0) / applicableWeight) : null
  return { id:sedeId == null ? 'global' : String(sedeId), label:sede?.nombre || 'Global empresa', score, dimensions, documentation, volume:allGestion.length + reportes.length + capa.length + auditorias.length }
}

export function buildGestionScorecards({ data, sedes, desde, hasta }) {
  const bySede = sedes.map(sede => buildOne(data, sede, desde, hasta, sedes.length))
  return { global:buildOne(data, null, desde, hasta, sedes.length), bySede }
}

export function gestionScoreTone(score) {
  if (score == null) return 'gray'
  if (score >= 90) return 'green'
  if (score >= 80) return 'blue'
  if (score >= 70) return 'yellow'
  return 'red'
}
