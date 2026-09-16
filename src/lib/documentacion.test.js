import { describe, expect, it } from 'vitest'
import {
  getVehiculoDocumentacionTemplate,
  VEHICULO_DOCUMENTACION_TEMPLATE,
} from './documentacion'

describe('documentación especial de vehículos aeroportuarios', () => {
  it('agrega el seguro ARIEL sólo a vehículos de sedes aeropuerto', () => {
    const aeropuerto = getVehiculoDocumentacionTemplate('Aeropuerto de Córdoba')
    const planta = getVehiculoDocumentacionTemplate('Planta de Producción Córdoba')

    expect(aeropuerto).toHaveLength(VEHICULO_DOCUMENTACION_TEMPLATE.length + 1)
    expect(aeropuerto.at(-1)).toMatchObject({
      codigo:'seguro_ariel_aeropuerto',
      aviso_dias:30,
      seccion:'Seguridad aeroportuaria',
    })
    expect(planta).toEqual(VEHICULO_DOCUMENTACION_TEMPLATE)
  })

  it('tolera nombres vacíos y diferencias de mayúsculas', () => {
    expect(getVehiculoDocumentacionTemplate('').some(item => item.codigo === 'seguro_ariel_aeropuerto')).toBe(false)
    expect(getVehiculoDocumentacionTemplate('AEROPUERTO ROSARIO').some(item => item.codigo === 'seguro_ariel_aeropuerto')).toBe(true)
  })
})
