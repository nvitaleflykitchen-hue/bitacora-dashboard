import { describe, expect, it } from 'vitest'
import { calcularCumplimientoAuditoria, clasificarAuditoria, filtrarAuditoresElegibles, resumirPuntajeAuditoria } from './auditoriaScore'

describe('puntaje de auditorías internas', () => {
  it('pondera las preguntas y excluye las no observadas', () => {
    const preguntas = [
      { id: 'a', peso: 2 },
      { id: 'b', peso: 1 },
      { id: 'c', peso: 5 },
    ]
    const respuestas = {
      a: { valor: 'Cumple' },
      b: { valor: 'Parcial' },
      c: { valor: 'No observado' },
    }

    expect(calcularCumplimientoAuditoria(preguntas, respuestas)).toBe(83.3)
  })

  it('no inventa puntaje cuando no hay preguntas evaluadas', () => {
    expect(calcularCumplimientoAuditoria([{ id: 'a', peso: 1 }], {})).toBeNull()
  })

  it('desglosa respuestas y puntos ponderados', () => {
    const preguntas = [{ id:'a', peso:2 }, { id:'b', peso:1 }, { id:'c', peso:1 }, { id:'d', peso:1 }]
    const respuestas = { a:{ valor:'Cumple' }, b:{ valor:'Parcial' }, c:{ valor:'No cumple' }, d:{ valor:'No observado' } }
    expect(resumirPuntajeAuditoria(preguntas, respuestas)).toEqual({ cumple:1, parcial:1, noCumple:1, noObservado:1, sinResponder:0, obtenido:5, maximo:8 })
  })

  it('clasifica los umbrales definidos', () => {
    expect(clasificarAuditoria(90)).toBe('Conforme')
    expect(clasificarAuditoria(70)).toBe('Con observaciones')
    expect(clasificarAuditoria(50)).toBe('No conforme')
    expect(clasificarAuditoria(49.9)).toBe('Crítico')
  })

  it('ofrece solo usuarios activos con rango de auditor y respeta el alcance de Miguel', () => {
    const perfiles = [
      { nombre: 'Admin', email: 'admin@fk.com', rol: 'admin', activo: true },
      { nombre: 'Calidad', email: 'tecnica@flykitchen.com.ar', rol: 'consultor', activo: true },
      { nombre: 'Miguel', email: 'mriviere@flykitchen.com.ar', rol: 'admin', activo: true },
      { nombre: 'Sede', email: 'sede@fk.com', rol: 'sede', activo: true },
      { nombre: 'Inactivo', email: 'inactivo@fk.com', rol: 'editor', activo: false },
    ]

    expect(filtrarAuditoresElegibles(perfiles, 'Comedor').map(p => p.nombre)).toEqual(['Admin', 'Calidad'])
    expect(filtrarAuditoresElegibles(perfiles, 'Aeropuerto').map(p => p.nombre)).toEqual(['Admin', 'Calidad', 'Miguel'])
  })
})
