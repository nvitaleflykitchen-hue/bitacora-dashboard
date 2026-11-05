import { telefonoEnlace } from './directorioPersonas'

// Only contact fields are allowed here. In particular, perfiles.email is excluded.
export async function guardarContactoInicio(client, contacto, form) {
  const nombre = form.nombre.trim()
  const apellido = contacto._persona ? form.apellido.trim() : ''
  const nombreCompleto = [nombre, apellido].filter(Boolean).join(' ')
  const telefono = form.telefono.trim()
  const email = form.email.trim()
  if (!nombre || !telefono) throw new Error('Completá nombre y teléfono.')
  let completed = 0
  async function update(schema, table, id, values) {
    const { data, error } = await client.schema(schema).from(table).update(values).eq('id', id).select('id').single()
    if (error) throw error
    if (!data) throw new Error('No se pudo confirmar el cambio. Revisá tus permisos.')
    completed++
  }
  try {
    if (contacto._perfilId) await update('bitacora', 'perfiles', contacto._perfilId, { nombre: nombreCompleto, telefono })
    if (contacto._persona?.id) await update('equipo', 'personas', contacto._persona.id, { nombre, apellido: apellido || null, telefono, email: email || null })
    await update('bitacora', 'directorio_contactos', contacto.id, {
      nombre: nombreCompleto, telefono, email: email || null,
      tel: telefonoEnlace(telefono), wa: form.whatsapp ? telefonoEnlace(telefono) : null,
      updated_at: new Date().toISOString(),
      // Persist the resolved identity so a rename does not break the link.
      ...(contacto._perfilId ? { perfil_id: contacto._perfilId } : {}),
    })
  } catch (error) {
    throw new Error(`${completed ? 'Se guardó parte del cambio. Reintentá para completar. ' : ''}${error.message}`)
  }
}
