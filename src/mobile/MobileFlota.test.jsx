import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import MobileFlota from './MobileFlota'
vi.mock('../components/SkeletonTable',()=>({default:()=>null}))
vi.mock('../lib/queries',()=>({getActivos:async()=>[{id:'v',tipo:'VEHICULO',nombre:'Ficha anterior'}],getPoes:async()=>[]}))
vi.mock('../lib/backStack',()=>({useBackHandler:()=>{}}))
vi.mock('../lib/flotaReportData',()=>({loadVehicleReport:async()=>[{
  vehicle:{id:'v',nombre:'DOBLO AC065RF',dominio:'AC065RF',marca:'Fiat',modelo:'Doblò',anio:2017,combustible:'nafta'},
  reading:{km:77000,fecha:'2026-08-20',fuente:'Ticket 893'},warnings:['SENASA: fechas contradictorias'],
  documentation:[],plans:[],tickets:[{id:'t',numero:893,estado:'resuelto',fecha_cierre:'2026-08-20',created_at:'2026-10-28',descripcion:'Service histórico'}],
}]}))
afterEach(cleanup)
it('muestra la ficha fresca y los históricos resueltos en móvil',async()=>{
  render(<MobileFlota focusContext={{type:'vehiculo',id:'v'}}/>)
  expect(await screen.findByText('DOBLO AC065RF')).toBeTruthy()
  expect(screen.getByText(/#893.*resuelto/)).toBeTruthy()
  expect(screen.getByText(/SENASA: fechas contradictorias/)).toBeTruthy()
  expect(screen.getByText(/77.000 km/)).toBeTruthy()
  expect(screen.getByText('Informe PDF completo')).toBeTruthy()
})
