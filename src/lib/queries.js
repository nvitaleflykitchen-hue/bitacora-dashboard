import { db, supabase } from './supabase'
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, eachDayOfInterval, getDaysInMonth } from 'date-fns'
import { notifyHighPriority } from './pushNotifications'

// ─── SEDES ────────────────────────────────────────────────────────────────────

export async function getSedes(sedeIds = null) {
  let query = db().from('sedes').select('*').eq('activa', true).order('nombre')
  if (sedeIds?.length) query = query.in('id', sedeIds)
  const { data, error } = await query
  if (error) throw error
  return data
}

// ─── REGISTROS HOY ────────────────────────────────────────────────────────────

export async function getRegistrosHoy(sedeIds = null) {
  const hoy = new Date()
  const desde = startOfDay(hoy).toISOString()
  const hasta = endOfDay(hoy).toISOString()
  let query = db().from('registros').select('*, sedes(*)')
    .gte('fecha_reporte', desde)
    .lte('fecha_reporte', hasta)
    .order('fecha_reporte', { ascending: false })
  if (sedeIds?.length) query = query.in('sede_id', sedeIds)
  const { data, error } = await query
  if (error) throw error
  return data
}

// ─── REGISTROS POR SEDE (últimos 30 días) ────────────────────────────────────

export async function getRegistrosBySede(sedeId, dias = 30) {
  const hace = subDays(new Date(), dias)
  let query = db()
    .from('registros')
    .select('*, sedes(*)')
    .gte('fecha_reporte', hace.toISOString())
    .lte('fecha_reporte', new Date().toISOString())
    .order('fecha_reporte', { ascending: false })
  if (sedeId) query = query.eq('sede_id', sedeId)
  const { data, error } = await query
  if (error) throw error
  return data
}

// ─── REGISTRO INDIVIDUAL ──────────────────────────────────────────────────────

