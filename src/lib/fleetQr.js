import vehicles from '../data/vehicleQrCatalog.json'
import { isAirportVehicle, airportVehicleUrl } from './airportChecklist'

// Snapshot de las unidades incorporadas al circuito de QR de flota el 17/11/2026.
// Esta lista selecciona la pantalla, no concede permisos: el formulario carga
// exclusivamente las unidades disponibles para la sesión y excluye las bajas.
export const isGeneralFleetVehicle = id => vehicles.some(v=>v.id===id)
export const isFleetChecklistVehicle = id => isAirportVehicle(id) || isGeneralFleetVehicle(id)
export const fleetVehicleUrl = airportVehicleUrl
