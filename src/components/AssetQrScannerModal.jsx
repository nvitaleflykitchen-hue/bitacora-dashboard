import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Keyboard, ScanLine, X } from 'lucide-react'
import { parseAssetQrValue } from '../lib/assetQrScan'

const OVERLAY = {
  position:'fixed', inset:0, zIndex:90, background:'rgba(0,0,0,.86)',
  display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem',
}

export default function AssetQrScannerModal({ onClose, onScan }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const frameRef = useRef(null)
  const busyRef = useRef(false)
  const [manualValue, setManualValue] = useState('')
  const [status, setStatus] = useState('Preparando la cámara…')
  const [cameraActive, setCameraActive] = useState(false)

  const stopCamera = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }, [])

  const deliver = useCallback(raw => {
    const parsed = parseAssetQrValue(raw)
    if (!parsed) {
      setStatus('El código no corresponde a un activo de Fly Gestión.')
      busyRef.current = false
      return false
    }
    stopCamera()
    onScan(parsed)
    return true
  }, [onScan, stopCamera])

  useEffect(() => {
    let disposed = false

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('Este dispositivo no permite usar la cámara. Ingresá el enlace o código manualmente.')
        return
      }
      if (!('BarcodeDetector' in window)) {
        setStatus('El lector automático no está disponible en este navegador. Ingresá el enlace o código manualmente.')
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false })
        if (disposed) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        setCameraActive(true)
        setStatus('Apuntá al QR de la etiqueta.')
        const detector = new window.BarcodeDetector({ formats:['qr_code'] })

        const detect = async () => {
          if (disposed || !streamRef.current) return
          if (!busyRef.current && video.readyState >= 2) {
            busyRef.current = true
            try {
              const codes = await detector.detect(video)
              if (codes[0]?.rawValue && deliver(codes[0].rawValue)) return
            } catch {
              setStatus('No se pudo leer la cámara. Probá con el ingreso manual.')
            } finally {
              busyRef.current = false
            }
          }
          frameRef.current = requestAnimationFrame(detect)
        }
        frameRef.current = requestAnimationFrame(detect)
      } catch {
        setStatus('No se pudo acceder a la cámara. Revisá el permiso o usá el ingreso manual.')
      }
    }

    start()
    return () => {
      disposed = true
      stopCamera()
    }
  }, [deliver, stopCamera])

  const submitManual = event => {
    event.preventDefault()
    if (!manualValue.trim()) return
    deliver(manualValue)
  }

  return (
    <div style={OVERLAY} role="dialog" aria-modal="true" aria-labelledby="asset-scanner-title" onClick={onClose}>
      <div onClick={event=>event.stopPropagation()} style={{ width:'min(430px, 100%)', maxHeight:'92vh', overflowY:'auto', background:'var(--surface)', border:'1px solid rgba(57,255,20,.2)', borderRadius:10, padding:'1rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:12 }}>
          <div>
            <h2 id="asset-scanner-title" style={{ color:'var(--text)', fontSize:'1rem', fontWeight:700, margin:0 }}>Escanear activo</h2>
            <p style={{ color:'var(--text-dim)', fontSize:'.68rem', margin:'3px 0 0' }}>Lector interno de Fly Gestión</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar lector" style={{ background:'none', border:0, color:'var(--text-dim)', cursor:'pointer', padding:6 }}><X size={20}/></button>
        </div>

        <div style={{ position:'relative', aspectRatio:'4 / 3', background:'#050507', borderRadius:8, overflow:'hidden', display:'grid', placeItems:'center' }}>
          <video ref={videoRef} muted playsInline style={{ width:'100%', height:'100%', objectFit:'cover', display:cameraActive?'block':'none' }}/>
          {!cameraActive && <Camera size={42} style={{ color:'rgba(255,255,255,.25)' }}/>} 
          <div aria-hidden="true" style={{ position:'absolute', width:'58%', aspectRatio:'1', border:'2px solid var(--phosphor)', borderRadius:8, boxShadow:'0 0 0 999px rgba(0,0,0,.22)' }}/>
        </div>
        <p role="status" style={{ color:'var(--text-dim)', fontSize:'.72rem', lineHeight:1.4, textAlign:'center', margin:'10px 0 14px' }}>{status}</p>

        <form onSubmit={submitManual}>
          <label htmlFor="asset-qr-manual" style={{ display:'flex', alignItems:'center', gap:6, color:'var(--text-dim)', fontSize:'.65rem', textTransform:'uppercase', marginBottom:6 }}><Keyboard size={14}/> Alternativa manual</label>
          <div style={{ display:'flex', gap:8 }}>
            <input id="asset-qr-manual" className="input-dark" value={manualValue} onChange={event=>setManualValue(event.target.value)} placeholder="Pegá el enlace o código FK-EQ…" autoComplete="off" style={{ flex:1, minWidth:0 }}/>
            <button type="submit" className="btn-primary" disabled={!manualValue.trim()} style={{ display:'inline-flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}><ScanLine size={15}/> Abrir</button>
          </div>
        </form>
        <p style={{ color:'var(--text-dim)', fontSize:'.62rem', lineHeight:1.45, margin:'12px 0 0' }}>Dentro de la app se abre la ficha privada. El mismo QR, escaneado con la cámara normal del teléfono, mantiene la vista pública.</p>
      </div>
    </div>
  )
}
