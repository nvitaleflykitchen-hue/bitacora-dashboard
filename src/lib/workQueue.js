import { getCapa, getEscalamientosItems, getRequerimientos, getTareas, getTickets } from './queries'
import { canSeeQualityTask, isQualityOnlyProfile } from './access'
import { isGestionProjectAction } from './gestionProjects'

const CACHE_TTL_MS = 30_000
const cache = new Map()

export function normalizeWorkItems({ tareas = [], capas = [], escalamientos = [], tickets = [], compras = [] }) {
  const escalamientoIdsConTicket = new Set(
    tickets.map(item => item.escalamiento_id).filter(Boolean).map(String),
  )
  const items = [
    ...tareas.map(item => ({
      id:`tarea-${item.id}`, entityId:item.id, entityType:'tarea', module:'Tarea', title:item.titulo, status:item.estado,
      site:item.sede_nombre || item.sedes?.nombre, owner:item.responsable, priority:item.prioridad,
      date:item.fecha_limite || item.created_at, target:'tareas', ownerId:item.responsable_id || null,
      sedeId:item.sede_id || null,
    })),
    ...capas.filter(item => !['Completada','Verificada'].includes(item.estado)).map(item => ({
      id:`capa-${item.id}`, entityId:item.id, entityType:'capa', module:isGestionProjectAction(item) ? 'Proyecto' : 'CAPA', title:item.descripcion, status:item.estado,
      site:item.sede_nombre || item.sedes?.nombre, owner:item.perfiles?.nombre || item.responsable,
      ownerId:item.responsable_id || null, priority:item.prioridad || 'Media',
      date:item.fecha_limite || item.created_at, target:isGestionProjectAction(item) ? 'proyectosGestion' : 'capa', project:item.auditoria_codigo,
      sedeId:item.sede_id || null,
    })),
    ...escalamientos.filter(item => item.estado !== 'Resuelto' && !escalamientoIdsConTicket.has(String(item.id))).map(item => ({
      id:`escalamiento-${item.id}`, entityId:item.id, entityType:'escalamiento', module:'Escalamiento', title:item.descripcion, status:item.estado,
      site:item.sede_nombre, owner:item.reportante, priority:'Alta',
      date:item.fecha_reporte || item.created_at, target:'escalamientos', sedeId:item.sede_id || null,
    })),
    ...tickets.filter(item => !['resuelto','rechazado'].includes(item.estado)).map(item => ({
      id:`ticket-${item.id}`, entityId:item.id, entityType:'ticket', module:'Mantenimiento', title:item.descripcion, status:item.estado,
      site:item.sede_nombre || item.sede, owner:item.responsable_nombre || item.responsable, priority:item.prioridad,
      date:item.fecha_limite || item.created_at, target:'mntTickets', ownerId:item.responsable_id || null,
      sedeId:item.sede_id || null, linkedEscalamientoId:item.escalamiento_id || null,
    })),
    ...compras.filter(item => !['Cumplido','Rechazado','Cancelado'].includes(item.estado)).map(item => ({
      id:`compra-${item.id}`, entityId:item.id, entityType:'requerimiento', module:'Compra', title:item.descripcion, status:item.estado,
      site:item.sede_nombre || item.sedes?.nombre, owner:item.solicitante, priority:item.urgencia,
      date:item.fecha_necesidad || item.created_at, target:'requerimientos',
      ownerId:item.comprador_id || item.responsable_id || null, sedeId:item.sede_id || null,
    })),
  ]

  const isCritical = value => ['alta','critica','crítica'].includes(String(value || '').toLowerCase()) ? 1 : 0
  return items.sort((a, b) => isCritical(b.priority) - isCritical(a.priority) || new Date(a.date || 0) - new Date(b.date || 0))
}

export async function getWorkQueue({ sedeIds, perfil, rol, force = false } = {}) {
  const cacheKey = JSON.stringify({ sedeIds:sedeIds || null, perfil:perfil?.id || perfil?.nombre || null, rol })
  const cached = cache.get(cacheKey)
  if (!force && cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.data

  const scope = sedeIds || undefined
  const [tareas, capas, escalamientos, tickets, compras] = await Promise.all([
    getTareas({ sedeIds:scope }),
    getCapa({ sedeIds:scope }),
    getEscalamientosItems({ sedeIds:scope }),
    getTickets({ sedeIds:scope }),
    getRequerimientos({ sedeIds:scope }),
  ])
  if (isQualityOnlyProfile(perfil)) {
    const scopedTareas = (tareas || []).filter(tarea => canSeeQualityTask(tarea, perfil))
    const data = normalizeWorkItems({ tareas: scopedTareas, capas })
    cache.set(cacheKey, { createdAt:Date.now(), data })
    return data
  }

  const all = normalizeWorkItems({ tareas, capas, escalamientos, tickets, compras })
  const data = rol === 'consultor' || !perfil?.nombre
    ? all
    : all.filter(item => !item.owner || item.owner === perfil.nombre || item.module !== 'Tarea')

  cache.set(cacheKey, { createdAt:Date.now(), data })
  return data
}

export function clearWorkQueueCache() {
  cache.clear()
}
