import React from 'react'
import { beforeEach,it,expect,vi } from 'vitest'
import { render,screen,fireEvent,within,waitFor,cleanup } from '@testing-library/react'
import AirportVehicleChecklist from './AirportVehicleChecklist'
import { AIRPORT_ITEMS,AIRPORT_VEHICLES } from '../lib/airportChecklist'
const api=vi.hoisted(()=>({loadAirportVehicles:vi.fn(),loadAirportHistory:vi.fn(),saveAirportChecklist:vi.fn(),uploadAirportPhoto:vi.fn(),loadAirportPhotos:vi.fn()}))
vi.mock('../lib/airportChecklistApi',()=>api)
vi.mock('../lib/auth',()=>({useAuth:()=>({perfil:{id:'operator',nombre:'Responsable real'}})}))
const vehicle={...AIRPORT_VEHICLES[0],nombre:'Hyundai - JDN 192',sede_id:21,sede_nombre:'Aeropuerto Córdoba',estado:'en_reparacion'}
beforeEach(()=>{cleanup();vi.clearAllMocks();api.loadAirportVehicles.mockResolvedValue([vehicle]);api.loadAirportHistory.mockResolvedValue([]);api.uploadAirportPhoto.mockResolvedValue();api.saveAirportChecklist.mockImplementation(async(id,asset,form)=>({...form,id,activo_id:asset,fecha:'2026-11-16',creado_por:'operator',responsable:'Responsable real',resultado:'sin_novedades'}))})
async function fill(){await screen.findByRole('heading',{name:'JDN192'});fireEvent.change(screen.getByLabelText('Turno'),{target:{value:'mañana'}});fireEvent.change(screen.getByLabelText('Kilometraje'),{target:{value:'100'}});fireEvent.change(screen.getByLabelText('Combustible'),{target:{value:'1/2'}});for(const item of AIRPORT_ITEMS)fireEvent.click(within(screen.getByRole('group',{name:item.label})).getByRole('button',{name:'OK'}))}
it('permite guardar en reparación y exige responder sin preseleccionar OK',async()=>{
  render(<AirportVehicleChecklist activoId={vehicle.id}/>)
  await screen.findByRole('heading',{name:'JDN192'})
  expect(screen.getByText('en reparacion')).toBeInTheDocument()
  expect(screen.getAllByRole('button',{name:'OK'}).every(b=>b.getAttribute('aria-pressed')==='false')).toBe(true)
  await fill();fireEvent.click(screen.getByRole('button',{name:'Guardar control'}))
  await screen.findByRole('heading',{name:'Control guardado'})
  expect(api.saveAirportChecklist).toHaveBeenCalledTimes(1)
  expect(api.saveAirportChecklist.mock.calls[0][1]).toBe(vehicle.id)
})
it('no expone formulario cuando la RPC no autoriza el vehículo',async()=>{
  api.loadAirportVehicles.mockResolvedValue([]);api.loadAirportHistory.mockRejectedValue(Error('Sin acceso'))
  render(<AirportVehicleChecklist activoId={vehicle.id}/>)
  await screen.findByText(/no está disponible para tu cuenta/)
  expect(screen.queryByRole('button',{name:'Guardar control'})).not.toBeInTheDocument()
})
it('reintenta fotos sin volver a guardar el control',async()=>{
  api.uploadAirportPhoto.mockRejectedValueOnce(Error('Sin red')).mockResolvedValueOnce()
  render(<AirportVehicleChecklist activoId={vehicle.id}/>)
  await fill();fireEvent.change(screen.getByLabelText(/Fotos opcionales/),{target:{files:[new File(['image'],'foto.jpg',{type:'image/jpeg'})]}})
  fireEvent.click(screen.getByRole('button',{name:'Guardar control'}))
  await screen.findByText(/No se pudieron subir 1 fotos/)
  fireEvent.click(screen.getByRole('button',{name:'Reintentar fotos pendientes'}))
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Reintentar fotos pendientes'})).not.toBeInTheDocument())
  expect(api.saveAirportChecklist).toHaveBeenCalledTimes(1);expect(api.uploadAirportPhoto).toHaveBeenCalledTimes(2)
})

vi.mock('./ChecklistFindings',()=>({useChecklistFindings:(_v,answer)=>({choose:(item,value)=>answer(item,value,null),panel:null})}))
