import React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import FeedbackHost from './FeedbackHost'
import { confirmar } from '../lib/feedback'
vi.mock('../lib/backStack', () => ({ useBackHandler: vi.fn() }))
afterEach(cleanup)
it('presenta la confirmación fuera de capas locales y resuelve guardar o volver', async () => {
  const { container } = render(<div style={{ transform: 'translateZ(0)', zIndex: 1 }}><FeedbackHost /></div>)
  let answer
  act(() => { answer = confirmar({ titulo: 'Cerrar ticket', mensaje: 'Confirmar resolución' }) })
  const dialog = screen.getByRole('dialog', { name: 'Cerrar ticket' })
  expect(dialog.parentElement).toBe(document.body)
  expect(container.contains(dialog)).toBe(false)
  expect(Number(dialog.style.zIndex)).toBeGreaterThan(10000)
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar', exact: true }))
  await expect(answer).resolves.toBe(true)
  act(() => { answer = confirmar({ titulo: 'Descartar cambios', mensaje: 'Se perderán los cambios' }) })
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar', exact: true }))
  await expect(answer).resolves.toBe(false)
  expect(screen.queryByRole('dialog')).toBeNull()
})
