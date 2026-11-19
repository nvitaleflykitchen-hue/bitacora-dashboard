import { describe,it,expect } from 'vitest'
import { AIRPORT_ITEMS,AIRPORT_VEHICLES,isAirportVehicle,airportVehicleUrl,validateAirportChecklist } from './airportChecklist'
import { parseAssetQrValue } from './assetQrScan'
const valid=()=>({turno:'mañana',km:'12000',combustible:'1/2',respuestas:Object.fromEntries(AIRPORT_ITEMS.map(i=>[i.id,'ok'])),observaciones:''})
describe('Checklist gran porte',()=>{
  it('asigna solo cuatro IDs y conserva el formato QR existente',()=>{
    expect(AIRPORT_VEHICLES).toHaveLength(4)
    for(const v of AIRPORT_VEHICLES)expect(parseAssetQrValue(airportVehicleUrl(v.id))).toEqual({id:v.id,code:null})
    expect(isAirportVehicle('5b7321a9-28aa-4c60-8424-0eb53b6ad176')).toBe(false)
  })
  it('exige respuestas explícitas y datos válidos',()=>{
    expect(validateAirportChecklist(valid())).toBeNull()
    for(const km of ['',-1,1.5,Infinity,'abc'])expect(validateAirportChecklist({...valid(),km})).toBeTruthy()
    expect(validateAirportChecklist({...valid(),respuestas:{}})).toBeTruthy()
    expect(validateAirportChecklist({...valid(),turno:''})).toBeNull()
  })
  it('exige detalle de NC y justificación NA solo donde corresponde',()=>{
    const form=valid();form.respuestas.luces='nc'
    expect(validateAirportChecklist(form)).toMatch(/Describí/)
    form.observaciones='Luz trasera rota';expect(validateAirportChecklist(form)).toBeNull()
    form.respuestas.luces='na';expect(validateAirportChecklist(form)).toBeTruthy()
    form.respuestas.luces='ok';form.respuestas.urea='na';expect(validateAirportChecklist(form)).toBeNull()
  })
})
