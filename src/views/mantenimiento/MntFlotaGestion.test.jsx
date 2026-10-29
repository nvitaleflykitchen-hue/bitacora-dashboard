import React from 'react'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { VehiculoModal } from './MntFlotaGestion'
import { loadVehicleReport } from '../../lib/flotaReportData'
import { saveFleetVehicle } from '../../lib/flotaVehicleSave'
vi.mock('../../lib/auth',()=>({useAuth:()=>({rol:'admin',perfil:{rol:'admin'}})}))
vi.mock('../../lib/queries',()=>({getActivos:vi.fn(),getSedes:vi.fn(),getProveedores:async()=>[]}))
vi.mock('../../lib/supabase',()=>({supabase:{},db:()=>({})}))
vi.mock('../../lib/flotaReportData',()=>({loadVehicleReport:vi.fn()}))
vi.mock('../../lib/flotaVehicleSave',()=>({saveFleetVehicle:vi.fn()}))
vi.mock('../../components/DocumentacionChecklist',()=>({default:()=>null}))
afterEach(()=>{cleanup();vi.clearAllMocks()})
it('recarga la ficha y guarda sólo la edición, conservando notas y serie',async()=>{
  const vehicle={id:'v',nombre:'DOBLO - AC065RF',marca:'Fiat',modelo:'Doblò',numero_serie:'2-307082',notas:'Conservar',updated_at:'2026-10-28'}
  loadVehicleReport.mockResolvedValue([{vehicle,plans:[],warnings:[],tickets:[],reading:{km:77000,fecha:'2026-08-20',fuente:'Ticket 893'}}])
  const saved=vi.fn()
  render(<VehiculoModal vehiculo={{...vehicle,marca:'Vieja'}} sedes={[]} onSaved={saved} onClose={()=>{}}/>)
  await screen.findByText('Fiat Doblò')
  fireEvent.click(screen.getByText('Editar datos'))
  fireEvent.change(screen.getByDisplayValue('Fiat'),{target:{value:'Marca revisada'}})
  fireEvent.click(screen.getByText('Guardar'))
  await waitFor(()=>expect(saved).toHaveBeenCalled())
  expect(saveFleetVehicle).toHaveBeenCalledWith(expect.objectContaining({marca:'Marca revisada',notas:'Conservar',numero_serie:'2-307082'}),vehicle,['marca'],[])
})
