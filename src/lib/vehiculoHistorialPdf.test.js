import { describe, expect, it } from 'vitest'
import { crearHistorialVehiculoPdf, vehiculoHistorialFilename } from './vehiculoHistorialPdf'

describe('vehiculoHistorialPdf', () => {
  it('genera un nombre de archivo seguro', () => {
    expect(vehiculoHistorialFilename('LIFAN - AD 286 IH')).toMatch(/^historial_vehiculo_lifan_ad_286_ih_\d{4}-\d{2}-\d{2}\.pdf$/)
  })

  it('genera un PDF con tickets y novedades', () => {
    const doc = crearHistorialVehiculoPdf({
      vehiculo:'AD 286 IH',
      tickets:[{ id:12, estado:'abierto', prioridad:'alta', tipo:'correctivo', descripcion:'Falla eléctrica', created_at:'2026-08-05', responsable:'Taller Norte' }],
      novedades:[{ id:4, tipo:'Avería', estado:'Pendiente', descripcion:'Se quemó un fusible', fecha_reporte:'2026-08-04', reportante:'Operaciones' }],
    })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(1000)
  })
})
