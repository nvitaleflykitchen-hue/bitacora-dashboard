// ─── Fuente única de estados y colores ────────────────────────────────────────
// Antes cada vista definía su propio ESTADO_COLOR/PRIORIDAD_COLOR con paletas
// levemente distintas (ej: prioridad "alta" roja en mobile y naranja en
// desktop). Este módulo es la referencia canónica; no redefinir mapas locales.

// Tickets de mantenimiento
export const TICKET_ESTADOS = ['abierto', 'aprobado', 'en_progreso', 'resuelto', 'rechazado']
export const TICKET_ESTADO_COLOR = {
  abierto: '#F97316', aprobado: '#F59E0B', en_progreso: '#3B82F6',
  resuelto: '#39FF14', rechazado: '#6B7280',
}

// Prioridad de tickets (4 niveles, crítica reservada al rojo)
export const PRIORIDADES = ['baja', 'media', 'alta', 'critica']
export const PRIORIDAD_COLOR = { critica: '#FF2A2A', alta: '#F97316', media: '#F59E0B', baja: '#39FF14' }
export const SLA_HS = { critica: 2, alta: 4, media: 48, baja: 168 }

// Urgencia de 3 niveles (tareas, requerimientos): acá "alta" sí es roja
export const URGENCIA_COLOR = { alta: '#FF2A2A', media: '#F59E0B', baja: '#39FF14' }

// Requerimientos / Compras (flujo real: ver Requerimientos.jsx TRANSICIONES)
export const REQ_ESTADOS = ['Pendiente', 'Observado', 'Aprobado', 'Enviado', 'En compra', 'Recibido', 'Cumplido', 'Rechazado', 'Cancelado']
export const REQ_ESTADO_COLOR = {
  Pendiente: 'rgba(255,255,255,0.5)', Observado: '#FB923C', Aprobado: '#60A5FA',
  Enviado: '#F59E0B', 'En compra': '#A78BFA', Recibido: '#2DD4BF', Cumplido: '#39FF14',
  Rechazado: '#F87171', Cancelado: 'rgba(107,114,128,0.5)',
}

// Escalamientos
export const ESCALAMIENTO_ESTADO_COLOR = { Pendiente: '#F59E0B', 'En gestión': '#50b4ff', Resuelto: '#39FF14' }

// Activos / flota / matafuegos / documentos / proveedores
export const ACTIVO_ESTADO_COLOR = { operativo: '#39FF14', en_reparacion: '#F59E0B', baja: '#FF2A2A' }
export const MATAFUEGO_ESTADO_COLOR = { operativo: '#39FF14', vencido: '#FF2A2A', baja: '#6B7280' }
export const DOC_ESTADO_COLOR = { vigente: '#39FF14', vencido: '#FF2A2A', baja: '#6B7280' }
export const PROVEEDOR_ESTADO_COLOR = { activo: '#39FF14', inactivo: '#6B7280', bloqueado: '#FF2A2A' }

/** Color de un estado con fallback gris. */
export const estadoColor = (mapa, estado) => mapa?.[estado] || '#6B7280'
