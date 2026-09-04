import { describe, expect, it } from 'vitest'
import { CREDENTIAL_AREAS, credentialPresentation, inferCredentialArea, resolveCredentialArea } from './credentialAreas'

describe('áreas funcionales de credenciales', () => {
  it('mantiene los seis códigos y colores corporativos', () => {
    expect(CREDENTIAL_AREAS).toEqual({
      operations:{ code:'OPS', label:'Operaciones', color:'#F36C00' },
      logistics:{ code:'LOG', label:'Logística', color:'#1565C0' },
      quality:{ code:'CAL', label:'Calidad', color:'#2E7D32' },
      maintenance:{ code:'MNT', label:'Mantenimiento', color:'#D97706' },
      administration:{ code:'ADM', label:'Administración', color:'#546E7A' },
      hr:{ code:'RRHH', label:'Recursos Humanos', color:'#7B1FA2' },
    })
  })
  it('clasifica como OPS los cargos operativos y nutricionistas responsables', () => {
    for (const puesto of ['Responsable de Servicio Hospitalario', 'Nutricionista responsable de sede', 'Cocinera', 'Ayudante de cocina', 'Operario de catering']) {
      expect(inferCredentialArea({ puesto })).toBe('operations')
    }
  })
  it('prioriza el área explícita y conserva el snapshot de la credencial', () => {
    expect(resolveCredentialArea({ functional_area:'logistics', puesto:'Cocinero' }).code).toBe('LOG')
    expect(resolveCredentialArea({ functional_area:'operations' }, { area_impresa:'quality' }).code).toBe('CAL')
  })
  it('mantiene cargo y área como datos independientes', () => {
    expect(credentialPresentation({ functional_area:'hr', puesto:'Analista' }, { puesto_impreso:'Jefa de Personas', area_impresa:'hr' })).toEqual({
      area:{ key:'hr', code:'RRHH', label:'Recursos Humanos', color:'#7B1FA2' }, jobTitle:'JEFA DE PERSONAS',
    })
  })
})
