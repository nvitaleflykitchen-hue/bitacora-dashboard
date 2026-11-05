import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import EditarContactoInicio from './EditarContactoInicio'
const mocks = vi.hoisted(() => ({ rol: 'admin', save: vi.fn() }))
afterEach(cleanup)
vi.mock('../lib/auth', () => ({ useAuth: () => ({ rol: mocks.rol }) }))
vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../lib/saveContactoInicio', () => ({ guardarContactoInicio: mocks.save }))
beforeEach(() => {
  mocks.rol = 'admin'
  mocks.save.mockReset().mockResolvedValue(undefined)
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})
const contacto = { id: 'c', nombre: 'Ana', telefono: '3511234567', email: 'contacto@example.com' }
it('no ofrece edición a lectores', () => {
  mocks.rol = 'consultor'
  render(<EditarContactoInicio contacto={contacto} />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
it('guarda el formulario y notifica la recarga del directorio', async () => {
  const listener = vi.fn()
  window.addEventListener('directorio-updated', listener)
  render(<EditarContactoInicio contacto={contacto} />)
  fireEvent.click(screen.getByRole('button', { name: 'Editar contacto Ana' }))
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '3517654321' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(listener).toHaveBeenCalledTimes(1))
  expect(mocks.save.mock.calls[0][2].telefono).toBe('3517654321')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  window.removeEventListener('directorio-updated', listener)
})
it('mantiene el formulario y muestra el error al fallar', async () => {
  mocks.save.mockRejectedValue(new Error('Sin permisos'))
  render(<EditarContactoInicio contacto={contacto} />)
  fireEvent.click(screen.getByRole('button', { name: 'Editar contacto Ana' }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin permisos')
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})
