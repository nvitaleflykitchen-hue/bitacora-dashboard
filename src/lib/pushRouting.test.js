import { describe, expect, it } from 'vitest'
import { normalizeVapidPrivateKey, subscriptionAcceptsEvent } from '../../supabase/functions/send-priority-notification/routing.js'

const event = { module:'mantenimiento', sedeId:10 }
const subscription = { event_types:['mantenimiento'], site_ids:null }

describe('destinatarios push por dispositivo', () => {
  it('respeta la categoría y la sede elegidas', () => {
    expect(subscriptionAcceptsEvent(subscription, event, { rol:'admin' }, null)).toBe(true)
    expect(subscriptionAcceptsEvent({ ...subscription, event_types:['compras'] }, event, { rol:'admin' }, null)).toBe(false)
    expect(subscriptionAcceptsEvent({ ...subscription, site_ids:[11] }, event, { rol:'admin' }, null)).toBe(false)
  })

  it('no convierte una preferencia en permiso de sede', () => {
    expect(subscriptionAcceptsEvent({ ...subscription, site_ids:[10] }, event, { rol:'encargado', sede_ids:[11] }, null)).toBe(false)
    expect(subscriptionAcceptsEvent(subscription, event, { rol:'encargado', sede_ids:[10] }, null)).toBe(true)
    expect(subscriptionAcceptsEvent(subscription, event, { rol:'grupo', grupo_id:2 }, 3)).toBe(false)
    expect(subscriptionAcceptsEvent(subscription, event, { rol:'grupo', grupo_id:2 }, 2)).toBe(true)
  })
})

describe('clave privada VAPID', () => {
  const key = btoa(String.fromCharCode(...Array.from({ length:32 }, (_, i) => i)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  it('acepta claves URL-safe y corrige comillas, prefijo y padding', () => {
    expect(normalizeVapidPrivateKey(key)).toBe(key)
    expect(normalizeVapidPrivateKey(`VAPID_PRIVATE_KEY="${key}="`)).toBe(key)
  })
  it('rechaza una clave corrupta sin exponer su contenido', () => {
    expect(() => normalizeVapidPrivateKey('incorrecta')).toThrow('32 bytes')
    expect(() => normalizeVapidPrivateKey('dato secreto!')).toThrow('formato Base64 URL')
  })
})
