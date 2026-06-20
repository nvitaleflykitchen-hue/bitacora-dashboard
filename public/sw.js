self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data?.json() || {} } catch { payload = { body:event.data?.text() || '' } }
  const title = payload.title || 'Bitácora In Situ · Fly Kitchen'
  event.waitUntil(self.registration.showNotification(title, {
    body:payload.body || 'Tenés una nueva alerta prioritaria.',
    tag:payload.tag || payload.dedupe_key || 'bitacora-alerta',
    data:{ url:payload.url || '/' },
    requireInteraction:payload.requireInteraction !== false,
    vibrate:[200,100,200],
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type:'window', includeUncontrolled:true })
    for (const client of clientsList) {
      if ('focus' in client) {
        await client.navigate(target)
        return client.focus()
      }
    }
    return clients.openWindow(target)
  })())
})
