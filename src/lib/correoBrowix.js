import { destinoCorreo, personasCorreo } from './correoDestinos'

export const esSolicitudBrowix = message => /^(?:(?:re|fw|fwd|rv):\s*)*solicitud\s+laboral\s+[^|\r\n]+\|\s*browix\s*$/i.test(String(message?.asunto || '').trim())

const nombreNormalizado = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]+/g)?.sort().join(' ') || ''

export function seleccionInicialCorreo(message, people = []) {
  const current = destinoCorreo(message)
  const linkedPeople = personasCorreo(message)
  const browix = esSolicitudBrowix(message)
  const suggested = browix ? '' : destinoCorreo(message, true)
  const selected = current?.startsWith('persona:') ? '' : (current || (suggested?.startsWith('persona:') ? '' : suggested) || '')
  if (linkedPeople.length || message.estado === 'vinculado') return { selected, people: linkedPeople, notice: '' }
  if (!browix) return { selected, people: personasCorreo(message, true), notice: '' }

  // Use only the labelled employee, never names in comments or coverage staff.
  const employees = [...String(message.cuerpo || '').matchAll(/^\s*Empleado\s*:\s*([^\r\n]+)/gim)]
    .map(match => match[1].split(/\s+Legajo\s*:/i)[0].trim())
  const names = [...new Set(employees.map(nombreNormalizado).filter(Boolean))]
  const matches = names.length === 1 ? people.filter(person =>
    nombreNormalizado(person.nombre || person.apellido ? `${person.nombre || ''} ${person.apellido || ''}` : person.titulo) === names[0]) : []
  if (matches.length !== 1) return { selected, people: [], notice: 'No se pudo identificar una persona única para esta solicitud de Browix. Seleccionala manualmente.' }
  const person = matches[0]
  return { selected, people: [String(person.id)], notice: `Persona identificada en Browix: ${person.titulo || `${person.nombre} ${person.apellido}`}. Revisá y guardá el vínculo.` }
}
