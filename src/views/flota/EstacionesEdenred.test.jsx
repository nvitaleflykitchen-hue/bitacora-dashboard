import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EstacionesEdenred from './EstacionesEdenred'

vi.mock('../../data/edenred.json', () => ({ default:{ sourceDate:'30/09/2026 07:30', stations:[
  { id:'1', nombre:'Shell Adelante', localidad:'Ballesteros', provincia:'Córdoba', direccion:'Ruta 9 km 1', lat:-32.4, lng:-63 },
  { id:'2', nombre:'Puma Atrás', localidad:'Villa María', provincia:'Córdoba', direccion:'Ruta 9 km 2', lat:-32.51, lng:-63 },
  { id:'3', nombre:'Sin punto', localidad:'Villa María', provincia:'Córdoba', direccion:'Ruta 9 km 3', lat:null, lng:null },
] } }))
let success, failure, geo
beforeEach(() => {
  vi.useFakeTimers()
  geo = { watchPosition:vi.fn((ok,err) => { success=ok; failure=err; return 77 }), clearWatch:vi.fn() }
  vi.stubGlobal('navigator', { geolocation:geo })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const locate = () => act(() => success({ timestamp:Date.now(), coords:{ latitude:-32.5,longitude:-63,accuracy:10,heading:0,speed:10 } }))

describe('Consulta Edenred', () => {
  it('no solicita GPS al abrir y permite buscar sin permiso', () => {
    render(<EstacionesEdenred />)
    expect(geo.watchPosition).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole('searchbox'),{ target:{value:'villa maria'} })
    expect(screen.getAllByRole('link',{name:/Navegar a/})).toHaveLength(2)
    expect(screen.getByText(/Sin coordenadas confirmadas/)).toBeTruthy()
  })
  it('ante denegación mantiene la búsqueda manual y permite reintentar', () => {
    render(<EstacionesEdenred />)
    fireEvent.click(screen.getByText('Mi ubicación'))
    act(()=>failure({code:1}))
    expect(screen.getByRole('status').textContent).toContain('no autorizada')
    expect(geo.clearWatch).toHaveBeenCalledWith(77)
    fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Ballesteros'}})
    expect(screen.getByText('Shell Adelante')).toBeTruthy()
    expect(screen.getByText('Mi ubicación').disabled).toBe(false)
  })
  it('muestra varias alternativas, prioriza adelante y limpia el GPS al salir', () => {
    const {unmount}=render(<EstacionesEdenred />)
    fireEvent.click(screen.getByText('Mi ubicación'))
    locate()
    const links=screen.getAllByRole('link',{name:/Navegar a/})
    expect(links).toHaveLength(2)
    expect(links[0].getAttribute('aria-label')).toContain('Shell Adelante')
    expect(screen.getByText(/Distancias aproximadas en línea recta/)).toBeTruthy()
    unmount()
    expect(geo.clearWatch).toHaveBeenCalledWith(77)
  })
  it('no sigue mostrando una ubicación vencida', () => {
    render(<EstacionesEdenred />)
    fireEvent.click(screen.getByText('Mi ubicación'))
    locate()
    act(()=>vi.advanceTimersByTime(61000))
    expect(screen.queryAllByRole('link',{name:/Navegar a/})).toHaveLength(0)
    expect(screen.getByRole('status').textContent).toContain('actualizada')
  })
  it('pausa al ocultar la página y pide una posición nueva al volver', () => {
    render(<EstacionesEdenred />)
    fireEvent.click(screen.getByText('Mi ubicación'))
    locate()
    const visibility = vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden')
    fireEvent(document,new Event('visibilitychange'))
    expect(geo.clearWatch).toHaveBeenCalledWith(77)
    expect(screen.queryAllByRole('link',{name:/Navegar a/})).toHaveLength(0)
    visibility.mockReturnValue('visible')
    fireEvent(document,new Event('visibilitychange'))
    expect(geo.watchPosition).toHaveBeenCalledTimes(2)
  })
})
