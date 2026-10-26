// Matriz V1.1: FA es una autorización, nunca un espacio físico.
export const PLANTA_SECTORS = [
  ['Of','Oficinas',false,'existente'], ['Rp','Recepción',false,'existente'],
  ['Ve','Vestuarios',false,'existente'], ['Vd','Verdulería',false,'existente'],
  ['Ca','Carnicería',false,'existente'], ['Cc','Cocina caliente',false,'existente'],
  ['Pa','Pastelería',false,'existente'], ['Dp','Depósito general',false,'existente'],
  ['En','Sala de envasado',false,'existente'], ['Ar','Armado general',false,'existente'],
  ['La','Lavadero',false,'existente'], ['Li','Sector limpieza',true,'existente'],
  ['Pf','Playón frontal',false,'existente'], ['Pp','Playón posterior / carga aeroportuaria',true,'reconversion'],
  ['Cd','Carga y descarga general',false,'existente'], ['Ci','Patio de cisternas',true,'existente'],
  ['Ge','Grupo electrógeno',true,'existente'], ['Ae','Sala de Líneas Aéreas / armado aeroportuario',true,'integracion'],
  ['Da','Depósito de Líneas Aéreas',true,'proyectado'],
]
export const AIRPORT_SECTOR_CODES = ['Ae','Pp','Da']
export const SECTOR_SHORT_NAMES = {Of:'OFICINAS',Rp:'RECEPCIÓN',Ve:'VESTUARIOS',Vd:'VERDULERÍA',Ca:'CARNICERÍA',Cc:'COCINA',Pa:'PASTELERÍA',Dp:'DEPÓSITO',En:'ENVASADO',Ar:'ARMADO',La:'LAVADERO',Li:'LIMPIEZA',Pf:'PLAYÓN F.',Pp:'PLAYÓN P.',Cd:'CARGA',Ci:'CISTERNAS',Ge:'GENERADOR',Ae:'LÍNEAS AÉREAS',Da:'DEPÓSITO AÉREO',FA:'ACCESO TOTAL'}
export const sectorColor = sector => sector.zra || sector.codigo === 'FA' ? '#B91C1C' : '#000000'
export const sectorShortName = sector => SECTOR_SHORT_NAMES[sector.codigo] || sector.nombre
export const sectorStateLabel = sector => sector.tipo === 'permiso' ? 'Permiso maestro por sede' : sector.habilitado_ingreso ? 'Habilitado para ingreso' : `Sin ingreso · ${sector.estado_fisico || 'pendiente de habilitación'}`
export function sectorTileLayout(count) {
  const columns = count <= 4 ? Math.max(1,count) : count <= 10 ? 5 : 7
  const rows = Math.ceil(count / columns) || 1
  const size = Math.min(48, (246-(columns-1)*3)/columns, (68-(rows-1)*3)/rows)
  return { columns, rows, width:size, height:size }
}

export function credentialFrontLayout(count, showSectors = true) {
  const photoHeight = !showSectors ? 180 : count <= 5 ? 156 : 136
  return { photoHeight, sectorsHeight: 218-photoHeight, sectorsTop: 167+photoHeight }
}
