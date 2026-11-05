import { describe, it, expect } from 'vitest'
import { resolverContactos } from './directorioPersonas'

describe('contactos desde Usuarios y Equipo', () => {
  const contact = { nombre: 'Ana Pérez', modulo: 'calidad', telefono: 'viejo', tel: 'viejo', wa: 'viejo' }
  it('actualiza identidad por vínculo aunque cambien nombre y correo', () => {
    const [result] = resolverContactos([{ ...contact, perfil_id: 'p' }],
      [{ id: 'p', nombre: 'Ana García', email: 'nuevo@example.com', telefono: '3511234567' }], [])
    expect(result).toMatchObject({ nombre: 'Ana García', email: '', telefono: '3511234567', tel: '5493511234567', wa: '5493511234567' })
  })
  it('usa el correo de Equipo y conserva intacto el correo de acceso', () => {
    const perfil = Object.freeze({ id: 'p', email: 'acceso@example.com' })
    const persona = Object.freeze({ perfil_id: 'p', email: 'contacto@example.com' })
    const original = Object.freeze({ ...contact, perfil_id: 'p', email: 'anterior@example.com' })
    const [result] = resolverContactos([original], [perfil], [persona])
    expect(result.email).toBe('contacto@example.com')
    expect(perfil.email).toBe('acceso@example.com')
    expect(original.email).toBe('anterior@example.com')
  })
  it('conserva el correo del directorio cuando Equipo no tiene correo', () => {
    const [result] = resolverContactos([{ ...contact, perfil_id: 'p', email: 'contacto@example.com' }],
      [{ id: 'p', email: 'acceso@example.com' }], [])
    expect(result.email).toBe('contacto@example.com')
  })
  it('completa desde Equipo sin perfil vinculado por nombre único', () => {
    const [result] = resolverContactos([contact], [{ id: 'p', nombre: 'Ana Pérez' }],
      [{ nombre: 'Ana', apellido: 'Perez', telefono: '3511234567' }])
    expect(result.telefono).toBe('3511234567')
  })
  it('prioriza Usuarios sobre Equipo', () => {
    const [result] = resolverContactos([{ ...contact, perfil_id: 'p' }],
      [{ id: 'p', telefono: '111' }], [{ perfil_id: 'p', telefono: '222' }])
    expect(result.telefono).toBe('111')
  })
  it('no mezcla homónimos ni reemplaza un vínculo explícito ausente', () => {
    expect(resolverContactos([contact], [{ nombre: 'Ana Pérez', telefono: '111' }, { nombre: 'Ana Pérez', telefono: '222' }], [])).toEqual([contact])
    const linked = { ...contact, perfil_id: 'missing' }
    expect(resolverContactos([linked], [{ id: 'other', nombre: 'Ana Pérez' }], [])).toEqual([linked])
  })
  it('conserva emergencias y contactos generales; omite personas inactivas', () => {
    const emergency = { ...contact, modulo: 'emergencias', telefono: '107' }
    expect(resolverContactos([emergency], [{ nombre: 'Ana Pérez', telefono: '111' }], [])).toEqual([emergency])
    expect(resolverContactos([contact], [], [])).toEqual([contact])
    expect(resolverContactos([{ ...contact, perfil_id: 'p' }], [{ id: 'p', activo: false }], [])).toEqual([])
  })
})
