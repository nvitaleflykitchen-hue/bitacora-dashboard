import { describe, expect, it } from 'vitest'
import { parseMicrobiologyText } from './microbiologiaPdf'

describe('parseMicrobiologyText', () => {
  it('extrae protocolo, muestra y ensayos del formato Microfood', () => {
    const parsed = parseMicrobiologyText(`
      N° de Protocolo: 40948A
      Fecha de toma: 28/01/2026
      Identificación dada por el solicitante: Ensalada de lechuga y tomate
      Observaciones:
      ENSAYO VALOR HALLADO UNIDADES
      Recuento de E. coli NMP/g ISO 16649-3:2005 <3 NMP/g
      Recuento de Estafilococos coagulasa positiva ISO 6888-3:1999 <1/10 UFC/g
      Salmonella spp. ISO 6579:2002 Ausencia En 25 g
      E. coli O157:H7/NM ISO 16654:2001 Ausencia En 65 g
      Listeria monocytogenes ISO 11290-1:1996 Ausencia En 25 g
      Parámetro Criterio de aceptación Metodología
    `, 'Protocolo 40948A.pdf')

    expect(parsed).toMatchObject({ protocolo:'40948A', fecha:'2026-01-28', muestra:'Ensalada de lechuga y tomate' })
    expect(parsed.resultados).toEqual(expect.arrayContaining([
      expect.objectContaining({ parametroId:'ecoli', valor:'<3' }),
      expect.objectContaining({ parametroId:'staphylococcus', valor:'<1/10' }),
      expect.objectContaining({ parametroId:'salmonella', valor:'Ausencia' }),
      expect.objectContaining({ parametroId:'ecoli157', valor:'Ausencia' }),
      expect.objectContaining({ parametroId:'listeria', valor:'Ausencia' }),
    ]))
  })

  it('usa el nombre de archivo cuando el protocolo no está en el texto', () => {
    expect(parseMicrobiologyText('Salmonella spp. Ausencia En 25 g', 'UMI - 27386.pdf').protocolo).toBe('27386')
  })
})
