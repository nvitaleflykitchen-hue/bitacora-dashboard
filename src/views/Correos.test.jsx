import React from 'react'
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
  it('reabre el activo vinculado y busca equipos por serie sin distinguir acentos', async () => {
    const current = { ...message, estado: 'vinculado', sugerido_plan_id: null, activo_id: 'a1' }
    api.getCorreoDetail.mockResolvedValue({ message: current, history: [] })
    const destinations = { activos: [
      { id: 'activo:a1', titulo: 'CAM-001 · Cámara fría', search: 'Cámara Córdoba SER-88' },
      { id: 'activo:a2', titulo: 'Horno', search: 'Horno SER-99' },
    ] }
    render(<CorreoDetail id="m1" destinations={destinations} canReview onClose={() => {}} onSaved={() => {}} />)
    await screen.findByText('Presupuesto')
    expect(screen.getByRole('tab', { name: /Activos/ }).getAttribute('aria-selected')).toBe('true')
    fireEvent.change(screen.getByPlaceholderText('Nombre, código, marca, modelo, serie o sede…'), { target: { value: 'cordoba ser-88' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('option').getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByText('Guardar vínculo'))
    await waitFor(() => expect(api.reviewCorreo).toHaveBeenCalledWith(current, 'activo:a1', 'vinculado', []))
  })

  it('consulta el historial de una persona en todos los buzones y abre el detalle sin editar vínculos', async () => {
    render(<Correos planId="persona:11111111-1111-1111-1111-111111111111" readOnly />)
    await screen.findByText('Presupuesto')
    expect(api.getCorreos).toHaveBeenLastCalledWith(expect.objectContaining({ mailboxId: '', state: 'vinculado', planId: 'persona:11111111-1111-1111-1111-111111111111' }))
    expect(screen.getByText('Todos mis buzones')).toBeTruthy()
    fireEvent.click(screen.getByText('Presupuesto'))
    await screen.findByText('Descargar correo original')
    expect(screen.queryByText('Guardar vínculo')).toBeNull()
    fireEvent.click(screen.getByText('Cerrar detalle'))
    fireEvent.change(screen.getByLabelText('Buzón'), { target: { value: 'b1' } })
    await waitFor(() => expect(api.getCorreos).toHaveBeenLastCalledWith(expect.objectContaining({ mailboxId: 'b1' })))
  })
  it('no consulta el historial de correos sin buzones habilitados', async () => {
    api.getCorreoContext.mockResolvedValue({ mailboxes: [], plans: [], memberships: [] })
    render(<Correos planId="persona:11111111-1111-1111-1111-111111111111" readOnly />)
    await screen.findByText(/No tenés buzones habilitados/)
    expect(api.getCorreos).not.toHaveBeenCalled()
  })
  it('permite aceptar una sugerencia y conserva el cuerpo como texto', async () => {
    const saved = vi.fn()
    render(<CorreoDetail id="m1" plans={plans} canReview onClose={() => {}} onSaved={saved} />)
    await screen.findByText('Presupuesto')
    expect(document.querySelector('script')).toBeNull()
    fireEvent.click(screen.getByText('Guardar vínculo'))
    await waitFor(() => expect(api.reviewCorreo).toHaveBeenCalledWith(message, 'p1', 'vinculado', []))
    expect(saved).toHaveBeenCalledOnce()
  })
  it('abre el detalle como panel fijo y permite cerrarlo con Escape', async () => {
    const close = vi.fn()
    render(<CorreoDetail id="m1" plans={plans} canReview onClose={close} onSaved={() => {}} />)
    const dialog = await screen.findByRole('dialog', { name: 'Detalle del correo' })
    expect(dialog.parentElement.style.position).toBe('fixed')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(close).toHaveBeenCalledOnce()
  })
  it.each(['tarea:7', 'compra:8', 'ticket:abc'])('guarda el destino %s desde el detalle', async key => {
    const [kind, id] = key.split(':')
    const current = { ...message, sugerido_plan_id: null, [`sugerido_${kind}_id`]: id }
    api.getCorreoDetail.mockResolvedValue({ message: current, history: [] })
    render(<CorreoDetail id="m1" plans={[{ id: key, titulo: 'Gestión destino' }]} canReview onClose={() => {}} onSaved={() => {}} />)
    await screen.findByText('Presupuesto')
    fireEvent.click(screen.getByText('Guardar vínculo'))
    const people = key.startsWith('persona:') ? [key] : []
    await waitFor(() => expect(api.reviewCorreo).toHaveBeenCalledWith(current, key.startsWith('persona:') ? '' : key, 'vinculado', people))
  })
  it('busca y asocia el correo a una persona específica', async () => {
    const destinations = {
      tickets: [], compras: [], tareas: [], planes: plans, proyectos: [], grupos: [], sedes: [], vehiculos: [], id: [],
      personas: [
        { id: 'persona:p1', titulo: 'Romina Rodríguez', meta: 'Nutricionista', search: 'Romina Rodríguez Nutricionista' },
        { id: 'persona:p2', titulo: 'Pablo Fernández', meta: 'Mantenimiento', search: 'Pablo Fernández Mantenimiento' },
      ],
    }
    api.getCorreoDetail.mockResolvedValue({ message: { ...message, sugerido_plan_id: null }, history: [] })
    render(<CorreoDetail id="m1" plans={plans} destinations={destinations} canReview onClose={() => {}} onSaved={() => {}} />)
    await screen.findByText('Presupuesto')
    fireEvent.click(screen.getByRole('tab', { name: /Personas/ }))
    fireEvent.change(screen.getByPlaceholderText('Nombre, apellido o puesto…'), { target: { value: 'Romina' } })
    expect(screen.getByText('Romina Rodríguez')).toBeTruthy()
    expect(screen.queryByText('Pablo Fernández')).toBeNull()
    fireEvent.click(screen.getByText('Romina Rodríguez'))
    fireEvent.change(screen.getByPlaceholderText('Nombre, apellido o puesto…'), { target: { value: 'Pablo' } })
    fireEvent.click(screen.getByText('Pablo Fernández'))
    fireEvent.click(screen.getByText('Guardar vínculo'))
    await waitFor(() => expect(api.reviewCorreo).toHaveBeenCalledWith(expect.anything(), '', 'vinculado', ['persona:p1', 'persona:p2']))
  })
  it('conserva una gestión y varias personas en la misma revisión', async () => {
    const destinations = {
      tickets: [], compras: [{ id:'compra:8', titulo:'Compra de estantería' }], tareas: [], planes: [], proyectos: [], grupos: [], sedes: [], vehiculos: [], id: [],
      personas: [{ id:'persona:p1', titulo:'Romina Rodríguez' }, { id:'persona:p2', titulo:'Pablo Fernández' }],
    }
    api.getCorreoDetail.mockResolvedValue({ message:{ ...message, sugerido_plan_id:null }, history:[] })
    render(<CorreoDetail id="m1" destinations={destinations} canReview onClose={() => {}} onSaved={() => {}} />)
    await screen.findByText('Presupuesto')
    fireEvent.click(screen.getByRole('tab', { name:/Compras/ }))
    fireEvent.click(screen.getByText('Compra de estantería'))
    fireEvent.click(screen.getByRole('tab', { name:/Personas/ }))
    fireEvent.click(screen.getByRole('checkbox', { name:'Asociar a Romina Rodríguez' }))
    fireEvent.click(screen.getByRole('checkbox', { name:'Asociar a Pablo Fernández' }))
    fireEvent.click(screen.getByText('Guardar vínculo'))
    await waitFor(() => expect(api.reviewCorreo).toHaveBeenCalledWith(expect.anything(), 'compra:8', 'vinculado', ['persona:p1','persona:p2']))
  })
  it.each([
    ['Activos', 'activo:a1', 'CAM-001 · Cámara de frío'],
    ['Grupos', 'grupo:3', 'Comedores Centro'],
    ['Sedes', 'sede:4', 'Hospital Villa Dolores'],
    ['Vehículos', 'vehiculo:v1', 'Camión AA123BB'],
    ['I+D', 'idproyecto:i1', 'FK-ID-2026-0001 · Postre nuevo'],
  ])('busca y asocia desde %s', async (tab, key, label) => {
    const destinations = {
      tickets: [], compras: [], tareas: [], planes: [], proyectos: [], personas: [],
      activos: tab === 'Activos' ? [{ id:key, titulo:label, search:label }] : [],
      grupos: tab === 'Grupos' ? [{ id:key, titulo:label, search:label }] : [],
      sedes: tab === 'Sedes' ? [{ id:key, titulo:label, search:label }] : [],
      vehiculos: tab === 'Vehículos' ? [{ id:key, titulo:label, search:label }] : [],
      id: tab === 'I+D' ? [{ id:key, titulo:label, search:label }] : [],
    }
    api.getCorreoDetail.mockResolvedValue({ message: { ...message, sugerido_plan_id:null }, history:[] })
    render(<CorreoDetail id="m1" destinations={destinations} canReview onClose={() => {}} onSaved={() => {}} />)
    await screen.findByText('Presupuesto')
    fireEvent.click(screen.getByRole('tab', { name:new RegExp(tab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }))
    fireEvent.click(screen.getByText(label))
    fireEvent.click(screen.getByText('Guardar vínculo'))
    await waitFor(() => expect(api.reviewCorreo).toHaveBeenCalledWith(expect.anything(), key, 'vinculado', []))
  })
  it('separa los planes de acción de los proyectos de gestión', async () => {
    const destinations = {
      tickets: [], compras: [], tareas: [], personas: [], grupos: [], sedes: [], vehiculos: [], id: [],
      planes: [{ id:'plan-min', titulo:'Plan Ministerio Villa Dolores' }],
      proyectos: [{ id:'plan-gest', titulo:'Relocalización operativa' }],
    }
    api.getCorreoDetail.mockResolvedValue({ message: { ...message, sugerido_plan_id:null }, history:[] })
    render(<CorreoDetail id="m1" destinations={destinations} canReview onClose={() => {}} onSaved={() => {}} />)
    await screen.findByText('Presupuesto')
    expect(screen.getByText('Plan Ministerio Villa Dolores')).toBeTruthy()
    expect(screen.queryByText('Relocalización operativa')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name:/Proyectos/ }))
    expect(screen.getByText('Relocalización operativa')).toBeTruthy()
    expect(screen.queryByText('Plan Ministerio Villa Dolores')).toBeNull()
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
