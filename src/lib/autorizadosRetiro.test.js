import { expect, it } from 'vitest'
import { validarAutorizados } from './autorizadosRetiro'
it('exige al menos una persona completa sin recuperar silenciosamente la lista original',()=>{
  for (const lista of [undefined, [], [{nombre:'Persona',dni:''}], [{nombre:'',dni:'12345678'}], [{nombre:'Persona',dni:'abc12345678'}]]) {
    expect(()=>validarAutorizados(lista)).toThrow()
  }
  expect(validarAutorizados([{nombre:' Persona nueva ',dni:'12.345.678'}])).toEqual([{nombre:'Persona nueva',dni:'12.345.678'}])
})
