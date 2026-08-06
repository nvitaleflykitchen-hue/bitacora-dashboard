import { describe, expect, it } from 'vitest'
import { RELEASES } from './releases'

describe('historial de actualizaciones', () => {
  it('no contiene secuencias típicas de texto UTF-8 mal recodificado', () => {
    const content = JSON.stringify(RELEASES)
    expect(content).not.toMatch(/Ã|Â|â(?:€|œ|™)|ðŸ/)
  })
})
