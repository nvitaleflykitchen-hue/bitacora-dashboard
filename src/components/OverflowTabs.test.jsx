import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import OverflowTabs from './OverflowTabs'

describe('OverflowTabs', () => {
  it('agrupa las vistas secundarias y comunica la activa', () => {
    const onChange = vi.fn()
    render(<OverflowTabs primaryTabs={[{ id:'lista', label:'LISTA' }]} secondaryTabs={[{ id:'bajas', label:'HISTORIAL DE BAJAS (9)' }]} activeTab="bajas" onChange={onChange} ariaLabel="Secciones de Equipo" />)
    const more = screen.getByRole('button', { name:/Activa: HISTORIAL DE BAJAS/ })
    fireEvent.click(more)
    fireEvent.click(screen.getByRole('menuitem', { name:/HISTORIAL DE BAJAS/ }))
    expect(onChange).toHaveBeenCalledWith('bajas')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('cierra el submenú con Escape', () => {
    render(<OverflowTabs primaryTabs={[]} secondaryTabs={[{ id:'contactos', label:'CONTACTOS' }]} activeTab="lista" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name:'Más herramientas' }))
    fireEvent.keyDown(document, { key:'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
