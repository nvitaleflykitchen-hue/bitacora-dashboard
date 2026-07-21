import { describe, expect, it } from 'vitest'
import {
  canCreateDisciplinaryRequest,
  canReviewDisciplinaryRequest,
  disciplinaryStatusMeta,
} from './disciplinaryWorkflow'

describe('flujo disciplinario', () => {
  it('permite iniciar solicitudes solo a admin y encargado', () => {
    expect(canCreateDisciplinaryRequest('admin')).toBe(true)
    expect(canCreateDisciplinaryRequest('encargado')).toBe(true)
    expect(canCreateDisciplinaryRequest('editor')).toBe(false)
    expect(canCreateDisciplinaryRequest('grupo')).toBe(false)
  })

  it('reserva la aprobación al administrador', () => {
    expect(canReviewDisciplinaryRequest('admin')).toBe(true)
    expect(canReviewDisciplinaryRequest('encargado')).toBe(false)
  })

  it('presenta un estado desconocido sin romper la interfaz', () => {
    expect(disciplinaryStatusMeta('estado_nuevo')).toEqual({ label:'estado_nuevo', color:'#9ca3af' })
  })
})
