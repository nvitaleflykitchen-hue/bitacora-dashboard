import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import DocumentacionChecklist from './DocumentacionChecklist'
import { upsertDocumentacionItem } from '../lib/documentacion'
import { uploadAdjunto } from '../lib/adjuntos'
vi.mock('../lib/auth', () => ({ useAuth: () => ({ perfil: { nombre: 'Admin' } }) }))
vi.mock('./CorreosEntidad', () => ({ default: () => null }))
vi.mock('./AdjuntosPanel', () => ({ default: () => <p>Archivos cargados</p> }))
vi.mock('../lib/adjuntos', () => ({ uploadAdjunto: vi.fn().mockResolvedValue({ id: 3 }) }))
vi.mock('../lib/documentacion', () => ({
  DOCUMENTACION_ESTADOS: [{ value: 'pendiente', label: 'Pendiente' }], DOCUMENTACION_AVISO_DIAS_DEFAULT: 30,
  docEstadoMeta: () => ({ label: 'Pendiente' }), docVencimientoInfo: () => ({ tipo: 'sin_fecha', label: 'Sin vencimiento' }),
  getDocumentacionItems: vi.fn().mockResolvedValue([]), upsertDocumentacionItem: vi.fn().mockImplementation(async item => ({ ...item, id: 42 })),
}))
afterEach(() => { cleanup(); vi.clearAllMocks() })
const template = [{ codigo: 'senasa', titulo: 'SENASA', seccion: 'Vehículos' }]
it('saves the item and uploads directly without a separate save click', async () => {
  render(<DocumentacionChecklist entityType="vehiculo" entityId="vehiculo-1" template={template} canEdit wide />)
  const input = await screen.findByLabelText('Subir documentación: SENASA')
  const file = new File(['pdf'], 'senasa.pdf', { type: 'application/pdf' })
  fireEvent.change(input, { target: { files: [file] } })
  await waitFor(() => expect(uploadAdjunto).toHaveBeenCalledWith('documentacion_item', 42, file, 'Admin'))
  expect(upsertDocumentacionItem).toHaveBeenCalledWith(expect.objectContaining({ entity_type: 'vehiculo', entity_id: 'vehiculo-1' }))
})
it('does not offer upload to read-only users', async () => {
  render(<DocumentacionChecklist entityType="vehiculo" entityId="vehiculo-1" template={template} />)
  await screen.findByText('SENASA')
  expect(screen.queryByLabelText('Subir documentación: SENASA')).not.toBeInTheDocument()
})
