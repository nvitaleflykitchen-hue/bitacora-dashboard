import React from 'react'
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react'
import {it,expect,vi,afterEach,beforeEach} from 'vitest'
import ComedorQrAdmin from './ComedorQrAdmin'
const mocks=vi.hoisted(()=>({api:vi.fn(),contacts:vi.fn()}))
vi.mock('../lib/auth',()=>({useAuth:()=>({perfil:{rol:'admin'}})}))
vi.mock('../lib/comedorQr',()=>({comedorApi:mocks.api,comedorUrl:t=>'https://example.invalid/'+t,TEMAS_COMEDOR:[]}))
vi.mock('../lib/comedorContactOptions',async importOriginal=>({...await importOriginal(),loadComedorContacts:mocks.contacts}))
afterEach(cleanup)
beforeEach(()=>{
 vi.clearAllMocks()
 mocks.contacts.mockResolvedValue([{id:'nico',persona_id:'1d44ec86-aca3-4df8-b6f8-bd7e834a6c98',nombre:'Nicolás',rol:'Coordinador',telefono:'5493518763027'},{id:'benja',persona_id:'de367ea8-3da1-439d-92ef-0b87c74023c6',nombre:'Benjamín',rol:'Gerente',telefono:'5493516657883'},{id:'resp',nombre:'Jazmín',rol:'Responsable',telefono:'5493511111111',assigned:true}])
 mocks.api.mockImplementation(async b=>b.action==='reports'?{items:[]}:b.action==='config'?{config:null}:{...b,token:'token'})
})
it('ofrece tres desplegables con valores predeterminados y guarda el contacto elegido',async()=>{
 render(<ComedorQrAdmin sede={{id:1,nombre:'Comedor'}}/>)
 fireEvent.click(screen.getByText('QR del comedor · novedades de clientes'))
 await waitFor(()=>expect(screen.getByLabelText('Responsable del servicio')).toHaveValue('resp'))
 expect(screen.getByLabelText('Coordinación · Nicolás')).toHaveValue('nico')
 expect(screen.getByLabelText('Gerencia')).toHaveValue('benja')
 fireEvent.click(screen.getByText('Guardar contactos y estado'))
 await waitFor(()=>expect(mocks.api).toHaveBeenCalledWith(expect.objectContaining({action:'save',coordinacion:expect.objectContaining({nombre:'Nicolás'}),gerencia:expect.arrayContaining([expect.objectContaining({nombre:'Jazmín'})])})))
})
it('conserva un contacto guardado que no está en Equipo hasta una selección explícita',async()=>{
 mocks.api.mockImplementation(async b=>b.action==='reports'?{items:[]}:{config:{activo:true,token:'existing',coordinacion:{nombre:'Externo',rol:'Supervisor',telefono:'5493519999999'},gerencia:[{nombre:'G',rol:'G',telefono:'5493518888888'},{nombre:'R',rol:'R',telefono:'5493517777777'}]}})
 render(<ComedorQrAdmin sede={{id:2,nombre:'Otra sede'}}/>)
 fireEvent.click(screen.getByText('QR del comedor · novedades de clientes'))
 await waitFor(()=>expect(screen.getByLabelText('Coordinación · Nicolás')).toHaveValue('actual'))
 expect(screen.getByText('Externo · contacto guardado')).toBeTruthy()
 expect(mocks.api).not.toHaveBeenCalledWith(expect.objectContaining({action:'save'}))
})
