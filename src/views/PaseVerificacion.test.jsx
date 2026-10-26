import React from 'react'
import {render,screen,cleanup,waitFor,act} from '@testing-library/react'
import {afterEach,it,expect,vi} from 'vitest'
import PaseVerificacion from './PaseVerificacion'
import CredencialVerificacion from './CredencialVerificacion'
import {supabase} from '../lib/supabase'
vi.mock('../lib/supabase',()=>({supabase:{rpc:vi.fn()}}))
afterEach(()=>{cleanup();vi.useRealTimers();vi.resetAllMocks()})
it('QR público tiene un contenedor desplazable independiente del body',async()=>{
 supabase.rpc.mockResolvedValue({data:[{estado:'activa',nombre:'Persona',fecha_vencimiento:'2030-01-01',sectores_autorizados:[]}]})
 const {container}=render(<CredencialVerificacion token="abc"/> )
 await screen.findByText('CREDENCIAL VÁLIDA')
 expect(container.firstChild).toHaveStyle({height:'100dvh',overflowY:'auto',alignItems:'start'})
})
it('un pase sin entrega no muestra una autorización verde',async()=>{
 supabase.rpc.mockResolvedValue({data:{codigo:'ATA-01',tipo:'temporal',vigente:false,estado:'sin entrega'}})
 render(<PaseVerificacion token="abc"/>)
 await screen.findByText('NO AUTORIZA EL INGRESO')
 expect(screen.queryByText('VIGENTE · SÓLO CON ACOMPAÑANTE')).toBeNull()
})
it('el pase muestra sector, titular y acompañante y vence sin recargar',async()=>{
 vi.useFakeTimers({shouldAdvanceTime:true})
 supabase.rpc.mockResolvedValue({data:{codigo:'ATA-01',tipo:'temporal',vigente:true,estado:'acompañamiento obligatorio',titular:'Operario',acompanante:'Supervisora',sede:'Planta',sector:'Verdulería',codigo_sector:'Vd',desde:new Date().toISOString(),hasta:new Date(Date.now()+3000).toISOString()}})
 render(<PaseVerificacion token="abc"/>)
 await waitFor(()=>expect(screen.getByText('VIGENTE · SÓLO CON ACOMPAÑANTE')).toBeInTheDocument())
 expect(screen.getByText('Supervisora')).toBeInTheDocument()
 expect(screen.getByText('Vd · Verdulería')).toBeInTheDocument()
 await act(()=>vi.advanceTimersByTimeAsync(4000))
 expect(screen.getByText('NO AUTORIZA EL INGRESO')).toBeInTheDocument()
})
