import React from 'react'
import { render,screen,fireEvent,waitFor,cleanup } from '@testing-library/react'
import { afterEach,beforeEach,it,expect,vi } from 'vitest'
import FormulariosPermisos from './FormulariosPermisos'
import * as api from '../lib/formulariosPermisos'
import { confirmar } from '../lib/feedback'
vi.mock('../lib/formulariosPermisos',async()=>{
 const real=await vi.importActual('../lib/formulariosPermisos')
 return {...real,loadFormContext:vi.fn(),listForms:vi.fn(),saveForm:vi.fn(),uploadFormPdf:vi.fn(),transitionForm:vi.fn()}
})
vi.mock('../lib/formulariosPdf',()=>({createFormularioPdf:vi.fn(async()=>new Uint8Array([1,2,3]))}))
vi.mock('../lib/feedback',()=>({confirmar:vi.fn(),toast:{ok:vi.fn()}}))
const template={id:'t',tipo:'ppa_auto',layout:1,version:1,nombre:'Permiso de prueba',activa:true}
const person={id:'p',nombre:'Ana',apellido:'Prueba',sede_ids:[1],puesto:'Operador'}
beforeEach(()=>{
 vi.clearAllMocks();URL.createObjectURL=vi.fn(()=> 'blob:test');URL.revokeObjectURL=vi.fn()
 api.loadFormContext.mockResolvedValue({personas:[person],sedes:[{id:1,nombre:'Aeropuerto',acciones:['ver','crear','editar','generar']}],plantillas:[template],admin:false})
 api.listForms.mockResolvedValue([])
 api.saveForm.mockImplementation(async d=>({...d,id:'f',version:1,plantilla:template,datos:{personas:[person],variables:d.variables}}))
 confirmar.mockResolvedValue(false)
})
afterEach(cleanup)
async function preview(){
 render(<FormulariosPermisos personaId="p"/>);fireEvent.click(await screen.findByRole('button',{name:/Permiso de prueba/}))
 fireEvent.change(screen.getByLabelText('Desde'),{target:{value:'08:00'}})
 fireEvent.change(screen.getByLabelText('Hasta'),{target:{value:'18:00'}})
 fireEvent.change(screen.getByLabelText('Tareas a desarrollar'),{target:{value:'Servicio'}})
 fireEvent.change(screen.getByLabelText('Sectores solicitados (1 a 7)'),{target:{value:'1'}})
 fireEvent.click(screen.getByRole('button',{name:'Vista previa'}))
 await waitFor(()=>expect(screen.getByRole('button',{name:'Generar PDF'})).toBeEnabled())
}
it('requires a new preview after editing and never uploads if warnings are declined',async()=>{
 await preview();fireEvent.click(screen.getByRole('button',{name:'Generar PDF'}))
 await waitFor(()=>expect(confirmar).toHaveBeenCalled())
 expect(api.uploadFormPdf).not.toHaveBeenCalled();expect(api.transitionForm).not.toHaveBeenCalled()
 await waitFor(()=>expect(screen.getByLabelText('Tareas a desarrollar')).toBeEnabled())
 fireEvent.change(screen.getByLabelText('Tareas a desarrollar'),{target:{value:'Otra tarea'}})
 expect(screen.getByRole('button',{name:'Generar PDF'})).toBeDisabled()
})
it('keeps the draft and reports storage failure without claiming generation',async()=>{
 confirmar.mockResolvedValue(true);api.uploadFormPdf.mockRejectedValue(new Error('No se pudo guardar el PDF'))
 await preview();fireEvent.click(screen.getByRole('button',{name:'Generar PDF'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el PDF')
 expect(api.transitionForm).not.toHaveBeenCalled();expect(screen.getByLabelText('Tareas a desarrollar')).toBeInTheDocument()
})
it('offers corporate responsables and supports entirely manual participants and responsible',async()=>{
 const anexo={...template,tipo:'anexo_e'}
 api.loadFormContext.mockResolvedValue({personas:[],responsables:[{id:'corp',nombre:'Nicolás',apellido:'Vitale',aeroportuario:{}}],sedes:[{id:1,nombre:'Aeropuerto',acciones:['ver','crear','editar','generar']}],plantillas:[anexo],admin:false})
 render(<FormulariosPermisos/>);fireEvent.click(await screen.findByRole('button',{name:/Permiso de prueba/}))
 expect(screen.getByRole('option',{name:/Vitale, Nicolás/})).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Agregar persona manual'}))
 fireEvent.change(screen.getByLabelText('Nombre/s'),{target:{value:'Emanuel'}})
 fireEvent.change(screen.getByLabelText('Apellido/s'),{target:{value:'Calderón'}})
 fireEvent.change(screen.getByLabelText('Responsable del acompañamiento'),{target:{value:'manual'}})
 fireEvent.change(screen.getAllByLabelText('Nombre/s')[1],{target:{value:'Pablo'}})
 fireEvent.change(screen.getAllByLabelText('Apellido/s')[1],{target:{value:'Fernandez'}})
 fireEvent.click(screen.getByRole('button',{name:'Guardar borrador'}))
 await waitFor(()=>expect(api.saveForm).toHaveBeenCalled())
 const payload=api.saveForm.mock.calls[0][0]
 expect(payload.persona_ids).toEqual([])
 expect(payload.variables.personas_manuales[0]).toMatchObject({nombre:'Emanuel',apellido:'Calderón'})
 expect(payload.variables.responsable_manual).toMatchObject({nombre:'Pablo',apellido:'Fernandez'})
})
