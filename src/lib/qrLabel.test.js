import { describe, expect, it } from 'vitest'
import { normalizeQrLabel } from './qrLabel'

describe('normalizeQrLabel', () => {
  it('ordena las medidas para una etiqueta horizontal', () => {
    expect(normalizeQrLabel({ widthMm:30, heightMm:50, orientation:'horizontal' })).toEqual({ widthMm:50, heightMm:30, orientation:'horizontal' })
  })

  it('ordena las medidas para una etiqueta vertical', () => {
    expect(normalizeQrLabel({ widthMm:50, heightMm:30, orientation:'vertical' })).toEqual({ widthMm:30, heightMm:50, orientation:'vertical' })
  })

  it('limita las medidas a valores imprimibles', () => {
    expect(normalizeQrLabel({ widthMm:5, heightMm:500 })).toMatchObject({ widthMm:200, heightMm:20 })
  })
})
