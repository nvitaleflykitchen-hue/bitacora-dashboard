const clean = value => String(value || '').trim().toLowerCase()
const name = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')
const fullName = person => [person.nombre, person.apellido].filter(Boolean).join(' ').trim()
const unique = (rows, predicate) => {
  const matches = rows.filter(predicate)
  return matches.length === 1 ? matches[0] : null
}

function match(contact, rows, idKey, getName) {
  // An explicit identity must never fall back to a different person by name.
  if (contact.perfil_id) return unique(rows, row => row[idKey] === contact.perfil_id)
  const email = clean(contact.email)
  const emailMatches = email ? rows.filter(row => clean(row.email) === email) : []
  if (emailMatches.length) return emailMatches.length === 1 ? emailMatches[0] : null
  return name(contact.nombre) ? unique(rows, row => name(getName(row)) === name(contact.nombre)) : null
}

export function telefonoEnlace(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 10) return `549${digits}`
  if (digits.length > 10 && digits.startsWith('0')) return `54${digits.slice(1)}`
  return digits
}

// Preserve the curated categories and service numbers; resolve people at read time.
export function resolverContactos(contactos, perfiles, personas) {
  return contactos.map(contact => {
    if (contact.modulo === 'emergencias') return contact
    const perfil = match(contact, perfiles, 'id', row => row.nombre)
    const persona = perfil
      ? unique(personas, row => row.perfil_id === perfil.id) ||
        match({ ...perfil, perfil_id: null }, personas.filter(row => !row.perfil_id), 'perfil_id', fullName)
      : match(contact, personas, 'perfil_id', fullName)
    if (perfil?.activo === false || persona?.activo === false) return null
    if (!perfil && !persona) return contact
    const telefono = perfil?.telefono?.trim() || persona?.telefono?.trim()
    return {
      ...contact,
      nombre: perfil?.nombre || (persona && fullName(persona)) || contact.nombre,
      // perfiles.email identifies the login account, not the contact mailbox.
      // Resolve contact details only; never write them back to the auth profile.
      email: persona?.email?.trim() || contact.email || '',
      ...(telefono ? { telefono, tel: telefonoEnlace(telefono), wa: telefonoEnlace(telefono) } : {}),
    }
  }).filter(Boolean)
}
