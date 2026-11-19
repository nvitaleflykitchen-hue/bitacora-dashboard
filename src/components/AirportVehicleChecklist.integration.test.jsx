import React from 'react'
import { beforeEach,it,expect,vi } from 'vitest'
import { render,screen,fireEvent,within,waitFor,cleanup } from '@testing-library/react'
import AirportVehicleChecklist from './AirportVehicleChecklist'
import { AIRPORT_ITEMS,AIRPORT_VEHICLES } from '../lib/airportChecklist'
const api=vi.hoisted(()=>({loadAirportVehicles:vi.fn(),loadAirportHistory:vi.fn(),saveAirportChecklist:vi.fn(),uploadAirportPhoto:vi.fn(),loadAirportPhotos:vi.fn()}))
vi.mock('../lib/airportChecklistApi',()=>api)
vi.mock('../lib/auth',()=>({useAuth:()=>({perfil:{id:'operator',nombre:'Responsable real'}})}))
const vehicle={...AIRPORT_VEHICLES[0],nombre:'Hyundai - JDN 192',sede_id:21,sede_nombre:'Aeropuerto Córdoba',estado:'en_reparacion'}
beforeEach(()=>{cleanup();vi.clearAllMocks();api.loadAirportVehicles.mockResolvedValue([vehicle]);api.loadAirportHistory.mockResolvedValue([]);api.uploadAirportPhoto.mockResolvedValue();api.saveAirportChecklist.mockImplementation(async(id,asset,form)=>({...form,id,activo_id:asset,fecha:'2026-11-18',creado_at:new Date().toISOString(),creado_por:'operator',responsable:'Responsable real',resultado:'sin_novedades'}))})
async function fill(){await screen.findByRole('heading',{name:'JDN192'});fireEvent.change(screen.getByLabelText('Kilometraje'),{target:{value:'100'}});fireEvent.change(screen.getByLabelText('Combustible'),{target:{value:'1/2'}});for(const item of AIRPORT_ITEMS)fireEvent.click(within(screen.getByRole('group',{name:item.label})).getByRole('button',{name:'OK'}))}

const tickets=vi.hoisted(()=>({getTickets:vi.fn(),createTicket:vi.fn(),updateTicket:vi.fn()}))
vi.mock('../lib/queries',()=>tickets)
beforeEach(()=>{tickets.getTickets.mockResolvedValue([]);tickets.createTicket.mockResolvedValue({id:'test-ticket',estado:'abierto',descripcion:'Prueba aislada'});tickets.updateTicket.mockResolvedValue({id:'test-ticket'})})
it('completa y guarda dos controles conformes el mismo día sin turno',async()=>{
 render(<AirportVehicleChecklist activoId={vehicle.id}/>);await fill()
 expect(screen.queryByLabelText('Turno')).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Guardar control'}));await screen.findByRole('heading',{name:'Control guardado'})
 fireEvent.click(screen.getByRole('button',{name:'Nuevo control'}));expect(screen.getByLabelText('Kilometraje')).toHaveValue(100)
 await fill();fireEvent.click(screen.getByRole('button',{name:'Guardar control'}));await screen.findByRole('heading',{name:'Control guardado'})
 expect(api.saveAirportChecklist).toHaveBeenCalledTimes(2)
 expect(api.saveAirportChecklist.mock.calls[0][0]).not.toBe(api.saveAirportChecklist.mock.calls[1][0])
})
it('NC abre observación, genera ticket y guarda el control completo',async()=>{
 render(<AirportVehicleChecklist activoId={vehicle.id}/>);await fill()
 fireEvent.click(within(screen.getByRole('group',{name:'Cabina limpia'})).getByRole('button',{name:'NC',exact:true}))
 expect(screen.getByRole('dialog')).toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Confirmar observación y ticket'})).toBeDisabled()
 fireEvent.change(screen.getByRole('textbox',{name:'Observación del punto'}),{target:{value:'Suciedad en cabina'}})
 fireEvent.click(screen.getByRole('button',{name:'Confirmar observación y ticket'}))
 await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
 fireEvent.click(screen.getByRole('button',{name:'Guardar control'}));await screen.findByRole('heading',{name:'Control guardado'})
 expect(tickets.createTicket).toHaveBeenCalledTimes(1)
 expect(api.saveAirportChecklist.mock.calls[0][2]).toMatchObject({respuestas:{cabina:'nc'},observaciones:expect.stringContaining('Suciedad en cabina')})
})
it('permite corregir Crítico a OK sin conservar una NC en el control ni cerrar el ticket',async()=>{
 render(<AirportVehicleChecklist activoId={vehicle.id}/>);await fill()
 const group=screen.getByRole('group',{name:'Luces'})
 fireEvent.click(within(group).getByRole('button',{name:'CRITICO',exact:true}))
 fireEvent.change(screen.getByRole('textbox',{name:'Observación del punto'}),{target:{value:'Falla eléctrica'}})
 fireEvent.click(screen.getByRole('button',{name:'Confirmar observación y ticket'}));await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
 expect(within(group).getByRole('button',{name:'CRITICO'})).toHaveAttribute('aria-pressed','true')
 fireEvent.click(within(group).getByRole('button',{name:'OK',exact:true}))
 fireEvent.click(screen.getByRole('button',{name:'Guardar control'}));await screen.findByRole('heading',{name:'Control guardado'})
 expect(api.saveAirportChecklist.mock.calls[0][2]).toMatchObject({respuestas:{luces:'ok'},observaciones:''})
 expect(tickets.updateTicket).not.toHaveBeenCalled()
})
it('justifica No aplica por punto y guarda sin crear ticket',async()=>{
 render(<AirportVehicleChecklist activoId={vehicle.id}/>);await fill()
 fireEvent.click(within(screen.getByRole('group',{name:'Rampa'})).getByRole('button',{name:'NA',exact:true}))
 fireEvent.change(screen.getByRole('textbox',{name:'Observación del punto'}),{target:{value:'La unidad no tiene rampa'}})
 fireEvent.click(screen.getByRole('button',{name:'Confirmar justificación'}));await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
 fireEvent.click(screen.getByRole('button',{name:'Guardar control'}));await screen.findByRole('heading',{name:'Control guardado'})
 expect(tickets.createTicket).not.toHaveBeenCalled()
 expect(api.saveAirportChecklist.mock.calls[0][2].observaciones).toContain('La unidad no tiene rampa')
})
