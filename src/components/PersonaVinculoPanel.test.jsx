import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PersonaVinculoPanel from './PersonaVinculoPanel';
const mocks = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn(), single: vi.fn(), ok: vi.fn(), error: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { schema: () => ({ from: () => ({ update: mocks.update }) }) } }));
vi.mock('../lib/feedback', () => ({ toast: { ok: mocks.ok, error: mocks.error } }));
describe('Clasificación de personas', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ select: () => ({ single: mocks.single }) });
  });
  it('conserva actividad y actualiza solamente el vínculo de la persona elegida', async () => {
    mocks.single.mockResolvedValue({ data: { id: 'persona-1', tipo_vinculo: 'externo' }, error: null });
    const changed = vi.fn();
    render(<PersonaVinculoPanel persona={{ id: 'persona-1', activo: true }} canManage onChanged={changed} />);
    fireEvent.change(screen.getByLabelText('Tipo de vínculo'), { target: { value: 'externo' } });
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(mocks.update).toHaveBeenCalledWith({ tipo_vinculo: 'externo' });
    expect(mocks.eq).toHaveBeenCalledWith('id', 'persona-1');
  });
  it('no anuncia éxito ni refresca la ficha si la base rechaza la escritura', async () => {
    mocks.single.mockResolvedValue({ data: null, error: new Error('Sin permiso') });
    const changed = vi.fn();
    render(<PersonaVinculoPanel persona={{ id: 'persona-1', tipo_vinculo: 'staff' }} canManage onChanged={changed} />);
    fireEvent.change(screen.getByLabelText('Tipo de vínculo'), { target: { value: 'externo' } });
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(changed).not.toHaveBeenCalled();
    expect(mocks.ok).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Tipo de vínculo').value).toBe('staff');
  });
  it('permite consultar externos sin habilitar cambios a quien no administra equipo', () => {
    render(<PersonaVinculoPanel persona={{ id: 'persona-1', tipo_vinculo: 'externo' }} canManage={false} />);
    expect(screen.getByLabelText('Tipo de vínculo')).toBeDisabled();
    expect(screen.getByText(/Vínculo externo activo/)).toBeTruthy();
  });
});
