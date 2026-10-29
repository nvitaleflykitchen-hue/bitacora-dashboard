import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CredencialPersonalModal from './CredencialPersonalModal'
import { emitirCredencial, getFaMultisedeEligibility } from '../lib/credenciales'
vi.mock('../lib/auth',()=>({useAuth:()=>({perfil:{rol:'admin',activo:true}})}))
vi.mock('../lib/personaFotos',()=>({getPersonaFotoDataUrl:async()=> 'data:image/png;base64,fixture'}))
vi.mock('../lib/feedback',()=>({confirmar:async()=>true,toast:{ok:vi.fn(),error:vi.fn()}}))
vi.mock('../lib/credenciales',()=>({
  getFaMultisedeEligibility:vi.fn(async()=>true),getCredencialPersona:async()=>null,getSectoresCredencial:async()=>[],
  getAutorizantesCredencial:async()=>[{id:'a',label:'Responsable nominal'}],
  fechaVencimientoCredencial:()=> '2028-10-29',emitirCredencial:vi.fn(async()=>({id:'c',estado:'activa',fa_todas_sedes:true,sectores_autorizados:[],fecha_emision:'2026-10-29',fecha_vencimiento:'2028-10-29'})),
  actualizarPrivacidadCredencial:vi.fn(),cambiarEstadoCredencial:vi.fn(),descargarCredencialPdf:vi.fn(),urlValidacionCredencial:()=>'',
}))
afterEach(()=>{cleanup();vi.clearAllMocks()})
const persona={id:'p',nombre:'Persona',apellido:'Central',sede_ids:[30],foto_url:'fixture',puesto:'Coordinador'}
it('ofrece FA global sin cambiar la sede y exige autorización nominal y vencimiento',async()=>{
  render(<CredencialPersonalModal persona={persona} sedes={[{id:30,nombre:'Equipo Central',activa:true},{id:19,nombre:'Mendoza',activa:true}]} onClose={()=>{}}/>)
  const choice=await screen.findByLabelText('FA · Todas las sedes')
  expect(choice.checked).toBe(false)
  fireEvent.click(choice)
  fireEvent.click(screen.getByLabelText('Confirmo que esta persona cuenta con autorización FA para todas las sedes activas.'))
  expect(screen.getByText('Emitir credencial').disabled).toBe(true)
  await waitFor(()=>expect(screen.getByLabelText('Responsable que autoriza').disabled).toBe(false))
  fireEvent.change(screen.getByLabelText('Responsable que autoriza'),{target:{value:'Responsable nominal'}})
  fireEvent.change(screen.getByLabelText('FA vigente hasta'),{target:{value:'2027-10-29'}})
  fireEvent.click(screen.getByLabelText('Confirmo que esta persona cuenta con autorización FA para todas las sedes activas.'))
  fireEvent.click(screen.getByText('Emitir credencial'))
  await waitFor(()=>expect(emitirCredencial).toHaveBeenCalled())
  expect(emitirCredencial).toHaveBeenCalledWith(expect.objectContaining({persona,faTodasSedes:true,sectorIds:[],faVencimiento:'2027-10-29',autorizacionResponsable:'Responsable nominal',sedeNombre:'Equipo Central'}))
})
it('no ofrece FA global a una persona no habilitada',async()=>{
  getFaMultisedeEligibility.mockResolvedValueOnce(false)
  render(<CredencialPersonalModal persona={persona} sedes={[]} onClose={()=>{}}/>)
  await screen.findByText('SIN EMITIR')
  expect(screen.queryByLabelText('FA · Todas las sedes')).toBeNull()
})
