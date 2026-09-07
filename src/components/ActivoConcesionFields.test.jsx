import React, { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { it, expect } from 'vitest'
import ActivoConcesionFields from './ActivoConcesionFields'
it('permite clasificar un activo y completar los datos sólo cuando corresponde', () => {
  function Form() { const [form,setForm]=useState({}); return <ActivoConcesionFields form={form} onChange={(k,v)=>setForm(f=>({...f,[k]:v}))}/> }
  render(<Form/> )
  expect(screen.getByLabelText('Bien concesionado').value).toBe('')
  expect(screen.queryByLabelText('Propietario / entidad concedente')).toBeNull()
  fireEvent.change(screen.getByLabelText('Bien concesionado'), {target:{value:'si'}})
  fireEvent.change(screen.getByLabelText('Propietario / entidad concedente'), {target:{value:'Universidad'}})
  expect(screen.getByLabelText('Propietario / entidad concedente').value).toBe('Universidad')
  fireEvent.change(screen.getByLabelText('Bien concesionado'), {target:{value:'no'}})
  expect(screen.queryByLabelText('Propietario / entidad concedente')).toBeNull()
})
