import { credentialFrontLayout } from './credentialCatalog'
import { describe, it, expect } from 'vitest'
import { PLANTA_SECTORS, AIRPORT_SECTOR_CODES, sectorColor, sectorTileLayout } from './credentialCatalog'
import { toggleCredentialSector } from './credentialAccess'

describe('matriz definitiva V1.1',()=>{
  it('define 19 espacios, seis restringidos y aeropuerto independiente',()=>{
    expect(PLANTA_SECTORS).toHaveLength(19)
    expect(PLANTA_SECTORS.filter(s=>s[2]).map(s=>s[0])).toEqual(['Li','Pp','Ci','Ge','Ae','Da'])
    expect(PLANTA_SECTORS.every(s=>/^[A-Z][a-z]$/.test(s[0]))).toBe(true)
    expect(AIRPORT_SECTOR_CODES).toEqual(['Ae','Pp','Da'])
  })
  it('FA reemplaza sólo permisos de su sede y no concede otros',()=>{
    const catalog=[{id:'a',sede_id:24,codigo:'Ar'},{id:'f',sede_id:24,codigo:'FA'},{id:'e',sede_id:21,codigo:'Ae'}]
    expect(toggleCredentialSector(catalog,['a','e'],'f')).toEqual(['e','f'])
    expect(toggleCredentialSector(catalog,['f','e'],'a')).toEqual(['e','a'])
    expect(sectorColor({codigo:'FA'})).toBe('#B91C1C')
    expect(sectorTileLayout(1)).toMatchObject({width:48,height:48})
    expect(sectorTileLayout(3)).toMatchObject({width:48,height:48})
    expect(sectorColor({codigo:'Ar',zra:false})).toBe('#000000')
  })
  it('acomoda todas las fichas dentro de la banda de la tarjeta',()=>{
    for(let count=1;count<=19;count++){
      const {columns,rows,width,height}=sectorTileLayout(count)
      expect(columns*width+(columns-1)*3).toBeLessThanOrEqual(246.001)
      expect(rows*height+(rows-1)*3).toBeLessThanOrEqual(68.001)
      expect(columns*rows).toBeGreaterThanOrEqual(count)
    }
  })
})

it('reserva foto mayor sin superponer permisos ni vencimiento',()=>{
 for(let count=0;count<=19;count++){
  const layout=credentialFrontLayout(count)
  const tiles=sectorTileLayout(count)
  expect(46+layout.photoHeight+121+layout.sectorsHeight+43).toBe(428)
  expect(layout.sectorsTop+11+tiles.rows*tiles.height+(tiles.rows-1)*3).toBeLessThanOrEqual(385)
 }
 expect(credentialFrontLayout(1).photoHeight).toBeGreaterThan(136)
})
