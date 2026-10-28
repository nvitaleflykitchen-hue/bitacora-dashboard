export const AUTORIZADOS_INICIALES = [
  { nombre: 'PABLO OCAMPO', dni: '37.316.088' },
  { nombre: 'FERNANDO GONZÁLEZ', dni: '42.896.086' },
  { nombre: 'BRAIAN CABALLERO', dni: '43.229.305' },
  { nombre: 'NAHUEL PEDANO', dni: '43.450.813' },
  { nombre: 'KEVIN RAMALLO', dni: '38.106.268' },
  { nombre: 'MAURO BERTOLA', dni: '42.979.180' },
]

export function validarAutorizados(personas) {
  if (!Array.isArray(personas) || !personas.length) throw new Error('Agregá al menos una persona autorizada.')
  return personas.map(persona => {
    const nombre = String(persona.nombre || '').trim()
    const dni = String(persona.dni || '').trim()
    if (!nombre || nombre.length > 100 || !/^[\d.\s]+$/.test(dni) || !/^\d{7,8}$/.test(dni.replace(/[.\s]/g, ''))) {
      throw new Error('Completá nombre y DNI válido (7 u 8 dígitos) de cada persona autorizada.')
    }
    return { nombre, dni }
  })
}
