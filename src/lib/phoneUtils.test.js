import { describe, expect, it } from 'vitest'
import { phoneDigits, phoneHref, whatsappDigits, whatsappHref } from './phoneUtils'

describe('phoneUtils', () => {
  it.each([
    ['351 362-8059', '543513628059'],
    ['+54 351 362-8059', '543513628059'],
    ['0054 351 3628059', '543513628059'],
    ['0351 3628059', '543513628059'],
  ])('normaliza %s para llamadas', (raw, expected) => {
    expect(phoneDigits(raw)).toBe(expected)
    expect(phoneHref(raw)).toBe(`tel:+${expected}`)
  })

  it('conserva números cortos de emergencia', () => {
    expect(phoneHref('107')).toBe('tel:107')
    expect(whatsappHref('107')).toBe('')
  })

  it('genera WhatsApp argentino sin duplicar prefijos', () => {
    expect(whatsappDigits('351 362-8059')).toBe('5493513628059')
    expect(whatsappDigits('+54 9 351 362-8059')).toBe('5493513628059')
    expect(whatsappHref('5493513628059')).toBe('https://wa.me/5493513628059')
  })
})

