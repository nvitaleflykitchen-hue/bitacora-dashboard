import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AssetQrScannerModal from './AssetQrScannerModal'

describe('AssetQrScannerModal', () => {
  it('permite abrir un activo pegando el enlace cuando no hay lector de cámara', () => {
    const onScan = vi.fn()
    render(<AssetQrScannerModal onClose={vi.fn()} onScan={onScan}/>)

    fireEvent.change(screen.getByLabelText('Alternativa manual'), {
      target:{ value:'https://bitacora-dashboard.vercel.app/?scan=activo&id=ccf6ad91-a654-4fa6-b402-460328dbb424' },
    })
    fireEvent.click(screen.getByRole('button', { name:'Abrir' }))

    expect(onScan).toHaveBeenCalledWith({ id:'ccf6ad91-a654-4fa6-b402-460328dbb424', code:null })
  })
})
