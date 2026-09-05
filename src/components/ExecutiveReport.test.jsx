import React from 'react'
import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import ExecutiveReport from './ExecutiveReport'
import { buildExecutiveBriefing } from '../lib/executiveBriefing'
afterEach(cleanup)
it('ofrece un informe sin servicio IA y prepara borradores separados sin enviarlos', () => {
  const navigate = vi.fn()
  const briefing = buildExecutiveBriefing({ profileIds:['yo'], today:new Date('2026-09-05T12:00:00'), tasks:[{estado:'Pendiente',creado_por:'yo',responsable_id:'otro',perfiles:{nombre:'Ana'},titulo:'Inventario cocina',fecha_limite:'2026-09-04'}] })
  render(<ExecutiveReport briefing={briefing} name="Nicolás" onNavigate={navigate} />)
  expect(screen.getByText('Nicolás, este es tu punto de partida.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Revisar compras'}))
  expect(navigate).toHaveBeenCalledWith('requerimientos')
  fireEvent.click(screen.getByRole('button',{name:'Preparar mensajes de seguimiento'}))
  expect(screen.getByText('Para Ana')).toBeTruthy()
  expect(screen.getByText(/Hola, Ana.*Necesito/s).textContent).toContain('Inventario cocina')
  expect(screen.queryByRole('button',{name:'Enviar'})).toBeNull()
})
it('no presenta un informe vacío como válido si falló la carga', () => {
  render(<ExecutiveReport briefing={buildExecutiveBriefing()} error onNavigate={vi.fn()} />)
  expect(screen.getByRole('alert')).toBeTruthy()
  expect(screen.queryByText('1. Destrabar decisiones')).toBeNull()
})
