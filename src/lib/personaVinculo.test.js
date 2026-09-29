import { describe, expect, it } from 'vitest';
import { esPersonalOperativo, coincideVinculo } from './personaVinculo';
describe('Dotación y directorio externo', () => {
  const personas = [{ id: 'staff', activo: true }, { id: 'asesora', activo: true, tipo_vinculo: 'externo' }, { id: 'baja', activo: false, tipo_vinculo: 'staff' }];
  it('mantiene el staff anterior y excluye externos e inactivos de dotación', () => {
    expect(personas.filter(esPersonalOperativo).map(p => p.id)).toEqual(['staff']);
  });
  it('permite encontrar a la asesora en externos y todos, conservando su actividad', () => {
    const asesora = personas[1];
    expect(coincideVinculo(asesora, 'staff')).toBe(false);
    expect(coincideVinculo(asesora, 'externo')).toBe(true);
    expect(coincideVinculo(asesora, 'todos')).toBe(true);
    expect(asesora.activo).toBe(true);
  });
});
