import React from 'react'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import BibliotecaRecursos from './BibliotecaRecursos'
import { useAuth } from '../lib/auth'
import { getSedes, getPersonasBySede, getSedeContactos } from '../lib/queries'
import { entregarEtiquetaEncomienda } from '../lib/etiquetaEncomiendaPdf'
import { entregarAutorizacionRetiro } from '../lib/autorizacionRetiroPdf'
vi.mock('../lib/auth',()=>({useAuth:vi.fn()}))
vi.mock('./RecursosCompartidos',()=>({default:()=> <div>Recursos compartidos</div>}))
vi.mock('../lib/queries',()=>({getSedes:vi.fn(),getPersonasBySede:vi.fn(),getSedeContactos:vi.fn()}))
vi.mock('../lib/etiquetaEncomiendaPdf',()=>({entregarEtiquetaEncomienda:vi.fn()}))
vi.mock('../lib/autorizacionRetiroPdf',()=>({entregarAutorizacionRetiro:vi.fn()}))
beforeEach(()=>{
  useAuth.mockReturnValue({isAdmin:true})
  getSedes.mockResolvedValue([{id:1,nombre:'Escala Mendoza',direccion:'Calle de prueba 123'}])
  getPersonasBySede.mockResolvedValue([{nombre:'Persona',apellido:'Prueba',puesto:'Responsable de escala'}])
  getSedeContactos.mockResolvedValue([{contactos:{telefono:'123456'}}])
})
afterEach(()=>{cleanup();vi.resetAllMocks()})
it('conserva recursos y oculta generadores para usuarios sin acceso administrativo',()=>{
  useAuth.mockReturnValue({isAdmin:false})
  render(<BibliotecaRecursos />)
  expect(screen.getByText('Recursos compartidos')).toBeInTheDocument()
  expect(screen.queryByText('Etiqueta para Envío de Encomiendas')).toBeNull()
})
it('abre etiqueta desde Recursos y descarga con los datos revisados de la sede',async()=>{
  render(<BibliotecaRecursos />)
  fireEvent.click(within(screen.getByText('Etiqueta para Envío de Encomiendas').closest('article')).getByRole('button'))
  await screen.findByRole('option',{name:'Escala Mendoza'})
  fireEvent.change(screen.getByLabelText('SEDE DESTINO *'),{target:{value:'1'}})
  await screen.findByDisplayValue('Persona Prueba')
  fireEvent.change(screen.getByLabelText('DESTINATARIO / RESPONSABLE *'),{target:{value:'Destinatario revisado'}})
  fireEvent.click(screen.getByText('Descargar PDF'))
  expect(entregarEtiquetaEncomienda).toHaveBeenCalledWith(expect.objectContaining({destinatario:'Destinatario revisado',direccion:'Calle de prueba 123',sedeNombre:'Escala Mendoza'}),false)
})
it('valida autorización y permite compartir el PDF con transportista y origen',async()=>{
  render(<BibliotecaRecursos />)
  fireEvent.click(within(screen.getByText('Autorización para Retiro de Encomiendas').closest('article')).getByRole('button'))
  await screen.findByRole('option',{name:'Escala Mendoza'})
  fireEvent.click(screen.getByText('Descargar PDF'))
  expect(await screen.findByRole('alert')).toHaveTextContent('Completá')
  expect(entregarAutorizacionRetiro).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('EMPRESA TRANSPORTISTA *'),{target:{value:'Transportista de prueba'}})
  fireEvent.change(screen.getByLabelText('ESCALA / COCINA IN SITU *'),{target:{value:'1'}})
  fireEvent.click(screen.getByText('Compartir / enviar'))
  expect(entregarAutorizacionRetiro).toHaveBeenCalledWith(expect.objectContaining({empresa:'Transportista de prueba',origen:'Mendoza'}),true)
})
