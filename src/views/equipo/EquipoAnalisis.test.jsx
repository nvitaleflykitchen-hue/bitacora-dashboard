import React from 'react'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import EquipoAnalisis from './EquipoAnalisis'
const mock=vi.hoisted(()=>({order:vi.fn()}))
vi.mock('../../lib/supabase',()=>({supabase:{from:()=>({select:()=>({order:mock.order})})}}))
vi.mock('../../components/EvaluacionesAnalysisPanel',()=>({default:({evaluaciones})=><div>{evaluaciones.map(e=><span key={e.id}>{e.id}</span>)}</div>}))
beforeEach(()=>mock.order.mockReset())
afterEach(cleanup)
it('loads evaluations on mount and only passes authorized staff to the panel',async()=>{
 mock.order.mockResolvedValue({data:[{id:'allowed',persona_id:1},{id:'other',persona_id:2}]})
 render(<EquipoAnalisis personas={[{id:'1'}]}/>)
 expect(await screen.findByText('allowed')).toBeInTheDocument()
 expect(screen.queryByText('other')).toBeNull()
})
it('shows a retryable error rather than an empty report',async()=>{
 mock.order.mockResolvedValueOnce({error:{message:'network'}}).mockResolvedValueOnce({data:[]})
 render(<EquipoAnalisis personas={[]}/>)
 fireEvent.click(await screen.findByRole('button',{name:'Reintentar'}))
 await waitFor(()=>expect(mock.order).toHaveBeenCalledTimes(2))
 await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull())
})
