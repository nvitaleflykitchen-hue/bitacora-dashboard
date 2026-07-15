export const ROLES = ['admin', 'editor', 'consultor', 'grupo', 'encargado', 'sede', 'operario', 'flota', 'mnt_editor']

export const ROLE_LABELS = {
  admin: 'Administrador',
  editor: 'Editor',
  consultor: 'Consultor',
  grupo: 'Responsable de grupo',
  encargado: 'Encargado',
  sede: 'Usuario de sede',
  operario: 'Operario',
  flota: 'Responsable de Flota',
  mnt_editor: 'Gestión Mantenimiento',
}

// 'operario' es un rol acotado (solo bitácora + checklist, mobile-only) y
// queda afuera de la navegación de escritorio: no entra en ALL_OPERATIONAL_ROLES.
const ALL_OPERATIONAL_ROLES = new Set(ROLES.filter(r => r !== 'operario'))
// 'flota' tiene su propio módulo (Flota) y no necesita el de Mantenimiento de
// edificios/equipos: se excluye puntualmente de mantenimientoHub.
const MANTENIMIENTO_ROLES = new Set([...ALL_OPERATIONAL_ROLES].filter(r => r !== 'flota'))
const STAFF_ROLES = new Set(['admin', 'editor', 'grupo', 'encargado'])
const QUALITY_ONLY_EMAILS = new Set(['tecnica@flykitchen.com.ar'])
const SAFETY_ONLY_EMAILS = new Set(['rrhh.higieneyseguridad.emp@gmail.com'])
const SAFETY_ONLY_NAV = new Set(['tablon', 'pendientes', 'sedesHub', 'requerimientos', 'mantenimientoHub', 'calidadHub', 'equipo'])
const SAFETY_ONLY_VIEWS = new Set([
  'tablon', 'pendientes', 'tareas', 'calendario',
  'sedesHub', 'sede', 'sedeFicha',
  'requerimientos',
  'mantenimientoHub', 'mntDashboard', 'mntTickets', 'mntActivos', 'mntPlanes', 'mntProveedores',
  'mntMatafuegos', 'mntInsumos', 'mntKanban', 'qrActivo',
  'calidadHub', 'noConformidades', 'capa', 'indicadores',
  'equipo',
])
const QUALITY_ONLY_NAV = new Set(['pendientes', 'requerimientos', 'mantenimientoHub', 'flotaHub', 'calidadHub', 'equipo'])
const COMPRAS_ONLY_NAV = new Set(['inicio', 'requerimientos'])
const COMPRAS_ONLY_VIEWS = new Set(['inicio', 'requerimientos'])
const QUALITY_ONLY_VIEWS = new Set([
  'pendientes', 'tareas', 'calendario',
  'requerimientos',
  'mantenimientoHub', 'mntDashboard', 'mntTickets', 'mntActivos', 'mntPlanes', 'mntProveedores',
  'mntMatafuegos', 'mntInsumos', 'mntKanban', 'mntResponsables', 'mntVehiculos', 'qrActivo',
  'flotaHub', 'flotaGestion',
  'calidadHub', 'noConformidades', 'capa', 'indicadores',
  'equipo',
])
const QUALITY_ONLY_WRITE_DOMAINS = new Set(['calidad', 'noConformidades', 'capa', 'tareas'])
const QUALITY_TASK_CATEGORIES = new Set(['F'])
const QUALITY_TEXT_TERMS = ['calidad', 'bpm', 'higiene', 'inocuidad', 'auditoria', 'auditoría', 'no conformidad', 'conformidades', 'capa']

export function isQualityOnlyProfile(perfil) {
  const email = String(perfil?.email || '').trim().toLowerCase()
  return QUALITY_ONLY_EMAILS.has(email)
}

export function isSafetyOnlyProfile(perfil) {
  const email = String(perfil?.email || '').trim().toLowerCase()
  return SAFETY_ONLY_EMAILS.has(email)
}

export function getComprasPermisos(perfil) {
  return Array.isArray(perfil?.compras_permisos) ? perfil.compras_permisos.filter(Boolean) : []
}

