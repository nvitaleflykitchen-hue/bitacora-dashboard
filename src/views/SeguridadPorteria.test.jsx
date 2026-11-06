import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import SeguridadPorteria from './SeguridadPorteria'
const mocks=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('../lib/auth',()=>({useAuth:()=>({perfil:{nombre:'Guardia'},signOut:vi.fn()})}))
vi.mock('../lib/seguridad',()=>({seguridadRpc:mocks.rpc,parseSeguridadQr:vi.fn()}))
vi.mock('../lib/pasesAcompanados',()=>({descargarPase:vi.fn()}))
vi.mock('../components/AssetQrScannerModal',()=>({default:({onScan})=><button onClick={()=>onScan({tipo:'credencial',token:'token'})}>Leer QR de prueba</button>}))
afterEach(cleanup)
beforeEach(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.open=true}
 HTMLDialogElement.prototype.close=function(){this.open=false}
 mocks.rpc.mockReset().mockImplementation(async action=>{
  if(action==='sedes')return [{id:24,nombre:'Planta'}]
  if(action==='listar')return {sectores:[{id:'sector',codigo:'Vd',nombre:'Producción'}],personas:[],pases:[],entregas:[]}
  if(action==='escanear')return {nombre:'Persona',estado:'activa',primera_entrega:true,entregada_at:'2026-11-06T12:00:00Z',sectores:[]}
  return []
 })
})
it('escanea desde la sede y comunica la primera entrega',async()=>{
 render(<SeguridadPorteria/> )
 const button=screen.getByRole('button',{name:'Escanear credencial o pase'})
 await waitFor(()=>expect(button).toBeEnabled())
 fireEvent.click(button);fireEvent.click(screen.getByRole('button',{name:'Leer QR de prueba'}))
 expect(await screen.findByText('Primera entrega de credencial registrada.')).toBeInTheDocument()
 expect(mocks.rpc).toHaveBeenCalledWith('escanear',24,{tipo:'credencial',token:'token'})
})
it('exige DNI y confirmación de custodia en el formulario de visita',async()=>{
 render(<SeguridadPorteria/> )
 const button=screen.getByRole('button',{name:'Entregar pase de visita'})
 await waitFor(()=>expect(button).toBeEnabled())
 fireEvent.click(button)
 expect(screen.getByLabelText('DNI original recibido')).toBeRequired()
 expect(screen.getByLabelText(/Recibí el DNI original/)).toBeRequired()
 expect(mocks.rpc.mock.calls.some(c=>c[0]==='entregar')).toBe(false)
})
