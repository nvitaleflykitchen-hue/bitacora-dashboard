import { describe, expect, it } from 'vitest'
import { subscriptionAcceptsEvent } from '../../supabase/functions/send-priority-notification/routing.js'

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
