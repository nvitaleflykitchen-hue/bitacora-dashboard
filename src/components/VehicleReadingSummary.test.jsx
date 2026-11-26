import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import VehicleReadingSummary from './VehicleReadingSummary'
afterEach(cleanup)
it('distingue ausencia de lectura, cero y error de consulta',()=>{
  const {rerender}=render(<VehicleReadingSummary loading/>)
  expect(screen.getByRole('status').textContent).toContain('Consultando')
  rerender(<VehicleReadingSummary error="Error de red"/>)
  expect(screen.getByText('No se pudo consultar el kilometraje.')).toBeTruthy()
  rerender(<VehicleReadingSummary report={{reading:{km:null}}}/>)
  expect(screen.getByText('Sin registro')).toBeTruthy()
  rerender(<VehicleReadingSummary report={{reading:{km:0,fecha:'2026-11-26T12:00:00Z',fuente:'Checklist',responsable:'Vicente'}}}/>)
  expect(screen.getByText('0 km')).toBeTruthy()
  expect(screen.getByText(/09:00:00/)).toBeTruthy()
  expect(screen.getByText('Responsable registrado: Vicente')).toBeTruthy()
})
