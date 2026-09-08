import { describe, expect, it } from 'vitest'
import { parsePurchaseTrackingValue, vendorEmailHref, vendorWhatsappHref } from './comprasWorkflow'

const token='123e4567-e89b-42d3-a456-426614174000'

describe('comprasWorkflow',()=>{
  it('extrae únicamente tokens válidos del QR de compras',()=>{
    expect(parsePurchaseTrackingValue(`https://fly.test/?compra=${token}`)).toBe(token)
    expect(parsePurchaseTrackingValue(token)).toBe(token)
    expect(parsePurchaseTrackingValue('https://fly.test/?id=42')).toBeNull()
  })

  it('arma destinos del proveedor para WhatsApp y correo',()=>{
    const proveedor={whatsapp:'+54 9 351 555-1212',email:'ventas@proveedor.test',contacto_nombre:'Ana'}
    const requerimiento={id:94,numero:94,orden_compra_numero:'00000-00029234'}
    expect(vendorWhatsappHref(proveedor,requerimiento)).toContain('https://wa.me/5493515551212')
    expect(vendorEmailHref(proveedor,requerimiento)).toContain('mailto:ventas@proveedor.test')
  })
})
