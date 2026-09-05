import { expect, it } from 'vitest'
import { taskProgress } from './taskProgress'
it('cuenta hasta el fin del día argentino y calcula subtareas independientes del tiempo', () => {
  const result = taskProgress({fecha_limite:'2026-09-11',created_at:'2026-09-01T00:00:00-03:00',subtareas:[{completada:true},{completada:false}]}, Date.parse('2026-09-08T18:51:00-03:00'))
  expect(result.countdown).toBe('3d 5h 8m')
  expect(result.progress).toBe(50)
  expect(result.review).toBe(true)
  expect(result.overdue).toBe(false)
})
it('no inventa avance sin subtareas ni plazo con fechas inválidas', () => {
  const result = taskProgress({fecha_limite:'incorrecta'})
  expect(result.progress).toBeNull()
  expect(result.elapsed).toBeNull()
  expect(result.valid).toBe(false)
})
it('detiene el contador de tareas cerradas y limita el plazo vencido a 100%', () => {
  const task={fecha_limite:'2026-09-01',created_at:'2026-08-01',estado:'Pendiente'}
  const now=Date.parse('2026-09-05')
  expect(taskProgress(task,now).elapsed).toBe(100)
  expect(taskProgress(task,now).overdue).toBe(true)
  expect(taskProgress({...task,estado:'Resuelto'},now).overdue).toBe(false)
  expect(taskProgress({...task,estado:'Cancelado'},now).elapsed).toBeNull()
})