export function hasComprasPermission(perfil, action = 'request') {
  const permisos = new Set(getComprasPermisos(perfil))
  if (action === 'request') return permisos.has('request') || permisos.has('manage') || permisos.has('supervise')
  if (action === 'manage') return permisos.has('manage') || permisos.has('supervise')
  if (action === 'supervise') return permisos.has('supervise')
  if (action === 'invoice') return permisos.has('invoice') || permisos.has('supervise')
  return permisos.has(action)
}

export function isComprasOnlyProfile(perfil) {
  return perfil?.rol === 'consultor' && getComprasPermisos(perfil).length > 0
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function includesAnyQualityTerm(value) {
  const text = normalizeText(value)
  return QUALITY_TEXT_TERMS.some(term => text.includes(normalizeText(term)))
}

function samePersonText(value, perfil) {
  const text = normalizeText(value)
  if (!text || !perfil) return false
  const name = normalizeText(perfil.nombre)
  const email = normalizeText(perfil.email)
  return Boolean((name && text.includes(name)) || (email && text.includes(email)))
}

export function isOwnTask(tarea, perfil) {
  if (!tarea || !perfil) return false
  if (tarea.responsable_id && perfil.id && String(tarea.responsable_id) === String(perfil.id)) return true
  if (tarea.creado_por && perfil.id && String(tarea.creado_por) === String(perfil.id)) return true
  if (samePersonText(tarea.responsable, perfil) || samePersonText(tarea.creado_por, perfil)) return true
  const intervinientes = Array.isArray(tarea.intervinientes) ? tarea.intervinientes : []
  return intervinientes.some(item => {
    if (item?.id && perfil.id && String(item.id) === String(perfil.id)) return true
    return samePersonText(item?.nombre || item?.email || item, perfil)
  })
}

export function isQualityRelatedTask(tarea) {
  if (!tarea) return false
  const category = String(tarea.categoria || '').toUpperCase()
  if (QUALITY_TASK_CATEGORIES.has(category)) return true
  return includesAnyQualityTerm([
    tarea.categoria,
    tarea.titulo,
    tarea.descripcion,
    tarea.responsable,
    JSON.stringify(tarea.intervinientes || []),
  ].join(' '))
}

export function canSeeQualityTask(tarea, perfil) {
  return isOwnTask(tarea, perfil) || isQualityRelatedTask(tarea)
}

export function isQualityTeamPerson(persona, perfil = null) {
  if (!persona) return false
  if (perfil?.email && normalizeText(persona.email) === normalizeText(perfil.email)) return true
  return includesAnyQualityTerm([
    persona.area,
    persona.puesto,
    persona.cargo,
    persona.descripcion_puesto,
    persona.email,
    Array.isArray(persona.procesos) ? persona.procesos.join(' ') : '',
  ].join(' '))
}

export const PRIMARY_NAV = [
  { id:'inicio', label:'Inicio', icon:'home', roles:ALL_OPERATIONAL_ROLES },
  { id:'tablon', label:'Tablón', icon:'announcement', roles:ALL_OPERATIONAL_ROLES },
  { id:'pendientes', label:'Pendientes', icon:'pending', roles:ALL_OPERATIONAL_ROLES },
  { id:'sedesHub', label:'Sedes', icon:'sites', roles:ALL_OPERATIONAL_ROLES },
  { id:'requerimientos', label:'Compras', icon:'purchases', roles:ALL_OPERATIONAL_ROLES },
  { id:'mantenimientoHub', label:'Mantenimiento', icon:'maintenance', roles:MANTENIMIENTO_ROLES },
  { id:'flotaHub', label:'Flota', icon:'fleet', roles:new Set(['admin','editor','consultor','grupo','encargado','flota']) },
  { id:'calidadHub', label:'Calidad', icon:'quality', roles:new Set(['admin','editor','consultor','grupo','encargado']) },
  { id:'equipo', label:'Equipo', icon:'team', roles:new Set(['admin','editor','consultor','grupo','encargado']) },
]

const VIEW_ROLES = {
  inicio: ALL_OPERATIONAL_ROLES,
  tablon: ALL_OPERATIONAL_ROLES,
  actualizaciones: ALL_OPERATIONAL_ROLES,
  pendientes: ALL_OPERATIONAL_ROLES,
  sedesHub: ALL_OPERATIONAL_ROLES,
  requerimientos: ALL_OPERATIONAL_ROLES,
  mantenimientoHub: MANTENIMIENTO_ROLES,
  flotaHub: new Set(['admin','editor','consultor','grupo','encargado','flota']),
  calidadHub: new Set(['admin','editor','consultor','grupo','encargado']),
  equipo: new Set(['admin','editor','consultor','grupo','encargado']),
  dashboard: new Set(['admin','editor','consultor','grupo','encargado']),
  sedeEncargado: new Set(['admin','editor','grupo','encargado','sede']),
  sede: ALL_OPERATIONAL_ROLES,
  sedeFicha: ALL_OPERATIONAL_ROLES,
  sedeResponsables: new Set(['admin','editor','consultor','grupo','encargado']),
  escalamientos: ALL_OPERATIONAL_ROLES,
  tareas: ALL_OPERATIONAL_ROLES,
  calendario: ALL_OPERATIONAL_ROLES,
  noConformidades: new Set(['admin','editor','consultor','grupo','encargado']),
  capa: new Set(['admin','editor','consultor','grupo','encargado']),
  indicadores: new Set(['admin','editor','consultor','grupo','encargado']),
  mntDashboard: ALL_OPERATIONAL_ROLES,
  mntTickets: ALL_OPERATIONAL_ROLES,
  mntActivos: ALL_OPERATIONAL_ROLES,
  mntPlanes: new Set(['admin','editor','consultor','grupo','encargado','mnt_editor']),
  mntProveedores: new Set(['admin','editor','consultor','grupo','encargado','mnt_editor']),
  mntMatafuegos: new Set(['admin','editor','consultor','grupo','encargado','mnt_editor']),
  mntInsumos: new Set(['admin','editor','consultor','grupo','encargado','mnt_editor']),
  mntKanban: new Set(['admin','editor','consultor','grupo','encargado','mnt_editor']),
  mntResponsables: new Set(['admin','editor','consultor','grupo','encargado','mnt_editor']),
  mntVehiculos: new Set(['admin','editor','consultor','grupo','encargado','mnt_editor']),
  flotaGestion: new Set(['admin','editor','consultor','grupo','encargado']),
  qrActivo: ALL_OPERATIONAL_ROLES,
  usuarios: new Set(['admin']),
  auditoria: new Set(['admin']),
  accesosApp: new Set(['admin']),
  // Plantilla semanal de vuelos por escala (admin/editor). No tiene ícono propio
  // en el menú principal: se entra desde la ficha de la sede tipo Aeropuerto.
  vuelosPlantilla: new Set(['admin','editor']),
}

export function canAccessView(rol, view, perfil = null) {
  if (isSafetyOnlyProfile(perfil)) return SAFETY_ONLY_VIEWS.has(view)
  if (isQualityOnlyProfile(perfil)) return QUALITY_ONLY_VIEWS.has(view)
  if (isComprasOnlyProfile(perfil)) return COMPRAS_ONLY_VIEWS.has(view)
  return Boolean(VIEW_ROLES[view]?.has(rol))
}

export function getPrimaryNav(rol, perfil = null) {
  if (isSafetyOnlyProfile(perfil)) return PRIMARY_NAV.filter(item => SAFETY_ONLY_NAV.has(item.id))
  if (isQualityOnlyProfile(perfil)) return PRIMARY_NAV.filter(item => QUALITY_ONLY_NAV.has(item.id))
  if (isComprasOnlyProfile(perfil)) return PRIMARY_NAV.filter(item => COMPRAS_ONLY_NAV.has(item.id))
  return PRIMARY_NAV.filter(item => item.roles.has(rol))
}

const VIEW_SECTIONS = {
  dashboard:'inicio', sedeEncargado:'inicio',
  tareas:'pendientes', escalamientos:'pendientes', calendario:'pendientes',
  sede:'sedesHub', sedeFicha:'sedesHub', sedeResponsables:'sedesHub', vuelosPlantilla:'sedesHub',
  mntDashboard:'mantenimientoHub', mntTickets:'mantenimientoHub', mntActivos:'mantenimientoHub',
  mntPlanes:'mantenimientoHub', mntProveedores:'mantenimientoHub', mntMatafuegos:'mantenimientoHub',
  mntInsumos:'mantenimientoHub', mntKanban:'mantenimientoHub', mntResponsables:'mantenimientoHub',
  mntVehiculos:'mantenimientoHub', flotaGestion:'mantenimientoHub', qrActivo:'mantenimientoHub',
  noConformidades:'calidadHub', capa:'calidadHub', indicadores:'calidadHub',
}

export function getNavSection(view) {
  return VIEW_SECTIONS[view] || view
}

export function canWrite(rol, domain, action = 'manage', perfil = null) {
  if (isSafetyOnlyProfile(perfil)) {
    if (['calidad', 'noConformidades', 'capa', 'tareas', 'mantenimiento'].includes(domain)) return true
    if (domain === 'bitacora') return ['report', 'attach'].includes(action)
    if (domain === 'compras') return action === 'request'
    return false
  }
  if (isQualityOnlyProfile(perfil)) return QUALITY_ONLY_WRITE_DOMAINS.has(domain)
  if (rol === 'admin' || rol === 'editor') return true
  if (domain === 'compras' && hasComprasPermission(perfil, action)) return true
  if (rol === 'consultor') return false
  if (rol === 'grupo' || rol === 'encargado') {
    if (domain === 'admin') return false
    // 'equipo' (RRHH) ahora gestionable por grupo/encargado, acotado a su(s) sede(s)
    // vía allowedSedeIds en las vistas. 'sedes' (alta/baja de sedes) sigue admin-only.
    if (domain === 'sedes') return false
    return true
  }
  if (rol === 'sede') {
    return (
      (domain === 'bitacora' && ['report','attach'].includes(action)) ||
      (domain === 'mantenimiento' && ['report','attach'].includes(action)) ||
      (domain === 'compras' && action === 'request')
    )
  }
  if (rol === 'operario') {
    // Acotado a llenar la bitácora (Nuevo Reporte) y el checklist. Sin
    // mantenimiento, sin compras, sin acceso a escritorio.
    return domain === 'bitacora' && ['report', 'attach'].includes(action)
  }
  if (rol === 'flota') {
    // Responsable de Flota: gestiona vehículos, matafuegos por vehículo,
    // documentos/POEs y tickets dentro de su propio módulo.
    return domain === 'flota'
  }
  if (rol === 'mnt_editor') {
    // Gestión Mantenimiento: editor completo del módulo de mantenimiento.
    // Sin acceso a administración, RRHH, flota ni sedes.
    if (domain === 'mantenimiento') return true
    if (domain === 'bitacora' && ['report', 'attach'].includes(action)) return true
    if (domain === 'compras' && action === 'request') return true
    return false
  }
  return false
}

/**
 * Indica si el rol puede eliminar un ticket dado.
 * mnt_editor solo puede borrar sus propios tickets (creado_por === perfilId).
 */
export function canDeleteTicket(rol, ticket = null, perfilId = null) {
  if (rol === 'admin') return true
  if (rol === 'mnt_editor') {
    return Boolean(ticket?.creado_por && perfilId && String(ticket.creado_por) === String(perfilId))
  }
  return ['editor', 'grupo', 'encargado'].includes(rol)
}

export function getDefaultView(rol, perfil = null) {
  if (isSafetyOnlyProfile(perfil)) return 'calidadHub'
  if (isQualityOnlyProfile(perfil)) return 'calidadHub'
  if (isComprasOnlyProfile(perfil)) return 'requerimientos'
  return canAccessView(rol, 'inicio', perfil) ? 'inicio' : null
}

export function isStaffRole(rol) {
  return STAFF_ROLES.has(rol)
}
