import React from 'react'
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import RrhhScope from './RrhhScope'
const mock=vi.hoisted(()=>({perfil:{rol:'admin'}}))
vi.mock('../lib/auth',()=>({useAuth:()=>({perfil:mock.perfil})}))
vi.mock('../views/equipo/RrhhEmpresas',()=>({default:({onBack,onOpenPersona})=><div><button onClick={onBack}>Volver al padrón</button><button onClick={()=>onOpenPersona('fk1')}>Abrir existente</button></div>}))
afterEach(()=>{cleanup();mock.perfil={rol:'admin'}})
it('keeps FlyKitchen as the starting screen and returns to its original file',async()=>{
 render(<RrhhScope>{id=><p>{id||'Lista FlyKitchen'}</p>}</RrhhScope>)
 expect(screen.getByText('Lista FlyKitchen')).toBeInTheDocument()
 expect(screen.queryByText('Volver al padrón')).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'Empresas · RRHH'}))
 fireEvent.click(await screen.findByRole('button',{name:'Abrir existente'}))
 expect(screen.getByText('fk1')).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Empresas · RRHH'}))
 fireEvent.click(await screen.findByRole('button',{name:'Volver al padrón'}))
 expect(screen.getByText('Lista FlyKitchen')).toBeInTheDocument()
})
it('does not offer central administration to site roles',()=>{
 mock.perfil={rol:'encargado'}
 render(<RrhhScope>{()=> <p>Equipo de la sede</p>}</RrhhScope>)
 expect(screen.getByText('Equipo de la sede')).toBeInTheDocument()
 expect(screen.queryByRole('button',{name:'Empresas · RRHH'})).toBeNull()
})
