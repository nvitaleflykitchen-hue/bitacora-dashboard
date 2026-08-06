import { describe, expect, it } from 'vitest'
import { sensitiveActionConfig } from './sensitiveActions'

describe('sensitiveActionConfig', () => {
  it('explica consecuencia y recuperación en una eliminación', () => {
    const config = sensitiveActionConfig({ action:'eliminar', subject:'el proyecto', consequence:'También se eliminan sus acciones.' })
    expect(config).toMatchObject({ peligro:true, confirmText:'Eliminar', cancelText:'Volver' })
    expect(config.consecuencia).toContain('acciones')
    expect(config.recuperacion).toContain('no se puede deshacer')
  })

  it('permite documentar una recuperación operativa', () => {
    const config = sensitiveActionConfig({ action:'cerrar', consequence:'Sale de pendientes.', recovery:'Un administrador puede reabrirlo.' })
    expect(config.peligro).toBe(false)
    expect(config.recuperacion).toContain('reabrirlo')
  })
})

