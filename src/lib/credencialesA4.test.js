import { describe,expect,it } from 'vitest'
import { CARD_H,CARD_W } from './credenciales'
import { expandCredentialCards,hojasCredencialesA4,posicionCredencialA4 } from './credencialesA4'

describe('credenciales A4',()=>{
  it('separa los mismos códigos de sedes distintas y conserva la tarjeta histórica sin sectores',()=>{
    const cards=expandCredentialCards([{credencial:{sectores_autorizados:[
      {id:'a',sede_id:24,sede_nombre:'Córdoba',codigo:'04'},
      {id:'b',sede_id:25,sede_nombre:'Rosario',codigo:'04'},
    ]}},{credencial:{sede_nombre:'Central'}}])
    expect(cards.map(card=>card.group.nombre)).toEqual(['Córdoba','Rosario','Central'])
    expect(cards.map(card=>card.group.sectores.length)).toEqual([1,1,0])
    expect(hojasCredencialesA4(expandCredentialCards(Array(5).fill(cards[0])).length)).toBe(2)
  })
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
