import React from 'react'
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AssetQrScannerModal from './AssetQrScannerModal'
const reader = vi.hoisted(()=>({ decode:vi.fn(), stop:vi.fn() }))
vi.mock('@zxing/browser',()=>({ BrowserQRCodeReader: class { decodeFromStream(...args) { return reader.decode(...args) } } }))
afterEach(()=>{ cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); reader.decode.mockReset(); reader.stop.mockReset() })

describe('AssetQrScannerModal', () => {
  it('solicita cámara sin BarcodeDetector, lee QR y libera la cámara', async () => {
    const stop = vi.fn(), onScan = vi.fn()
    const stream = { getTracks:()=>[{stop}] }
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    vi.stubGlobal('navigator',{mediaDevices:{getUserMedia}})
    let callback
    reader.decode.mockImplementation(async (input, video, cb)=>{ callback=cb; return {stop:reader.stop} })
    render(<AssetQrScannerModal onClose={vi.fn()} onScan={onScan}/>)
    await waitFor(()=>expect(reader.decode).toHaveBeenCalled())
    expect(getUserMedia).toHaveBeenCalledWith({video:{facingMode:{ideal:'environment'}},audio:false})
    callback({getText:()=> 'https://bitacora-dashboard.vercel.app/?scan=activo&id=ccf6ad91-a654-4fa6-b402-460328dbb424'},null,{stop:reader.stop})
    expect(onScan).toHaveBeenCalledOnce()
    expect(stop).toHaveBeenCalled()
  })
  it('explica permiso bloqueado y permite reintentar', async () => {
    const getUserMedia=vi.fn().mockRejectedValue(Object.assign(new Error(),{name:'NotAllowedError'}))
    vi.stubGlobal('navigator',{mediaDevices:{getUserMedia}})
    render(<AssetQrScannerModal onClose={vi.fn()} onScan={vi.fn()}/>)
    await screen.findByText(/El acceso a la cámara está bloqueado/)
    fireEvent.click(screen.getByRole('button',{name:'Activar / reintentar cámara'}))
    await waitFor(()=>expect(getUserMedia).toHaveBeenCalledTimes(2))
  })
  it('detiene una cámara cuyo permiso se concede después de cerrar', async () => {
    let resolve
    const stop=vi.fn()
    vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:()=>new Promise(r=>{resolve=r})}})
    const view=render(<AssetQrScannerModal onClose={vi.fn()} onScan={vi.fn()}/>)
    view.unmount()
    resolve({getTracks:()=>[{stop}]})
    await waitFor(()=>expect(stop).toHaveBeenCalled())
    expect(reader.decode).not.toHaveBeenCalled()
  })
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
