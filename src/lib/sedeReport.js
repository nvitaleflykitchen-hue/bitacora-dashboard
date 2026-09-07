import { format, subDays, subMonths, parseISO, eachDayOfInterval, isValid } from 'date-fns'
import { db, supabase } from './supabase'
import { PERSONA_DOCUMENTACION_TEMPLATE, SEDE_DOCUMENTACION_TEMPLATE, VEHICULO_DOCUMENTACION_TEMPLATE } from './documentacion'
import { getResultadoEvaluacion } from './evaluacionResultado'
import { concesionLabel } from './activoConcesion'

export const fechaInforme = value => value ? String(value).slice(0, 10) : ''
const pct = (n, d) => d ? `${Math.round(n / d * 100)}% (${n}/${d})` : 'No aplica'
const nombre = p => `${p.nombre || ''} ${p.apellido || ''}`.trim()
const finCapa = c => ['Completada', 'Verificada', 'Cancelada'].includes(c.estado)
const abierto = t => !['resuelto', 'rechazado', 'cancelado'].includes(t.estado)
const atraso = (fecha, hoy) => Boolean(fecha && fechaInforme(fecha) < hoy)
const fechaLegible = value => value ? fechaInforme(value).split('-').reverse().join('/') : 'Sin fecha'
const vence = (fecha, hoy) => fecha ? `${fechaLegible(fecha)}${atraso(fecha, hoy) ? ' · Vencido' : ''}` : 'Sin fecha objetivo'
export function rangoInformeSede(now = new Date()) {
  return { desde: format(subDays(now, 30), 'yyyy-MM-dd'), hasta: format(subDays(now, 1), 'yyyy-MM-dd') }
}
export function validarRangoInforme(desde, hasta, now = new Date()) {
  if (![desde, hasta].every(v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && isValid(parseISO(v)) && format(parseISO(v), 'yyyy-MM-dd') === v)) throw new Error('Indicá fechas válidas.')
  if (desde > hasta) throw new Error('La fecha desde debe ser anterior o igual a la fecha hasta.')
  if (hasta > format(now, 'yyyy-MM-dd')) throw new Error('El período no puede incluir fechas futuras.')
  if (eachDayOfInterval({ start: parseISO(desde), end: parseISO(hasta) }).length > 366) throw new Error('Elegí un período de hasta 366 días.')
}

