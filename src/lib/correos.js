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
  const [mailboxes, plans, memberships, tareas, compras, tickets] = await Promise.all([
    db().from('correo_buzones').select('id,nombre').eq('activo', true),
    db().from('capa_planes').select('id,titulo,objetivo,auditoria_codigo').like('auditoria_codigo', 'FK-GEST-%').order('created_at', { ascending: false }),
    db().from('correo_buzon_miembros').select('buzon_id,puede_revisar'),
    allRows(() => db().from('tareas').select('id,titulo,sede_id')),
    allRows(() => db().from('requerimientos').select('id,descripcion,sede_id')),
    allRows(() => supabase.from('mnt_tickets').select('id,descripcion,sede')),
  ])
  return { mailboxes: checked(mailboxes), plans: [...checked(plans),
    ...tareas.map(t => ({id: `tarea:${t.id}`, titulo: `Tarea #${t.id} · ${t.titulo}`})),
    ...compras.map(t => ({id: `compra:${t.id}`, titulo: `Compra #${t.id} · ${t.descripcion}`})),
    ...tickets.map(t => ({id: `ticket:${t.id}`, titulo: `Mantenimiento · ${t.sede || ''} · ${t.descripcion}`}))], memberships: checked(memberships) }
}

export async function getCorreos({ mailboxId, state, planId, analysis, page = 0 }) {
  let query = db().from('correos').select('id,buzon_id,asunto,remitente,fecha_correo,created_at,estado,plan_id,tarea_id,compra_id,ticket_id,sugerido_plan_id,sugerido_tarea_id,sugerido_compra_id,sugerido_ticket_id,tipo,resumen,motivo,nueva_gestion,ai_estado,ai_error,updated_at', { count: 'exact' })
  if (mailboxId) query = query.eq('buzon_id', mailboxId)
  if (state && state !== 'todos') query = query.eq('estado', state)
  if (planId) { const [column, value] = Object.entries(camposDestino(planId)).find(([, value]) => value != null); query = query.eq(column, value) }
  if (analysis === 'lista') query = query.eq('ai_estado', 'lista')
  if (analysis === 'pendiente') query = query.in('ai_estado', ['pendiente', 'error'])
  if (analysis === 'sugerencia') query = query.or('sugerido_plan_id.not.is.null,sugerido_tarea_id.not.is.null,sugerido_compra_id.not.is.null,sugerido_ticket_id.not.is.null')
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
