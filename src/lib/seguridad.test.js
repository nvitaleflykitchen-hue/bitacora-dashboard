import { describe, expect, it } from 'vitest'
import { parseSeguridadQr } from './seguridad'
import { canAccessView, canWrite, getPrimaryNav } from './access'
describe('Seguridad', () => {
 it('restringe la navegación y escritura a portería', () => {
  expect(getPrimaryNav('seguridad')).toEqual([])
  for (const view of ['equipo','usuarios','inicio','mntTickets','requerimientos']) expect(canAccessView('seguridad',view)).toBe(false)
  expect(canAccessView('seguridad','seguridad')).toBe(true)
  expect(canWrite('seguridad','equipo')).toBe(false)
  expect(canWrite('seguridad','seguridad')).toBe(true)
 })
 it('acepta sólo QR de credenciales o pases con UUID', () => {
  const token='00000000-0000-0000-0000-000000000001'
  expect(parseSeguridadQr(`https://bitacora-dashboard.vercel.app/?credencial=${token}`)).toEqual({tipo:'credencial',token})
  expect(parseSeguridadQr(`https://bitacora-dashboard.vercel.app/?pase=${token}`)).toEqual({tipo:'pase',token})
  for (const value of ['12345','javascript:alert(1)','https://x/?pase=invalid','https://x/?activo=abc']) expect(parseSeguridadQr(value)).toBeNull()
 })
})
