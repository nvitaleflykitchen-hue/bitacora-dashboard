import { describe, expect, it, vi } from 'vitest'
import {
  loadMobileShortcuts,
  recordMobileRecent,
  sanitizeMobileShortcuts,
  saveMobileShortcuts,
  toggleMobileFavorite,
} from './mobileShortcuts'

describe('mobileShortcuts', () => {
  it('descarta accesos duplicados o fuera de los permisos actuales', () => {
    expect(sanitizeMobileShortcuts({
      favorites: ['flota', 'flota', 'personal', 'sin-acceso'],
      recents: ['sin-acceso', 'personal', 'flota'],
    }, ['flota', 'personal'])).toEqual({
      favorites: ['flota', 'personal'],
      recents: ['personal', 'flota'],
    })
  })

  it('alterna favoritos y conserva primero el acceso más reciente', () => {
    const base = { favorites: ['flota'], recents: ['personal', 'flota'] }
    expect(toggleMobileFavorite(base, 'flota').favorites).toEqual([])
    expect(toggleMobileFavorite(base, 'calidad').favorites).toEqual(['calidad', 'flota'])
    expect(recordMobileRecent(base, 'flota').recents).toEqual(['flota', 'personal'])
  })

  it('tolera almacenamiento inválido o no disponible', () => {
    const brokenStorage = { getItem: vi.fn(() => '{'), setItem: vi.fn(() => { throw new Error('blocked') }) }
    expect(loadMobileShortcuts('usuario', ['flota'], brokenStorage)).toEqual({ favorites: [], recents: [] })
    expect(() => saveMobileShortcuts('usuario', { favorites: ['flota'], recents: [] }, brokenStorage)).not.toThrow()
  })
})
