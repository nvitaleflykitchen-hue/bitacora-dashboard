import React from 'react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import App from './App'
import { AIRPORT_VEHICLES } from './lib/airportChecklist'
import generalVehicles from './data/vehicleQrCatalog.json'

const state = vi.hoisted(() => ({ auth: {} }))
vi.mock('./lib/auth', () => ({ AuthProvider: ({ children }) => children, useAuth: () => state.auth }))
vi.mock('./hooks/useEscalamientosAlert', () => ({ useEscalamientosAlert: () => {} }))
vi.mock('./data/releases', () => ({ hasSeenLatestRelease: () => true }))
vi.mock('./components/FeedbackHost', () => ({ default: () => null }))
vi.mock('./components/OfflineStatus', () => ({ default: () => null }))
vi.mock('./components/LoginPage', () => ({ default: () => <h1>Iniciar sesión</h1> }))
vi.mock('./components/CambiarContrasena', () => ({ default: () => <h1>Cambiar contraseña</h1> }))
vi.mock('./components/AirportVehicleChecklist', () => ({ default: ({ activoId }) => <h1>Checklist {activoId}</h1> }))
vi.mock('./views/flota/FlotaChecklist', () => ({ GeneralFlotaChecklist: ({ activoId }) => <h1>Checklist general {activoId}</h1> }))
vi.mock('./views/mantenimiento/PublicAssetQrView', () => ({ default: () => <h1>Ficha pública</h1> }))

beforeEach(() => {
  vi.stubGlobal('React', React)
  state.auth = { user: { id: 'operario' }, perfil: { rol: 'operario' }, rol: 'operario', loading: false, allowedSedeIds: [21], can: () => false }
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/') })

it.each(AIRPORT_VEHICLES)('el QR externo de $plate abre el checklist, no la ficha pública', async ({ id }) => {
  window.history.replaceState({}, '', `/?scan=activo&id=${id}`)
  render(<App />)
  expect(await screen.findByRole('heading', { name: `Checklist ${id}` })).toBeInTheDocument()
  expect(screen.queryByText('Ficha pública')).not.toBeInTheDocument()
})

it.each(generalVehicles)('QR de $nombre abre el control general preseleccionado', async ({ id }) => {
  window.history.replaceState({}, '', `/?scan=activo&id=${id}`)
  render(<App />)
  expect(await screen.findByRole('heading', { name: `Checklist general ${id}` })).toBeInTheDocument()
  expect(screen.queryByText('Ficha pública')).not.toBeInTheDocument()
})

it('el QR general exige login y conserva el vehículo al ingresar', async () => {
  const id=generalVehicles[0].id
  window.history.replaceState({}, '', `/?scan=activo&id=${id}`)
  state.auth.user=null
  const view=render(<App />)
  expect(screen.getByText('Iniciar sesión')).toBeInTheDocument()
  state.auth.user={id:'operario'}
  view.rerender(<App />)
  expect(await screen.findByRole('heading', {name:`Checklist general ${id}`})).toBeInTheDocument()
})

it('conserva el destino después de iniciar sesión y cambiar la clave obligatoria', async () => {
  const id = AIRPORT_VEHICLES[0].id
  window.history.replaceState({}, '', `/?scan=activo&id=${id}`)
  state.auth = { ...state.auth, user: null }
  const view = render(<App />)
  expect(screen.getByText('Iniciar sesión')).toBeInTheDocument()
  state.auth = { ...state.auth, user: { id: 'operario' }, perfil: { rol: 'operario', must_change_password: true } }
  view.rerender(<App />)
  expect(screen.getByText('Cambiar contraseña')).toBeInTheDocument()
  state.auth.perfil = { rol: 'operario', must_change_password: false }
  view.rerender(<App />)
  expect(await screen.findByRole('heading', { name: `Checklist ${id}` })).toBeInTheDocument()
})

it('otros activos conservan su ficha pública sin login', async () => {
  window.history.replaceState({}, '', '/?scan=activo&id=otro-activo')
  state.auth.user = null
  render(<App />)
  expect(await screen.findByText('Ficha pública')).toBeInTheDocument()
})
