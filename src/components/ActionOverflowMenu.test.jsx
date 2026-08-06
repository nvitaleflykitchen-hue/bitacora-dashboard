import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ActionOverflowMenu from './ActionOverflowMenu'

afterEach(cleanup)

describe('ActionOverflowMenu', () => {
  it('ejecuta una acción y cierra el menú', () => {
    const action = vi.fn()
    render(<ActionOverflowMenu items={[{ id:'edit', label:'Editar', onClick:action }]} />)
    fireEvent.click(screen.getByRole('button', { name:/Más acciones/ }))
    fireEvent.click(screen.getByRole('menuitem', { name:'Editar' }))
    expect(action).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('mantiene deshabilitada una acción sin datos', () => {
    render(<ActionOverflowMenu items={[{ id:'call', label:'Llamar', disabled:true }]} />)
    fireEvent.click(screen.getByRole('button', { name:/Más acciones/ }))
    expect(screen.getByRole('menuitem', { name:'Llamar' })).toBeDisabled()
  })
})
