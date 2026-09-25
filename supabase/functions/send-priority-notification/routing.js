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
