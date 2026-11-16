import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ReclutamientoBoard from './ReclutamientoBoard'
const mocks=vi.hoisted(()=>({pdf:vi.fn(),closed:{id:'closed',codigo_requerimiento:'REQ-PER-2026-0001',puesto:'Cocinero',estado:'cerrada',sede_id:21,fecha_apertura:'2026-06-08'}}))
vi.mock('../../lib/requerimientoPersonalPdf',()=>({downloadRequerimientoPersonalPdf:mocks.pdf}))
vi.mock('../../lib/auth',()=>({useAuth:()=>({user:{id:'admin'},perfil:{rol:'admin'}})}))
vi.mock('../../lib/supabase',()=>({supabase:{schema:()=>({from:name=>{
  const result={data:name==='reclutamiento_solicitudes'?[mocks.closed]:[],error:null}
  return {select:()=>({order:()=>Promise.resolve(result),then:(a,b)=>Promise.resolve(result).then(a,b)})}
}})}}))
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
it('permite buscar y descargar el PDF de un requerimiento histórico sin editarlo',async()=>{
  vi.stubGlobal('React',React)
  render(<ReclutamientoBoard sedes={[{id:21,nombre:'Aeropuerto Córdoba'}]} canManage={false}/> )
  const search=await screen.findByLabelText('Buscar requerimiento')
  fireEvent.change(search,{target:{value:'REQ-PER-2026-0001'}})
  fireEvent.click(await screen.findByRole('button',{name:'PDF REQ-PER-2026-0001'}))
  expect(mocks.pdf).toHaveBeenCalledWith(expect.objectContaining({codigo_requerimiento:'REQ-PER-2026-0001',estado:'cerrada',sede_nombre:'Aeropuerto Córdoba'}))
})
