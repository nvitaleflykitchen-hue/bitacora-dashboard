import { describe,it,expect } from 'vitest'
import { toggleCredentialSector,credentialSectorSites,hasIncompatibleCredentialSectors,credentialIsValid,groupCredentialSectors,selectedCredentialSectors } from './credentialAccess'

describe('autorización individual multisede',()=>{
  const letters=[{id:'a',sede_id:21,codigo:'A'},{id:'d',sede_id:21,codigo:'D'},{id:'z',sede_id:21,codigo:'Z'},{id:'planta',sede_id:24,codigo:'Z'}]
  it('Z reemplaza sólo los sectores de su sede y no se asigna automáticamente',()=>{
    expect(toggleCredentialSector(letters,['a','d','planta'],'z')).toEqual(['planta','z'])
    expect(toggleCredentialSector(letters,['z','planta'],'a')).toEqual(['planta','a'])
    expect(toggleCredentialSector(letters,['z','planta'],'z')).toEqual(['planta'])
    expect(toggleCredentialSector(letters,[],'a')).toEqual(['a'])
  })
  it('limita sectores a las sedes Córdoba asignadas y detecta el caso Mendoza',()=>{
    expect(credentialSectorSites({sede_ids:[19]})).toEqual([])
    expect(credentialSectorSites({sede_ids:[19,21,24]})).toEqual([21,24])
    expect(hasIncompatibleCredentialSectors({sede_ids:[19]},{sectores_autorizados:[{sede_id:24}]})).toBe(true)
    expect(hasIncompatibleCredentialSectors({sede_ids:[24]},{sectores_autorizados:[{sede_id:24}]})).toBe(false)
  })
  const sectors=[
    {id:'a',sede_id:24,sede_nombre:'Córdoba',codigo:'04',zra:true},
    {id:'b',sede_id:25,sede_nombre:'Rosario',codigo:'04',zra:false},
    {id:'c',sede_id:24,sede_nombre:'Córdoba',codigo:'01',zra:false},
  ]
  it('no mezcla códigos iguales de sedes diferentes y ordena los sectores',()=>{
    expect(groupCredentialSectors(sectors).map(g=>[g.nombre,g.sectores.map(s=>s.id)])).toEqual([['Córdoba',['c','a']],['Rosario',['b']]])
  })
  it('sin selección individual no concede accesos',()=>{
    expect(selectedCredentialSectors(sectors,[])).toEqual([])
    expect(selectedCredentialSectors(sectors,['a']).map(s=>s.id)).toEqual(['a'])
  })
  it('rechaza estados invalidados y vencimiento incluso si el estado almacenado es activa',()=>{
    const credential={estado:'activa',fecha_emision:'2026-01-01',fecha_vencimiento:'2028-01-01'}
    expect(credentialIsValid(credential,new Date(2028,0,1,23,59))).toBe(true)
    expect(credentialIsValid(credential,new Date(2028,0,2))).toBe(false)
    expect(credentialIsValid(credential,new Date(2025,11,31))).toBe(false)
    for(const estado of ['anulada','extraviada','vencida','borrador']) expect(credentialIsValid({...credential,estado},new Date(2027,0,1))).toBe(false)
  })
})
