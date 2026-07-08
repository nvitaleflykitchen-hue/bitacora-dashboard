import { supabase, db } from './supabase'

function base64UrlToUint8Array(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)))
}

function uint8ArrayToBase64Url(value) {
  const bytes = new Uint8Array(value)
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function getCurrentPushSubscription() {
  if (!pushSupported()) return null
  const registration = await navigator.serviceWorker.register('/sw.js')
  return registration.pushManager.getSubscription()
}

export async function activatePushNotifications(user, deviceLabel = '') {
  if (!user?.id) throw new Error('Iniciá sesión antes de activar notificaciones.')
  if (!pushSupported()) throw new Error('Este navegador no admite notificaciones Push.')
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!publicKey) throw new Error('Falta configurar VITE_VAPID_PUBLIC_KEY.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('El permiso de notificaciones no fue concedido.')

  const registration = await navigator.serviceWorker.register('/sw.js')
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:base64UrlToUint8Array(publicKey),
    })
  }
  const keyP256dh = subscription.getKey('p256dh')
  const keyAuth = subscription.getKey('auth')
  const { error } = await db().from('push_subscriptions').upsert({
    user_id:user.id,
    endpoint:subscription.endpoint,
    p256dh:uint8ArrayToBase64Url(keyP256dh),
    auth_key:uint8ArrayToBase64Url(keyAuth),
    user_agent:navigator.userAgent,
    device_label:deviceLabel || navigator.platform || 'Dispositivo',
    active:true,
    updated_at:new Date().toISOString(),
    last_seen_at:new Date().toISOString(),
  }, { onConflict:'endpoint' })
  if (error) throw error
  return subscription
}

export async function deactivatePushNotifications(user) {
  const subscription = await getCurrentPushSubscription()
  if (!subscription) return
  if (user?.id) {
    const { error } = await db().from('push_subscriptions')
      .update({ active:false, updated_at:new Date().toISOString() })
      .eq('user_id', user.id).eq('endpoint', subscription.endpoint)
    if (error) throw error
  }
  await subscription.unsubscribe()
}

export async function notifyHighPriority(event) {
  const priority = String(event?.priority || '').toLowerCase()
  if (!['alta','critica','crítica'].includes(priority)) return
  const { error } = await supabase.functions.invoke('send-priority-notification', { body:event })
  if (error) console.warn('[push] No se pudo enviar la alerta prioritaria:', error.message)
}

// Los comentarios siempre notifican al responsable del registro padre (prioridad
// 'media' fija, resuelta server-side), por eso no pasan por el filtro de notifyHighPriority.
export async function notifyComentario(comentarioId) {
  if (!comentarioId) return
  const { error } = await supabase.functions.invoke('send-priority-notification', {
    body: { module:'comentario', entity_id:comentarioId },
  })
  if (error) console.warn('[push] No se pudo notificar el comentario:', error.message)
}
