export const sectorCode = sector => sector.numero && sector.simbolo ? `${String(sector.numero).padStart(2, '0')}-${sector.simbolo}` : sector.codigo
export const isTotalAccess = sector => sector.tipo === 'condicion' || sector.codigo === 'Z'
export const localDay = (date = new Date()) => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-')
export const sectorPermissionValid = (sector, day = localDay()) => sector.activo !== false && (!sector.vigente_hasta || sector.vigente_hasta >= day)
export const canManageSectorAccess = perfil => perfil?.rol === 'admin' || perfil?.sectores_permisos?.includes('manage_sector_access')
export function credentialTileLayout(count) {
  const columns = Math.min(6, Math.max(1, count))
  return { columns, rows:Math.ceil(count / columns), width:(246 - (columns - 1)*3)/columns }
}
