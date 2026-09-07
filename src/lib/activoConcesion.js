export function concesionLabel(value) {
  return value === true ? 'Concesionado' : value === false ? 'No concesionado' : 'Sin definir'
}

export function normalizarConcesion(payload) {
  if (!Object.hasOwn(payload, 'bien_concesionado')) return payload
  const value = payload.bien_concesionado
  if (value !== null && value !== true && value !== false) throw new Error('Indicá Sí, No o Sin definir para bien concesionado.')
  return {
    ...payload,
    concesion_propietario: value === true ? String(payload.concesion_propietario || '').trim() || null : null,
    concesion_referencia: value === true ? String(payload.concesion_referencia || '').trim() || null : null,
  }
}

export function coincideConcesion(activo, filtro) {
  return filtro === 'todos' || (filtro === 'si' && activo.bien_concesionado === true)
    || (filtro === 'no' && activo.bien_concesionado === false)
    || (filtro === 'sin_definir' && activo.bien_concesionado == null)
}
