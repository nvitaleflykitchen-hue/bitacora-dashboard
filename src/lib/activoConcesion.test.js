import { describe, it, expect } from 'vitest'
import { normalizarConcesion, concesionLabel, coincideConcesion } from './activoConcesion'
describe('condición concesionada del activo', () => {
  it('no convierte registros desconocidos en propios', () => {
    expect(concesionLabel(null)).toBe('Sin definir')
    expect(coincideConcesion({}, 'no')).toBe(false)
    expect(coincideConcesion({}, 'sin_definir')).toBe(true)
    expect(concesionLabel(false)).toBe('No concesionado')
  })
  it('guarda titularidad sin modificar custodia', () => {
    expect(normalizarConcesion({ bien_concesionado:true, concesion_propietario:' Universidad ', custodio_persona_id:'p1' })).toMatchObject({ bien_concesionado:true, concesion_propietario:'Universidad', custodio_persona_id:'p1' })
  })
  it('limpia la referencia al quitar la condición y conserva updates parciales', () => {
    expect(normalizarConcesion({ bien_concesionado:false, concesion_propietario:'Anterior', concesion_referencia:'Acta' })).toMatchObject({ concesion_propietario:null, concesion_referencia:null })
    expect(normalizarConcesion({ estado:'baja' })).toEqual({ estado:'baja' })
    expect(() => normalizarConcesion({ bien_concesionado:'false' })).toThrow()
  })
})
