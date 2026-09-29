// Los registros anteriores a la clasificación pertenecen al staff.
export const esPersonaExterna = (persona) => persona?.tipo_vinculo === 'externo';
export const esPersonalOperativo = (persona) => persona?.activo !== false && !esPersonaExterna(persona);
export function coincideVinculo(persona, filtro) {
  return filtro === 'todos' || (filtro === 'externo' ? esPersonaExterna(persona) : !esPersonaExterna(persona));
}
