import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import CredencialVerificacion from './CredencialVerificacion'
import { supabase } from '../lib/supabase'
vi.mock('../lib/supabase',()=>({supabase:{rpc:vi.fn()}}))
afterEach(cleanup)
it('distingue FA multisede de sectores físicos y conserva alcance en QR público',async()=>{
  supabase.rpc.mockResolvedValue({data:[{estado:'activa',nombre:'Persona Central',fecha_vencimiento:'2028-10-29',sectores_autorizados:[{id:'fa-19',sede_id:19,sede_nombre:'Mendoza',codigo:'FA',tipo:'permiso',alcance:'todas_sedes',fa_vencimiento:'2027-10-29',nombre:'Acceso completo interno a la sede',zra:true}]}]})
  render(<CredencialVerificacion token="fixture"/>)
  expect(await screen.findByText('FA · Todas las sedes activas')).toBeTruthy()
  expect(screen.getByText('Mendoza')).toBeTruthy()
  expect(screen.queryByText('· Restringido')).toBeNull()
})
