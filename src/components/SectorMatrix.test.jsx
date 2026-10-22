import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import SectorMatrix from './SectorMatrix'

it('muestra restricciones con texto y no transforma acceso total en recinto', () => {
  const select=vi.fn()
  const sectors=[{id:'ar',numero:10,simbolo:'Ar',nombre:'Armado'},{id:'ae',numero:18,simbolo:'Ae',nombre:'Sala de Líneas Aéreas',zra:true},{id:'all',codigo:'TOTAL',nombre:'Acceso total',tipo:'condicion'}]
  render(<SectorMatrix sectors={sectors} onSelect={select} selectedIds={['ar']}/>)
  expect(screen.getAllByRole('button')).toHaveLength(2)
  expect(screen.getByText('Restringido')).toBeVisible()
  expect(screen.getByRole('button',{name:/Armado/})).toHaveAttribute('aria-pressed','true')
  fireEvent.click(screen.getByRole('button',{name:/Sala de Líneas Aéreas/}))
  expect(select).toHaveBeenCalledWith(sectors[1])
})
