import { camposDestino } from './correoDestinos'
import { db, supabase } from './supabase'

export const CORREO_BUCKET = 'correos-evidencias'
export const CORREO_PAGE_SIZE = 25

function checked(result) {
  if (result.error) throw result.error
  return result.data
}

async function allRows(makeQuery) {
  const result = []
  for (let offset = 0; ; offset += 500) {
    const page = checked(await makeQuery().order('id').range(offset, offset + 499))
    result.push(...page)
    if (page.length < 500) return result
  }
}
export async function getCorreoContext() {
  const [mailboxes, plans, memberships, capas, tareas, compras, tickets, personas, grupos, sedes, vehiculos, idProyectos] = await Promise.all([
    db().from('correo_buzones').select('id,nombre').eq('activo', true),
    db().from('capa_planes').select('id,titulo,objetivo,auditoria_codigo,sede_nombre,estado').neq('estado', 'obsoleto').order('created_at', { ascending: false }),
    db().from('correo_buzon_miembros').select('buzon_id,puede_revisar'),
    allRows(() => db().from('capa').select('auditoria_codigo').not('estado', 'in', '(Completada,Verificada)')),
    allRows(() => db().from('tareas').select('id,titulo,descripcion,sede_id,responsable,estado,fecha_limite').in('estado', ['Pendiente', 'En proceso'])),
    allRows(() => db().from('requerimientos').select('id,numero,descripcion,sede_id,sede_nombre,solicitante,estado,fecha_necesidad').not('estado', 'in', '(Cumplido,Rechazado,Cancelado)')),
    allRows(() => supabase.from('mnt_tickets').select('id,numero,descripcion,sede,estado,prioridad,responsable,fecha_limite').not('estado', 'in', '(Completada,Verificada,Resuelto,Rechazado,Cancelado,cerrado,resuelto,rechazado,cancelado)')),
    allRows(() => supabase.from('v_personas').select('id,nombre,apellido,puesto,sede_ids,activo').eq('activo', true)),
    allRows(() => db().from('grupos').select('id,nombre,slug,color,activo').eq('activo', true)),
    allRows(() => db().from('sedes').select('id,nombre,tipo,activa,en_pausa').eq('activa', true).eq('en_pausa', false)),
    allRows(() => supabase.from('mnt_activos').select('id,nombre,marca,modelo,sede,sede_id,estado').eq('tipo', 'VEHICULO')),
    allRows(() => db().from('id_proyectos').select('id,codigo,titulo,categoria,etapa,situacion,sede_id').not('situacion', 'in', '(Completado,Cancelado)')),
  ])
  const openPlanCodes = new Set(capas.map(c => c.auditoria_codigo))
  const openPlans = checked(plans).filter(p => openPlanCodes.has(p.auditoria_codigo))
  const planDestination = (p, kind) => ({ ...p, kind, meta: [p.sede_nombre, p.auditoria_codigo].filter(Boolean).join(' · '), search: [p.titulo, p.objetivo, p.auditoria_codigo, p.sede_nombre].join(' ') })
  const destinations = {
    planes: openPlans.filter(p => !String(p.auditoria_codigo).toUpperCase().startsWith('FK-GEST-')).map(p => planDestination(p, 'plan')),
    proyectos: openPlans.filter(p => String(p.auditoria_codigo).toUpperCase().startsWith('FK-GEST-')).map(p => planDestination(p, 'proyecto')),
    tareas: tareas.map(t => ({ ...t, id: `tarea:${t.id}`, kind: 'tarea', titulo: t.titulo || `Tarea #${t.id}`, meta: [t.estado, t.responsable].filter(Boolean).join(' · '), search: [t.id, t.titulo, t.descripcion, t.responsable, t.estado].join(' ') })),
    compras: compras.map(c => ({ ...c, id: `compra:${c.id}`, kind: 'compra', titulo: `Compra #${c.numero || c.id} · ${c.descripcion}`, meta: [c.sede_nombre, c.estado, c.solicitante].filter(Boolean).join(' · '), search: [c.numero, c.descripcion, c.sede_nombre, c.solicitante, c.estado].join(' ') })),
    tickets: tickets.map(t => ({ ...t, id: `ticket:${t.id}`, kind: 'ticket', titulo: `Mantenimiento${t.numero ? ` #${t.numero}` : ''} · ${t.descripcion}`, meta: [t.sede, t.estado, t.responsable].filter(Boolean).join(' · '), search: [t.numero, t.descripcion, t.sede, t.estado, t.responsable].join(' ') })),
    personas: personas.map(p => ({ ...p, id: `persona:${p.id}`, kind: 'persona', titulo: `${p.nombre || ''} ${p.apellido || ''}`.trim(), meta: p.puesto || 'Persona', search: [p.nombre, p.apellido, p.puesto].join(' ') })),
    grupos: grupos.map(g => ({ ...g, id: `grupo:${g.id}`, kind: 'grupo', titulo: g.nombre, meta: 'Grupo de sedes', search: [g.nombre, g.slug].join(' ') })),
    sedes: sedes.map(s => ({ ...s, id: `sede:${s.id}`, kind: 'sede', titulo: s.nombre, meta: s.tipo || 'Sede', search: [s.nombre, s.tipo].join(' ') })),
    vehiculos: vehiculos.map(v => ({ ...v, id: `vehiculo:${v.id}`, kind: 'vehiculo', titulo: v.nombre || [v.marca, v.modelo].filter(Boolean).join(' ') || 'Vehículo', meta: [v.sede, v.estado, v.marca, v.modelo].filter(Boolean).join(' · '), search: [v.nombre, v.marca, v.modelo, v.sede, v.estado].join(' ') })),
    id: idProyectos.map(p => ({ ...p, id: `idproyecto:${p.id}`, kind: 'idproyecto', titulo: `${p.codigo} · ${p.titulo}`, meta: [p.categoria, p.etapa, p.situacion].filter(Boolean).join(' · '), search: [p.codigo, p.titulo, p.categoria, p.etapa, p.situacion].join(' ') })),
  }
  return { mailboxes: checked(mailboxes), destinations, plans: Object.values(destinations).flat(), memberships: checked(memberships) }
}

export async function getCorreos({ mailboxId, state, planId, analysis, page = 0 }) {
  let query = db().from('correos').select('id,buzon_id,asunto,remitente,fecha_correo,created_at,estado,plan_id,tarea_id,compra_id,ticket_id,persona_id,grupo_id,sede_id,vehiculo_id,id_proyecto_id,sugerido_plan_id,sugerido_tarea_id,sugerido_compra_id,sugerido_ticket_id,sugerido_persona_id,sugerido_grupo_id,sugerido_sede_id,sugerido_vehiculo_id,sugerido_id_proyecto_id,tipo,resumen,motivo,nueva_gestion,ai_estado,ai_confianza,ai_fuente,ai_error,updated_at', { count: 'exact' })
  if (mailboxId) query = query.eq('buzon_id', mailboxId)
  if (state && state !== 'todos') query = query.eq('estado', state)
  if (planId) { const [column, value] = Object.entries(camposDestino(planId)).find(([, value]) => value != null); query = query.eq(column, value) }
  if (analysis === 'lista') query = query.eq('ai_estado', 'lista')
  if (analysis === 'pendiente') query = query.in('ai_estado', ['pendiente', 'error'])
  if (analysis === 'sugerencia') query = query.or('sugerido_plan_id.not.is.null,sugerido_tarea_id.not.is.null,sugerido_compra_id.not.is.null,sugerido_ticket_id.not.is.null,sugerido_persona_id.not.is.null,sugerido_grupo_id.not.is.null,sugerido_sede_id.not.is.null,sugerido_vehiculo_id.not.is.null,sugerido_id_proyecto_id.not.is.null')
  const result = await query.order('fecha_correo', { ascending: false, nullsFirst: false }).order('id').range(page * CORREO_PAGE_SIZE, (page + 1) * CORREO_PAGE_SIZE - 1)
  return { items: checked(result), total: result.count || 0 }
}

export async function getCorreoDetail(id) {
  const [message, history] = await Promise.all([
    db().from('correos').select('*').eq('id', id).single(),
    db().from('correo_historial').select('id,antes,despues,created_at,actor_id').eq('correo_id', id).order('created_at', { ascending: false }).limit(100),
  ])
  return { message: checked(message), history: checked(history) }
}

export async function reviewCorreo(message, planId, state) {
  if ((state === 'vinculado') !== Boolean(planId)) throw new Error('Elegí una gestión para vincular el correo.')
  const result = await db().from('correos').update({ ...camposDestino(planId), estado: state })
    .eq('id', message.id).eq('updated_at', message.updated_at).select('id')
  const rows = checked(result)
  if (!rows?.length) throw new Error('El correo cambió o ya no tenés permiso. Actualizá la bandeja.')
}

export async function downloadCorreoFile(path, name) {
  const result = await supabase.storage.from(CORREO_BUCKET).download(path)
  const blob = checked(result)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name.replace(/[\\/:*?"<>|]/g, '_')
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function correoError(error) {
  if (['42P01', 'PGRST205'].includes(error?.code)) return 'La bandeja de correos todavía no está habilitada en la base de datos.'
  return error?.message || 'No se pudo cargar el correo. Intentá actualizar.'
}
