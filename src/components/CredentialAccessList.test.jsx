import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import CredentialAccessList from './CredentialAccessList'
afterEach(cleanup)
it('muestra sólo la sede elegida sin expandir una lista de todas las sedes', () => {
 const sectors = [
  { id:'a',sede_id:24,sede_nombre:'Planta',codigo:'Vd',nombre:'Producción' },
  { id:'b',sede_id:21,sede_nombre:'Aeropuerto',codigo:'Of',nombre:'Oficinas' },
 ]
 render(<CredentialAccessList sectors={sectors}/>)
 expect(screen.getByText('Oficinas')).toBeInTheDocument()
 expect(screen.queryByText('Producción')).toBeNull()
 fireEvent.change(screen.getByLabelText('Sedes con acceso'),{target:{value:'24'}})
 expect(screen.getByText('Producción')).toBeInTheDocument()
 expect(screen.queryByText('Oficinas')).toBeNull()
})
