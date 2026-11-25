import React from 'react'
import {render,screen,act,waitFor,cleanup} from '@testing-library/react'
import {afterEach,beforeEach,it,expect,vi} from 'vitest'
import {AuthProvider,useAuth} from './auth'
const m=vi.hoisted(()=>({rpc:vi.fn(),session:vi.fn(),callback:null}))
vi.mock('./supabase',()=>({supabase:{rpc:m.rpc,auth:{getSession:m.session,onAuthStateChange:cb=>{m.callback=cb;return {data:{subscription:{unsubscribe:vi.fn()}}}}}},db:vi.fn()}))
function Probe(){const {user,perfil,loading}=useAuth();return <p>{user?.id||'-'} / {perfil?.id||'-'} / {loading?'loading':'ready'}</p>}
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}}
const profile=id=>({id,nombre:id,rol:'seguridad',activo:true,sede_ids:[21]})
function PasswordProbe(){const {perfil}=useAuth();return <p>{perfil?.must_change_password?'Cambio requerido':'Sin cambio pendiente'}</p>}
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();sessionStorage.clear();vi.stubGlobal('React',React)})
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
it('actualiza el requisito de contraseña aunque los demás datos del perfil no cambien',async()=>{
 let required=false
 m.session.mockResolvedValue({data:{session:{user:{id:'juan'}}}})
 m.rpc.mockImplementation(name=>Promise.resolve(name==='obtener_perfil_sesion'?{data:{...profile('juan'),must_change_password:required}}:{error:null}))
 render(<AuthProvider><Probe/><PasswordProbe/></AuthProvider>)
 await screen.findByText('juan / juan / ready')
 required=true
 act(()=>m.callback('TOKEN_REFRESHED',{user:{id:'juan'}}))
 await screen.findByText('Cambio requerido')
 required=false
 act(()=>m.callback('TOKEN_REFRESHED',{user:{id:'juan'}}))
 await screen.findByText('Sin cambio pendiente')
})
it('descarta el perfil tardío de la cuenta anterior después de cambiar de usuario',async()=>{
 const old=deferred();let calls=0
 m.session.mockResolvedValue({data:{session:{user:{id:'pablo'}}}})
 m.rpc.mockImplementation(name=>name==='obtener_perfil_sesion'?(++calls===1?old.promise:Promise.resolve({data:profile('juan')})):Promise.resolve({error:null}))
 render(<AuthProvider><Probe/></AuthProvider>)
 await waitFor(()=>expect(calls).toBe(1))
 act(()=>m.callback('SIGNED_IN',{user:{id:'juan'}}))
 await screen.findByText('juan / juan / ready')
 await act(async()=>old.resolve({data:profile('pablo')}))
 expect(screen.getByText('juan / juan / ready')).toBeTruthy()
 expect(localStorage.getItem('fly:offline-perfil:pablo')).toBeNull()
})
it('rechaza una respuesta de perfil que pertenece a otra cuenta',async()=>{
 m.session.mockResolvedValue({data:{session:{user:{id:'juan'}}}})
 m.rpc.mockResolvedValue({data:profile('pablo')})
 render(<AuthProvider><Probe/></AuthProvider>)
 await screen.findByText('juan / - / ready')
 expect(localStorage.getItem('fly:offline-perfil:juan')).toBeNull()
})
it('una lectura inicial tardía no reemplaza la cuenta recién iniciada',async()=>{
 const initial=deferred()
 m.session.mockReturnValue(initial.promise)
 m.rpc.mockImplementation(name=>Promise.resolve(name==='obtener_perfil_sesion'?{data:profile('juan')}:{error:null}))
 render(<AuthProvider><Probe/></AuthProvider>)
 act(()=>m.callback('SIGNED_IN',{user:{id:'juan'}}))
 await screen.findByText('juan / juan / ready')
 await act(async()=>initial.resolve({data:{session:{user:{id:'pablo'}}}}))
 expect(screen.getByText('juan / juan / ready')).toBeTruthy()
})
