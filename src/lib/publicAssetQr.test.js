import { describe, expect, it } from 'vitest'
import { PUBLIC_COMPANY_CONTACT } from './publicAssetQr'

describe('PUBLIC_COMPANY_CONTACT', () => {
  it('mantiene centralizados los canales públicos oficiales', () => {
    expect(PUBLIC_COMPANY_CONTACT.phoneHref).toBe('tel:+5493515939373')
    expect(PUBLIC_COMPANY_CONTACT.whatsappHref).toBe('https://wa.me/5493515939373')
    expect(PUBLIC_COMPANY_CONTACT.instagram).toContain('flykitchencatering')
    expect(PUBLIC_COMPANY_CONTACT.linkedin).toContain('company/flykitchen')
  })
})
