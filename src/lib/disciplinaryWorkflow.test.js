import { describe, expect, it } from 'vitest'
import {
  canCreateDisciplinaryRequest,
  canReviewDisciplinaryRequest,
  disciplinaryEditAuditNote,
  disciplinaryStatusMeta,
  isDisciplinaryReviewApplied,
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

  it('reconoce una revisión ya aplicada aunque el update no devuelva representación', () => {
    expect(isDisciplinaryReviewApplied({ estado:'aprobado' }, true)).toBe(true)
    expect(isDisciplinaryReviewApplied({ estado:'rechazado' }, false)).toBe(true)
    expect(isDisciplinaryReviewApplied({ estado:'pendiente_aprobacion' }, true)).toBe(false)
    expect(isDisciplinaryReviewApplied(null, true)).toBe(false)
  })

  it('conserva el texto anterior al auditar una edición', () => {
    const note = disciplinaryEditAuditNote({
      fecha_hecho:'2026-07-27',
      hechos:'Texto original',
      revision_observaciones:'Aprobado por administración.',
    }, '2026-07-28T13:00:00.000Z')

    expect(note).toContain('Aprobado por administración.')
    expect(note).toContain('Fecha anterior: 2026-07-27')
    expect(note).toContain('Texto anterior: Texto original')
  })
})
