import { getEscalamientosItems, getRequerimientos, getTareas, getTickets } from './queries'

const CACHE_TTL_MS = 30_000
const cache = new Map()

export function normalizeWorkItems({ tareas = [], escalamientos = [], tickets = [], compras = [] }) {
  const items = [
    ...tareas.map(item => ({
      id:`tarea-${item.id}`, module:'Tarea', title:item.titulo, status:item.estado,
      site:item.sede_nombre || item.sedes?.nombre, owner:item.responsable, priority:item.prioridad,
      date:item.fecha_limite || item.created_at, target:'tareas',
    })),
    ...escalamientos.filter(item => item.estado !== 'Resuelto').map(item => ({
      id:`escalamiento-${item.id}`, module:'Escalamiento', title:item.descripcion, status:item.estado,
      site:item.sede_nombre, owner:item.reportante, priority:'Alta',
      date:item.fecha_reporte || item.created_at, target:'escalamientos',
    })),
    ...tickets.filter(item => !['resuelto','rechazado'].includes(item.estado)).map(item => ({
      id:`ticket-${item.id}`, module:'Mantenimiento', title:item.descripcion, status:item.estado,
      site:item.sede_nombre || item.sede, owner:item.responsable_nombre || item.responsable, priority:item.prioridad,
      date:item.fecha_limite || item.created_at, target:'mntTickets',
    })),
    ...compras.filter(item => !['Cumplido','Rechazado','Cancelado'].includes(item.estado)).map(item => ({
      id:`compra-${item.id}`, module:'Compra', title:item.descripcion, status:item.estado,
      site:item.sede_nombre || item.sedes?.nombre, owner:item.solicitante, priority:item.urgencia,
      date:item.fecha_necesidad || item.created_at, target:'requerimientos',
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
  const [tareas, escalamientos, tickets, compras] = await Promise.all([
    getTareas({ sedeIds:scope }),
    getEscalamientosItems({ sedeIds:scope }),
    getTickets({ sedeIds:scope }),
    getRequerimientos({ sedeIds:scope }),
  ])
  const all = normalizeWorkItems({ tareas, escalamientos, tickets, compras })
  const data = rol === 'consultor' || !perfil?.nombre
    ? all
    : all.filter(item => !item.owner || item.owner === perfil.nombre || item.module !== 'Tarea')

  cache.set(cacheKey, { createdAt:Date.now(), data })
  return data
}

export function clearWorkQueueCache() {
  cache.clear()
}