// A section is either complete or unavailable: never keep a truncated/failed page as a zero.
export async function leerPaginasInforme(query) {
  const rows = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query().order('id').range(offset, offset + 499)
    if (error) throw error
    if (!Array.isArray(data)) throw new Error('Respuesta sin datos')
    rows.push(...data)
    if (data.length < 500) return rows
  }
}
export async function cargarInformeSede({ sedeId, sedeNombre, desde, hasta }) {
  validarRangoInforme(desde, hasta)
  const sources = {}
  async function load(key, query) {
    try { sources[key] = { rows: await leerPaginasInforme(query) } }
    catch { sources[key] = { rows: [], error: 'No se pudo consultar. Revisá los permisos o reintentá.' } }
  }
  await Promise.all([
    load('sede', () => db().from('sedes').select('id,nombre,responsable,direccion,activa,en_pausa,dias_operacion,created_at').eq('id', sedeId)),
    load('registros', () => db().from('registros').select('id,fecha_reporte,turno,estado_general,estado_a,estado_b,estado_c,estado_d,estado_e,estado_f,estado_g,estado_h,detalle_a,detalle_b,detalle_c,detalle_d,detalle_e,detalle_f,detalle_g,detalle_h,motivo_escalamiento').eq('sede_id', sedeId).gte('fecha_reporte', desde).lte('fecha_reporte', hasta)),
    load('tickets', () => supabase.from('mnt_tickets').select('id,numero,activo_id,descripcion,estado,prioridad,responsable,fecha_limite,created_at,updated_at,subtareas').eq('sede_id', sedeId).not('estado', 'in', '(resuelto,rechazado,cancelado)')),
    load('capas', () => db().from('capa').select('id,codigo,auditoria_codigo,no_conformidad_id,descripcion,estado,responsable,fecha_limite,updated_at').eq('sede_id', sedeId)),
    load('ncs', () => db().from('no_conformidades').select('id,codigo,descripcion,estado,responsable,fecha_apertura,updated_at').eq('sede_id', sedeId).not('estado', 'eq', 'Verificada')),
    load('personas', () => supabase.from('v_personas').select('id,nombre,apellido,puesto,sede_ids,puntaje_promedio,evaluacion_confidencial,evaluacion_propia,fecha_ingreso').eq('activo', true).contains('sede_ids', [Number(sedeId)])),
    load('activos', () => supabase.from('mnt_activos').select('id,codigo_interno,nombre,tipo,estado,responsable,marca,modelo,updated_at,vencimiento_seguro,vencimiento_vtv,vencimiento_senasa,vencimiento_rmtsa,bien_concesionado,concesion_propietario,concesion_referencia').eq('sede_id', sedeId)),
    load('modulos', () => db().from('modulo_novedades').select('id,registro_id,modulo_label,descripcion,fecha_reporte').eq('sede_id', sedeId).eq('privada', false).gte('fecha_reporte', desde).lte('fecha_reporte', hasta)),
    load('vehiculoNovedades', () => db().from('vehiculo_novedades').select('id,registro_id,activo_id,activo_nombre,descripcion,estado,fecha_reporte').eq('sede_id', sedeId).not('estado', 'in', '(Resuelto,Resuelta,Cerrado,Cerrada)')),
    load('docsSede', () => db().from('documentacion_items').select('id,entity_id,codigo,titulo,estado,fecha_vencimiento,updated_at').eq('entity_type', 'sede').eq('entity_id', String(sedeId))),
  ])
  if (!sources.sede.rows.length) sources.sede.error = 'Sede no disponible para esta sesión.'
  const personas = sources.personas.rows
  const vehiculos = sources.activos.rows.filter(a => a.tipo === 'VEHICULO')
  const related = async (key, parent, ids, query) => {
    if (sources[parent].error) { sources[key] = { rows: [], error: 'No se pudo consultar la información relacionada.' }; return }
    if (!ids.length) { sources[key] = { rows: [] }; return }
    // Bound the URL size; failure in any batch invalidates the whole section.
    try {
      const rows = []
      for (let i = 0; i < ids.length; i += 100) rows.push(...await leerPaginasInforme(() => query(ids.slice(i, i + 100))))
      sources[key] = { rows }
    } catch { sources[key] = { rows: [], error: 'No se pudo consultar. Revisá los permisos o reintentá.' } }
  }
  await Promise.all([
    related('docsPersonal', 'personas', personas.map(p => String(p.id)), ids => db().from('documentacion_items').select('id,entity_id,codigo,titulo,estado,fecha_vencimiento,updated_at').eq('entity_type', 'persona').in('entity_id', ids)),
    related('evaluaciones', 'personas', personas.filter(p => p.puntaje_promedio != null && !p.evaluacion_propia).map(p => p.id), ids => supabase.from('v_evaluaciones').select('id,persona_id,fecha_evaluacion,puntaje_calculado').in('persona_id', ids).lte('fecha_evaluacion', hasta)),
    related('docsVehiculo', 'activos', vehiculos.map(v => String(v.id)), ids => db().from('documentacion_items').select('id,entity_id,codigo,titulo,estado,fecha_vencimiento,updated_at').eq('entity_type', 'vehiculo').in('entity_id', ids)),
    related('preventivos', 'activos', vehiculos.map(v => v.id), ids => supabase.from('mnt_planes').select('id,activo_id,nombre,proxima_fecha,responsable,activo').in('activo_id', ids).eq('activo', true)),
  ])
  return construirInformeSede({ sources, sedeId, sedeNombre, desde, hasta })
}

