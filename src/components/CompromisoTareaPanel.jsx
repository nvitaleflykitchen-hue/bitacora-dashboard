import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, Paperclip, ShieldAlert } from 'lucide-react'
import { uploadAdjunto } from '../lib/adjuntos'
import { fmtFecha } from '../lib/dateUtils'
import { mensajeError } from '../lib/errores'
import { toast } from '../lib/feedback'
import { useAuth } from '../lib/auth'
import {
  getCompromisoEventos,
  getCompromisoTarea,
  informarBloqueoCompromiso,
  registrarAvanceCompromiso,
  registrarEvidenciaCompromiso,
} from '../lib/compromisos'

const LABELS = {
  pendiente:'Pendiente', aceptado:'Aceptado', en_curso:'En curso', bloqueado:'Bloqueado',
  cumplido:'Cumplido', cerrado:'Cerrado', cancelado:'Cancelado',
}

const LEVEL = ['Sin seguimiento enviado','Recordatorio enviado','Actualización solicitada','Segundo seguimiento','Escalado']

export default function CompromisoTareaPanel({ tareaId, readOnly=false }) {
  const { user, perfil } = useAuth()
  const [item,setItem]=useState(null)
  const [eventos,setEventos]=useState([])
  const [detalle,setDetalle]=useState('')
  const [archivo,setArchivo]=useState(null)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)

  const load=async()=>{
    setLoading(true)
    try {
      const compromiso=await getCompromisoTarea(tareaId)
      setItem(compromiso)
      setEventos(compromiso ? await getCompromisoEventos(compromiso.id) : [])
    } catch(error) { console.error('Copiloto Fly:',error) }
    finally { setLoading(false) }
  }
  useEffect(()=>{ load() },[tareaId])

  const run=async(fn,success)=>{
    if(!detalle.trim()) return toast.warn('Escribí el avance o motivo.')
    setSaving(true)
    try { await fn(item.id,detalle.trim()); setDetalle(''); toast.ok(success); await load() }
    catch(error){ toast.error(mensajeError(error)) }
    finally{ setSaving(false) }
  }

  const subir=async()=>{
    if(!archivo) return toast.warn('Elegí un archivo.')
    setSaving(true)
    try {
      await uploadAdjunto('compromiso',item.id,archivo)
      await registrarEvidenciaCompromiso(item.id,`Evidencia: ${archivo.name}`)
      setArchivo(null); toast.ok('Evidencia registrada.'); await load()
    } catch(error){ toast.error(mensajeError(error)) }
    finally{ setSaving(false) }
  }

  if(loading) return <p style={{color:'var(--text-dim)',fontSize:'.65rem'}}>Cargando seguimiento…</p>
  if(!item) return <p style={{color:'var(--text-dim)',fontSize:'.65rem'}}>Sin seguimiento Copiloto Fly: requiere usuario responsable y fecha límite.</p>
  const vencido=new Date(item.fecha_objetivo)<new Date() && !['cumplido','cerrado','cancelado'].includes(item.estado)
  const canRespond=user?.id===item.responsable_id||['admin','editor'].includes(perfil?.rol)
  return <div className="rounded p-3 space-y-2" style={{background:'rgba(57,255,20,.035)',border:'1px solid rgba(57,255,20,.14)'}}>
    <div className="flex justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2"><ShieldAlert size={13} color="var(--phosphor)"/><strong style={{fontSize:'.7rem'}}>SEGUIMIENTO COPILOTO FLY</strong></div>
      <span className="font-metric" style={{fontSize:'.58rem',color:vencido?'#ff6666':'var(--phosphor)'}}>{LABELS[item.estado]||item.estado}{vencido?' · VENCIDO':''}</span>
    </div>
    <p style={{fontSize:'.68rem',color:'var(--text)'}}>{item.accion_requerida}</p>
    <div className="flex gap-3 flex-wrap" style={{fontSize:'.62rem',color:'var(--text-dim)'}}>
      <span><Clock3 size={10} style={{display:'inline',marginRight:3}}/>Vence {fmtFecha(item.fecha_objetivo)}</span>
      <span>{LEVEL[item.nivel_seguimiento]||LEVEL[0]}</span>
      <span>{item.cantidad_recordatorios} aviso(s)</span>
    </div>
    {item.evidencia_esperada&&<p style={{fontSize:'.64rem',color:'#f59e0b'}}><Paperclip size={10} style={{display:'inline',marginRight:4}}/>Evidencia esperada: {item.evidencia_esperada}</p>}
    {item.bloqueo_motivo&&<p style={{fontSize:'.64rem',color:'#ff7777'}}><AlertTriangle size={10} style={{display:'inline',marginRight:4}}/>{item.bloqueo_motivo}</p>}
    {canRespond&&!['cumplido','cerrado','cancelado'].includes(item.estado)&&<>
      <textarea className="input-dark w-full" rows={2} value={detalle} onChange={e=>setDetalle(e.target.value)} placeholder="Registrar avance, respuesta o motivo del bloqueo…"/>
      <div className="flex gap-2 flex-wrap">
        <button className="btn-primary" disabled={saving} onClick={()=>run(registrarAvanceCompromiso,'Avance registrado.')}>Registrar avance</button>
        <button className="btn-ghost" disabled={saving} onClick={()=>run(informarBloqueoCompromiso,'Bloqueo informado.')}>Informar bloqueo</button>
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <input type="file" className="input-dark" style={{fontSize:'.62rem',padding:'.3rem'}} onChange={e=>setArchivo(e.target.files?.[0]||null)}/>
        <button className="btn-ghost" disabled={saving||!archivo} onClick={subir}><Paperclip size={11}/> Adjuntar evidencia</button>
      </div>
    </>}
    <a href={item.origen_url||`/?view=tareas&focus=${tareaId}`} className="btn-ghost inline-flex items-center gap-1" style={{fontSize:'.62rem',textDecoration:'none'}}><ExternalLink size={10}/> Ver origen</a>
    {eventos.length>0&&<details><summary style={{cursor:'pointer',fontSize:'.62rem',color:'var(--text-dim)'}}>Historial auditable ({eventos.length})</summary>
      <div className="space-y-1 mt-2">{eventos.slice(0,8).map(e=><div key={e.id} style={{fontSize:'.6rem',color:'var(--text-dim)'}}><CheckCircle2 size={9} style={{display:'inline',marginRight:4,color:'var(--phosphor)'}}/>{e.tipo} · {new Date(e.created_at).toLocaleString('es-AR')} {e.detalle?`· ${e.detalle}`:''}</div>)}</div>
    </details>}
  </div>
}
