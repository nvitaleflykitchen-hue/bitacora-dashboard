export const THEME_KEY = 'bd.theme'
export function getTheme() { return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark' }
export function setTheme(theme) {
  const value = theme === 'light' ? 'light' : 'dark'
  document.documentElement.dataset.theme = value
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value === 'light' ? '#f5f3ed' : '#0a0a0e')
  try { localStorage.setItem(THEME_KEY, value) } catch { /* The theme still works without storage. */ }
  window.dispatchEvent(new Event('bd-theme-change'))
}
export function subscribeTheme(callback) {
  const onStorage = event => {
    if (event.key !== THEME_KEY && event.key !== null) return
    document.documentElement.dataset.theme = event.newValue === 'light' ? 'light' : 'dark'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getTheme() === 'light' ? '#f5f3ed' : '#0a0a0e')
    callback()
  }
  window.addEventListener('bd-theme-change', callback)
  window.addEventListener('storage', onStorage)
  return () => { window.removeEventListener('bd-theme-change', callback); window.removeEventListener('storage', onStorage) }
}
