import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const date = z.iso.date()
const common = {
  escala_id: z.number().int().positive().optional().describe('ID de sede; solo sedes autorizadas'),
  desde: date.optional(), hasta: date.optional(),
  limite: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).max(10000).default(0),
}
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const result = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value })
const cap = value => typeof value === 'string' && value.length > 4000 ? `${value.slice(0, 4000)} [truncado]` : value
const escapeLike = value => value.replace(/[\\%_]/g, '\\$&')

export function createMcpServer(client, allowedSedes) {
  const server = new McpServer({ name: 'fly-gestion', version: '1.0.0' })
  function register(name, description, fields, run) {
    server.registerTool(name, { description, inputSchema: z.object({ ...common, ...fields }).strict(), annotations }, async args => {
      if (args.desde && args.hasta && args.desde > args.hasta) return { ...result({ error: 'desde debe ser anterior o igual a hasta' }), isError: true }
      if (args.escala_id && !allowedSedes.includes(args.escala_id)) return { ...result({ error: 'Escala no autorizada' }), isError: true }
      try { return result(await run(args)) }
      catch { return { ...result({ error: 'No se pudo consultar la fuente. Revisar configuración y disponibilidad del backend.' }), isError: true } }
    })
  }
  async function query(table, columns, field, args, filter = q => q) {
    let q = client.schema('bitacora').from(table).select(columns)
      .in('sede_id', args.escala_id ? [args.escala_id] : allowedSedes)
    if (args.desde) q = q.gte(field, args.desde)
    if (args.hasta) {
      const next = new Date(`${args.hasta}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1)
      q = q.lt(field, next.toISOString().slice(0, 10))
    }
    const { data, error } = await filter(q).order(field, { ascending: false, nullsFirst: false })
      .order('id', { ascending: false }).range(args.offset, args.offset + args.limite).abortSignal(AbortSignal.timeout(10000))
    if (error) throw new Error('Query failed')
    const hasMore = data.length > args.limite
    return { fuente: `bitacora.${table}`, datos: data.slice(0, args.limite).map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, cap(v)]))), has_more: hasMore, next_offset: hasMore ? args.offset + args.limite : null }
  }
  register('get_auditorias', 'Auditorías internas y externas por escala, fechas y estado. Fechas sin hora.', {
    estado: z.enum(['Borrador', 'Programada', 'En curso', 'Finalizada', 'Cerrada', 'Cancelada']).optional(),
    campo_fecha: z.enum(['fecha_auditoria', 'fecha_programada']).default('fecha_auditoria'),
  }, a => query('auditorias_internas', 'id,codigo,sede_id,tipo_auditoria,origen,estado,fecha_auditoria,fecha_programada,porcentaje_cumplimiento,resultado,puntaje_obtenido,puntaje_maximo,resumen,conclusiones', a.campo_fecha, a, q => a.estado ? q.eq('estado', a.estado) : q))

  const estados = { Pendiente: ['Pendiente'], 'En curso': ['En ejecución'], Cerrado: ['Completada', 'Verificada'] }
  register('get_capa_acciones', 'Acciones correctivas/preventivas. auditoria_codigo y sede_id identifican su plan. Cerrado incluye Completada y Verificada; no implica eficacia verificada.', {
    estado: z.enum(['Pendiente', 'En curso', 'Cerrado']).optional(),
    auditoria_codigo: z.string().trim().min(1).max(100).optional(),
  }, async a => {
    const page = await query('capa', 'id,codigo,sede_id,auditoria_codigo,tipo,descripcion,estado,fecha_limite,fecha_cierre,eficacia_verificada,created_at', 'created_at', a, q => {
      q = q.in('tipo', ['Correctiva', 'Preventiva'])
      if (a.estado) q = q.in('estado', estados[a.estado])
      if (a.auditoria_codigo) q = q.eq('auditoria_codigo', a.auditoria_codigo)
      return q
    })
    return { ...page, filtro_fecha: 'created_at', equivalencias_estado: estados }
  })
  register('get_registros_temperatura', 'Solo novedades textuales de cadena de frío, NO mediciones numéricas: la base no tiene registros de temperatura por cámara. Sector/cámara buscan en el texto.', {
    sector: z.string().trim().min(1).max(100).optional(), camara: z.string().trim().min(1).max(100).optional(),
  }, async a => ({
    ...await query('registros', 'id,sede_id,sede_nombre,fecha_reporte,turno,estado_b,detalle_b', 'fecha_reporte', { ...a, desde: a.desde ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) }, q => {
      q = q.not('detalle_b', 'is', null).neq('detalle_b', '')
      for (const text of [a.sector, a.camara].filter(Boolean)) q = q.ilike('detalle_b', `%${escapeLike(text)}%`)
      return q
    }), mediciones_estructuradas_disponibles: false,
    limitaciones: ['Fuente: novedades de cadena de frío, categoría B. No permite determinar temperatura ni cumplimiento térmico.', 'Sin desde: últimos 30 días. Fechas de timestamp filtradas en UTC.'],
  }))
  register('get_checklists', 'Checklists enviados de apertura/cierre. Agrupación diaria o semanal de registros observados; no determina faltantes ni cumplimiento de plantillas semanales.', {
    tipo: z.enum(['apertura', 'cierre']).optional(), periodo: z.enum(['diario', 'semanal']).default('diario'),
  }, async a => {
    const page = await query('checklists', 'id,sede_id,sede_nombre,tipo,turno,fecha,items_ok,items_total,observaciones', 'fecha', a, q => a.tipo ? q.eq('tipo', a.tipo) : q)
    const groups = new Map()
    for (const row of page.datos) {
      if (!row.fecha) continue
      const d = new Date(`${row.fecha}T00:00:00Z`)
      if (a.periodo === 'semanal') d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7)
      const inicio = d.toISOString().slice(0, 10), key = `${row.sede_id}/${inicio}/${row.tipo}`
      const group = groups.get(key) ?? { sede_id: row.sede_id, inicio, tipo: row.tipo, registros: 0, items_ok: 0, items_total: 0, registros_sin_conteo_valido: 0 }
      group.registros++
      if (Number.isInteger(row.items_ok) && Number.isInteger(row.items_total) && row.items_ok >= 0 && row.items_total >= row.items_ok) { group.items_ok += row.items_ok; group.items_total += row.items_total }
      else group.registros_sin_conteo_valido++
      groups.set(key, group)
    }
    return { ...page, resumen_pagina: [...groups.values()].map(g => ({ ...g, porcentaje: g.items_total ? Math.round(10000 * g.items_ok / g.items_total) / 100 : null })), limitaciones: ['Resumen solo de esta página: paginar para obtener todos los registros.', 'Sin cronograma esperado: ausencia de registros no prueba incumplimiento. La base admite apertura/cierre; semanal agrupa esos envíos, no plantillas semanales.'] }
  })
  return server
}
