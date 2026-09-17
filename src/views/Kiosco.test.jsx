import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Kiosco from './Kiosco'
import { confirmSale, listKioskCatalog } from '../lib/kioskQueries'

vi.mock('../lib/auth', () => ({ useAuth:() => ({ can:() => true }) }))
vi.mock('../lib/productQueries', () => ({
  listKioskSites:vi.fn().mockResolvedValue([{ id:1, nombre:'Comedor Centro' }]),
}))
vi.mock('./Articulos', () => ({ default:() => <div>Maestro de artículos integrado</div> }))
vi.mock('../lib/kioskQueries', () => ({
  listKioskCatalog:vi.fn(), getKioskIndicators:vi.fn().mockResolvedValue({ sales_today:0, operations_today:0, low_stock:0 }),
  confirmSale:vi.fn(), getSaleDetail:vi.fn(), confirmReceipt:vi.fn(), startInventoryCount:vi.fn(),
  saveInventoryCountLine:vi.fn(), finalizeInventoryCount:vi.fn(), annulSale:vi.fn(), listSales:vi.fn().mockResolvedValue([]),
  listReceipts:vi.fn().mockResolvedValue([]), listInventoryCounts:vi.fn().mockResolvedValue([]),
  listInventoryMovements:vi.fn().mockResolvedValue([]), money:value => `$ ${Number(value || 0)}`, localDate:value => String(value || '—'),
}))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  listKioskCatalog.mockResolvedValue([{
    product_id:'p1', presentation_id:'pr1', name:'Agua 500 ml', internal_code:'ART-000001',
    presentation:'Botella', barcodes:['7790000000011'], stock_factor:1, stock_current:8,
    stock_minimum:2, sale_price:1200, reference_cost:700, currency:'ARS', category:'Bebidas', active:true,
  }])
  confirmSale.mockResolvedValue({ id:'sale1', operation_number:'VTA-000001' })
})
afterEach(cleanup)

describe('Kiosco operativo', () => {
  it('reúne toda la operación y vende desde la sede habilitada', async () => {
    render(<Kiosco />)
    expect(await screen.findByRole('heading', { name:'Kiosco' })).toBeInTheDocument()
    expect(screen.getByLabelText('Sede operativa')).toHaveValue('1')
    for (const tab of ['Venta','Reposición','Inventario','Stock','Ventas','Movimientos','Artículos']) {
      expect(screen.getByRole('button', { name:tab })).toBeInTheDocument()
    }
    const input=screen.getByLabelText(/Venta actual/)
    fireEvent.change(input,{ target:{ value:'7790000000011' } })
    fireEvent.submit(input.closest('form'))
    expect(await screen.findByText('Agua 500 ml')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{ name:'COBRAR' }))
    fireEvent.change(screen.getByLabelText('Importe recibido'),{ target:{ value:'1500' } })
    fireEvent.click(screen.getByRole('button',{ name:'CONFIRMAR COBRO' }))
    await waitFor(() => expect(confirmSale).toHaveBeenCalledWith(expect.objectContaining({ sedeId:1, paymentMethod:'EFECTIVO' })))
  })

  it('integra el maestro sin volver al menú anterior', async () => {
    render(<Kiosco />)
    await screen.findByRole('heading', { name:'Kiosco' })
    fireEvent.click(screen.getByRole('button',{ name:'Artículos' }))
    expect(await screen.findByText('Maestro de artículos integrado')).toBeInTheDocument()
  })
})
