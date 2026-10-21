import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TicketModal } from './MntVehiculos'
import { updateTicket } from '../../lib/queries'
vi.mock('../../lib/supabase', () => ({ supabase: {}, db: vi.fn() }))
vi.mock('../../lib/auth', () => ({ useAuth: () => ({}) }))
vi.mock('../../lib/queries', () => ({ createTicket: vi.fn(), updateTicket: vi.fn() }))
vi.mock('../../lib/feedback', () => ({ toast: { ok: vi.fn(), error: vi.fn() } }))
vi.mock('../../components/TicketProveedor', () => ({ default: ({ value, onChange }) => <select aria-label="Proveedor" value={value || ''} onChange={e => onChange(e.target.value)}><option value="">Sin proveedor</option><option value="provider-1">Taller</option></select> }))
vi.mock('../../components/AdjuntosPanel', () => ({ default: ({ entityType, entityId }) => <p>Adjuntos {entityType} {entityId}</p> }))
vi.mock('../../lib/pushNotifications', () => ({ notifyHighPriority: vi.fn() }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
const ticket = { id: 'c6bd69fd-958c-43e9-8381-40436f0b0163', activo_nombre: 'JDN192', descripcion: 'Reparación', estado: 'abierto' }
it('saves the canonical phase and supplier preserving the UUID', async () => {
  updateTicket.mockResolvedValue({ ...ticket, estado: 'en_progreso' })
  const onSaved = vi.fn()
  render(<TicketModal ticket={ticket} patentes={[]} onSaved={onSaved} onClose={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('Estado del ticket'), { target: { value: 'en progreso' } })
  fireEvent.change(screen.getByLabelText('Proveedor'), { target: { value: 'provider-1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await waitFor(() => expect(updateTicket).toHaveBeenCalledWith(ticket.id, expect.objectContaining({ estado: 'en_progreso', proveedor_id: 'provider-1' })))
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
})
it('keeps the modal open and displays a failed write', async () => {
  updateTicket.mockRejectedValue(new Error('No autorizado'))
  const onSaved = vi.fn()
  render(<TicketModal ticket={ticket} patentes={[]} onSaved={onSaved} onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await screen.findByText('No autorizado')
  expect(onSaved).not.toHaveBeenCalled()
})
it('opens attachments with the same identity used by maintenance and mobile', () => {
  render(<TicketModal ticket={ticket} patentes={[]} onSaved={vi.fn()} onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Documentos / presupuestos' }))
  expect(screen.getByText(`Adjuntos ticket ${ticket.id}`)).toBeInTheDocument()
})
