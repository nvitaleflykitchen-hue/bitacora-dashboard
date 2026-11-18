import React from 'react'
import { beforeEach, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react'
import { GeneralFlotaChecklist } from './FlotaChecklist'
import { GENERAL_VEHICLE_ITEMS, generalChecklistError } from '../../lib/generalVehicleChecklist'
import { AIRPORT_VEHICLES } from '../../lib/airportChecklist'
const mock = vi.hoisted(()=>({assets:vi.fn(),insert:vi.fn(),ticket:vi.fn(),warn:vi.fn(),rol:'admin'}))
vi.mock('../../lib/queries',()=>({getActivos:mock.assets,createTicket:mock.ticket}))
vi.mock('../../lib/auth',()=>({useAuth:()=>({perfil:{id:'person',nombre:'Responsable'},rol:mock.rol,allowedSedeIds:null,can:()=>mock.rol==='admin'})}))
vi.mock('../../lib/feedback',()=>({toast:{ok:vi.fn(),warn:mock.warn}}))
vi.mock('../../components/AirportVehicleChecklist',()=>({default:()=>null}))
vi.mock('../../lib/supabase',()=>({supabase:{schema:()=>({from:()=>({insert:mock.insert})}),from:()=>{const q={select:()=>q,eq:()=>q,in:()=>q,like:()=>q,order:()=>q,limit:async()=>({data:[]})};return q}}}))
beforeEach(()=>{cleanup();vi.stubGlobal('React',React);vi.clearAllMocks();mock.rol='admin';mock.assets.mockResolvedValue([{id:'ordinary',nombre:'Camioneta',estado:'en_reparacion',sede_id:21}, {...AIRPORT_VEHICLES[0],nombre:'Camión aeropuerto'}, {id:'off',nombre:'Baja',estado:'baja'}]);mock.insert.mockResolvedValue({error:null});mock.ticket.mockResolvedValue({})})
async function select(){await screen.findByRole('option',{name:/Camioneta/});fireEvent.change(screen.getByLabelText('Vehículo'),{target:{value:'ordinary'}})}
function fill(){for(const item of GENERAL_VEHICLE_ITEMS)fireEvent.click(within(screen.getByRole('group',{name:item.label})).getByRole('button',{name:item.optional?'No aplica':'Conforme',exact:true}))}
it('excluye aeroportuarios y bajas, exige diez respuestas y guarda reparación con autor de sesión',async()=>{
 render(<GeneralFlotaChecklist/>);await select();expect(screen.queryByRole('option',{name:/Camión aeropuerto/})).not.toBeInTheDocument();expect(screen.queryByRole('option',{name:'Baja'})).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Guardar checklist'}));expect(mock.insert).not.toHaveBeenCalled();expect(screen.getByText('Respondé los 10 controles antes de guardar.')).toBeInTheDocument()
 fill();fireEvent.click(screen.getByRole('button',{name:'Guardar checklist'}));await waitFor(()=>expect(mock.insert).toHaveBeenCalledTimes(1));const row=mock.insert.mock.calls[0][0];const payload=JSON.parse(row.observacion.split('::')[1]);expect(payload).toMatchObject({version:2,conductor:'Responsable',respuestas:{rampa:'na'}});expect(row.created_by).toBe('person');expect(Object.keys(payload.respuestas)).toHaveLength(10)
})
it('el operario registra el control sin recibir gestión de tickets',async()=>{
 mock.rol='operario';render(<GeneralFlotaChecklist/>);await select();fill();fireEvent.click(within(screen.getByRole('group',{name:'Verificación de frenos'})).getByRole('button',{name:'No conforme'}));fireEvent.change(screen.getByLabelText('Observaciones'),{target:{value:'Ruido al frenar'}});expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Guardar checklist'}));await waitFor(()=>expect(mock.insert).toHaveBeenCalled());expect(mock.ticket).not.toHaveBeenCalled()
})
it('rechaza kilómetros negativos y no aplica fuera de rampa',()=>{const form={respuestas:Object.fromEntries(GENERAL_VEHICLE_ITEMS.map(i=>[i.id,'ok'])),km:-1};expect(generalChecklistError(form)).toMatch(/kilometraje/);form.km='';form.respuestas.frenos='na';expect(generalChecklistError(form)).toMatch(/10 controles/)})

it('el QR fija el vehículo y lo conserva después del guardado',async()=>{
 render(<GeneralFlotaChecklist activoId="ordinary"/>);await screen.findByRole('option',{name:/Camioneta/});expect(screen.getByLabelText('Vehículo')).toHaveValue('ordinary');expect(screen.getByLabelText('Vehículo')).toBeDisabled();fill();fireEvent.click(screen.getByRole('button',{name:'Guardar checklist'}));await waitFor(()=>expect(mock.insert).toHaveBeenCalledTimes(1));expect(screen.getByLabelText('Vehículo')).toHaveValue('ordinary')
})
it('no permite registrar un QR de una unidad que no devolvió la consulta autorizada',async()=>{
 render(<GeneralFlotaChecklist activoId="fuera-de-sede"/>);await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Guardar checklist'})).toBeDisabled();expect(mock.insert).not.toHaveBeenCalled()
})

vi.mock('../../components/ChecklistFindings',()=>({useChecklistFindings:(_v,answer)=>({choose:(item,value)=>answer(item,value,null),panel:null})}))
