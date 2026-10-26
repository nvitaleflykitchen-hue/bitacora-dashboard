import { render,screen,fireEvent,waitFor } from '@testing-library/react'
import { beforeEach,it,expect,vi } from 'vitest'
import CredencialAutorizanteSelect from './CredencialAutorizanteSelect'
import { getAutorizantesCredencial } from '../lib/credenciales'
vi.mock('../lib/credenciales',()=>({getAutorizantesCredencial:vi.fn()}))
beforeEach(()=>vi.resetAllMocks())
it('carga responsables de las sedes y requiere selección expresa',async()=>{
  getAutorizantesCredencial.mockResolvedValue([{id:'1',label:'Responsable de prueba · Jefa · Planta'}])
  const change=vi.fn()
  render(<CredencialAutorizanteSelect sedeIds={[24]} value="" onChange={change}/> )
  await screen.findByRole('option',{name:'Responsable de prueba · Jefa · Planta'})
  expect(getAutorizantesCredencial).toHaveBeenCalledWith([24])
  expect(change).not.toHaveBeenCalled()
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'Responsable de prueba · Jefa · Planta'}})
  expect(change).toHaveBeenCalledWith('Responsable de prueba · Jefa · Planta')
})
it('conserva el nombre histórico sin convertirlo en una asignación nueva',async()=>{
  getAutorizantesCredencial.mockResolvedValue([])
  render(<CredencialAutorizanteSelect sedeIds={[24]} value="Responsable anterior" onChange={()=>{}}/> )
  await screen.findByText(/No hay jefes/)
  expect(screen.getByRole('combobox')).toHaveValue('Responsable anterior')
  expect(screen.getByRole('option',{name:/registrado anteriormente/})).toBeDisabled()
})
it('permite reintentar un fallo sin ocultarlo como lista vacía',async()=>{
  getAutorizantesCredencial.mockRejectedValueOnce(new Error('red')).mockResolvedValueOnce([])
  render(<CredencialAutorizanteSelect sedeIds={[21]} value="" onChange={()=>{}}/> )
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button',{name:'Reintentar autorizantes'}))
  await waitFor(()=>expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  await screen.findByText(/No hay jefes/)
})
