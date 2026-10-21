import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import SedeBiblioteca from './SedeBiblioteca'
import { getAdjuntos, uploadAdjunto } from '../lib/adjuntos'
const access = vi.hoisted(() => ({ perfil: { nombre: 'Admin' }, can: () => true, allowedSedeIds: null }))
afterEach(cleanup)
vi.mock('../lib/auth', () => ({ useAuth: () => access }))
vi.mock('../lib/adjuntos', () => ({ getAdjuntos: vi.fn(), uploadAdjunto: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); access.allowedSedeIds = null; access.can = () => true; getAdjuntos.mockResolvedValue([]) })
it('blocks reads and upload controls outside the assigned sede', () => {
  access.allowedSedeIds = [2]
  render(<SedeBiblioteca sedeId={19} sedeNombre="Mendoza" />)
  expect(getAdjuntos).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Subir documentos' })).not.toBeInTheDocument()
})
it('searches documents and keeps readers from uploading', async () => {
  access.can = () => false
  getAdjuntos.mockResolvedValue([{ id: 1, nombre: 'Evaluación Copa.pdf', url: 'https://example.com/a' }, { id: 2, nombre: 'POES.pdf', url: 'https://example.com/b' }])
  render(<SedeBiblioteca sedeId={19} sedeNombre="Mendoza" />)
  await screen.findByText('Evaluación Copa.pdf')
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'evaluacion' } })
  expect(screen.queryByText('POES.pdf')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Subir documentos' })).not.toBeInTheDocument()
})
it('preserves successful uploads when a later file fails', async () => {
  uploadAdjunto.mockResolvedValueOnce({ id: 1, nombre: 'primero.pdf', url: 'https://example.com/a' }).mockRejectedValueOnce(new Error('Sin conexión'))
  const { container } = render(<SedeBiblioteca sedeId={19} sedeNombre="Mendoza" />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Subir documentos' })).toBeEnabled())
  fireEvent.change(container.querySelector('input[type=file]'), { target: { files: [new File(['a'], 'primero.pdf'), new File(['b'], 'segundo.pdf')] } })
  await screen.findByText('primero.pdf')
  expect(await screen.findByRole('alert')).toHaveTextContent('Se cargaron 1 de 2 archivos')
  expect(uploadAdjunto).toHaveBeenCalledWith('sede_biblioteca', 19, expect.any(File), 'Admin')
})
