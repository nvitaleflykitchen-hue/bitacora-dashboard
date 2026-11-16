import { it, expect } from 'vitest'
import { createRequerimientoPersonalPdf } from './requerimientoPersonalPdf'
const record={id:'test-uuid',codigo_requerimiento:'REQ-PER-2026-0023',puesto:'Cocinero',sede_nombre:'Aeropuerto Córdoba',estado:'cerrada',fecha_apertura:'2026-06-08'}
it('genera una hoja A4 para un requerimiento ya gestionado con código y estado',()=>{
  const pdf=createRequerimientoPersonalPdf(record)
  expect(pdf.getNumberOfPages()).toBe(1)
  expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(595.28,1)
  const out=pdf.output()
  expect(out).toContain(record.codigo_requerimiento)
  expect(out).toContain('Cerrada')
  expect(out).toContain('08/06/2026')
})
it('marca explícitamente el resumen para textos extremos en lugar de cortarlos en silencio',()=>{
  const pdf=createRequerimientoPersonalPdf({...record,tareas:'Tarea extensa '.repeat(2000)})
  expect(pdf.getNumberOfPages()).toBe(1)
  expect(pdf.output()).toContain('Resumen A4')
})
it('no emite un documento sin código persistido',()=>{
  expect(()=>createRequerimientoPersonalPdf({puesto:'Nuevo'})).toThrow(/Guardá/)
})
