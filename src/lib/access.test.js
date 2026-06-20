import { describe, expect, it } from 'vitest'
import { ROLES, canAccessView, canWrite, getPrimaryNav } from './access'

describe('matriz de acceso', () => {
  it.each(ROLES)('limita el menú principal de %s a siete accesos', rol => {
    expect(getPrimaryNav(rol).length).toBeLessThanOrEqual(7)
  })

  it('deja al consultor en modo lectura', () => {
    expect(canAccessView('consultor', 'mantenimientoHub')).toBe(true)
    expect(canWrite('consultor', 'mantenimiento', 'manage')).toBe(false)
    expect(canWrite('consultor', 'compras', 'request')).toBe(false)
  })

  it('permite a sede reportar sin administrar', () => {
    expect(canWrite('sede', 'mantenimiento', 'report')).toBe(true)
    expect(canWrite('sede', 'mantenimiento', 'manage')).toBe(false)
    expect(canAccessView('sede', 'calidadHub')).toBe(false)
  })

  it('reserva administración para admin', () => {
    expect(canAccessView('admin', 'usuarios')).toBe(true)
    expect(canAccessView('editor', 'usuarios')).toBe(false)
  })
})
