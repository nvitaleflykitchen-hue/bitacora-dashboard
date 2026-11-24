import React from 'react'
import { render,screen,fireEvent,cleanup,waitFor } from '@testing-library/react'
import { afterEach,beforeEach,it,expect,vi } from 'vitest'
import ComedorPublico from './ComedorPublico'
const api=vi.hoisted(()=>vi.fn())
vi.mock('../lib/comedorQr',()=>({comedorApi:api,TEMAS_COMEDOR:[['a','Servicio'],['f','Higiene']]}))
afterEach(cleanup)
beforeEach(()=>{api.mockReset();api.mockResolvedValue({nombre:'Comedor prueba',coordinacion:{nombre:'Coordinación',telefono:'5493510000000'},gerencia:{nombre:'Gerencia',telefono:'5493510000001'}})})
it('permite varios temas sin cuenta y conserva la referencia al reintentar',async()=>{
 render(<ComedorPublico token="qr-sede"/>);await screen.findByText('Comedor prueba')
 fireEvent.change(screen.getByLabelText('Tu nombre'),{target:{value:'Cliente'}})
 fireEvent.click(screen.getByLabelText('Servicio'));fireEvent.click(screen.getByLabelText('Higiene'))
 fireEvent.change(screen.getByLabelText('Detalle: Servicio'),{target:{value:'Demora en el servicio'}})
 fireEvent.change(screen.getByLabelText('Detalle: Higiene'),{target:{value:'Limpieza pendiente'}})
 api.mockRejectedValueOnce(new Error('Sin conexión'))
 fireEvent.click(screen.getByText('Enviar novedad'));await screen.findByText('Sin conexión')
 const first=api.mock.calls[1][0]
 expect(first.items).toEqual([{tema:'a',detalle:'Demora en el servicio'},{tema:'f',detalle:'Limpieza pendiente'}])
 expect(first.token).toBe('qr-sede');expect(first.sede_id).toBeUndefined()
 api.mockResolvedValueOnce({codigo:'COM-000001'})
 fireEvent.click(screen.getByText('Enviar novedad'));await screen.findByText('COM-000001')
 expect(api.mock.calls[2][0].request_id).toBe(first.request_id)
})
it('un QR no disponible no expone formulario ni contactos',async()=>{
 api.mockRejectedValue(new Error('no disponible'));render(<ComedorPublico token="no"/>)
 await screen.findByRole('alert');expect(screen.queryByText('Enviar novedad')).toBeNull();expect(screen.queryByText('WhatsApp')).toBeNull()
})
it('exige un tema antes de enviar',async()=>{
 render(<ComedorPublico token="qr"/>);await screen.findByText('Comedor prueba')
 fireEvent.change(screen.getByLabelText('Tu nombre'),{target:{value:'Cliente'}})
 fireEvent.click(screen.getByText('Enviar novedad'));await screen.findByRole('alert')
 await waitFor(()=>expect(api).toHaveBeenCalledTimes(1))
})
