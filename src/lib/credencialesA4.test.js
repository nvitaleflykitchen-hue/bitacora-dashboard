import { describe,expect,it } from 'vitest'
import { CARD_H,CARD_W } from './credenciales'
import { hojasCredencialesA4,posicionCredencialA4 } from './credencialesA4'

describe('credenciales A4',()=>{
  it('distribuye hasta nueve credenciales por hoja',()=>{
    expect(hojasCredencialesA4(0)).toBe(0)
    expect(hojasCredencialesA4(9)).toBe(1)
    expect(hojasCredencialesA4(10)).toBe(2)
  })

  it('mantiene la grilla completa dentro de A4',()=>{
    for(let index=0;index<9;index+=1){
      const {x,y}=posicionCredencialA4(index)
      expect(x).toBeGreaterThan(0)
      expect(y).toBeGreaterThan(0)
      expect(x+CARD_W).toBeLessThan(210)
      expect(y+CARD_H).toBeLessThan(297)
    }
  })

  it('espeja las columnas del dorso sin cambiar las filas',()=>{
    for(let index=0;index<9;index+=1){
      const frente=posicionCredencialA4(index)
      const dorso=posicionCredencialA4(index,true)
      const extremoOpuesto=posicionCredencialA4(Math.floor(index/3)*3+(2-index%3))
      expect(dorso.x).toBeCloseTo(extremoOpuesto.x,6)
      expect(dorso.y).toBeCloseTo(frente.y,6)
    }
  })
})
