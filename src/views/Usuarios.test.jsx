import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SedesMultiSelector } from './Usuarios'

const grupos = [{ id:1, nombre:'Comedores' }, { id:2, nombre:'Plantas' }]
const sedes = [
  { id:1, nombre:'Comedor - Ferreyra', grupo_id:1 },
  { id:2, nombre:'Comedor - Quilmes', grupo_id:1 },
  { id:3, nombre:'Comedor - La anonima', grupo_id:1 },
  { id:4, nombre:'Comedor - Montich', grupo_id:1 },
  { id:13, nombre:'Comedor - Central Plaza', grupo_id:1 },
  { id:27, nombre:'Clinica Saint Michel', grupo_id:1 },
  { id:30, nombre:'Planta Norte', grupo_id:2 },
]

afterEach(cleanup)

it('permite elegir todas las sedes de un grupo y ajustar la selección con casillas', () => {
  const changes = vi.fn()

  function Form() {
    const [selectedIds, setSelectedIds] = useState([27])
    const update = ids => { changes(ids); setSelectedIds(ids) }
    return <SedesMultiSelector sedes={sedes} grupos={grupos} grupoId={1} selectedIds={selectedIds} onChange={update}/>
  }

  render(<Form/>)
  fireEvent.click(screen.getByRole('button', { name:/Agregar las 6 sedes de Comedores/ }))
  expect(changes).toHaveBeenLastCalledWith([1, 2, 3, 4, 13, 27])
  expect(screen.getByLabelText('Clinica Saint Michel')).toBeChecked()
  expect(screen.getByLabelText('Comedor - Quilmes')).toBeChecked()

  fireEvent.click(screen.getByLabelText('Comedor - Quilmes'))
  expect(changes).toHaveBeenLastCalledWith([1, 3, 4, 13, 27])
})

it('filtra las sedes por nombre sin perder la selección', () => {
  render(<SedesMultiSelector sedes={sedes} grupos={grupos} grupoId={1} selectedIds={[27]} onChange={() => {}}/>)
  fireEvent.change(screen.getByLabelText('Buscar sede'), { target:{ value:'saint' } })
  expect(screen.getByLabelText('Clinica Saint Michel')).toBeChecked()
  expect(screen.queryByLabelText('Comedor - Ferreyra')).toBeNull()
})
