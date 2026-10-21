import React from 'react'
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RegistroVehiculos from './RegistroVehiculos'
import { getVehiculoNovedadesByRegistro } from '../lib/queries'

vi.mock('../lib/queries', () => ({ getVehiculoNovedadesByRegistro: vi.fn() }))
afterEach(cleanup)
const novelty = { id: 24, activo_nombre: 'Lifan - AD 286 IH', tipo: 'Avería', descripcion: 'Espejo izquierdo flojo\nLevanta vidrios roto', estado: 'Pendiente', fecha_reporte: '2026-10-20' }

describe('novedades vehiculares vinculadas al reporte', () => {
  beforeEach(() => vi.resetAllMocks())
  it('muestra el reporte 4323 sin necesitar detalles de categorías A–H', async () => {
    getVehiculoNovedadesByRegistro.mockResolvedValue([novelty])
    render(<RegistroVehiculos registroId={4323} />)
    expect(await screen.findByText('Lifan - AD 286 IH')).toBeInTheDocument()
    expect(screen.getByText(/Espejo izquierdo flojo/)).toBeInTheDocument()
    expect(getVehiculoNovedadesByRegistro).toHaveBeenCalledWith(4323)
  })
  it('muestra errores y permite reintentar sin afirmar que no hay novedades', async () => {
    getVehiculoNovedadesByRegistro.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([novelty])
    render(<RegistroVehiculos registroId={4323} compact />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar')
    fireEvent.click(screen.getByText('Reintentar'))
    expect(await screen.findByText('Lifan - AD 286 IH')).toBeInTheDocument()
  })
  it('ignora una respuesta anterior al cambiar de reporte o sede', async () => {
    let resolveOld
    getVehiculoNovedadesByRegistro.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve })).mockResolvedValueOnce([])
    const { rerender } = render(<RegistroVehiculos registroId={4323} />)
    rerender(<RegistroVehiculos registroId={4324} />)
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    resolveOld([novelty])
    await waitFor(() => expect(screen.queryByText('Lifan - AD 286 IH')).not.toBeInTheDocument())
  })
})
