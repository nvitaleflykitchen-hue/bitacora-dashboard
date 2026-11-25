import {it,expect} from 'vitest'
import {comedorContactOptions,comedorDefaults,matchingContact} from './comedorContactOptions'
const people=[{id:'1d44ec86-aca3-4df8-b6f8-bd7e834a6c98',nombre:'Nicolás',apellido:'Vitale',puesto:'Coordinación',telefono:'3518763027'}, {id:'de367ea8-3da1-439d-92ef-0b87c74023c6',nombre:'Benjamín',apellido:'García',puesto:'Gerencia',telefono:'+54 9 351 6657883'}]
it('elige las identidades fijas y el único responsable asignado, sin usar correo de acceso',()=>{
 const options=comedorContactOptions(people,[{rol:'Responsable',contactos:{id:'j',nombre:'Jazmín',telefono:'3511111111'}}])
 const defaults=comedorDefaults(options,{id:1})
 expect(defaults.coordinacion.nombre).toBe('Nicolás Vitale')
 expect(defaults.coordinacion.telefono).toBe('5493518763027')
 expect(defaults.gerencia.map(c=>c.nombre)).toEqual(['Benjamín García','Jazmín'])
 expect(defaults.activo).toBe(false)
 expect(matchingContact(options,defaults.coordinacion)).toBe('persona:1d44ec86-aca3-4df8-b6f8-bd7e834a6c98')
 expect(defaults.coordinacion.email).toBeUndefined()
})
it('no elige arbitrariamente si hay más de un responsable',()=>{
 const options=comedorContactOptions(people,[{rol:'Responsable',contactos:{id:'a',nombre:'A'}},{rol:'Responsable',contactos:{id:'b',nombre:'B'}}])
 expect(comedorDefaults(options,{id:1}).gerencia[1].nombre).toBe('')
 expect(comedorDefaults(options,{id:1,responsable:'B'}).gerencia[1].nombre).toBe('B')
})
