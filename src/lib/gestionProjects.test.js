import { describe, expect, it } from 'vitest'
import { gestionHealth, isGestionProjectAction } from './gestionProjects'

describe('protocolo de gestión', () => {
  const now = new Date('2026-07-20T12:00:00Z')

  it('identifica proyectos de gestión sin mezclarlos con CAPA', () => {
    expect(isGestionProjectAction({ auditoria_codigo:'FK-GEST-ESCALAS-2026-06-19' })).toBe(true)
    expect(isGestionProjectAction({ auditoria_codigo:'AUD-CAL-001', no_conformidad_id:4 })).toBe(false)
  })

  it('alerta compromisos sin aceptar y acciones sin movimiento', () => {
    expect(gestionHealth({ gestion_estado:'Sin aceptar', updated_at:'2026-07-17T10:00:00Z' }, now).level).toBe('critical')
    expect(gestionHealth({ gestion_estado:'Aceptada', ultima_gestion_at:'2026-07-16T10:00:00Z' }, now).level).toBe('warning')
    expect(gestionHealth({ gestion_estado:'Aceptada', ultima_gestion_at:'2026-07-10T10:00:00Z' }, now).level).toBe('critical')
  })
})
