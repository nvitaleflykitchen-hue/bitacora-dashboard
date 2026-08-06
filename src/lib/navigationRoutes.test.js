import { describe, expect, it } from 'vitest'
import { mobileDestinationForView, readAppRoute, writeAppRoute } from './navigationRoutes'

describe('navigationRoutes', () => {
  it('conserva contexto de entidad al escribir y leer una ruta', () => {
    const url = writeAppRoute('https://app.test/?view=inicio', 'equipo', { type:'persona', id:'abc', sedeId:4 })
    expect(readAppRoute(url)).toMatchObject({ view:'equipo', target:{ type:'persona', id:'abc', sedeId:'4' } })
  })

  it('traduce vistas desktop sin duplicar decisiones en mobile', () => {
    expect(mobileDestinationForView('mntActivos')).toEqual({ tab:'mas', module:'mantenimiento' })
    expect(mobileDestinationForView('sedeFicha')).toEqual({ tab:'sedes' })
  })
})

