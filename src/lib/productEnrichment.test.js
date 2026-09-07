import { describe, it, expect } from 'vitest'
import { missingProposals, applyProductProposals, displayProductSources } from './productEnrichment'
import { normalizeFacts } from '../../server/productProviders'
import { parsePresentation } from '../../server/productNormalization'
import { parsePrecialo, precialoUrl } from '../../server/precialoProducts'
const source = { provider:'Precialo', source_url:'https://precialo.com.ar/p/prueba', retrieved_at:'2026-09-07T12:00:00Z' }
describe('propuestas de artículos', () => {
  it('completa solo faltantes y conserva correcciones y la procedencia anterior', () => {
    const current = { name:'Mi nombre', brand:'Mi marca', net_quantity:'', net_unit:'', source:{ provider:'Anterior' } }
    const proposals = missingProposals(current, [{ name:'Otro', brand:'Otra', category:'Aderezos', net_quantity:8, net_unit:'g', source }])
    expect(proposals[0].fields).toEqual({ category:'Aderezos', net_quantity:8, net_unit:'g' })
    const applied = applyProductProposals(current, proposals)
    expect(applied).toMatchObject({ name:'Mi nombre', brand:'Mi marca', category:'Aderezos', net_quantity:8, net_unit:'g' })
    expect(displayProductSources([applied.source]).map(s => s.provider)).toEqual(['Anterior','Precialo'])
  })
  it('no pisa campos editados después de obtener la propuesta', () => {
    const proposals = missingProposals({}, [{ brand:'Externa', source }])
    expect(applyProductProposals({ brand:'Corregida' },proposals).brand).toBe('Corregida')
  })
  it('no mezcla cantidades ni niveles de empaque incompatibles', () => {
    expect(missingProposals({ net_quantity:8 }, [{ net_quantity:1000, net_unit:'g', source }])).toEqual([])
    expect(missingProposals({ packaging_level:'case' }, [{ packaging_level:'unit', net_quantity:1, net_unit:'kg', source }])).toEqual([])
    const current = { net_quantity:8, net_unit:'' }
    expect(applyProductProposals(current,missingProposals(current,[{ net_quantity:8,net_unit:'g',source }])).net_unit).toBe('g')
  })
  it('normaliza el azúcar sin inventar fabricante', () => {
    expect(normalizeFacts({ product_name:'Azúcar', quantity:'1kg', categories:'Sugars', origins:'Argentina, es:Provincia de Tucuman' }, { name:'OFF',host:'world.openfoodfacts.org' },'7798425860011'))
      .toMatchObject({ net_quantity:1, net_unit:'kg', category:'Azúcares', country_of_origin:'Argentina, Provincia de Tucuman', manufacturer:'' })
    expect(parsePresentation('1kg','17791620187218').net_quantity).toBe('')
  })
  it('extrae catálogo solo cuando el código pertenece a la ficha', () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"Mayonesa Danica sch 192 u 8 g","brand":{"name":"Danica"}}</script><div><div><p>MultipleEan</p></div><div><p>--175249:17791620187218-175249:7791620187211--</p></div></div>`
    expect(parsePrecialo(html,'17791620187218',source.source_url)).toMatchObject({ brand:'Danica', units_per_package:192,net_quantity:8,net_unit:'g' })
    expect(parsePrecialo(html+'<aside>12345678</aside>','12345678',source.source_url)).toBeNull()
  })
  it('rechaza URLs fuera del catálogo público permitido', () => {
    for(const url of ['http://precialo.com.ar/p/prueba','https://evil.test/p/prueba','https://precialo.com.ar@evil.test/p/prueba','https://precialo.com.ar/p/prueba?url=http://localhost','https://precialo.com.ar/api/user']) expect(()=>precialoUrl(url)).toThrow()
  })
})
