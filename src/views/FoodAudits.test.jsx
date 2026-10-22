import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import FoodAudits from './FoodAudits'
import { listFoodAudits } from '../lib/foodAudits'
import { getSedes } from '../lib/queries'
import { getAdjuntos } from '../lib/adjuntos'
const auth = vi.hoisted(() => ({ allowedSedeIds:[19], perfil:{rol:'consultor'}, user:{id:'user'} }))
vi.mock('../lib/auth',()=>({useAuth:()=>auth}))
vi.mock('../lib/queries',()=>({getSedes:vi.fn()}))
vi.mock('../lib/adjuntos',()=>({getAdjuntos:vi.fn()}))
vi.mock('../lib/foodAudits',async importOriginal => ({...await importOriginal(),listFoodAudits:vi.fn()}))
vi.mock('recharts',()=>({ResponsiveContainer:({children})=><div>{children}</div>,LineChart:()=> <div>Gráfico</div>,CartesianGrid:()=>null,Line:()=>null,Tooltip:()=>null,XAxis:()=>null,YAxis:()=>null}))
afterEach(cleanup)
beforeEach(()=>{vi.clearAllMocks();auth.allowedSedeIds=[19];auth.perfil.rol='consultor';getSedes.mockResolvedValue([{id:19,nombre:'Mendoza'}]);getAdjuntos.mockResolvedValue([{id:1,nombre:'auditoria.pdf',url:'https://example.org/audit.pdf'}]);listFoodAudits.mockResolvedValue([
 {id:'july',codigo:'JUL',sede_id:19,sedes:{nombre:'Mendoza'},organismo_auditor:'Biolev',fecha_auditoria:'2026-07-30',porcentaje_cumplimiento:76.6,estado:'Finalizada'},
 {id:'oct',codigo:'OCT',sede_id:19,sedes:{nombre:'Mendoza'},organismo_auditor:'Biolev',fecha_auditoria:'2026-10-17',porcentaje_cumplimiento:77.8,estado:'Finalizada',auditoria_hallazgos:[{id:'h1',titulo:'POES',estado:'Abierto',es_reincidente:true}]}
])})
it('muestra evolución, PDF e historial sin ofrecer carga a consultores',async()=>{
 render(<FoodAudits />)
 expect(await screen.findByText('+1,2 puntos')).toBeInTheDocument()
 expect(await screen.findByRole('link',{name:/Abrir PDF original/})).toHaveAttribute('href','https://example.org/audit.pdf')
 expect(screen.getByText('POES')).toBeInTheDocument()
 expect(screen.queryByRole('button',{name:'Subir auditoría'})).not.toBeInTheDocument()
 fireEvent.click(screen.getAllByRole('button',{name:'Ver auditoría'})[0])
 expect(await screen.findByText('Sin hallazgos cargados en este registro.')).toBeInTheDocument()
})
it('no lista sedes cuando el usuario no tiene ninguna asignada',async()=>{
 auth.allowedSedeIds=[];listFoodAudits.mockResolvedValue([])
 render(<FoodAudits />)
 await screen.findByText('No hay auditorías finalizadas para esta selección.')
 expect(getSedes).not.toHaveBeenCalled()
 expect(listFoodAudits).toHaveBeenCalledWith([])
})
