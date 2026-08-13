const CACHE_VERSION='fly-gestion-shell-v2'
const CORE=['/','/index.html','/manifest.webmanifest','/favicon.svg']

async function cacheAppShell(){
  const cache=await caches.open(CACHE_VERSION)
  const response=await fetch('/index.html',{cache:'no-store'})
  if(!response.ok)throw new Error('No se pudo descargar la aplicación')
  const html=await response.clone().text()
  const assets=[...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map(match=>match[1]).filter(path=>path.startsWith('/assets/'))
  await cache.put('/index.html',response.clone())
  await cache.put('/',response)
  await cache.addAll([...new Set([...CORE.slice(2),...assets])])
}

self.addEventListener('install',event=>{
  event.waitUntil(cacheAppShell().then(()=>self.skipWaiting()))
})

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('fly-gestion-')&&key!==CACHE_VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))
})

self.addEventListener('fetch',event=>{
  const request=event.request
  if(request.method!=='GET')return
  const url=new URL(request.url)
  if(url.origin!==self.location.origin)return
  if(request.mode==='navigate'){
    event.respondWith(caches.match('/index.html').then(cached=>cached||fetch(request)))
    event.waitUntil(fetch('/index.html',{cache:'no-store'}).then(response=>response.ok?cacheAppShell():null).catch(()=>null))
    return
  }
  if(url.pathname.startsWith('/assets/')||['/manifest.webmanifest','/favicon.svg'].includes(url.pathname)){
    event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok)caches.open(CACHE_VERSION).then(cache=>cache.put(request,response.clone()));return response})))
  }
})

self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data?.json() || {} } catch { payload = { body:event.data?.text() || '' } }
  const title = payload.title || 'Fly Gestión · Fly Kitchen'
  event.waitUntil(self.registration.showNotification(title, {body:payload.body || 'Tenés una nueva alerta prioritaria.',tag:payload.tag || payload.dedupe_key || 'bitacora-alerta',data:{ url:payload.url || '/' },requireInteraction:payload.requireInteraction !== false,vibrate:[200,100,200]}))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil((async () => {const clientsList=await clients.matchAll({type:'window',includeUncontrolled:true});for(const client of clientsList){if('focus' in client){await client.navigate(target);return client.focus()}}return clients.openWindow(target)})())
})
