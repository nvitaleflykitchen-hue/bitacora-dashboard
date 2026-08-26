import { describe, expect, it } from 'vitest'
import { formatCapaCode, nextCapaSequence } from './capaCodes'

describe('códigos CAPA', () => {
  it('usa el máximo existente aunque haya huecos en la numeración', () => {
    const codigos = ['CA-2026-001', 'CA-2026-069', 'CA-2026-071']
    expect(nextCapaSequence(codigos, 'CA', 2026)).toBe(72)
    expect(formatCapaCode('CA', 2026, 72)).toBe('CA-2026-072')
  })
})
