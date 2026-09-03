function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function isVehicleAsset(asset) {
  return normalize(asset?.tipo) === 'vehiculo'
}

export function isVehicleTicket(ticket, assets = []) {
  const category = normalize(ticket?.categoria)
  if (['vehiculo', 'vehiculos', 'flota'].includes(category)) return true
  if (isVehicleAsset(ticket?.activos)) return true

  if (!ticket?.activo_id) return false
  const asset = assets.find(item => String(item.id) === String(ticket.activo_id))
  return isVehicleAsset(asset)
}

export function filterMaintenanceTickets(tickets = [], assets = []) {
  return tickets.filter(ticket => !isVehicleTicket(ticket, assets))
}

export function filterMaintenanceAssets(assets = []) {
  return assets.filter(asset => !isVehicleAsset(asset))
}

export function maintenanceAssetQueryFilters(allowedSedeIds) {
  return allowedSedeIds === null ? {} : { sedeIds: allowedSedeIds || undefined }
}