export async function getRegistroById(id) {
  const { data, error } = await db()
    .from('registros')
    .select('*, sedes(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// ─── REGISTROS POR RANGO DE FECHA ─────────────────────────────────────────────

export async function getRegistrosByFecha(desde, hasta, sedeIds = null) {
  let query = db().from('registros').select('*, sedes(*)')
    .gte('fecha_reporte', startOfDay(new Date(desde)).toISOString())
    .lte('fecha_reporte', endOfDay(new Date(hasta)).toISOString())
    .order('fecha_reporte', { ascending: false })
  if (sedeIds?.length) query = query.in('sede_id', sedeIds)
  const { data, error } = await query
  if (error) throw error
  return data
}

// ─── ESCALAMIENTOS ────────────────────────────────────────────────────────────

export async function getEscalamientosItems(filtros = {}) {
  let query = db()
    .from('escalamientos')
    .select('*, registros(*)')
    .order('created_at', { ascending: false })
  if (filtros.sedeIds?.length) query = query.in('sede_id', filtros.sedeIds)
  else if (filtros.sedeId)     query = query.eq('sede_id', filtros.sedeId)
  if (filtros.estado)          query = query.eq('estado', filtros.estado)
  if (filtros.tipo)            query = query.eq('tipo', filtros.tipo)
  if (filtros.desde)           query = query.gte('fecha_reporte', filtros.desde)
  if (filtros.hasta)           query = query.lte('fecha_reporte', filtros.hasta)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createEscalamientoItem(payload) {
  const { data, error } = await db()
    .from('escalamientos')
    .insert(payload)
    .select()
  if (error) throw error
  const created = data?.[0]
  if (created?.id) notifyHighPriority({ module:'escalamientos', entity_id:created.id })
  return created
}

export async function updateEscalamientoItem(id, payload) {
  const { data, error } = await db()
    .from('escalamientos')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
  if (error) throw error
  return data?.[0]
}

export async function getEscalamientos(filtros = {}) {
  let query = db()
    .from('registros')
    .select('*, sedes(*), tareas(id, titulo, estado, prioridad, responsable, fecha_limite, categoria)')
    .eq('requiere_escalamiento', true)
    .order('fecha_reporte', { ascending: false })
  if (filtros.sedeIds?.length) query = query.in('sede_id', filtros.sedeIds)
  else if (filtros.sedeId) query = query.eq('sede_id', filtros.sedeId)
  if (filtros.desde)  query = query.gte('fecha_reporte', startOfDay(new Date(filtros.desde)).toISOString())
  if (filtros.hasta)  query = query.lte('fecha_reporte', endOfDay(new Date(filtros.hasta)).toISOString())
  else                query = query.lte('fecha_reporte', new Date().toISOString())
  const { data, error } = await query
  if (error) { console.error('getEscalamientos error:', error); throw error }
  return data ?? []
}

// ─── TAREAS ───────────────────────────────────────────────────────────────────

export async function getTareas({ sedeId, sedeIds, prioridad, categoria, incluirResueltas } = {}) {
  let query = db()
    .from('tareas')
    .select('*, sedes(*), registros(id, fecha_reporte, sede_nombre, requiere_escalamiento), perfiles:responsable_id(id, nombre, email, telefono), contactos:contacto_id(id, nombre, email, telefono, cargo)')
    .order('created_at', { ascending: false })
  if (!incluirResueltas) {
    query = query.not('estado', 'in', '("Resuelto","Cancelado")')
  }
  if (sedeIds?.length) query = query.in('sede_id', sedeIds)
  else if (sedeId) query = query.eq('sede_id', sedeId)
  if (prioridad) query = query.eq('prioridad', prioridad)
  if (categoria) query = query.eq('categoria', categoria)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createTarea(payload) {
  const { data, error } = await db()
    .from('tareas')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  if (data?.id && String(data.prioridad).toLowerCase() === 'alta') {
    notifyHighPriority({ module:'tareas', entity_id:data.id, priority:data.prioridad })
  }
  return data
}

export async function updateTarea(id, payload) {
  const { data, error } = await db()
    .from('tareas')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  if (data?.id && String(data.prioridad).toLowerCase() === 'alta') {
    notifyHighPriority({ module:'tareas', entity_id:data.id, priority:data.prioridad })
  }
  return data
}

// ─── NO CONFORMIDADES ─────────────────────────────────────────────────────────

export async function getNoConformidades(filtros = {}) {
  let query = db()
    .from('no_conformidades')
    .select('*, sedes(*), capa(*)')
    .order('created_at', { ascending: false })
  if (filtros.estado) query = query.eq('estado', filtros.estado)
  if (filtros.sedeIds?.length) query = query.in('sede_id', filtros.sedeIds)
  else if (filtros.sedeId) query = query.eq('sede_id', filtros.sedeId)
  if (filtros.desde)  query = query.gte('fecha_apertura', filtros.desde)
  if (filtros.hasta)  query = query.lte('fecha_apertura', filtros.hasta)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createNoConformidad(payload) {
  // generar código NC-YYYY-NNN
  const anio = new Date().getFullYear()
  const { count } = await db()
    .from('no_conformidades')
    .select('*', { count: 'exact', head: true })
    .like('codigo', `NC-${anio}-%`)
  const nro = String((count || 0) + 1).padStart(3, '0')
  const codigo = `NC-${anio}-${nro}`
  const { data, error } = await db()
    .from('no_conformidades')
    .insert({ ...payload, codigo })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateNoConformidad(id, payload) {
  const { data, error } = await db()
    .from('no_conformidades')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── CAPA ─────────────────────────────────────────────────────────────────────

export async function getCapa(filtros = {}) {
  let query = db()
    .from('capa')
    .select('*, no_conformidades(codigo, descripcion, sede_nombre), sedes(id, nombre)')
    .order('created_at', { ascending: false })
  if (filtros.tipo)             query = query.eq('tipo', filtros.tipo)
  if (filtros.estado)           query = query.eq('estado', filtros.estado)
  if (filtros.responsable)      query = query.ilike('responsable', `%${filtros.responsable}%`)
  if (filtros.auditoria_codigo) query = query.eq('auditoria_codigo', filtros.auditoria_codigo)
  if (filtros.sedeIds?.length)  query = query.in('sede_id', filtros.sedeIds)
  else if (filtros.sede_id)     query = query.eq('sede_id', filtros.sede_id)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createCapa(payload) {
  const anio = new Date().getFullYear()
  const prefijo = payload.tipo === 'Preventiva' ? 'PA' : 'CA'
  const { count } = await db()
    .from('capa')
    .select('*', { count: 'exact', head: true })
    .like('codigo', `${prefijo}-${anio}-%`)
  const nro = String((count || 0) + 1).padStart(3, '0')
  const codigo = `${prefijo}-${anio}-${nro}`
  const { data, error } = await db()
    .from('capa')
    .insert({ ...payload, codigo })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCapa(id, payload) {
  const { data, error } = await db()
    .from('capa')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── INDICADORES POR SEDE ─────────────────────────────────────────────────────

export async function getIndicadoresPorSede(dias = 30, sedeIds = null) {
  const desde = subDays(new Date(), dias).toISOString()
  let sedesQ = db().from('sedes').select('*').eq('activa', true)
  let regsQ  = db().from('registros').select('sede_id, sede_nombre, estado_general, requiere_escalamiento, fecha_reporte').gte('fecha_reporte', desde)
  let tarQ   = db().from('tareas').select('sede_id, estado, fecha_limite, created_at').gte('created_at', desde)
  if (sedeIds?.length) {
    sedesQ = sedesQ.in('id', sedeIds)
    regsQ  = regsQ.in('sede_id', sedeIds)
    tarQ   = tarQ.in('sede_id', sedeIds)
  }
  const [{ data: registros, error: e1 }, { data: sedes, error: e2 }, { data: tareas, error: e3 }] = await Promise.all([regsQ, sedesQ, tarQ])
  if (e1) throw e1
  if (e2) throw e2

  const diasPeriodo = dias
  return (sedes || []).map(sede => {
    const regs = (registros || []).filter(r => r.sede_id === sede.id)
    const totalRegs = regs.length
    const sinNovedades = regs.filter(r => r.estado_general === 'Sin novedades').length
    const escalamientos = regs.filter(r => r.requiere_escalamiento).length
    const tareasSede = (tareas || []).filter(t => t.sede_id === sede.id)
    const tareasResueltas = tareasSede.filter(t => t.estado === 'Resuelto').length
    const tareasTotal = tareasSede.length

    // % cumplimiento carga: reportes / dias del periodo
    const pctCumplimiento = diasPeriodo > 0 ? Math.min(100, Math.round((totalRegs / diasPeriodo) * 100)) : 0
    const pctLimpias = totalRegs > 0 ? Math.round((sinNovedades / totalRegs) * 100) : 0
    const tiempoMedioResolucion = tareasResueltas > 0
      ? Math.round(tareasSede
          .filter(t => t.estado === 'Resuelto' && t.fecha_limite)
          .reduce((acc, t) => {
            const dias2 = Math.abs((new Date(t.fecha_limite) - new Date(t.created_at)) / 86400000)
            return acc + dias2
          }, 0) / tareasResueltas)
      : null

    return {
      sede,
      totalRegs,
      sinNovedades,
      escalamientos,
      pctCumplimiento,
      pctLimpias,
      tareasTotal,
      tareasResueltas,
      tiempoMedioResolucion,
    }
  })
}

export async function getMapaCalorGestion(dias = 30, sedeIds = null) {
  const desde = format(subDays(new Date(), dias), 'yyyy-MM-dd')
  const hoy = format(new Date(), 'yyyy-MM-dd')
  let sedesQ = db().from('sedes').select('id,nombre,tipo,grupo_id').eq('activa', true).order('nombre')
  let registrosQ = db().from('registros').select('sede_id,requiere_escalamiento').gte('fecha_reporte', desde).eq('requiere_escalamiento', true)
  let tareasQ = db().from('tareas').select('sede_id,estado,fecha_limite').not('fecha_limite','is',null)
  let ticketsQ = supabase.from('mnt_tickets').select('sede_id,estado,fecha_limite')
  let comprasQ = db().from('requerimientos').select('sede_id,estado,enviado_at,cumplido_at,sla_dias,urgencia')
  let capasQ = db().from('capa').select('sede_id,sede_nombre,estado,fecha_limite').not('fecha_limite','is',null)
  let activosQ = supabase.from('mnt_activos').select('sede_id,tipo,vencimiento_seguro,vencimiento_vtv,vencimiento_senasa,vencimiento_rmtsa')
  let matafuegosQ = supabase.from('mnt_matafuegos').select('sede_id,vencimiento')

  if (Array.isArray(sedeIds)) {
    if (sedeIds.length === 0) return []
    sedesQ = sedesQ.in('id', sedeIds)
    registrosQ = registrosQ.in('sede_id', sedeIds)
    tareasQ = tareasQ.in('sede_id', sedeIds)
    ticketsQ = ticketsQ.in('sede_id', sedeIds)
    comprasQ = comprasQ.in('sede_id', sedeIds)
    capasQ = capasQ.in('sede_id', sedeIds)
    activosQ = activosQ.in('sede_id', sedeIds)
    matafuegosQ = matafuegosQ.in('sede_id', sedeIds)
  }

  const results = await Promise.all([sedesQ, registrosQ, tareasQ, ticketsQ, comprasQ, capasQ, activosQ, matafuegosQ])
  const error = results.find(result=>result.error)?.error
  if (error) throw error
  const [sedes, registros, tareas, tickets, compras, capas, activos, matafuegos] = results.map(result=>result.data || [])

  const diasHabiles = (inicio, fin = new Date()) => {
    const start = new Date(inicio); const end = new Date(fin)
    if (Number.isNaN(start.getTime()) || end < start) return 0
    start.setHours(0,0,0,0); end.setHours(0,0,0,0)
    let total = 0
    for (const d = new Date(start); d < end; d.setDate(d.getDate()+1)) if (![0,6].includes(d.getDay())) total++
    return total
  }
  const slaCompra = r => r.sla_dias || ({ alta:3, media:7, baja:15 }[r.urgencia] || 7)
  const estadosCompraCerrados = ['Cumplido','Rechazado','Cancelado']
  const estadosTicketCerrados = ['resuelto','rechazado','cerrado']
  const docVencida = activo => ['vencimiento_seguro','vencimiento_vtv','vencimiento_senasa','vencimiento_rmtsa'].some(field=>activo[field] && activo[field] < hoy)

  const buildRow = sede => {
    const id = sede.id
    const metricas = {
      novedades:(registros || []).filter(r=>r.sede_id===id).length,
      tareas:(tareas || []).filter(t=>t.sede_id===id && t.fecha_limite < hoy && !['Resuelto','Cancelado'].includes(t.estado)).length,
      tickets:(tickets || []).filter(t=>t.sede_id===id && t.fecha_limite && t.fecha_limite.slice(0,10) < hoy && !estadosTicketCerrados.includes(String(t.estado).toLowerCase())).length,
      compras:(compras || []).filter(r=>r.sede_id===id && r.enviado_at && !estadosCompraCerrados.includes(r.estado) && diasHabiles(r.enviado_at) > slaCompra(r)).length,
      capas:(capas || []).filter(c=>c.sede_id===id && c.fecha_limite < hoy && !['Completada','Verificada'].includes(c.estado)).length,
      documentacion:(activos || []).filter(a=>a.sede_id===id && a.tipo==='VEHICULO' && docVencida(a)).length +
        (matafuegos || []).filter(m=>m.sede_id===id && m.vencimiento && m.vencimiento < hoy).length,
    }
    return { sede, metricas, total:Object.values(metricas).reduce((sum,value)=>sum+value,0) }
  }

  const rows = (sedes || []).map(buildRow)
  if (!Array.isArray(sedeIds)) {
    const gestionCapas = (capas || []).filter(c=>!c.sede_id && c.sede_nombre==='Gestión' && c.fecha_limite < hoy && !['Completada','Verificada'].includes(c.estado)).length
    if (gestionCapas > 0) rows.push({
      sede:{ id:'gestion', nombre:'Gestión', tipo:'Corporativo' },
      metricas:{ novedades:0, tareas:0, tickets:0, compras:0, capas:gestionCapas, documentacion:0 },
      total:gestionCapas,
    })
  }
  return rows.sort((a,b)=>b.total-a.total || a.sede.nombre.localeCompare(b.sede.nombre, 'es'))
}

// ─── CUMPLIMIENTO CALENDARIO ──────────────────────────────────────────────────

export async function getCumplimientoCalendario(anio, mes) {
  const primerDia = new Date(anio, mes - 1, 1)
  const ultimoDia = endOfMonth(primerDia)
  const hoy = startOfDay(new Date())

  const [{ data: registros, error: e1 }, { data: sedes, error: e2 }, { data: tareas }] = await Promise.all([
    db().from('registros')
      .select('id, fecha_reporte, sede_id, sede_nombre, requiere_escalamiento, turno, reportante, estado_general, nivel_actividad, estado_a, estado_b, estado_c, estado_d, estado_e, estado_f, estado_g, estado_h, detalle_a, detalle_b, detalle_c, detalle_d, detalle_e, detalle_f, detalle_g, detalle_h, motivo_escalamiento, sedes(nombre)')
      .gte('fecha_reporte', primerDia.toISOString())
      .lte('fecha_reporte', ultimoDia.toISOString()),
    db().from('sedes').select('id').eq('activa', true),
    db().from('tareas').select('fecha_limite, estado')
      .gte('fecha_limite', format(primerDia, 'yyyy-MM-dd'))
      .lte('fecha_limite', format(ultimoDia, 'yyyy-MM-dd')),
  ])
  if (e1) throw e1
  if (e2) throw e2

  const totalSedes = (sedes || []).length
  const dias = eachDayOfInterval({ start: primerDia, end: ultimoDia })

  return dias.map(dia => {
    const diaStr = format(dia, 'yyyy-MM-dd')
    const esFuturo = dia > hoy

    const regsDelDia = (registros || []).filter(r => r.fecha_reporte.startsWith(diaStr))
    const sedesQueReportaron = new Set(regsDelDia.map(r => r.sede_id)).size
    const tieneEscalamiento = regsDelDia.some(r => r.requiere_escalamiento)
    const tieneTareaVencida = (tareas || []).some(t => t.fecha_limite === diaStr && t.estado !== 'Resuelto' && t.estado !== 'Cancelado')

    let estado = 'futuro'
    if (!esFuturo) {
      if (sedesQueReportaron === 0) estado = 'ninguna'
      else if (totalSedes > 0 && sedesQueReportaron >= totalSedes) estado = 'todas'
      else estado = 'algunas'
    }

    // Enriquecer registros con nombre de sede
    const regsEnriquecidos = regsDelDia.map(r => ({
      ...r,
      sede_nombre: r.sede_nombre || r.sedes?.nombre || String(r.sede_id),
    }))

    return { dia, diaStr, sedesQueReportaron, totalSedes, estado, tieneEscalamiento, tieneTareaVencida, registros: regsEnriquecidos }
  })
}

// ─── PERFILES ─────────────────────────────────────────────────────────────────

export async function getPerfiles() {
  const { data, error } = await db()
    .from('perfiles')
    .select('*')
    .order('nombre')
  if (error) throw error
  return data
}


// ─── GRUPOS ───────────────────────────────────────────────────────────────────

export async function getGrupos() {
  const { data, error } = await db()
    .from('grupos')
    .select('*')
    .eq('activo', true)
    .order('nombre')
  if (error) throw error
  return data ?? []
}

export async function createGrupo(payload) {
  const { data, error } = await db()
    .from('grupos')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function upsertPerfil(payload) {
  const { data, error } = await db()
    .from('perfiles')
    .upsert({ ...payload, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── KPIs HOY ─────────────────────────────────────────────────────────────────

export async function getKPIsHoy(sedeIds = null) {
  const [registrosHoy, sedes, escalamientosItems, tareas] = await Promise.all([
    getRegistrosHoy(sedeIds),
    getSedes(sedeIds),
    getEscalamientosItems({ sedeIds }),
    getTareas({ sedeIds }),
  ])
  const sedesQueReportaron = new Set(registrosHoy.map(r => r.sede_id))
  const escalamientosActivos = escalamientosItems.filter(e => e.estado !== 'Resuelto')
  return {
    totalRegistrosHoy: registrosHoy.length,
    sedesReportaronHoy: sedesQueReportaron.size,
    totalSedesActivas: sedes.length,
    escalamientosActivos: escalamientosActivos.length,
    tareasPendientes: tareas.length,
    registrosHoy,
    sedes,
    escalamientosRecientes: escalamientosActivos.slice(0, 5),
  }
}

// ─── TENDENCIA ESTADO GENERAL ─────────────────────────────────────────────────

export async function getEstadoTendencia(sedeIds = null, dias = 14) {
  const desde = new Date()
  desde.setDate(desde.getDate() - (dias - 1))
  desde.setHours(0, 0, 0, 0)

  let q = db()
    .from('registros')
    .select('fecha_reporte,estado_general')
    .gte('fecha_reporte', desde.toISOString())
    .order('fecha_reporte')

  if (sedeIds?.length) q = q.in('sede_id', sedeIds)

  const { data, error } = await q
  if (error) throw error

  // Agrupar por fecha y contar estados
  const byDate = {}
  for (const r of data || []) {
    const d = r.fecha_reporte?.slice(0, 10)
    if (!d) continue
    if (!byDate[d]) byDate[d] = { fecha: d, sin_novedades: 0, hay_novedades: 0, condicionada: 0 }
    if (r.estado_general === 'Sin novedades')          byDate[d].sin_novedades++
    else if (r.estado_general === 'Hay novedades')     byDate[d].hay_novedades++
    else if (r.estado_general === 'Operación condicionada') byDate[d].condicionada++
  }

  // Rellenar días sin datos y ordenar
  const result = []
  for (let i = 0; i < dias; i++) {
    const d = new Date(desde)
    d.setDate(d.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    result.push(byDate[key] || { fecha: key, sin_novedades: 0, hay_novedades: 0, condicionada: 0 })
  }
  return result
}

// ─── HISTORIAL SEMANAL DE ESTADO POR SEDE ─────────────────────────────────────

export async function getHistorialSemanal(sedeIds = null, semanas = 8) {
  const desde = new Date()
  desde.setDate(desde.getDate() - semanas * 7)
  desde.setHours(0, 0, 0, 0)

  let q = db()
    .from('registros')
    .select('fecha_reporte,estado_general')
    .gte('fecha_reporte', desde.toISOString())
    .order('fecha_reporte')

  if (sedeIds?.length) q = q.in('sede_id', sedeIds)

  const { data, error } = await q
  if (error) throw error

  const byWeek = {}
  for (const r of data || []) {
    const d = new Date(r.fecha_reporte)
    const day = d.getDay() || 7
    const mon = new Date(d); mon.setDate(d.getDate() - day + 1)
    const wk = mon.toISOString().slice(0, 10)
    if (!byWeek[wk]) byWeek[wk] = { semana: wk, sin_novedades: 0, hay_novedades: 0, condicionada: 0, total: 0 }
    byWeek[wk].total++
    if (r.estado_general === 'Sin novedades')               byWeek[wk].sin_novedades++
    else if (r.estado_general === 'Hay novedades')          byWeek[wk].hay_novedades++
    else if (r.estado_general === 'Operación condicionada') byWeek[wk].condicionada++
  }
  return Object.values(byWeek).sort((a, b) => a.semana.localeCompare(b.semana))
}

// ─── CHECKLISTS ────────────────────────────────────────────────────────────────

export async function getChecklistItems(tipo) {
  const { data, error } = await db()
    .from('checklist_items')
    .select('*')
    .eq('tipo', tipo)
    .eq('activo', true)
    .order('orden')
  if (error) throw error
  return data
}

export async function getChecklistHoy(sedeId, tipo) {
  const hoy = new Date().toISOString().slice(0, 10)
  const { data } = await db()
    .from('checklists')
    .select('*')
    .eq('sede_id', sedeId)
    .eq('tipo', tipo)
    .eq('fecha', hoy)
    .order('created_at', { ascending: false })
    .limit(1)
  return data?.[0] || null
}

export async function createChecklist(payload) {
  const { data, error } = await db()
    .from('checklists')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getChecklists({ sedeId, tipo, fechaDesde, sedeIds } = {}) {
  let q = db()
    .from('checklists')
    .select('*')
    .order('created_at', { ascending: false })
  if (sedeId)    q = q.eq('sede_id', sedeId)
  if (tipo)      q = q.eq('tipo', tipo)
  if (fechaDesde) q = q.gte('fecha', fechaDesde)
  if (sedeIds?.length) q = q.in('sede_id', sedeIds)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function updateChecklistItems(id, updates) {
  const { error } = await db().from('checklist_items').update(updates).eq('id', id)
  if (error) throw error
}

// ─── UTILIDADES ───────────────────────────────────────────────────────────────

export function getCategoriasCONNovedad(registro) {
  const cats = []
  for (const key of ['a','b','c','d','e','f','g','h']) {
    const est = registro[`estado_${key}`]
    if (est && est !== 'Sin novedad' && est !== 'Sin novedades') cats.push(key.toUpperCase())
  }
  return cats
}

// ─── CONTACTOS ─────────────────────────────────────────────────────────────────
export async function getContactos() {
  const { data, error } = await db()
    .from('contactos')
    .select('*')
    .eq('activo', true)
    .order('nombre')
  if (error) throw error
  return data
}

export async function upsertContacto(payload) {
  const { data, error } = await db()
    .from('contactos')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createRegistro(payload) {
  // Sanity check: si fecha_reporte viene del futuro (device clock mal), usar now()
  const ahora = new Date()
  const fr = payload.fecha_reporte ? new Date(payload.fecha_reporte) : null
  if (!fr || isNaN(fr) || (fr - ahora) > 3600000) {
    payload = { ...payload, fecha_reporte: ahora.toISOString() }
  }
  const { data, error } = await db()
    .from('registros')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getMisRegistrosHoy(email) {
  if (!email) return []
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const { data, error } = await db()
    .from('registros')
    .select('*, sedes(nombre, tipo)')
    .gte('fecha_reporte', hoy.toISOString())
    .eq('email_reportante', email)
    .order('fecha_reporte', { ascending: false })
  if (error) return []
  return data ?? []
}

export async function getMisTareas(userId) {
  const { data, error } = await db()
    .from('tareas')
    .select('*, sedes(nombre)')
    .eq('responsable_id', userId)
    .neq('estado', 'Resuelto')
    .order('prioridad', { ascending: false })
  if (error) return []
  return data ?? []
}

// ═══════════════════════════════════════════════════════════
// MANTENIMIENTO
// ═══════════════════════════════════════════════════════════

// ─── RESPONSABLES MNT ───────────────────────────────────────
export async function getResponsablesMnt() {
  const { data, error } = await supabase.from('mnt_responsables').select('id,nombre,nivel_escalacion').eq('activo', true).order('nombre')
  if (error) return []
  return data ?? []
}

// ─── ACTIVOS ────────────────────────────────────────────────
export async function getActivos(filtros = {}) {
  let q = supabase.from('mnt_activos').select('*').order('nombre')
  if (filtros.tipo)   q = q.eq('tipo', filtros.tipo)
  if (filtros.estado) q = q.eq('estado', filtros.estado)
  if (filtros.sedeIds?.length) q = q.in('sede_id', filtros.sedeIds)
  else if (filtros.sede_id) q = q.eq('sede_id', filtros.sede_id)
  if (filtros.sede)   q = q.eq('sede', filtros.sede)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}
export async function upsertActivo(payload) {
  const { data, error } = await supabase.from('mnt_activos').upsert({ ...payload, updated_at: new Date().toISOString() }).select().single()
  if (error) throw error
  return data
}

export async function getActivoById(id) {
  const { data, error } = await supabase.from('mnt_activos').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

// ─── TICKETS ────────────────────────────────────────────────
export const TICKET_TIPOS_VALIDOS = ['correctivo', 'preventivo']

export async function getTickets(filtros = {}) {
  let q = supabase.from('mnt_tickets').select('*').order('created_at', { ascending: false })
  if (filtros.estado)    q = q.eq('estado', filtros.estado)
  if (filtros.tipo)      q = q.eq('tipo', filtros.tipo)
  if (filtros.activo_id) q = q.eq('activo_id', filtros.activo_id)
  if (filtros.sedeIds?.length) q = q.in('sede_id', filtros.sedeIds)
  else if (filtros.sede_id) q = q.eq('sede_id', filtros.sede_id)
  if (filtros.sede)      q = q.eq('sede', filtros.sede)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getTicketsActivo({ id, nombre } = {}) {
  const queries = []
  if (id) queries.push(supabase.from('mnt_tickets').select('*').eq('activo_id', id))
  if (nombre) queries.push(supabase.from('mnt_tickets').select('*').eq('activo_nombre', nombre))
  if (!queries.length) return []

  const results = await Promise.all(queries)
  const error = results.find(result => result.error)?.error
  if (error) throw error

  const ticketsById = new Map()
  results.forEach(({ data }) => (data || []).forEach(ticket => ticketsById.set(ticket.id, ticket)))
  return [...ticketsById.values()].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
}
export async function getTicketsByEscalamientoIds(ids = []) {
  if (!ids?.length) return []
  const { data, error } = await supabase
    .from('mnt_tickets')
    .select('id, numero, estado, escalamiento_id')
    .in('escalamiento_id', ids)
  if (error) throw error
  return data ?? []
}
function normalizeTicketPayload(payload = {}) {
  const { sede_nombre, ...normalized } = payload
  if (!normalized.sede && sede_nombre) normalized.sede = sede_nombre
  if (normalized.tipo && !TICKET_TIPOS_VALIDOS.includes(normalized.tipo)) {
    throw new Error(`Tipo de ticket no válido: ${normalized.tipo}. Elegí Correctivo o Preventivo.`)
  }
  return normalized
}

export async function createTicket(payload) {
  const { data, error } = await supabase.from('mnt_tickets').insert(normalizeTicketPayload(payload)).select().single()
  if (error) throw error
  if (data?.id && ['alta','critica'].includes(String(data.prioridad).toLowerCase())) {
    notifyHighPriority({ module:'mantenimiento', entity_id:data.id, priority:data.prioridad })
  }
  return data
}
export async function updateTicket(id, payload) {
  const normalized = normalizeTicketPayload(payload)
  const { data, error } = await supabase.from('mnt_tickets').update({ ...normalized, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  if (data?.id && ['alta','critica'].includes(String(data.prioridad).toLowerCase())) {
    notifyHighPriority({ module:'mantenimiento', entity_id:data.id, priority:data.prioridad })
  }
  return data
}

// ─── PROVEEDORES ────────────────────────────────────────────
export async function getProveedores() {
  const { data, error } = await supabase.from('mnt_proveedores').select('*').order('nombre')
  if (error) throw error
  return data ?? []
}
export async function upsertProveedor(payload) {
  const { data, error } = await supabase.from('mnt_proveedores').upsert({ ...payload, updated_at: new Date().toISOString() }).select().single()
  if (error) throw error
  return data
}

// ─── PLANES PREVENTIVOS ─────────────────────────────────────
export async function getPlanes(activoId) {
  let q = supabase.from('mnt_planes').select('*').order('proxima_fecha')
  if (activoId) q = q.eq('activo_id', activoId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

// ─── MATAFUEGOS ─────────────────────────────────────────────
export async function getMatafuegos(filtros = {}) {
  let q = supabase.from('mnt_matafuegos').select('*').order('sede').order('codigo')
  if (filtros.sedeIds?.length) q = q.in('sede_id', filtros.sedeIds)
  else if (filtros.sede_id) q = q.eq('sede_id', filtros.sede_id)
  if (filtros.sede)    q = q.eq('sede', filtros.sede)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function upsertMatafuego(payload) {
  const { data, error } = await supabase.from('mnt_matafuegos').upsert({ ...payload, updated_at: new Date().toISOString() }).select().single()
  if (error) throw error
  return data
}

// ─── INSUMOS ────────────────────────────────────────────────
export async function getInsumos(filtros = {}) {
  // Nota: mantenimiento.insumos no tiene columna sede_id (stock es global, no por sede)
  const { data, error } = await supabase.from('mnt_insumos').select('*').order('nombre')
  if (error) throw error
  return data ?? []
}
export async function registrarMovimiento(payload) {
  // Registrar movimiento y actualizar stock
  const { data: insumo } = await supabase.from('mnt_insumos').select('stock_actual').eq('id', payload.insumo_id).single()
  const delta = payload.tipo === 'salida' ? -payload.cantidad : payload.cantidad
  await supabase.from('mnt_insumos').update({ stock_actual: (insumo?.stock_actual || 0) + delta }).eq('id', payload.insumo_id)
  const { data, error } = await supabase.from('mnt_movimientos').insert(payload).select().single()
  if (error) throw error
  return data
}

// ─── KPIs MANTENIMIENTO ─────────────────────────────────────
export async function getKPIsMantenimiento(sedeId = null, sedeIds = null) {
  let tq = supabase.from('mnt_tickets').select('estado, tipo, prioridad, sede_id')
  let aq = supabase.from('mnt_activos').select('estado, tipo, sede_id, vencimiento_seguro, vencimiento_vtv, vencimiento_senasa, vencimiento_rmtsa')
  let mq = supabase.from('mnt_matafuegos').select('estado, vencimiento, sede_id')
  if (sedeIds?.length) { tq = tq.in('sede_id', sedeIds); aq = aq.in('sede_id', sedeIds); mq = mq.in('sede_id', sedeIds) }
  else if (sedeId) { tq = tq.eq('sede_id', sedeId); aq = aq.eq('sede_id', sedeId); mq = mq.eq('sede_id', sedeId) }
  const [{ data: tickets }, { data: activos }, { data: matafuegos }] = await Promise.all([tq, aq, mq])
  const hoy = new Date().toISOString().split('T')[0]
  const docVencida = a => [a.vencimiento_seguro, a.vencimiento_vtv, a.vencimiento_senasa, a.vencimiento_rmtsa].some(f => f && f < hoy)
  return {
    ticketsAbiertos:    (tickets||[]).filter(t => t.estado === 'abierto').length,
    ticketsCriticos:    (tickets||[]).filter(t => t.prioridad === 'critica' && t.estado !== 'resuelto').length,
    activosEnReparacion:(activos||[]).filter(a => a.estado === 'en_reparacion').length,
    matafuegosVencidos: (matafuegos||[]).filter(m => m.vencimiento && m.vencimiento < hoy).length,
    vehiculosDocVencida:(activos||[]).filter(a => a.tipo === 'VEHICULO' && docVencida(a)).length,
    totalActivos:       (activos||[]).length,
    totalTickets:       (tickets||[]).length,
  }
}

// ═══════════════════════════════════════════════════════════
// SEDE CONTACTOS (responsables por sede)
// ═══════════════════════════════════════════════════════════
export async function getSedeContactos(sedeId) {
  const { data, error } = await db()
    .from('sede_contactos')
    .select('id, rol, activo, contactos(id, nombre, email, telefono, cargo, empresa)')
    .eq('sede_id', sedeId)
    .eq('activo', true)
    .order('rol')
  if (error) return []
  return data ?? []
}

export async function getAllSedeContactos() {
  const { data, error } = await db()
    .from('sede_contactos')
    .select('id, sede_id, contacto_id, rol, activo, sedes(nombre), contactos(id, nombre, email, telefono, cargo, perfil_id)')
    .order('sede_id')
  if (error) return []
  return data ?? []
}

export async function updateContacto(id, payload) {
  const { data, error } = await db()
    .from('contactos')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Vincula un contacto a un usuario del sistema y sincroniza sede_ids del perfil
export async function linkContactoToPerfil(contactoId, perfilId) {
  // 1. Obtener todas las sedes donde aparece este contacto
  const { data: asignaciones } = await db()
    .from('sede_contactos')
    .select('sede_id')
    .eq('contacto_id', contactoId)
    .eq('activo', true)
  const sedeIds = (asignaciones || []).map(a => a.sede_id)

  // 2. Actualizar contacto con perfil_id
  await db().from('contactos').update({ perfil_id: perfilId || null }).eq('id', contactoId)

  // 3. Sincronizar sede_ids del perfil (si se vinculó uno)
  if (perfilId && sedeIds.length > 0) {
    await db().from('perfiles').update({ sede_ids: sedeIds }).eq('id', perfilId)
  }
}

export async function upsertSedeContacto(payload) {
  const { data, error } = await db()
    .from('sede_contactos')
    .upsert(payload, { onConflict: 'sede_id,contacto_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSedeContacto(id) {
  const { error } = await db().from('sede_contactos').delete().eq('id', id)
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════
// REQUERIMIENTOS DE COMPRAS
// ═══════════════════════════════════════════════════════════
export async function getRequerimientos(filtros = {}) {
  let q = db()
    .from('requerimientos')
    .select('*, sedes(nombre)')
    .order('created_at', { ascending: false })
  if (filtros.estado)  q = q.eq('estado', filtros.estado)
  if (filtros.urgencia) q = q.eq('urgencia', filtros.urgencia)
  if (filtros.sedeIds?.length) q = q.in('sede_id', filtros.sedeIds)
  else if (filtros.sedeId) q = q.eq('sede_id', filtros.sedeId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function createRequerimiento(payload) {
  const { data, error } = await db()
    .from('requerimientos')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  if (data?.id && data.urgencia === 'alta') {
    notifyHighPriority({ module:'compras', entity_id:data.id, priority:data.urgencia })
  }
  return data
}

export async function updateRequerimiento(id, payload) {
  const { data, error } = await db()
    .from('requerimientos')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  if (data?.id && data.urgencia === 'alta') {
    notifyHighPriority({ module:'compras', entity_id:data.id, priority:data.urgencia })
  }
  return data
}

export async function bulkInsertContactos(contactos) {
  // Normalizar: email vacío → null para respetar el UNIQUE constraint
  const normalized = contactos.map(c => ({ ...c, email: c.email?.trim() || null }))
  // Split: with email (upsert) vs without email (insert only)
  const conEmail    = normalized.filter(c => c.email)
  const sinEmail    = normalized.filter(c => !c.email)
  const results = []

  if (conEmail.length > 0) {
    const { data, error } = await db()
      .from('contactos')
      .upsert(conEmail, { onConflict: 'email', ignoreDuplicates: false })
      .select()
    if (error) throw error
    results.push(...(data || []))
  }
  if (sinEmail.length > 0) {
    const { data, error } = await db()
      .from('contactos')
      .insert(sinEmail)
      .select()
    if (error) throw error
    results.push(...(data || []))
  }
  return results
}

// ═══════════════════════════════════════════════════════════
// AUDITORÍA UNIVERSAL
// ═══════════════════════════════════════════════════════════

/**
 * Inserta un registro manual en la auditoría (para acciones sin trigger DB).
 * tabla: string, registro_id: string|null, accion: string, descripcion: string, extras: {}
 */
export async function logAuditoria({ tabla, registro_id, accion, descripcion, campo, valor_antes, valor_nuevo, sede_id, sede_nombre } = {}) {
  try {
    await supabase.rpc('log_auditoria', {
      p_tabla:        tabla,
      p_registro_id:  registro_id ? String(registro_id) : null,
      p_accion:       accion,
      p_descripcion:  descripcion,
      p_campo:        campo        || null,
      p_valor_antes:  valor_antes  || null,
      p_valor_nuevo:  valor_nuevo  || null,
      p_sede_id:      sede_id      || null,
      p_sede_nombre:  sede_nombre  || null,
    })
  } catch (e) {
    // Audit log nunca debe romper el flujo
    console.warn('[audit]', e?.message)
  }
}

/**
 * Lee el log de auditoría con filtros opcionales.
 * filtros: { tabla, registro_id, usuario_id, accion, desde, hasta, limit }
 */
export async function getAuditoria(filtros = {}) {
  let q = supabase
    .from('v_auditoria')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filtros.limit || 500)

  if (filtros.tabla)       q = q.eq('tabla', filtros.tabla)
  if (filtros.registro_id) q = q.eq('registro_id', String(filtros.registro_id))
  if (filtros.usuario_id)  q = q.eq('usuario_id', filtros.usuario_id)
  if (filtros.accion)      q = q.eq('accion', filtros.accion)
  if (filtros.desde)       q = q.gte('created_at', filtros.desde)
  if (filtros.hasta)       q = q.lte('created_at', filtros.hasta)
  if (filtros.buscar)      q = q.ilike('descripcion', `%${filtros.buscar}%`)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

/**
 * Alias: auditoría específica de un ticket
 */
export async function getAuditoriaTicket(ticketId) {
  return getAuditoria({ tabla: 'mantenimiento.tickets', registro_id: ticketId, limit: 100 })
}

// ═══════════════════════════════════════════════════════════
// ALERTAS / NOTIFICACIONES INTERNAS
// ═══════════════════════════════════════════════════════════

/**
 * Devuelve un objeto con conteos de alertas activas.
 * Se llama al cargar la app y se puede refrescar cada N minutos.
 */
export async function getAlertas() {
  try {
    const [ticketsRes, matafuegosRes, capaRes, vehiculosRes] = await Promise.all([
      supabase
        .from('mnt_tickets')
        .select('id, responsable_id, prioridad, estado, fecha_limite, created_at'),
      supabase
        .from('mnt_matafuegos')
        .select('id, vencimiento, estado'),
      db()
        .from('capa')
        .select('id, codigo, estado, fecha_limite, sede_nombre')
        .not('estado', 'in', '("Completada","Verificada")')
        .not('fecha_limite', 'is', null),
      supabase
        .from('mnt_activos')
        .select('id, nombre, vencimiento_seguro, vencimiento_vtv, vencimiento_senasa, vencimiento_rmtsa')
        .eq('tipo', 'VEHICULO'),
    ])

    const tickets = ticketsRes.data ?? []
    const matafuegos = matafuegosRes.data ?? []
    const capas = capaRes.data ?? []
    const vehiculos = vehiculosRes.data ?? []
    const ahora = new Date()
    const en7dias  = new Date(ahora.getTime() +  7 * 24 * 60 * 60 * 1000)
    const en30dias = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000)

    const abiertos = tickets.filter(t => !['resuelto','cerrado'].includes(t.estado))
    const sinAsignar = abiertos.filter(t => !t.responsable_id)
    const vencidosSLA = abiertos.filter(t => t.fecha_limite && new Date(t.fecha_limite) < ahora)
    const criticos = abiertos.filter(t => t.prioridad === 'critica')
    
    // Tickets abiertos hace más de 30 días
    const diasAbiertoMax = 30
    const antiguos = abiertos.filter(t => {
      const dias = (ahora - new Date(t.created_at)) / (1000 * 60 * 60 * 24)
      return dias > diasAbiertoMax
    })

    const matafuegosVencidos = matafuegos.filter(m =>
      m.vencimiento && new Date(m.vencimiento) < ahora
    )
    const matafuegosPorVencer = matafuegos.filter(m =>
      m.vencimiento &&
      new Date(m.vencimiento) >= ahora &&
      new Date(m.vencimiento) <= en30dias
    )

    const DOC_FIELDS = ['vencimiento_seguro','vencimiento_vtv','vencimiento_senasa','vencimiento_rmtsa']
    const vehiculosDocVencida = vehiculos.filter(v =>
      DOC_FIELDS.some(f => v[f] && new Date(v[f]) < ahora)
    )
    const vehiculosDocPorVencer = vehiculos.filter(v =>
      !DOC_FIELDS.some(f => v[f] && new Date(v[f]) < ahora) &&
      DOC_FIELDS.some(f => v[f] && new Date(v[f]) >= ahora && new Date(v[f]) <= en30dias)
    )

    const alertas = []

    if (criticos.length > 0) {
      alertas.push({
        id: 'criticos',
        nivel: 'critico',
        mensaje: `${criticos.length} ticket${criticos.length > 1 ? 's' : ''} CRÍTICO${criticos.length > 1 ? 'S' : ''} abierto${criticos.length > 1 ? 's' : ''}`,
        count: criticos.length,
        navegarA: 'mntTickets',
      })
    }

    if (vencidosSLA.length > 0) {
      alertas.push({
        id: 'vencidos_sla',
        nivel: 'critico',
        mensaje: `${vencidosSLA.length} ticket${vencidosSLA.length > 1 ? 's' : ''} con SLA vencido`,
        count: vencidosSLA.length,
        navegarA: 'mntTickets',
      })
    }

    if (matafuegosVencidos.length > 0) {
      alertas.push({
        id: 'matafuegos_vencidos',
        nivel: 'critico',
        mensaje: `${matafuegosVencidos.length} matafuego${matafuegosVencidos.length > 1 ? 's' : ''} vencido${matafuegosVencidos.length > 1 ? 's' : ''}`,
        count: matafuegosVencidos.length,
        navegarA: 'mntMatafuegos',
      })
    }

    if (vehiculosDocVencida.length > 0) {
      alertas.push({
        id: 'flota_doc_vencida',
        nivel: 'critico',
        mensaje: `${vehiculosDocVencida.length} vehículo${vehiculosDocVencida.length > 1 ? 's' : ''} con documentación vencida`,
        count: vehiculosDocVencida.length,
        navegarA: 'flotaGestion',
      })
    }

    if (sinAsignar.length > 0) {
      alertas.push({
        id: 'sin_asignar',
        nivel: 'advertencia',
        mensaje: `${sinAsignar.length} ticket${sinAsignar.length > 1 ? 's' : ''} sin asignar`,
        count: sinAsignar.length,
        navegarA: 'mntKanban',
      })
    }

    if (matafuegosPorVencer.length > 0) {
      alertas.push({
        id: 'matafuegos_por_vencer',
        nivel: 'advertencia',
        mensaje: `${matafuegosPorVencer.length} matafuego${matafuegosPorVencer.length > 1 ? 's' : ''} vencen en 30 días`,
        count: matafuegosPorVencer.length,
        navegarA: 'mntMatafuegos',
      })
    }

    if (vehiculosDocPorVencer.length > 0) {
      alertas.push({
        id: 'flota_doc_por_vencer',
        nivel: 'advertencia',
        mensaje: `${vehiculosDocPorVencer.length} vehículo${vehiculosDocPorVencer.length > 1 ? 's' : ''} con documentación vence en 30 días`,
        count: vehiculosDocPorVencer.length,
        navegarA: 'flotaGestion',
      })
    }

    if (antiguos.length > 0) {
      alertas.push({
        id: 'antiguos',
        nivel: 'info',
        mensaje: `${antiguos.length} ticket${antiguos.length > 1 ? 's' : ''} abierto${antiguos.length > 1 ? 's' : ''} hace +30 días`,
        count: antiguos.length,
        navegarA: 'mntTickets',
      })
    }

    // CAPA vencidas
    const capaVencidas = capas.filter(c => new Date(c.fecha_limite) < ahora)
    if (capaVencidas.length > 0) {
      alertas.push({
        id: 'capa_vencidas',
        nivel: 'critico',
        mensaje: `${capaVencidas.length} CAPA${capaVencidas.length > 1 ? 's' : ''} vencida${capaVencidas.length > 1 ? 's' : ''}`,
        count: capaVencidas.length,
        navegarA: 'capa',
      })
    }

    const capaPorVencer = capas.filter(c =>
      c.fecha_limite &&
      new Date(c.fecha_limite) >= ahora &&
      new Date(c.fecha_limite) <= en7dias
    )
    if (capaPorVencer.length > 0) {
      alertas.push({
        id: 'capa_por_vencer',
        nivel: 'advertencia',
        mensaje: `${capaPorVencer.length} CAPA${capaPorVencer.length > 1 ? 's' : ''} vence${capaPorVencer.length > 1 ? 'n' : ''} en 7 días`,
        count: capaPorVencer.length,
        navegarA: 'capa',
      })
    }

    return alertas
  } catch (err) {
    console.error('[getAlertas]', err)
    return []
  }
}

// ── Eventos de mantenimiento para Calendario ──────────────────────────────────
// Retorna { 'YYYY-MM-DD': [{ color, label }] } con tickets, CAPA y tareas del mes
export async function getEventosMantenimiento(anio, mes) {
  const desde = `${anio}-${String(mes).padStart(2,'0')}-01`
  const hasta  = `${anio}-${String(mes).padStart(2,'0')}-31`

  const [{ data: tickets }, { data: capas }, { data: tareas }, { data: vehiculos }] = await Promise.all([
    supabase
      .schema('mantenimiento')
      .from('tickets')
      .select('id, titulo, fecha_limite, estado, prioridad')
      .gte('fecha_limite', desde)
      .lte('fecha_limite', hasta)
      .neq('estado', 'Cerrado'),

    db()
      .from('capa')
      .select('id, titulo, fecha_limite, estado')
      .gte('fecha_limite', desde)
      .lte('fecha_limite', hasta)
      .neq('estado', 'Cerrado'),

    db()
      .from('tareas')
      .select('id, titulo, fecha_limite, estado')
      .gte('fecha_limite', desde)
      .lte('fecha_limite', hasta)
      .neq('estado', 'Resuelto')
      .neq('estado', 'Cancelado'),

    supabase
      .from('mnt_activos')
      .select('id, nombre, vencimiento_seguro, vencimiento_vtv, vencimiento_senasa, vencimiento_rmtsa')
      .eq('tipo', 'VEHICULO'),
  ])

  const mapa = {}

  const agregar = (diaStr, color, label) => {
    if (!mapa[diaStr]) mapa[diaStr] = []
    mapa[diaStr].push({ color, label })
  }

  for (const t of (tickets || [])) {
    if (!t.fecha_limite) continue
    const d = t.fecha_limite.slice(0, 10)
    const color = t.prioridad === 'critica' ? '#FF2A2A'
                : t.prioridad === 'alta'    ? '#F59E0B'
                : '#50b4ff'
    agregar(d, color, `Ticket: ${t.titulo || '—'}`)
  }

  for (const c of (capas || [])) {
    if (!c.fecha_limite) continue
    agregar(c.fecha_limite.slice(0, 10), '#a78bfa', `CAPA: ${c.titulo || '—'}`)
  }

  for (const t of (tareas || [])) {
    if (!t.fecha_limite) continue
    agregar(t.fecha_limite.slice(0, 10), '#34d399', `Tarea: ${t.titulo || '—'}`)
  }

  const DOC_LABELS = { vencimiento_seguro:'Seguro', vencimiento_vtv:'VTV', vencimiento_senasa:'SENASA', vencimiento_rmtsa:'RMTSA' }
  for (const v of (vehiculos || [])) {
    for (const [key, label] of Object.entries(DOC_LABELS)) {
      const f = v[key]
      if (f && f >= desde && f <= hasta) {
        agregar(f.slice(0, 10), '#FF2A2A', `Vehículo ${v.nombre}: ${label} vence`)
      }
    }
  }

  return mapa
}

// ── Auto-escalar tickets críticos/vencidos ────────────────────────────────────
export async function autoEscalarTickets() {
  try {
    const ahora = new Date().toISOString()
    const { data: tickets } = await supabase
      .schema('mantenimiento')
      .from('tickets')
      .select('id, descripcion, prioridad, fecha_limite, sede_id, sede')
      .in('estado', ['abierto', 'en_progreso'])
      .or(`prioridad.eq.critica,fecha_limite.lt.${ahora}`)
      .limit(20)

    if (!tickets?.length) return

    const fechaHoy = new Date().toISOString().slice(0, 10)

    await Promise.all(tickets.map(t =>
      db()
        .from('escalamientos')
        .upsert({
          tipo:          'Mantenimiento',
          descripcion:   `Ticket ${t.prioridad === 'critica' ? 'crítico' : 'vencido'}: ${t.descripcion}`,
          sede_id:       t.sede_id || null,
          sede_nombre:   t.sede || '',
          reportante:    'Sistema',
          fecha_reporte: fechaHoy,
          estado:        'Pendiente',
          registro_id:   null,
        }, { onConflict: 'tipo,descripcion,fecha_reporte,sede_id', ignoreDuplicates: true })
    ))
  } catch (err) {
    console.error('[autoEscalarTickets]', err)
  }
}
