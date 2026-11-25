import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Keyboard, ScanLine, X } from 'lucide-react'
import { parseAssetQrValue } from '../lib/assetQrScan'

const OVERLAY = {
  position:'fixed', inset:0, zIndex:90, background:'rgba(0,0,0,.86)',
  display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem',
}

export default function AssetQrScannerModal({
  onClose,
  onScan,
  parseValue = parseAssetQrValue,
  title = 'Escanear activo',
  subtitle = 'Lector interno de Fly Gestión',
  prompt = 'Apuntá al QR de la etiqueta.',
  invalidMessage = 'El código no corresponde a un activo de Fly Gestión.',
  placeholder = 'Pegá el enlace o código FK-EQ…',
  help = 'Dentro de la app se abre la ficha privada. El mismo QR, escaneado con la cámara normal del teléfono, mantiene la vista pública.',
}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const controlsRef = useRef(null)
  const callbacksRef = useRef({ onScan, parseValue, invalidMessage })
  callbacksRef.current = { onScan, parseValue, invalidMessage }
  const [attempt, setAttempt] = useState(0)
  const [starting, setStarting] = useState(false)
  const [manualValue, setManualValue] = useState('')
  const [status, setStatus] = useState('Preparando la cámara…')
  const [cameraActive, setCameraActive] = useState(false)

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }, [])

  const deliver = useCallback(raw => {
    const parsed = callbacksRef.current.parseValue(raw)
    if (!parsed) {
      setStatus(callbacksRef.current.invalidMessage)
      return false
    }
    stopCamera()
    callbacksRef.current.onScan(parsed)
    return true
  }, [stopCamera])

  useEffect(() => {
    let disposed = false
    let completed = false

    const start = async () => {
      setStarting(true)
      setCameraActive(false)
      setStatus('Permití el acceso a la cámara cuando lo solicite el navegador…')
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('La cámara necesita una conexión HTTPS y un navegador compatible. Abrí Fly Gestión en Chrome, Edge o Safari, o usá el ingreso manual.')
        const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false })
        if (disposed) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        streamRef.current = stream
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        if (disposed) { stream.getTracks().forEach(track => track.stop()); return }
        const reader = new BrowserQRCodeReader()
        const controls = await reader.decodeFromStream(stream, videoRef.current, (result, error, scanner) => {
          if (disposed || completed || !result) return
          if (deliver(result.getText())) {
            completed = true
            scanner.stop()
            setCameraActive(false)
          }
        })
        if (disposed || completed) { controls.stop(); return }
        controlsRef.current = controls
        setCameraActive(true)
        setStatus(prompt)
      } catch (error) {
        if (disposed) return
        stopCamera()
        setCameraActive(false)
        setStatus(error.name === 'NotAllowedError'
          ? 'El acceso a la cámara está bloqueado o fue rechazado. En los permisos del sitio habilitá Cámara y revisá también el permiso del navegador en tu dispositivo. Después pulsá Activar / reintentar cámara.'
          : error.name === 'NotFoundError' ? 'No se encontró una cámara conectada. Conectala y reintentá, o usá el ingreso manual.'
          : error.name === 'NotReadableError' ? 'La cámara está ocupada o el dispositivo bloquea el acceso. Cerrá otras aplicaciones que la usen y reintentá.'
          : error.message || 'No se pudo iniciar el lector. Reintentá o usá el ingreso manual.')
      } finally {
        if (!disposed) setStarting(false)
      }
    }

    start()
    return () => {
      disposed = true
      stopCamera()
    }
  }, [attempt, deliver, prompt, stopCamera])

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
            <h2 id="asset-scanner-title" style={{ color:'var(--text)', fontSize:'1rem', fontWeight:700, margin:0 }}>{title}</h2>
            <p style={{ color:'var(--text-dim)', fontSize:'.68rem', margin:'3px 0 0' }}>{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar lector" style={{ background:'none', border:0, color:'var(--text-dim)', cursor:'pointer', padding:6 }}><X size={20}/></button>
        </div>

        <div style={{ position:'relative', aspectRatio:'4 / 3', background:'#050507', borderRadius:8, overflow:'hidden', display:'grid', placeItems:'center' }}>
          <video ref={videoRef} muted playsInline style={{ width:'100%', height:'100%', objectFit:'cover', display:cameraActive?'block':'none' }}/>
          {!cameraActive && <Camera size={42} style={{ color:'rgba(255,255,255,.25)' }}/>} 
          <div aria-hidden="true" style={{ position:'absolute', width:'58%', aspectRatio:'1', border:'2px solid var(--phosphor)', borderRadius:8, boxShadow:'0 0 0 999px rgba(0,0,0,.22)' }}/>
        </div>
        <p role="status" style={{ color:'var(--text-dim)', fontSize:'.72rem', lineHeight:1.4, textAlign:'center', margin:'10px 0 14px' }}>{status}</p>
        {!cameraActive && <button type="button" className="btn-primary" disabled={starting} onClick={()=>setAttempt(value=>value+1)} style={{ marginBottom:14 }}>{starting ? 'Esperando permiso de cámara…' : 'Activar / reintentar cámara'}</button>}

        <form onSubmit={submitManual}>
          <label htmlFor="asset-qr-manual" style={{ display:'flex', alignItems:'center', gap:6, color:'var(--text-dim)', fontSize:'.65rem', textTransform:'uppercase', marginBottom:6 }}><Keyboard size={14}/> Alternativa manual</label>
          <div style={{ display:'flex', gap:8 }}>
            <input id="asset-qr-manual" className="input-dark" value={manualValue} onChange={event=>setManualValue(event.target.value)} placeholder={placeholder} autoComplete="off" style={{ flex:1, minWidth:0 }}/>
            <button type="submit" className="btn-primary" disabled={!manualValue.trim()} style={{ display:'inline-flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}><ScanLine size={15}/> Abrir</button>
          </div>
        </form>
        <p style={{ color:'var(--text-dim)', fontSize:'.62rem', lineHeight:1.45, margin:'12px 0 0' }}>{help}</p>
      </div>
    </div>
  )
}
