import React from 'react'
import {it,expect,vi} from 'vitest'
import {render,screen,fireEvent} from '@testing-library/react'
import CredencialesMasivasA4 from './CredencialesMasivasA4'
vi.mock('../lib/auth',()=>({useAuth:()=>({perfil:{rol:'admin'}})}))
vi.mock('../lib/credentialAccess',()=>({credentialIsValid:()=>true}))
vi.mock('./PersonaAvatar',()=>({PersonaAvatar:()=>null}))
vi.mock('../lib/credencialesA4',()=>({descargarCredencialesA4:vi.fn(),hojasCredencialesA4:()=>0,expandCredentialCards:x=>x}))
vi.mock('../lib/supabase',()=>({supabase:{schema:()=>({from:()=>({select:()=>({eq:()=>({order:async()=>({data:[{id:'a',persona_id:1},{id:'b',persona_id:2},{id:'c',persona_id:3}]})})})})})}}))
it('agrupa por sede, ordena por nombre visible y busca sin tildes y por legajo',async()=>{
 vi.stubGlobal('React',React)
 render(<CredencialesMasivasA4 sedes={[{id:2,nombre:'Zeta'},{id:1,nombre:'Córdoba'}]} personas={[{id:1,nombre:'Zulema',sede_ids:[1]},{id:2,nombre:'Ángela',apellido:'Ruiz',sede_ids:['1'],legajo:'FK-123'},{id:3,nombre:'Ana',sede_ids:[2]}]}/> )
 await screen.findByText('Ángela Ruiz')
 const rows=screen.getAllByRole('button').filter(b=>b.textContent.includes('ACTIVA'))
 expect(rows.map(r=>r.textContent)).toEqual([expect.stringContaining('Ángela'),expect.stringContaining('Zulema'),expect.stringContaining('Ana')])
 fireEvent.change(screen.getByLabelText('Buscar personas con credencial'),{target:{value:'angela'}})
 expect(screen.queryByText('Zulema')).not.toBeInTheDocument()
 fireEvent.change(screen.getByLabelText('Buscar personas con credencial'),{target:{value:'FK-123'}})
 expect(screen.getByText('Ángela Ruiz')).toBeInTheDocument()
 fireEvent.change(screen.getByLabelText('Filtrar credenciales por sede'),{target:{value:'2'}})
 expect(screen.queryByText('Ángela Ruiz')).not.toBeInTheDocument()
 vi.unstubAllGlobals()
})
