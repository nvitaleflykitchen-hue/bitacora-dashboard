import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Usuarios, { SedesMultiSelector } from './Usuarios'

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

beforeEach(() => vi.stubGlobal('React', React))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

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

vi.mock('../lib/auth', () => ({ useAuth: () => ({ perfil: { id: 'admin' } }) }))
vi.mock('../lib/queries', async importOriginal => ({
  ...await importOriginal(),
  getPerfilesConDirectorio: vi.fn(async () => [
    { id: '1', nombre: 'Valentín', email: 'seguridad@example.com', rol: 'seguridad', activo: true, sede_ids: [24] },
    { id: '2', nombre: 'Otra Persona', email: 'otra@example.com', rol: 'operario', activo: false, sede_ids: [] },
  ]),
  getGrupos: vi.fn(async () => []),
  getSedes: vi.fn(async () => [{ id: 24, nombre: 'Planta Córdoba' }]),
  getPermisosCompras: vi.fn(async () => []),
  getPermisosMantenimiento: vi.fn(async () => []),
  getPermisosPersonal: vi.fn(async () => []),
}))
it('busca sin tildes, por sede y correo y combina rol y estado', async () => {
  render(<Usuarios />)
  await screen.findByText('Valentín')
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar usuario' }), { target: { value: 'valentin cordoba' } })
  expect(screen.getByText('Mostrando 1 de 2 usuarios')).toBeInTheDocument()
  expect(screen.queryByText('Otra Persona')).toBeNull()
  fireEvent.change(screen.getByRole('combobox', { name: 'Estado' }), { target: { value: 'inactivo' } })
  expect(screen.getByText('No hay usuarios que coincidan con los filtros.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
  expect(screen.getByText('Mostrando 2 de 2 usuarios')).toBeInTheDocument()
  fireEvent.change(screen.getByRole('combobox', { name: 'Rol' }), { target: { value: 'seguridad' } })
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar usuario' }), { target: { value: 'seguridad@example.com' } })
  expect(screen.getByText('Mostrando 1 de 2 usuarios')).toBeInTheDocument()
})
