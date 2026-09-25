import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VuelosPlantilla from './VuelosPlantilla'
import * as queries from '../lib/queries'

vi.mock('../lib/queries', () => ({
  getSedes: vi.fn(), getVuelosPlantilla: vi.fn(), getVuelosCalendarioMes: vi.fn(),
  getUltimoMesVuelosCalendario: vi.fn(), crearVueloPlantilla: vi.fn(),
  actualizarVueloPlantilla: vi.fn(), eliminarVueloPlantilla: vi.fn(),
}))
vi.mock('../components/PageHeader', () => ({
  default: ({ title, children }) => <header><h1>{title}</h1>{children}</header>,
}))

beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
  queries.getSedes.mockResolvedValue([{ id:10, nombre:'Aeropuerto Rosario', tipo:'Aeropuerto' }])
  queries.getVuelosPlantilla.mockResolvedValue([{ id:1, dia_semana:4, vuelo_codigo:'CM836', destino:'PTY', aerolinea:'Copa', orden:0 }])
  queries.getUltimoMesVuelosCalendario.mockResolvedValue(null)
  queries.getVuelosCalendarioMes.mockImplementation(async (_siteId, month) => month === '2026-10' ? [
    { id:100, fecha:'2026-10-01', vuelo_codigo:'CM836', destino:'PTY', aerolinea:'Copa', orden:0 },
    { id:101, fecha:'2026-10-06', vuelo_codigo:'WFL2076', destino:'MAD', aerolinea:'World2Fly', orden:0 },
  ] : [])
})

describe('Plantilla de Vuelos', () => {
  it('muestra el calendario diario cargado y conserva la plantilla semanal aparte', async () => {
    render(<VuelosPlantilla />)
    await waitFor(() => expect(screen.getByRole('button', { name:'Aeropuerto Rosario' })).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Mes'), { target:{ value:'2026-10' } })
    await waitFor(() => {
      expect(screen.getByText('CM836')).toBeTruthy()
      expect(screen.getByText('2 vuelos en 2 días')).toBeTruthy()
    }, { timeout: 10000 })
    fireEvent.click(screen.getByRole('button', { name:/^6/ }))
    expect(screen.getByText('WFL2076')).toBeTruthy()
    expect(screen.queryByText('CM836')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name:'Plantilla semanal' }))
    expect(screen.getByRole('button', { name:'Jueves (1)' })).toBeTruthy()
    expect(queries.getVuelosCalendarioMes).toHaveBeenCalledWith(10, '2026-10')
  })
})
