import { describe, expect, it } from 'vitest'
import { findScannedAsset, parseAssetQrValue, parseInternalQrValue } from './assetQrScan'

const id = 'ccf6ad91-a654-4fa6-b402-460328dbb424'

describe('parseAssetQrValue', () => {
  it('lee el enlace público actual del activo', () => {
    expect(parseAssetQrValue(`https://bitacora-dashboard.vercel.app/?scan=activo&id=${id}`)).toEqual({ id, code:null })
  })

  it('acepta UUID y código interno como alternativa manual', () => {
    expect(parseAssetQrValue(id)).toEqual({ id, code:null })
    expect(parseAssetQrValue('fk-eq-000135')).toEqual({ id:null, code:'FK-EQ-000135' })
  })

  it('rechaza enlaces que no sean QR de activos', () => {
    expect(parseAssetQrValue('https://example.com/?scan=persona&id=' + id)).toBeNull()
    expect(parseAssetQrValue('texto cualquiera')).toBeNull()
  })
})

describe('findScannedAsset', () => {
  const assets = [{ id, codigo_interno:'FK-EQ-000135', nombre:'Notebook' }]

  it('encuentra solamente dentro de los activos permitidos cargados', () => {
    expect(findScannedAsset(assets, { id, code:null })?.nombre).toBe('Notebook')
    expect(findScannedAsset(assets, { id:null, code:'FK-EQ-999999' })).toBeNull()
  })
})

describe('parseInternalQrValue', () => {
  it('distingue activos de credenciales', () => {
    expect(parseInternalQrValue(`https://fly.test/?scan=activo&id=${id}`)).toEqual({ type:'asset', id, code:null })
    expect(parseInternalQrValue(`https://fly.test/?credencial=${id}`)).toEqual({ type:'credential', token:id })
  })

  it('rechaza otros enlaces y textos', () => {
    expect(parseInternalQrValue('https://fly.test/?persona=' + id)).toBeNull()
    expect(parseInternalQrValue('QR desconocido')).toBeNull()
  })
})
