import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import HabilitarUsuarioModal from './HabilitarUsuarioModal'
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'test-token' } } })) } } }))
vi.mock('../lib/feedback', () => ({ toast: { ok: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const persona = { id: 'persona-id', nombre: 'Guardia', email: 'guardia@example.com', sede_ids: [24] }
const sedes = [{ id: 24, nombre: 'Planta', activa: true }, { id: 21, nombre: 'Aeropuerto', activa: true }, { id: 99, nombre: 'Inactiva', activa: false }]
it('envía el rol Seguridad con las sedes elegidas y muestra la contraseña real', async () => {
  const fetchMock = vi.fn(async () => ({ ok: true, text: async () => JSON.stringify({ data: { temp_password: 'Temporal-aleatoria!' } }) }))
  vi.stubGlobal('fetch', fetchMock)
  render(<HabilitarUsuarioModal persona={persona} sedes={sedes} />)
  fireEvent.change(screen.getByLabelText('Tipo de acceso'), { target: { value: 'seguridad' } })
  expect(screen.getByLabelText('Planta')).toBeChecked()
  expect(screen.queryByLabelText('Inactiva')).toBeNull()
  fireEvent.click(screen.getByLabelText('Planta'))
  expect(screen.getByRole('button', { name: 'Habilitar usuario' })).toBeDisabled()
  fireEvent.click(screen.getByLabelText('Aeropuerto'))
  fireEvent.click(screen.getByRole('button', { name: 'Habilitar usuario' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ persona_id: persona.id, email: persona.email, rol: 'seguridad', sede_ids: [21] })
  expect(await screen.findByText('Temporal-aleatoria!')).toBeInTheDocument()
  expect(decodeURIComponent(screen.getByRole('link').href)).toContain('Temporal-aleatoria!')
  expect(screen.queryByText('123456')).toBeNull()
})
it('aclara que vincular una cuenta existente conserva sus permisos y contraseña', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => JSON.stringify({ data: { linked_existing: true } }) })))
  render(<HabilitarUsuarioModal persona={persona} sedes={sedes} />)
  fireEvent.click(screen.getByRole('button', { name: 'Habilitar usuario' }))
  expect(await screen.findByText(/La cuenta conserva su tipo de acceso/)).toBeInTheDocument()
  expect(decodeURIComponent(screen.getByRole('link').href)).not.toContain('Contraseña temporal')
})
