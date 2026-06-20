import { fireEvent, render, screen } from '@testing-library/react'
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
})
