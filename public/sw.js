const CACHE_VERSION='fly-gestion-shell-v1'
const APP_SHELL=['/','/index.html','/manifest.webmanifest','/favicon.svg']

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_VERSION).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()))
})

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('fly-gestion-')&&key!==CACHE_VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))
})

self.addEventListener('fetch',event=>{
  const request=event.request
  if(request.method!=='GET')return
  const url=new URL(request.url)
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE_VERSION).then(cache=>cache.put('/index.html',copy));return response}).catch(()=>caches.match('/index.html')))
    return
  }
  if(url.origin===self.location.origin){
    event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_VERSION).then(cache=>cache.put(request,copy))}return response})))
  }
})

self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data?.json() || {} } catch { payload = { body:event.data?.text() || '' } }
  const title = payload.title || 'Fly Gestión · Fly Kitchen'
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
