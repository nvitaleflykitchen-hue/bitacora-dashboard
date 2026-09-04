import { describe, expect, it } from 'vitest'
import { APP_VERSION, LATEST_RELEASE, RELEASES } from './releases'

describe('historial de actualizaciones', () => {
  it('no contiene secuencias típicas de texto UTF-8 mal recodificado', () => {
    const content = JSON.stringify(RELEASES)
    expect(content).not.toMatch(/Ã|Â|â(?:€|œ|™)|ðŸ/)
  })

  it('mantiene sincronizada la versión visible con la novedad más reciente', () => {
    expect(APP_VERSION).toBe('2.9.5')
    expect(LATEST_RELEASE.version).toBe(APP_VERSION)
    expect(new Set(RELEASES.map(release => release.version)).size).toBe(RELEASES.length)
  })
})
