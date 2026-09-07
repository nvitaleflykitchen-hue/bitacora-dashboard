import React from 'react'
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import Articulos from './Articulos'
import { productResolver, saveProduct } from '../lib/productQueries'

vi.mock('../lib/auth', () => ({ useAuth:() => ({ can:() => true, perfil:{ nombre:'Prueba' } }) }))
vi.mock('../lib/adjuntos', () => ({ uploadAdjunto:vi.fn() }))
vi.mock('../components/ProductBarcodeScanner', () => ({ default:() => <div>Lector listo</div> }))
vi.mock('../lib/productQueries', () => ({ productResolver:{ resolve:vi.fn() }, findProduct:vi.fn(), saveProduct:vi.fn(), searchProducts:vi.fn().mockResolvedValue([]), validateProduct:vi.fn() }))
beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)
describe('flujo artículos', () => {
  it('permite completar un desconocido, guardar y pasar al siguiente', async () => {
    productResolver.resolve.mockResolvedValue({ product:null, origin:'unknown', warnings:[] })
    saveProduct.mockImplementation(async form => ({ ...form, expected_updated_at:'2026-09-07T12:00:00Z' }))
    render(<Articulos initialMode="scan" />)
    fireEvent.change(screen.getByLabelText('O ingresá el código manualmente'), { target:{ value:'012345678905' } })
    fireEvent.click(screen.getByRole('button', { name:'Buscar', exact:true }))
    await screen.findByText('Producto no identificado')
    fireEvent.change(screen.getByLabelText('Nombre del artículo *'), { target:{ value:'Artículo de prueba' } })
    fireEvent.change(screen.getByLabelText('Nivel de empaque'), { target:{ value:'case' } })
    fireEvent.change(screen.getByLabelText('Contenido por unidad contenida'), { target:{ value:'8' } })
    fireEvent.change(screen.getByLabelText('Unidad de contenido'), { target:{ value:'g' } })
    fireEvent.change(screen.getByLabelText('Unidades contenidas por caja / bulto'), { target:{ value:'192' } })
    fireEvent.click(screen.getByRole('button', { name:'GUARDAR Y ESCANEAR SIGUIENTE' }))
    await screen.findByText('Lector listo')
    expect(saveProduct.mock.calls[0][0]).toMatchObject({ barcode:'012345678905', name:'Artículo de prueba', net_quantity:'8', units_per_package:'192', packaging_level:'case' })
  })
  it('conserva el formulario y no avanza si el guardado falla', async () => {
    productResolver.resolve.mockResolvedValue({ product:null, origin:'unknown', warnings:[] })
    saveProduct.mockRejectedValue(new Error('Sin conexión'))
    render(<Articulos initialMode="scan" />)
    fireEvent.change(screen.getByLabelText('O ingresá el código manualmente'), { target:{ value:'012345678905' } })
    fireEvent.click(screen.getByRole('button', { name:'Buscar', exact:true }))
    await screen.findByText('Producto no identificado')
    fireEvent.change(screen.getByLabelText('Nombre del artículo *'), { target:{ value:'Se conserva' } })
    fireEvent.click(screen.getByRole('button', { name:'GUARDAR Y ESCANEAR SIGUIENTE' }))
    await screen.findByText('Sin conexión')
    expect(screen.getByLabelText('Nombre del artículo *')).toHaveValue('Se conserva')
    expect(screen.queryByText('Lector listo')).not.toBeInTheDocument()
  })
})
