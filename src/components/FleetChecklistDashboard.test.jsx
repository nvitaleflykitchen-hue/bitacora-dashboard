import React from 'react'
import {it,expect,vi} from 'vitest'
import {render,screen,fireEvent} from '@testing-library/react'
import FleetChecklistDashboard from './FleetChecklistDashboard'
import {fleetToday} from '../lib/flotaModel'
vi.mock('../lib/auth',()=>({useAuth:()=>({allowedSedeIds:null})}))
vi.mock('../lib/queries',()=>({getActivos:async()=>[{id:'one',nombre:'Unidad Córdoba',sede_id:21,sede_nombre:'Córdoba',estado:'operativo'},{id:'two',nombre:'Unidad Salta',sede_id:20,sede_nombre:'Salta',estado:'en_reparacion'}]}))
vi.mock('../lib/supabase',()=>({supabase:{from:table=>{const q={table,select:()=>q,in:()=>q,like:()=>q,order:()=>q};return q}}}))
vi.mock('../lib/flotaReportData',()=>({readAll:async q=>q.table==='mnt_tickets'?[]:[1,2].map(n=>({id:n,fecha:new Date().toISOString(),observacion:'CHECKLIST_VEHICULO::'+JSON.stringify({activo_id:'one',respuestas:{frenos:'observado'},estado:'observado'})}))}))
vi.mock('../lib/airportChecklistApi',()=>({loadAirportHistory:async()=>[]}))
it('cuenta unidades únicas y filtra sede, vehículo y período',async()=>{
render(<FleetChecklistDashboard onStart={()=>{}}/>);await screen.findByText('2/2',{exact:true}).catch(()=>{});
expect(await screen.findByText('1/2',{exact:true})).toBeInTheDocument();expect(screen.getByText('Historial del período (2)')).toBeInTheDocument();fireEvent.change(screen.getByLabelText('Sede del tablero'),{target:{value:'20'}});expect(screen.getByText('0/1',{exact:true})).toBeInTheDocument();expect(screen.getByText('Historial del período (0)')).toBeInTheDocument();expect(screen.queryByRole('option',{name:'Unidad Córdoba'})).not.toBeInTheDocument();expect(screen.getAllByDisplayValue(fleetToday())).toBeDefined()
})
