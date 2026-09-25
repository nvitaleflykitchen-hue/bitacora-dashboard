// El dispositivo sólo puede reducir el alcance del perfil, nunca ampliarlo.
export function subscriptionAcceptsEvent(sub, event, profile, eventGroupId) {
  const types = Array.isArray(sub.event_types) ? sub.event_types : []
  if (!types.includes(event.module)) return false
  if (!event.sedeId) return true
  const siteId = Number(event.sedeId)
  if (Array.isArray(sub.site_ids) && !sub.site_ids.map(Number).includes(siteId)) return false
  const role = String(profile.rol || '').toLowerCase()
  if (['admin','editor','consultor','flota'].includes(role)) return true
  if (role === 'grupo') return eventGroupId !== null && Number(profile.grupo_id) === Number(eventGroupId)
  return Array.isArray(profile.sede_ids) && profile.sede_ids.map(Number).includes(siteId)
}

export function normalizeVapidPrivateKey(raw) {
  let value = String(raw || '').trim()
  if (value.startsWith('VAPID_PRIVATE_KEY=')) value = value.slice('VAPID_PRIVATE_KEY='.length).trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim()
  }
  if (/^[a-f\d]{64}$/i.test(value)) {
    const bytes = value.match(/.{2}/g).map(part => String.fromCharCode(parseInt(part, 16))).join('')
    value = btoa(bytes)
  }
  value = value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('VAPID_PRIVATE_KEY no tiene formato Base64 URL válido')
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  if (atob(padded).length !== 32) throw new Error('VAPID_PRIVATE_KEY no representa una clave de 32 bytes')
  return value
}
