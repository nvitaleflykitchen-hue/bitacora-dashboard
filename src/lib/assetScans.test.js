import { describe, expect, it, vi } from 'vitest'
import { locationSummary, mapsUrl, requestScanLocation } from './assetScans'

describe('trazabilidad de escaneos de activos', () => {
  it('normaliza coordenadas y precisión entregadas por el dispositivo', async () => {
    const geolocation = { getCurrentPosition:vi.fn(success => success({ coords:{ latitude:-31.42, longitude:-64.18, accuracy:17.6 } })) }
    await expect(requestScanLocation({ geolocation })).resolves.toEqual({
      estado:'obtenida', latitud:-31.42, longitud:-64.18, precision:17.6,
    })
    expect(geolocation.getCurrentPosition).toHaveBeenCalledOnce()
  })

  it('conserva el escaneo aunque la persona no comparta ubicación', async () => {
    const geolocation = { getCurrentPosition:vi.fn((_, failure) => failure({ code:1 })) }
    await expect(requestScanLocation({ geolocation })).resolves.toEqual({
      estado:'denegada', latitud:null, longitud:null, precision:null,
    })
  })

  it('presenta precisión y enlace de mapa sólo cuando existen coordenadas', () => {
    const scan = { estado_ubicacion:'obtenida', latitud:-31.42, longitud:-64.18, precision_metros:17.6 }
    expect(locationSummary(scan)).toBe('Ubicación registrada · ±18 m')
    expect(mapsUrl(scan)).toBe('https://www.google.com/maps?q=-31.42,-64.18')
    expect(mapsUrl({ estado_ubicacion:'denegada' })).toBeNull()
  })
})
