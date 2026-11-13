import React from 'react'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react'
import EquipoView from './EquipoView'
const mock=vi.hoisted(()=>({tables:[]}))
vi.mock('../lib/auth',()=>({useAuth:()=>({can:()=>false,allowedSedeIds:null,perfil:{rol:'editor'},user:{id:'test'}})}))
vi.mock('../lib/useFormAccess',()=>({useFormAccess:()=>false}))
vi.mock('../lib/supabase',()=>{
 const client={schema:()=>client,from:name=>{
  mock.tables.push(name)
  const data=name==='v_personas'?[{id:'1',nombre:'Persona visible',apellido:'',sede_ids:[],activo:true}]:[]
  const query={then:resolve=>Promise.resolve({data,error:null}).then(resolve)}
  for(const method of ['select','order','eq','is','not'])query[method]=()=>query
  return query
 }}
 return {supabase:client,db:()=>client}
})
beforeEach(()=>{vi.stubGlobal('React',React);mock.tables.length=0})
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
it('opens the staff list without loading the evaluations history',async()=>{
 render(<EquipoView/>)
 expect(await screen.findByText('Persona visible')).toBeInTheDocument()
 expect(mock.tables).toContain('v_personas')
 expect(mock.tables).not.toContain('v_evaluaciones')
 fireEvent.click(screen.getAllByRole('button',{name:'ANÁLISIS'})[0])
 await waitFor(()=>expect(mock.tables).toContain('v_evaluaciones'))
 expect(screen.getByText('Equipo')).toBeInTheDocument()
})
