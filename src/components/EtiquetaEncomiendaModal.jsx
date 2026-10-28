import React, { useEffect, useMemo, useState } from 'react'
import { Download, Send, X } from 'lucide-react'
import { getPersonasBySede, getSedeContactos, getSedes } from '../lib/queries'
import { entregarEtiquetaEncomienda } from '../lib/etiquetaEncomiendaPdf'

const EMPTY={ sedeId:'', destinatario:'', dni:'', telefono:'', direccion:'', localidad:'', leyenda:'' }

function localidadDeSede(sede) {
  const guardada=sede?.localidad || sede?.ciudad
  if(guardada)return guardada
  const nombre=String(sede?.nombre || '').trim()
  const despuesDe=nombre.match(/\b(?:de|del)\s+([^,–-]+)$/i)?.[1]?.trim()
  if(despuesDe)return despuesDe
  return nombre.replace(/^(?:escala|aeropuerto|hospital|comedor|cocina(?:\s+in\s+situ)?)\s+/i,'').trim()
}

export default function EtiquetaEncomiendaModal({ onClose }) {
  const [sedes,setSedes]=useState([])
  const [form,setForm]=useState(EMPTY)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>{ getSedes().then(rows=>setSedes(rows || [])).catch(()=>setError('No se pudieron cargar las sedes. Cerrá y volvé a intentar.')) },[])
  const sede=useMemo(()=>sedes.find(s=>String(s.id)===String(form.sedeId)),[sedes,form.sedeId])
  const set=(key,value)=>setForm(current=>({...current,[key]:value}))
  const seleccionar=async id=>{
    if(busy)return
    const next=sedes.find(s=>String(s.id)===String(id))
    setError('')
    if(!next){ setForm(EMPTY); return }
    setBusy(true)
    try{
      const [personas,relaciones]=await Promise.all([getPersonasBySede(next.id),getSedeContactos(next.id)])
      const responsablePersona=(personas||[]).find(p=>/^responsable\s+de\s+escala$/i.test(p.puesto||''))
        || (personas||[]).find(p=>/responsable|encargad[oa]|jefe/i.test(p.puesto||''))
      const principal=(relaciones||[]).find(r=>/responsable|encargado|jefe/i.test(r.rol||'')) || relaciones?.[0]
      const contacto=principal?.contactos
      const localidad=localidadDeSede(next)
      setForm({
        sedeId:String(next.id),
        destinatario:responsablePersona ? `${responsablePersona.nombre || ''} ${responsablePersona.apellido || ''}`.trim() : (contacto?.nombre || next.responsable || next.contacto_nombre || ''),
        dni:responsablePersona?.dni || '',
        telefono:responsablePersona?.telefono || contacto?.telefono || next.telefono || '',
        direccion:next.direccion || '',
        localidad,
        leyenda:`RETIRO EN TERMINAL DE ${String(localidad).toUpperCase()}`,
      })
    }catch(e){ setError(e?.message||'No se pudieron cargar los responsables de la sede.') }
    finally{ setBusy(false) }
  }
  const generar=async compartir=>{
    if(!sede || !form.destinatario.trim() || !form.direccion.trim()){setError('Elegí una sede y completá destinatario y domicilio.');return}
    setBusy(true);setError('')
    try{await entregarEtiquetaEncomienda({...form,sedeNombre:sede.nombre},compartir)}catch(e){if(e?.name!=='AbortError')setError(e?.message||'No se pudo generar la etiqueta.')}finally{setBusy(false)}
  }
  const input={width:'100%',background:'var(--panel)',color:'var(--text)',border:'1px solid var(--line)',padding:'10px 12px',borderRadius:4,fontSize:13,marginTop:5}
  return <div role="dialog" aria-modal="true" aria-label="Etiqueta para encomienda" style={{position:'fixed',inset:0,zIndex:20000,background:'rgba(0,0,0,.72)',display:'grid',placeItems:'center',padding:16}}>
    <div className="glass" style={{width:'min(680px,100%)',padding:22,border:'1px solid rgba(80,180,255,.35)',maxHeight:'94vh',overflowY:'auto'}}>
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-title font-bold" style={{color:'var(--text)',fontSize:'1rem'}}>Etiqueta para envío de encomienda</h2><p style={{color:'var(--text-dim)',fontSize:12,marginTop:4}}>Los datos se completan desde la ficha y responsables de la sede.</p></div><button className="btn-ghost" onClick={onClose} disabled={busy} aria-label="Cerrar"><X size={16}/></button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{marginTop:18}}>
        <label className="md:col-span-2" style={{fontSize:11,color:'var(--text-dim)'}}>SEDE DESTINO *<select disabled={busy} value={form.sedeId} onChange={e=>seleccionar(e.target.value)} style={input}><option value="">— Seleccionar sede —</option>{sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
        <label style={{fontSize:11,color:'var(--text-dim)'}}>DESTINATARIO / RESPONSABLE *<input disabled={busy} maxLength={180} value={form.destinatario} onChange={e=>set('destinatario',e.target.value)} style={input}/></label>
        <label style={{fontSize:11,color:'var(--text-dim)'}}>DNI (OPCIONAL)<input disabled={busy} maxLength={180} value={form.dni} onChange={e=>set('dni',e.target.value)} placeholder="Ej: 28.668.251" style={input}/></label>
        <label style={{fontSize:11,color:'var(--text-dim)'}}>TELÉFONO<input disabled={busy} maxLength={180} value={form.telefono} onChange={e=>set('telefono',e.target.value)} style={input}/></label>
        <label className="md:col-span-2" style={{fontSize:11,color:'var(--text-dim)'}}>DOMICILIO DE ENTREGA *<input disabled={busy} maxLength={180} value={form.direccion} onChange={e=>set('direccion',e.target.value)} style={input}/></label>
        <label style={{fontSize:11,color:'var(--text-dim)'}}>LOCALIDAD / PROVINCIA<input disabled={busy} maxLength={180} value={form.localidad} onChange={e=>set('localidad',e.target.value)} style={input}/></label>
        <label style={{fontSize:11,color:'var(--text-dim)'}}>INDICACIÓN DE RETIRO<input disabled={busy} maxLength={180} value={form.leyenda} onChange={e=>set('leyenda',e.target.value)} style={input}/></label>
      </div>
      {error&&<p role="alert" style={{color:'#ff6b6b',fontSize:12,marginTop:12}}>{error}</p>}
      <div className="flex flex-wrap justify-end gap-2" style={{marginTop:18}}><button className="btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button><button className="btn-ghost flex items-center gap-2" onClick={()=>generar(false)} disabled={busy}><Download size={14}/> Descargar PDF</button><button className="btn-primary flex items-center gap-2" onClick={()=>generar(true)} disabled={busy}><Send size={14}/> {busy?'Generando…':'Compartir / enviar'}</button></div>
    </div>
  </div>
}
