import { expect, it } from 'vitest'
import { vehicleIdentity, lastReading, fleetPatch, fleetWarnings, interventionKind, fleetDate } from './flotaModel'
it('no confunde serie interna con dominio y conserva datos históricos de notas',()=>{
  const v=vehicleIdentity({nombre:'DOBLO - AC065RF',numero_serie:'2-307082',notas:'AÑO: 2017 | COMBUSTIBLE: nafta.'})
  expect(v.dominio).toBe('AC065RF');expect(v.anio).toBe('2017');expect(v.combustible).toBe('nafta')
  expect(vehicleIdentity({numero_serie:'AC065RF'}).dominio).toBeNull()
})
it('la última lectura sigue la fecha efectiva, no el máximo ni la importación',()=>{
  expect(lastReading({km_actual:0},[{lectura_km:80000,fecha_cierre:'2025-01-01'},{numero:893,lectura_km:77000,fecha_cierre:'2026-08-20',created_at:'2026-10-28'}])).toEqual({km:77000,fecha:'2026-08-20',fuente:'Ticket 893'})
  expect(lastReading({})).toMatchObject({km:null,fecha:null})
})
it('envía sólo los campos modificados y exige fecha al cambiar una lectura',()=>{
  expect(fleetPatch({marca:'Fiat',notas:'Conservar',numero_serie:'2-307082'},['marca'])).toEqual({marca:'Fiat'})
  expect(()=>fleetPatch({km_actual:77000},['km_actual'])).toThrow('fecha')
  expect(fleetPatch({anio:''},['anio'])).toEqual({anio:null})
})
it('detecta documentación contradictoria sin alterar estados o fechas',()=>{
  const docs=[{codigo:'habilitacion_senasa',fecha_vencimiento:'2026-12-30'}, {titulo:'ARIEL',estado:'vigente',fecha_vencimiento:'2020-10-01'}]
  const warnings=fleetWarnings({vencimiento_senasa:'2026-12-03'},docs,[{activo:true}])
  expect(warnings.join(' ')).toContain('no coinciden');expect(warnings.join(' ')).toContain('vencido');expect(warnings.join(' ')).toContain('falta documentación')
  expect(docs[1].estado).toBe('vigente')
  expect(interventionKind({estado:'resuelto',descripcion:'Diagnóstico mecánico'})).toBe('Diagnóstico')
  expect(interventionKind({estado:'cancelado'})).toBe('Cancelado / rechazado')
  expect(fleetDate('2026-10-28T01:00:00Z')).toBe('27/10/2026')
  expect(fleetDate('2026-10-28')).toBe('28/10/2026')
})
