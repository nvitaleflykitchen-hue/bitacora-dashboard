import { describe, it, expect } from 'vitest'
import { sectorCode, sectorPermissionValid, isTotalAccess, credentialTileLayout, canManageSectorAccess } from './sectorMatrix'
import { toggleCredentialSector } from './credentialAccess'

describe('matriz y autorizaciones', () => {
  it('conserva códigos históricos y no confunde números de versiones diferentes', () => {
    expect(sectorCode({codigo:'04'})).toBe('04')
    expect(sectorCode({numero:4,simbolo:'Vd'})).toBe('04-Vd')
    expect(sectorCode({numero:100,simbolo:'Xx'})).toBe('100-Xx')
  })
  it('un permiso temporal vale hasta el final de su fecha local', () => {
    expect(sectorPermissionValid({vigente_hasta:'2026-10-22'},'2026-10-22')).toBe(true)
    expect(sectorPermissionValid({vigente_hasta:'2026-10-22'},'2026-10-23')).toBe(false)
    expect(sectorPermissionValid({activo:false})).toBe(false)
  })
  it('acceso total es una condición y solo sustituye selecciones de su sede', () => {
    const sectors=[{id:'ar',sede_id:24,tipo:'sector'},{id:'ae',sede_id:24,tipo:'sector'},{id:'total',sede_id:24,tipo:'condicion'},{id:'otro',sede_id:21,tipo:'sector'}]
    expect(isTotalAccess(sectors[2])).toBe(true)
    expect(toggleCredentialSector(sectors,['ar','otro'],'total')).toEqual(['otro','total'])
    expect(toggleCredentialSector(sectors,['total','otro'],'ar')).toEqual(['otro','ar'])
    expect(toggleCredentialSector(sectors,[],'ar')).toEqual(['ar'])
  })
  it('dieciocho fichas caben en tres filas compactas', () => {
    expect(credentialTileLayout(18)).toEqual({columns:6,rows:3,width:38.5})
  })
  it('no concede facultades por el rol de responsable', () => {
    expect(canManageSectorAccess({rol:'encargado'})).toBeFalsy()
    expect(canManageSectorAccess({rol:'encargado',sectores_permisos:['manage_sector_access']})).toBe(true)
  })
})
