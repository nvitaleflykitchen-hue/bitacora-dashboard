// Los códigos sólo tienen significado dentro de su sede. Nunca inferir accesos del área.
export const CREDENTIAL_SECTOR_SITE_IDS = [21,24]
export const credentialSectorSites = persona => (persona.sede_ids || []).map(Number).filter(id=>CREDENTIAL_SECTOR_SITE_IDS.includes(id))
export const hasIncompatibleCredentialSectors = (persona,credential) => (credential?.sectores_autorizados || []).some(sector=>!credentialSectorSites(persona).includes(Number(sector.sede_id)))

export function groupCredentialSectors(sectors = []) {
  const groups = new Map()
  for (const sector of sectors) {
    const key = String(sector.sede_id)
    if (!groups.has(key)) groups.set(key, { sedeId:key, nombre:sector.sede_nombre, sectores:[] })
    const group = groups.get(key)
    if (!group.sectores.some(item => item.id === sector.id)) group.sectores.push(sector)
  }
  return [...groups.values()].sort((a,b) => a.nombre.localeCompare(b.nombre, 'es')).map(group => ({
    ...group, sectores:group.sectores.sort((a,b) => a.codigo.localeCompare(b.codigo)),
  }))
}

export function credentialIsValid(credential, today = new Date()) {
  const localDate = [today.getFullYear(), String(today.getMonth()+1).padStart(2,'0'), String(today.getDate()).padStart(2,'0')].join('-')
  return credential?.estado === 'activa' && credential.fecha_emision <= localDate && credential.fecha_vencimiento >= localDate
}

export function selectedCredentialSectors(catalog, ids) {
  const selection = new Set(ids)
  return catalog.filter(sector => selection.has(sector.id))
}
