import { expect, it, vi } from 'vitest'
import { guardarContactoInicio } from './saveContactoInicio'

function mockClient(failAt = -1) {
  const writes = []
  const client = { schema: schema => ({ from: table => ({ update: values => ({ eq: (_, id) => {
    writes.push({ schema, table, id, values })
    return { select: () => ({ single: vi.fn().mockResolvedValue(writes.length === failAt ? { error: new Error('Sin permisos') } : { data: { id } }) }) }
  } }) }) }) }
  return { client, writes }
}
const form = { nombre: 'Ana', apellido: 'Pérez', telefono: '3511234567', email: 'contacto@example.com', whatsapp: true }

it('actualiza las fichas vinculadas sin enviar el correo de acceso', async () => {
  const { client, writes } = mockClient()
  await guardarContactoInicio(client, { id: 'd', _perfilId: 'p', _persona: { id: 'e' } }, form)
  expect(writes[0]).toMatchObject({ table: 'perfiles', values: { nombre: 'Ana Pérez', telefono: form.telefono } })
  expect(writes[0].values).not.toHaveProperty('email')
  expect(writes[1]).toMatchObject({ table: 'personas', values: { email: form.email, apellido: 'Pérez' } })
  expect(writes[2].values).toMatchObject({ perfil_id: 'p', tel: '5493511234567', wa: '5493511234567' })
})
it('edita contactos generales sin tocar Usuarios o Equipo', async () => {
  const { client, writes } = mockClient()
  await guardarContactoInicio(client, { id: 'd' }, { ...form, nombre: 'Emergencias', telefono: '107', whatsapp: false })
  expect(writes).toHaveLength(1)
  expect(writes[0]).toMatchObject({ table: 'directorio_contactos', values: { tel: '107', wa: null } })
})
it('informa fallas parciales y no afirma que se guardó todo', async () => {
  const { client, writes } = mockClient(2)
  await expect(guardarContactoInicio(client, { id: 'd', _perfilId: 'p', _persona: { id: 'e' } }, form)).rejects.toThrow('Se guardó parte del cambio')
  expect(writes).toHaveLength(2)
})
