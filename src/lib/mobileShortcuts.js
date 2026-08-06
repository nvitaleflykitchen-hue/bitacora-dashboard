const STORAGE_PREFIX = 'bd.mobile.shortcuts.v1'

export const EMPTY_MOBILE_SHORTCUTS = Object.freeze({ favorites: [], recents: [] })

export function sanitizeMobileShortcuts(value, allowedKeys) {
  const allowed = new Set(allowedKeys)
  const clean = (items, limit) => [...new Set(Array.isArray(items) ? items : [])]
    .filter(key => typeof key === 'string' && allowed.has(key))
    .slice(0, limit)

  return {
    favorites: clean(value?.favorites, 6),
    recents: clean(value?.recents, 4),
  }
}

export function loadMobileShortcuts(userId, allowedKeys, storage = globalThis.localStorage) {
  if (!userId || !storage) return sanitizeMobileShortcuts(EMPTY_MOBILE_SHORTCUTS, allowedKeys)
  try {
    const saved = JSON.parse(storage.getItem(`${STORAGE_PREFIX}.${userId}`) || 'null')
    return sanitizeMobileShortcuts(saved, allowedKeys)
  } catch {
    return sanitizeMobileShortcuts(EMPTY_MOBILE_SHORTCUTS, allowedKeys)
  }
}

export function saveMobileShortcuts(userId, shortcuts, storage = globalThis.localStorage) {
  if (!userId || !storage) return
  try {
    storage.setItem(`${STORAGE_PREFIX}.${userId}`, JSON.stringify(shortcuts))
  } catch {
    // La navegación sigue funcionando aunque el navegador bloquee el almacenamiento.
  }
}

export function toggleMobileFavorite(shortcuts, key) {
  const exists = shortcuts.favorites.includes(key)
  return {
    ...shortcuts,
    favorites: exists
      ? shortcuts.favorites.filter(item => item !== key)
      : [key, ...shortcuts.favorites].slice(0, 6),
  }
}

export function recordMobileRecent(shortcuts, key) {
  return {
    ...shortcuts,
    recents: [key, ...shortcuts.recents.filter(item => item !== key)].slice(0, 4),
  }
}

export function clearMobileRecents(shortcuts) {
  return { ...shortcuts, recents: [] }
}
