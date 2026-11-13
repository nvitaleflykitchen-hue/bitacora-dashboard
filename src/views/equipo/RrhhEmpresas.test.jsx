import React from 'react'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react'
import RrhhEmpresas from './RrhhEmpresas'
const mock=vi.hoisted(()=>({load:vi.fn(),save:vi.fn(),units:vi.fn(),history:vi.fn()}))
vi.mock('../../lib/auth',()=>({useAuth:()=>({perfil:{rol:'admin'}})}))
vi.mock('../../lib/rrhhEmpresas',async original=>({...await original(),getRrhhEmpresas:mock.load,saveRrhhPerson:mock.save,saveRrhhUnit:mock.units,getRrhhHistory:mock.history}))
const fixture={empresas:[{id:'flykitchen',nombre:'FlyKitchen'},{id:'drill',nombre:'Servicios Drill'},{id:'tempura',nombre:'Tempura'}],unidades:[{id:'fk:24',empresa_id:'flykitchen',nombre:'Planta',activa:true},{id:'u1',empresa_id:'drill',nombre:'Unidad Drill',activa:true},{id:'u2',empresa_id:'tempura',nombre:'Cao',activa:true}],personas:[{id:'fk1',origen:'flykitchen',empresa_id:'flykitchen',nombre:'Ana',apellido:'Fly',activo:true,unidad_ids:['fk:24']},{id:'r1',origen:'rrhh',empresa_id:'drill',nombre:'Luis',apellido:'Drill',dni:'30000002',activo:true,unidad_id:'u1',unidad_ids:['u1']}]}
beforeEach(()=>{
 mock.load.mockReset().mockResolvedValue(fixture);mock.save.mockReset().mockResolvedValue({id:'new'});mock.units.mockReset();mock.history.mockReset()
 HTMLDialogElement.prototype.showModal=function(){this.open=true};HTMLDialogElement.prototype.close=function(){this.open=false}
})
afterEach(cleanup)
it('defaults to FlyKitchen, filters the company and opens the existing file without copying it',async()=>{
 const open=vi.fn();render(<RrhhEmpresas onOpenPersona={open}/>)
 expect(await screen.findByText('Ana Fly')).toBeInTheDocument();expect(screen.queryByText('Luis Drill')).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'Abrir ficha FlyKitchen'}));expect(open).toHaveBeenCalledWith('fk1')
 fireEvent.change(screen.getByLabelText('Empresa',{exact:true}),{target:{value:'drill'}})
 expect(screen.getByText('Luis Drill')).toBeInTheDocument();expect(screen.queryByText('Ana Fly')).toBeNull()
 fireEvent.change(screen.getByLabelText('Empresa',{exact:true}),{target:{value:'todas'}})
 expect(screen.getByText('Ana Fly')).toBeInTheDocument();expect(screen.getByText('Luis Drill')).toBeInTheDocument()
})
it('restricts the new form to the selected employer units and clears the unit on a transfer',async()=>{
 render(<RrhhEmpresas/>);await screen.findByText('Ana Fly')
 fireEvent.change(screen.getByLabelText('Empresa',{exact:true}),{target:{value:'drill'}})
 fireEvent.click(screen.getByRole('button',{name:'+ Colaborador'}))
 const dialog=screen.getByRole('dialog')
 fireEvent.change(within(dialog).getByLabelText('Unidad',{exact:true}),{target:{value:'u1'}})
 fireEvent.change(within(dialog).getByLabelText('Empresa empleadora'),{target:{value:'tempura'}})
 expect(within(dialog).getByLabelText('Unidad',{exact:true})).toHaveValue('')
 expect(within(dialog).queryByRole('option',{name:'Unidad Drill'})).toBeNull()
 expect(within(dialog).getByRole('option',{name:'Cao'})).toBeInTheDocument()
 expect(within(dialog).getByRole('button',{name:'Guardar legajo'})).toBeDisabled()
})
it('does not show successful saves when the server rejects a duplicate',async()=>{
 mock.save.mockRejectedValue(new Error('El DNI ya existe en FlyKitchen.'))
 render(<RrhhEmpresas/>);await screen.findByText('Ana Fly')
 fireEvent.change(screen.getByLabelText('Empresa',{exact:true}),{target:{value:'drill'}})
 fireEvent.click(screen.getByRole('button',{name:'Editar legajo'}))
 fireEvent.change(screen.getByLabelText('Motivo del cambio'),{target:{value:'Corrección solicitada'}})
 fireEvent.submit(screen.getByRole('button',{name:'Guardar legajo'}).closest('form'))
 await waitFor(()=>expect(mock.save).toHaveBeenCalledTimes(1))
 expect(await screen.findAllByText(/El DNI ya existe/)).not.toHaveLength(0)
 expect(screen.getByRole('dialog')).toBeInTheDocument()
 expect(screen.queryByText(/Legajo guardado/)).toBeNull()
})
it('keeps a retry action when the catalog fails',async()=>{
 mock.load.mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce(fixture)
 render(<RrhhEmpresas/>);fireEvent.click(await screen.findByRole('button',{name:'Reintentar'}))
 expect(await screen.findByText('Ana Fly')).toBeInTheDocument()
})
