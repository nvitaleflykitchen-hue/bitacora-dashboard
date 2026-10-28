import React, { useEffect, useMemo, useState } from 'react'
import { Download, Send, X } from 'lucide-react'
import { getSedes } from '../lib/queries'
import { entregarAutorizacionRetiro } from '../lib/autorizacionRetiroPdf'
import { AUTORIZADOS_INICIALES, validarAutorizados } from '../lib/autorizadosRetiro'

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone:'America/Argentina/Buenos_Aires' })

function localidadDeSede(sede) {
  const localidadGuardada = sede?.localidad || sede?.ciudad
  if (localidadGuardada) return localidadGuardada
  const nombre = String(sede?.nombre || '').trim()
  const despuesDe = nombre.match(/\b(?:de|del)\s+([^,–-]+)$/i)?.[1]?.trim()
  if (despuesDe) return despuesDe
  return nombre
    .replace(/^(?:escala|aeropuerto|hospital|comedor|cocina(?:\s+in\s+situ)?)\s+/i, '')
    .trim()
}

export default function AutorizacionRetiroModal({ onClose }) {
  const [sedes,setSedes] = useState([])
  const [empresa,setEmpresa] = useState('')
  const [sedeOrigenId,setSedeOrigenId] = useState('')
  const [origen,setOrigen] = useState('')
  const [fecha,setFecha] = useState(hoy)
  const [referencia,setReferencia] = useState('')
  const [personas,setPersonas] = useState(() => AUTORIZADOS_INICIALES.map(p => ({...p, id:crypto.randomUUID()})))
  const editarPersona = (id, campo, valor) => setPersonas(actual => actual.map(p => p.id === id ? {...p, [campo]:valor} : p))
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  useEffect(()=>{ getSedes().then(rows=>setSedes(rows || [])).catch(()=>setError('No se pudieron cargar las sedes. Podés completar el origen manualmente.')) },[])
  const opciones = useMemo(()=>[...sedes].sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')), [sedes])
  const seleccionarSede = id => {
    setSedeOrigenId(id)
    const sede = sedes.find(item => String(item.id) === String(id))
    setOrigen(sede ? localidadDeSede(sede) : '')
  }
  const generar = async compartir => {
    if (!empresa.trim() || !origen.trim() || !fecha) { setError('Completá la empresa transportista, el origen y la fecha.'); return }
    setBusy(true); setError('')
    try { await entregarAutorizacionRetiro({ empresa:empresa.trim(), origen:origen.trim(), fecha, referencia:referencia.trim(), personas:validarAutorizados(personas) }, compartir) }
    catch (e) { if (e?.name !== 'AbortError') setError(e?.message || 'No se pudo generar el documento.') }
    finally { setBusy(false) }
  }
  const fieldStyle={ width:'100%', background:'var(--panel)', color:'var(--text)', border:'1px solid var(--line)', padding:'10px 12px', borderRadius:4, fontSize:13 }
  return <div role="dialog" aria-modal="true" aria-label="Autorización para retirar encomienda" style={{position:'fixed',inset:0,zIndex:20000,background:'rgba(0,0,0,.72)',display:'grid',placeItems:'center',padding:16}}>
    <div className="glass" style={{width:'min(620px,100%)',maxHeight:'94dvh',overflowY:'auto',padding:22,border:'1px solid rgba(80,180,255,.35)'}}>
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="font-title font-bold" style={{color:'var(--text)',fontSize:'1rem'}}>Autorización para retirar encomienda</h2><p style={{color:'var(--text-dim)',fontSize:12,marginTop:4}}>Generá el PDF firmado y listo para enviar.</p></div>
        <button className="btn-ghost" onClick={onClose} disabled={busy} aria-label="Cerrar"><X size={16}/></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{marginTop:18}}>
        <label style={{fontSize:11,color:'var(--text-dim)'}}>EMPRESA TRANSPORTISTA *<input maxLength={120} disabled={busy} value={empresa} onChange={e=>setEmpresa(e.target.value)} placeholder="Ej.: Andreani" style={{...fieldStyle,marginTop:5}} autoFocus/></label>
        <label style={{fontSize:11,color:'var(--text-dim)'}}>FECHA *<input maxLength={120} disabled={busy} type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={{...fieldStyle,marginTop:5}}/></label>
        <label className="md:col-span-2" style={{fontSize:11,color:'var(--text-dim)'}}>ESCALA / COCINA IN SITU *<select disabled={busy} value={sedeOrigenId} onChange={e=>seleccionarSede(e.target.value)} style={{...fieldStyle,marginTop:5}}><option value="">— Seleccionar sede —</option>{opciones.map(sede=><option key={sede.id} value={sede.id}>{sede.nombre}</option>)}</select></label>
        <label className="md:col-span-2" style={{fontSize:11,color:'var(--text-dim)'}}>LOCALIDAD DE ORIGEN *<input maxLength={120} disabled={busy} value={origen} onChange={e=>setOrigen(e.target.value)} placeholder="Ej.: Laboulaye" style={{...fieldStyle,marginTop:5}}/><span style={{display:'block',marginTop:4,fontSize:10}}>Se completa automáticamente desde la sede y puede corregirse antes de generar.</span></label>
        <label className="md:col-span-2" style={{fontSize:11,color:'var(--text-dim)'}}>GUÍA / REMITO / FACTURA<input maxLength={120} disabled={busy} value={referencia} onChange={e=>setReferencia(e.target.value)} placeholder="Opcional" style={{...fieldStyle,marginTop:5}}/></label>
      </div>
      <fieldset disabled={busy} style={{marginTop:18}}>
        <legend className="font-title">Personas autorizadas a retirar</legend>
        <p style={{fontSize:12,marginTop:6}}>Revisá la lista antes de generar. Los cambios se aplican a esta autorización.</p>
        {personas.map((persona,index) => <div key={persona.id} className="grid grid-cols-1 md:grid-cols-2 gap-2" style={{marginTop:12}}>
          <label style={{fontSize:11}}>Nombre y apellido {index+1}<input maxLength={100} value={persona.nombre} onChange={e=>editarPersona(persona.id,'nombre',e.target.value)} style={fieldStyle}/></label>
          <label style={{fontSize:11}}>DNI {index+1}<input maxLength={12} inputMode="numeric" value={persona.dni} onChange={e=>editarPersona(persona.id,'dni',e.target.value)} style={fieldStyle}/></label>
          <button className="btn-ghost" onClick={()=>setPersonas(actual=>actual.filter(p=>p.id!==persona.id))} aria-label={`Quitar persona ${index+1}`}>Quitar persona</button>
        </div>)}
        <button className="btn-ghost" style={{marginTop:12}} onClick={()=>setPersonas(actual=>[...actual,{id:crypto.randomUUID(),nombre:'',dni:''}])}>Agregar persona</button>
      </fieldset>
      {error&&<p role="alert" style={{color:'#ff6b6b',fontSize:12,marginTop:12}}>{error}</p>}
      <div className="flex flex-wrap justify-end gap-2" style={{marginTop:18}}>
        <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn-ghost flex items-center gap-2" onClick={()=>generar(false)} disabled={busy}><Download size={14}/> Descargar PDF</button>
        <button className="btn-primary flex items-center gap-2" onClick={()=>generar(true)} disabled={busy}><Send size={14}/> {busy?'Generando…':'Compartir / enviar'}</button>
      </div>
    </div>
  </div>
}
