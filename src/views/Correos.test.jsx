import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Correos, { CorreoDetail } from './Correos'
import * as api from '../lib/correos'

vi.mock('../lib/correos', () => ({
  CORREO_PAGE_SIZE: 25, correoError: e => e.message,
  getCorreoContext: vi.fn(), getCorreos: vi.fn(), getCorreoDetail: vi.fn(),
  reviewCorreo: vi.fn(), downloadCorreoFile: vi.fn(),
}))
const message = { id: 'm1', buzon_id: 'b1', asunto: 'Presupuesto', remitente: 'Proveedor', destinatarios: ['Nico'], cuerpo: '<script>NO EJECUTAR</script>', estado: 'pendiente', sugerido_plan_id: 'p1', adjuntos: [], ai_estado: 'lista', original_path: 'original.eml' }
const plans = [{ id: 'p1', titulo: 'Reparación compresor' }]
beforeEach(() => {
  vi.resetAllMocks()
  api.getCorreoContext.mockResolvedValue({ mailboxes: [{ id: 'b1', nombre: 'Operaciones' }], plans, memberships: [{ buzon_id: 'b1', puede_revisar: true }] })
  api.getCorreos.mockResolvedValue({ items: [message], total: 1 })
  api.getCorreoDetail.mockResolvedValue({ message, history: [] })
  api.reviewCorreo.mockResolvedValue()
})
afterEach(cleanup)

describe('Bandeja de correos', () => {
  it('permite aceptar una sugerencia y conserva el cuerpo como texto', async () => {
    const saved = vi.fn()
    render(<CorreoDetail id="m1" plans={plans} canReview onClose={() => {}} onSaved={saved} />)
    await screen.findByText('Presupuesto')
    expect(document.querySelector('script')).toBeNull()
    fireEvent.click(screen.getByText('Guardar vínculo'))
    await waitFor(() => expect(api.reviewCorreo).toHaveBeenCalledWith(message, 'p1', 'vinculado'))
    expect(saved).toHaveBeenCalledOnce()
  })
  it('no muestra acciones de asociación a lectores', async () => {
    render(<CorreoDetail id="m1" plans={plans} canReview={false} onClose={() => {}} onSaved={() => {}} />)
    await screen.findByText('Presupuesto')
    expect(screen.queryByText('Guardar vínculo')).toBeNull()
    expect(screen.getByText('Descargar correo original')).toBeTruthy()
  })
  it('muestra errores de revisión sin cerrar ni anunciar éxito', async () => {
    api.reviewCorreo.mockRejectedValue(new Error('El correo cambió'))
    const saved = vi.fn()
    render(<CorreoDetail id="m1" plans={plans} canReview onClose={() => {}} onSaved={saved} />)
    await screen.findByText('Presupuesto')
    fireEvent.click(screen.getByText('Guardar vínculo'))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'El correo cambió')
    expect(saved).not.toHaveBeenCalled()
  })
  it('navega a página siguiente y vuelve a la anterior', async () => {
    api.getCorreos.mockResolvedValue({ items: [message], total: 80 })
    render(<Correos />)
    await screen.findByText('Siguiente')
    fireEvent.click(screen.getByText('Siguiente'))
    await waitFor(() => expect(api.getCorreos).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })))
    await screen.findByText('Siguiente')
    fireEvent.click(screen.getByText('Siguiente'))
    await waitFor(() => expect(api.getCorreos).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
    await screen.findByText('Anterior')
    fireEvent.click(screen.getByText('Anterior'))
    await waitFor(() => expect(api.getCorreos).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })))
  })
  it('explica cuando no hay buzones habilitados', async () => {
    api.getCorreoContext.mockResolvedValue({ mailboxes: [], plans: [], memberships: [] })
    render(<Correos />)
    expect(await screen.findByText(/No tenés buzones habilitados/)).toBeTruthy()
    expect(api.getCorreos).not.toHaveBeenCalled()
  })
})
