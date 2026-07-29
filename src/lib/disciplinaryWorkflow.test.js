import { describe, expect, it } from 'vitest'
import {
  canCreateDisciplinaryRequest,
  canReviewDisciplinaryRequest,
  disciplinaryEditAuditNote,
  disciplinaryStatusMeta,
  isDisciplinaryReviewApplied,
  suspensionPeriod,
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

  it('calcula el fin de la suspensión y la fecha de reintegro', () => {
    expect(suspensionPeriod('2026-07-28', 3)).toEqual({
      start:'2026-07-28',
      end:'2026-07-30',
      returnDate:'2026-07-31',
    })
    expect(suspensionPeriod('2026-07-31', 2)).toEqual({
      start:'2026-07-31',
      end:'2026-08-01',
      returnDate:'2026-08-02',
    })
  })

  it('rechaza períodos de suspensión incompletos', () => {
    expect(suspensionPeriod('', 3)).toBeNull()
    expect(suspensionPeriod('2026-07-28', 0)).toBeNull()
    expect(suspensionPeriod('2026-07-28', 1.5)).toBeNull()
  })
})
