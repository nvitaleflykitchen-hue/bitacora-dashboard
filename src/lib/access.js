export const ROLES = ['admin', 'editor', 'consultor', 'grupo', 'encargado', 'sede']

export const ROLE_LABELS = {
  admin: 'Administrador',
  editor: 'Editor',
  consultor: 'Consultor',
  grupo: 'Responsable de grupo',
  encargado: 'Encargado',
  sede: 'Usuario de sede',
}

const ALL_OPERATIONAL_ROLES = new Set(ROLES)
const STAFF_ROLES = new Set(['admin', 'editor', 'grupo', 'encargado'])

export const PRIMARY_NAV = [
  { id:'inicio', label:'Inicio', icon:'home', roles:ALL_OPERATIONAL_ROLES },
  { id:'pendientes', label:'Pendientes', icon:'pending', roles:ALL_OPERATIONAL_ROLES },
  { id:'sedesHub', label:'Sedes', icon:'sites', roles:ALL_OPERATIONAL_ROLES },
  { id:'requerimientos', label:'Compras', icon:'purchases', roles:ALL_OPERATIONAL_ROLES },
  { id:'mantenimientoHub', label:'Mantenimiento', icon:'maintenance', roles:ALL_OPERATIONAL_ROLES },
  { id:'calidadHub', label:'Calidad', icon:'quality', roles:new Set(['admin','editor','consultor','grupo','encargado']) },
  { id:'equipo', label:'Equipo', icon:'team', roles:new Set(['admin','editor','consultor','grupo','encargado']) },
]

const VIEW_ROLES = {
  inicio: ALL_OPERATIONAL_ROLES,
  pendientes: ALL_OPERATIONAL_ROLES,
  sedesHub: ALL_OPERATIONAL_ROLES,
  requerimientos: ALL_OPERATIONAL_ROLES,
  mantenimientoHub: ALL_OPERATIONAL_ROLES,
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
  mntPlanes: new Set(['admin','editor','consultor','grupo','encargado']),
  mntProveedores: new Set(['admin','editor','consultor','grupo','encargado']),
  mntMatafuegos: new Set(['admin','editor','consultor','grupo','encargado']),
  mntInsumos: new Set(['admin','editor','consultor','grupo','encargado']),
  mntKanban: new Set(['admin','editor','consultor','grupo','encargado']),
  mntResponsables: new Set(['admin','editor','consultor','grupo','encargado']),
  mntVehiculos: new Set(['admin','editor','consultor','grupo','encargado']),
  flotaGestion: new Set(['admin','editor','consultor','grupo','encargado']),
  qrActivo: ALL_OPERATIONAL_ROLES,
  usuarios: new Set(['admin']),
  auditoria: new Set(['admin']),
}

export function canAccessView(rol, view) {
  return Boolean(VIEW_ROLES[view]?.has(rol))
}

export function getPrimaryNav(rol) {
  return PRIMARY_NAV.filter(item => item.roles.has(rol))
}

const VIEW_SECTIONS = {
  dashboard:'inicio', sedeEncargado:'inicio',
  tareas:'pendientes', escalamientos:'pendientes', calendario:'pendientes',
  sede:'sedesHub', sedeFicha:'sedesHub', sedeResponsables:'sedesHub',
  mntDashboard:'mantenimientoHub', mntTickets:'mantenimientoHub', mntActivos:'mantenimientoHub',
  mntPlanes:'mantenimientoHub', mntProveedores:'mantenimientoHub', mntMatafuegos:'mantenimientoHub',
  mntInsumos:'mantenimientoHub', mntKanban:'mantenimientoHub', mntResponsables:'mantenimientoHub',
  mntVehiculos:'mantenimientoHub', flotaGestion:'mantenimientoHub', qrActivo:'mantenimientoHub',
  noConformidades:'calidadHub', capa:'calidadHub', indicadores:'calidadHub',
}

export function getNavSection(view) {
  return VIEW_SECTIONS[view] || view
}

export function canWrite(rol, domain, action = 'manage') {
  if (rol === 'admin' || rol === 'editor') return true
  if (rol === 'consultor') return false
  if (rol === 'grupo' || rol === 'encargado') {
    if (domain === 'admin') return false
    if (domain === 'equipo' || domain === 'sedes') return false
    return true
  }
  if (rol === 'sede') {
    return (
      (domain === 'bitacora' && ['report','attach'].includes(action)) ||
      (domain === 'mantenimiento' && ['report','attach'].includes(action)) ||
      (domain === 'compras' && action === 'request')
    )
  }
  return false
}

export function getDefaultView(rol) {
  return canAccessView(rol, 'inicio') ? 'inicio' : null
}

export function isStaffRole(rol) {
  return STAFF_ROLES.has(rol)
}
