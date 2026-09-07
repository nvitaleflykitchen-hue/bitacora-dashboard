import React, { useEffect, useRef, useState } from 'react'
import { normalizeBarcode } from '../lib/productBarcode'

export default function ProductBarcodeScanner({ onScan, onClose }) {
  const video = useRef(null)
  const dialog = useRef(null)
  const callbacks = useRef({ onScan, onClose })
  callbacks.current = { onScan, onClose }
  const [message, setMessage] = useState('Preparando cámara…')
  useEffect(() => {
    const modal = dialog.current
    modal.showModal()
    let canceled = false, completed = false, stream, controls
    const stop = () => { controls?.stop(); stream?.getTracks().forEach(track => track.stop()) }
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Cámara no disponible. Usá el ingreso manual desde una conexión HTTPS.')
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')])
        if (canceled) return
        stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1280 }, height:{ ideal:720 } }, audio:false })
        if (canceled) { stop(); return }
        const reader = new BrowserMultiFormatReader(new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_8, BarcodeFormat.EAN_13, BarcodeFormat.UPC_A, BarcodeFormat.ITF, BarcodeFormat.CODE_128]]]))
        setMessage('Acercá el código hasta que las barras se vean nítidas.')
        controls = await reader.decodeFromStream(stream, video.current, (result, error, scanner) => {
          if (canceled || completed || !result) return
          try {
            const barcode = normalizeBarcode(result.getText())
            completed = true
            scanner.stop(); stop()
            callbacks.current.onScan(barcode)
          } catch { setMessage('El código leído no es EAN, UPC o GTIN-14. Reintentá o ingresalo manualmente.') }
        })
        if (canceled || completed) stop()
      } catch (error) {
        stop()
        if (!canceled) setMessage(error.name === 'NotAllowedError' ? 'Permití el acceso a la cámara o cerrá para ingresar el código manualmente.' : error.message || 'No se pudo abrir la cámara. Podés ingresar el código manualmente.')
      }
    }
    start()
    return () => { canceled = true; stop(); modal.close() }
  }, [])
  return <dialog ref={dialog} className="product-scanner" onCancel={e => { e.preventDefault(); callbacks.current.onClose() }} aria-labelledby="scanner-title">
    <h2 id="scanner-title">Escanear código de barras</h2>
    <video ref={video} autoPlay muted playsInline />
    <p role="status">{message}</p>
    <button type="button" className="btn-ghost" onClick={onClose}>Cerrar / ingresar manualmente</button>
  </dialog>
}
