import React from 'react'
import { webcrypto } from 'node:crypto'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import CredentialDelivery from './CredentialDelivery'
const mocks=vi.hoisted(()=>({invoke:vi.fn(),single:vi.fn(),role:'admin'}))
vi.mock('../lib/auth',()=>({useAuth:()=>({perfil:{rol:mocks.role}})}))
vi.mock('../lib/supabase',()=>({supabase:{schema:()=>({from:()=>({select:()=>({eq:()=>({single:mocks.single})})})}),functions:{invoke:mocks.invoke}}}))
beforeEach(()=>{localStorage.clear(); mocks.role='admin'; vi.clearAllMocks(); vi.stubGlobal('crypto',webcrypto)})
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
async function prepare(action='create'){
 const keys=await webcrypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-1'},true,['encrypt','decrypt'])
 const manifest={project_id:'mixyhfdlzjarvszinytk',batch_id:'test',audited_at:new Date().toISOString(),public_key:await webcrypto.subtle.exportKey('jwk',keys.publicKey),people:[{persona_id:'p',nombre:'Persona',email:'person@example.com',sede_ids:[21],sedes:[{nombre:'Córdoba'}],action,auth_id:'u',rol:'encargado'}]}
 render(<CredentialDelivery/>)
 fireEvent.click(screen.getByText('Entrega de credenciales por sede'))
 fireEvent.change(screen.getByLabelText('Archivo de preparación'),{target:{files:[{text:async()=>JSON.stringify(manifest)}]}})
 await screen.findByText(/1 personas preparadas/)
 return keys
}
it('crea operario y conserva únicamente la clave cifrada, recuperable con la clave privada',async()=>{
 const keys=await prepare()
 mocks.single.mockResolvedValue({data:{activo:true,email:'person@example.com',sede_ids:[21]}})
 mocks.invoke.mockResolvedValue({data:{data:{user:{id:'u',email:'person@example.com'},temp_password:'Temporal-individual-9!'}}})
 fireEvent.click(screen.getByText('Preparar cuentas y claves'))
 await screen.findByText(/Preparación finalizada/)
 expect(mocks.invoke).toHaveBeenCalledWith('create-user-direct',{body:{persona_id:'p',rol:'operario'}})
 const stored=localStorage.getItem('fly-credential-delivery-encrypted-v1')
 expect(stored).not.toContain('Temporal-individual-9!')
 const row=JSON.parse(stored)[0]
 const decrypted=await webcrypto.subtle.decrypt({name:'RSA-OAEP'},keys.privateKey,Buffer.from(row.password_cifrado,'base64'))
 expect(new TextDecoder().decode(decrypted)).toBe('Temporal-individual-9!')
 fireEvent.click(screen.getByText('Preparar cuentas y claves'))
 await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledTimes(1))
})
it('no modifica una ficha que cambió de sede',async()=>{
 await prepare()
 mocks.single.mockResolvedValue({data:{activo:true,email:'person@example.com',sede_ids:[24]}})
 fireEvent.click(screen.getByText('Preparar cuentas y claves'))
 await screen.findByText(/Las sedes cambiaron/)
 expect(mocks.invoke).not.toHaveBeenCalled()
})
it('restablece sin enviar cambios de rol ni sedes y cifra antes de invocar',async()=>{
 await prepare('reset')
 mocks.single.mockResolvedValue({data:{activo:true,perfil_id:'u',sede_ids:[21]}})
 mocks.invoke.mockImplementation(async(name,options)=>{
  expect(name).toBe('prepare-temporary-password')
  expect(Object.keys(options.body).sort()).toEqual(['password','persona_id','user_id'])
  expect(localStorage.getItem('fly-credential-delivery-encrypted-v1')).not.toContain(options.body.password)
  expect(JSON.parse(localStorage.getItem('fly-credential-delivery-encrypted-v1'))[0].status).toBe('pendiente_verificacion')
  return {data:{success:true}}
 })
 fireEvent.click(screen.getByText('Preparar cuentas y claves'))
 await screen.findByText(/Preparación finalizada/)
 expect(JSON.parse(localStorage.getItem('fly-credential-delivery-encrypted-v1'))[0]).toMatchObject({status:'restablecido',rol:'encargado'})
})
it('no ofrece la herramienta a un operario',()=>{
 mocks.role='operario';render(<CredentialDelivery/>)
 expect(screen.queryByText('Entrega de credenciales por sede')).toBeNull()
})


it('informa un fallo de consulta sin confundirlo con una baja ni generar claves',async()=>{
 await prepare()
 mocks.single.mockResolvedValue({error:{code:'42501'}})
 fireEvent.click(screen.getByText('Preparar cuentas y claves'))
 await screen.findByText(/No se preparó ninguna credencial/)
 expect(screen.getByText(/No se pudo consultar la ficha/)).toBeTruthy()
 expect(mocks.invoke).not.toHaveBeenCalled()
 expect(screen.getByText('Descargar entrega cifrada').disabled).toBe(true)
})
