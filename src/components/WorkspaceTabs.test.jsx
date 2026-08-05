import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import WorkspaceTabs from './WorkspaceTabs'

describe('WorkspaceTabs', () => {
  it('expone pestañas navegables y comunica el cambio', () => {
    const onChange = vi.fn()
    render(
      <WorkspaceTabs title="Mantenimiento" tabs={[{ id:'resumen', label:'Resumen' }, { id:'tickets', label:'Tickets' }]} activeTab="resumen" onTabChange={onChange}>
        <p>Contenido</p>
      </WorkspaceTabs>
    )

    expect(screen.getByRole('button', { name:'Resumen' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('button', { name:'Tickets' }))
    expect(onChange).toHaveBeenCalledWith('tickets')
  })
  it('agrupa las herramientas secundarias sin ocultarlas', () => {
    const onChange = vi.fn()
    const tabs = Array.from({ length:7 }, (_, index) => ({ id:`tab-${index}`, label:`Sección ${index}` }))
    render(
      <WorkspaceTabs title="Flota" tabs={tabs} activeTab="tab-6" onTabChange={onChange}>
        <p>Contenido</p>
      </WorkspaceTabs>
    )

    const navigation = screen.getByRole('navigation', { name:'Secciones de Flota' })
    expect(within(navigation).getAllByRole('button')).toHaveLength(5)
    const more = within(navigation).getByRole('combobox', { name:'Más herramientas de Flota' })
    expect(more).toHaveValue('tab-6')
    fireEvent.change(more, { target:{ value:'tab-5' } })
    expect(onChange).toHaveBeenCalledWith('tab-5')
  })

  it('permite recorrer las secciones con el teclado', () => {
    render(
      <WorkspaceTabs title="Calidad" tabs={[{ id:'a', label:'Auditorias' }, { id:'b', label:'CAPA' }]} activeTab="a" onTabChange={() => {}}>
        <p>Contenido</p>
      </WorkspaceTabs>
    )

    const first = screen.getByRole('button', { name:'Auditorias' })
    const second = screen.getByRole('button', { name:'CAPA' })
    first.focus()
    fireEvent.keyDown(first, { key:'ArrowRight' })
    expect(second).toHaveFocus()
    fireEvent.keyDown(second, { key:'Home' })
    expect(first).toHaveFocus()
  })
})