export function resumenDocumental(entities, rows, template, hoy) {
  let total = 0, vigentes = 0, noAplica = 0, faltantes = 0, vencidos = 0
  const detalle = []
  for (const entity of entities) {
    for (const item of template) {
      const doc = rows.find(r => String(r.entity_id) === String(entity.id) && r.codigo === item.codigo)
      if (doc?.estado === 'no_aplica') { noAplica++; continue }
      total++
      const vencido = doc?.estado === 'vencido' || atraso(doc?.fecha_vencimiento, hoy)
      if (doc?.estado === 'vigente' && !vencido) { vigentes++; continue }
      if (vencido) vencidos++
      if (!doc) faltantes++
      detalle.push([entity.nombre, item.titulo, vencido ? 'Vencido' : doc?.estado || 'Sin carga', fechaLegible(doc?.fecha_vencimiento)])
    }
  }
  return { total, vigentes, noAplica, faltantes, vencidos, detalle, valor: pct(vigentes, total) }
}

export function construirInformeSede({ sources, sedeId, sedeNombre, desde, hasta, now = new Date() }) {
  validarRangoInforme(desde, hasta, now)
  const hoy = format(now, 'yyyy-MM-dd')
  const data = key => sources[key]?.rows || []
  const error = (...keys) => keys.some(k => !sources[k] || sources[k].error)
  const sede = data('sede')[0] || { id: sedeId, nombre: sedeNombre }
  const summary = [], sections = []
  const add = (id, title, keys, value, note, columns, rows) => {
    const unavailable = error(...keys)
    summary.push({ id, area: title, valor: unavailable ? 'No se pudo consultar' : value, detalle: unavailable ? 'Información no disponible; no equivale a cero.' : note, error: unavailable })
    sections.push({ id, title, note: unavailable ? 'Información no disponible; no equivale a cero.' : note, columns, rows: unavailable ? [] : rows, error: unavailable })
  }
  const personas = data('personas'), activos = data('activos'), tickets = data('tickets').filter(abierto)
  const capas = data('capas'), pendientes = capas.filter(c => !finCapa(c)), ncs = data('ncs')
  const registros = data('registros')
  const operativo = sede.activa !== false && !sede.en_pausa && Array.isArray(sede.dias_operacion)
  const dias = eachDayOfInterval({ start: parseISO(desde), end: parseISO(hasta) }).filter(d => {
    const f = format(d, 'yyyy-MM-dd')
    return f < hoy && (!sede.created_at || f >= fechaInforme(sede.created_at)) && sede.dias_operacion?.includes(d.getDay())
  }).map(d => format(d, 'yyyy-MM-dd'))
  const cargados = new Set(registros.map(r => fechaInforme(r.fecha_reporte)))
  const faltan = dias.filter(d => !cargados.has(d))
  add('reportes', 'Reportes diarios', ['registros', 'sede'], operativo ? pct(dias.length - faltan.length, dias.length) : 'Sin base calculable',
    `${registros.length} registros. Cobertura por día operativo con al menos un reporte; no por turno. Se excluye hoy. Calendario actual, sin historial de pausas.${operativo ? '' : ' Sede inactiva, pausada o sin calendario.'}`,
    ['Día operativo', 'Carga'], operativo ? dias.map(d => [fechaLegible(d), cargados.has(d) ? 'Sí' : 'Falta reporte']) : [])

  for (const [id, title, entities, template, keys] of [
    ['docsPersonal', 'Documentación del personal', personas.map(p => ({ id: p.id, nombre: nombre(p) })), PERSONA_DOCUMENTACION_TEMPLATE, ['personas', 'docsPersonal']],
    ['docsSede', 'Documentación de sede', [sede], SEDE_DOCUMENTACION_TEMPLATE, ['sede', 'docsSede']],
  ]) {
    const doc = resumenDocumental(entities, data(id), template, hoy)
    add(id, title, keys, doc.valor, `${doc.faltantes} sin carga · ${doc.vencidos} vencidos · ${doc.noAplica} no aplican. Checklist vigente: los requisitos sin carga cuentan como pendientes; “No aplica” se excluye. Estado declarado, no verificación de archivos adjuntos.`, ['Persona / sede', 'Requisito pendiente', 'Estado', 'Vencimiento'], doc.detalle)
  }

  const restringidas = personas.filter(p => p.puntaje_promedio == null || p.evaluacion_propia)
  const encargados = personas.filter(p => /\bencargad[oa]\b|\bresponsable de escala\b/i.test(p.puesto || ''))
  const trimestreDesde = format(subMonths(parseISO(hasta), 3), 'yyyy-MM-dd')
  const elegibles = personas.filter(p => !restringidas.includes(p) && !encargados.includes(p) && (!p.fecha_ingreso || fechaInforme(p.fecha_ingreso) <= hasta))
  const latest = new Map()
  data('evaluaciones').forEach(e => {
    if (!e.fecha_evaluacion || fechaInforme(e.fecha_evaluacion) > hasta) return
    const old = latest.get(String(e.persona_id))
    if (!old || String(e.fecha_evaluacion) > String(old.fecha_evaluacion) || (e.fecha_evaluacion === old.fecha_evaluacion && String(e.id) > String(old.id))) latest.set(String(e.persona_id), e)
  })
  const evaluadas = elegibles.filter(p => {
    const score = Number(latest.get(String(p.id))?.puntaje_calculado)
    return score >= 1 && score <= 5
  })
  const scores = evaluadas.map(p => Number(latest.get(String(p.id)).puntaje_calculado)).filter(s => s >= 1 && s <= 5)
  const promedio = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) + '/5' : 'Sin puntajes válidos'
  add('evaluaciones', 'Evaluaciones del personal', ['personas', 'evaluaciones'], pct(evaluadas.length, elegibles.length),
    `Última evaluación disponible hasta ${fechaLegible(hasta)}, incluyendo anteriores al período del informe. Promedio de sede: ${promedio} (${scores.length} personas con puntaje válido, una evaluación por persona). Últimos tres meses (${fechaLegible(trimestreDesde)} al ${fechaLegible(hasta)}): ${evaluadas.filter(p => fechaInforme(latest.get(String(p.id)).fecha_evaluacion) >= trimestreDesde).length} personas evaluadas. Cobertura sobre ${elegibles.length} personas elegibles; ${encargados.length} encargados / responsables de escala y ${restringidas.length} restringidas, excluidas del cálculo. Sin evaluación y puntajes cero no reducen el promedio.`,
    ['Persona', 'Puesto', 'Última evaluación disponible', 'Puntaje / resultado'], personas.map(p => {
      const e = latest.get(String(p.id)), restricted = restringidas.includes(p)
      const score = e?.puntaje_calculado
      const posterior = p.fecha_ingreso && fechaInforme(p.fecha_ingreso) > hasta
      const valido = Number(score) >= 1 && Number(score) <= 5
      return [nombre(p), p.puesto || 'Sin puesto', restricted ? 'Acceso restringido' : posterior ? 'Ingreso posterior al período' : e ? `${fechaLegible(e.fecha_evaluacion)} · ${fechaInforme(e.fecha_evaluacion) >= trimestreDesde ? 'Últimos tres meses' : 'Anterior al trimestre'}` : 'Sin evaluación visible', restricted ? 'Restringido' : posterior ? '-' : `${valido ? `${Number(score).toFixed(2)}/5 · ${getResultadoEvaluacion(score)}` : e ? 'Sin puntaje válido' : '-'}${encargados.includes(p) ? ' · Encargado: excluido del cálculo' : ''}`]
    }))

  const completos = activos.filter(a => a.nombre && a.tipo && a.estado && a.codigo_interno)
  add('activos', 'Activos', ['activos'], activos.length ? `Sí · ${activos.length}` : 'Sin activos registrados',
    `Fichas básicas completas: ${pct(completos.length, activos.length)} (nombre, tipo, estado y código). No certifica inventario completo: no hay cantidad esperada definida.`,
    ['Código / nombre', 'Tipo / estado', 'Responsable', 'Titularidad'], activos.map(a => [`${a.codigo_interno || 'Sin código'} · ${a.nombre || 'Sin nombre'}`, `${a.tipo || 'Sin tipo'} · ${a.estado || 'Sin estado'}`, a.responsable || 'Sin asignar', [concesionLabel(a.bien_concesionado), ...(a.bien_concesionado === true ? [a.concesion_propietario || 'Entidad sin registrar', a.concesion_referencia] : [])].filter(Boolean).join(' · ')]))

  const groups = [...new Set(pendientes.map(c => c.auditoria_codigo).filter(Boolean))]
  const avancePlan = groups.map(g => { const all = capas.filter(c => c.auditoria_codigo === g && c.estado !== 'Cancelada'); return `${g}: ${pct(all.filter(finCapa).length, all.length)}` }).join('; ')
  add('capas', 'Planes y acciones CAPA', ['capas'], `${groups.length} planes activos · ${pendientes.length} acciones pendientes`,
    `${pendientes.filter(c => atraso(c.fecha_limite, hoy)).length} acciones vencidas · ${pendientes.filter(c => !c.fecha_limite).length} sin fecha. ${pendientes.filter(c => !c.auditoria_codigo).length} acciones sin plan agrupado. Avance por acciones completadas o verificadas: ${avancePlan || 'Sin planes activos agrupados'}.`,
    ['Acción / plan', 'Descripción', 'Estado / responsable', 'Fecha objetivo'], pendientes.map(c => [`${c.codigo || c.id} / ${c.auditoria_codigo || 'Sin plan'}`, c.descripcion || 'Sin descripción', `${c.estado || 'Sin estado'} · ${c.responsable || 'Sin asignar'}`, vence(c.fecha_limite, hoy)]))

  const progreso = t => { const s = Array.isArray(t.subtareas) ? t.subtareas : []; return s.length ? `${pct(s.filter(x => x.completada === true).length, s.length)} subtareas` : 'Sin subtareas medibles' }
  add('tickets', 'Tickets de mantenimiento', ['tickets'], tickets.length ? `Sí · ${tickets.length} abiertos` : 'Sin tickets abiertos',
    `${tickets.filter(t => atraso(t.fecha_limite, hoy)).length} vencidos · ${tickets.filter(t => !t.fecha_limite).length} sin fecha · ${tickets.filter(t => t.prioridad === 'critica').length} críticos. Avance medido únicamente cuando hay subtareas.`,
    ['Ticket / descripción', 'Estado / avance', 'Responsable / prioridad', 'Fecha objetivo'], tickets.map(t => [`#${t.numero || t.id} · ${t.descripcion || 'Sin descripción'}`, `${t.estado} · ${progreso(t)}`, `${t.responsable || 'Sin asignar'} · ${t.prioridad || 'Sin prioridad'}`, vence(t.fecha_limite, hoy)]))

  add('ncs', 'No conformidades', ['ncs'], `${ncs.filter(n => n.estado !== 'Cerrada').length} abiertas · ${ncs.filter(n => n.estado === 'Cerrada').length} cerradas sin verificar`,
    'Las NC no tienen fecha objetivo propia. Se informa apertura y vencimiento de acciones asociadas; “Cerrada” se distingue de “Verificada”.',
    ['NC / descripción', 'Estado / responsable', 'Apertura', 'Acciones vencidas'], ncs.map(n => [`${n.codigo || n.id} · ${n.descripcion || 'Sin descripción'}`, `${n.estado} · ${n.responsable || 'Sin asignar'}`, fechaLegible(n.fecha_apertura), error('capas') ? 'No se pudo consultar' : String(pendientes.filter(c => String(c.no_conformidad_id) === String(n.id) && atraso(c.fecha_limite, hoy)).length)]))

  const vehiculos = activos.filter(a => a.tipo === 'VEHICULO')
  const flotaRows = vehiculos.map(v => {
    const docs = resumenDocumental([{ id: v.id, nombre: v.nombre }], data('docsVehiculo'), VEHICULO_DOCUMENTACION_TEMPLATE, hoy)
    const vencimientos = [['Seguro', v.vencimiento_seguro], ['VTV', v.vencimiento_vtv], ['SENASA', v.vencimiento_senasa], ['RMTSA', v.vencimiento_rmtsa]].filter(([, f]) => atraso(f, hoy)).map(([k]) => k)
    return [v.nombre, `${v.marca || ''} ${v.modelo || ''} · ${v.estado || 'Sin estado'}`, error('docsVehiculo') ? 'Checklist no disponible' : `Checklist: ${docs.valor}`, vencimientos.length ? `Vencido en ficha: ${vencimientos.join(', ')}` : 'Sin vencimientos registrados en ficha']
  })
  add('flota', 'Flota asignada', ['activos'], vehiculos.length ? `Sí · ${vehiculos.length} vehículos` : 'Sin vehículo registrado',
    'Asignación según activos de tipo VEHICULO. La ausencia de registros no determina si corresponde asignar un vehículo. Se muestran checklist y fechas de ficha por separado.',
    ['Vehículo', 'Marca / modelo / estado', 'Documentación', 'Pendientes de ficha'], flotaRows)
  add('flotaPendientes', 'Novedades y servicios de flota', ['vehiculoNovedades', 'preventivos'], `${data('vehiculoNovedades').length} novedades pendientes · ${data('preventivos').length} planes preventivos`,
    'Pendientes actuales. Los tickets vinculados a vehículos están incluidos en mantenimiento; no se suman nuevamente.',
    ['Vehículo', 'Pendiente', 'Estado / responsable', 'Fecha'], [
      ...data('vehiculoNovedades').map(n => [n.activo_nombre || 'Sin vehículo', n.descripcion || 'Sin descripción', n.estado || 'Sin estado', fechaLegible(n.fecha_reporte)]),
      ...data('preventivos').map(p => [vehiculos.find(v => String(v.id) === String(p.activo_id))?.nombre || 'Sin vehículo', p.nombre, p.responsable || 'Sin asignar', vence(p.proxima_fecha, hoy)]),
    ])
  const novedades = registros.map(r => {
    const parts = 'abcdefgh'.split('').map(k => r[`detalle_${k}`]).filter(Boolean)
    if (r.motivo_escalamiento) parts.push(r.motivo_escalamiento)
    data('modulos').filter(m => String(m.registro_id) === String(r.id)).forEach(m => parts.push(`${m.modulo_label || 'Novedad'}: ${m.descripcion}`))
    const tiene = ['Hay novedades', 'Operación condicionada'].includes(r.estado_general) || parts.length || 'abcdefgh'.split('').some(k => r[`estado_${k}`] && !['Sin novedad', 'Sin novedades'].includes(r[`estado_${k}`]))
    return tiene ? [fechaLegible(r.fecha_reporte), r.turno || '-', r.estado_general || 'Con novedades', [...new Set(parts)].join(' | ') || (error('modulos') ? 'Detalle de módulos no disponible' : 'Sin detalle visible; revisar el registro')] : null
  }).filter(Boolean)
  add('novedades', 'Novedades de bitácora', ['registros'], `${novedades.length} reportes con novedades`,
    `Detalle visible del período, sin recortar descripciones.${error('modulos') ? ' No se pudieron consultar las novedades de módulos; detalle parcial.' : ' Incluye módulos públicos vinculados.'}`,
    ['Fecha', 'Turno', 'Estado', 'Detalle'], novedades)

  return { sede, desde, hasta, generado: format(now, 'dd/MM/yyyy HH:mm'), hoy, summary, sections,
    warnings: Object.keys(sources).filter(k => sources[k].error).map(k => `Fuente no disponible: ${k}`) }
}
