import {fleetDateTime} from '../lib/flotaModel'
import { previousChecklistReading, checklistDateTime } from '../lib/checklistReading'
import { useChecklistFindings } from './ChecklistFindings'
import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import { AIRPORT_ITEMS, AIRPORT_FUEL, AIRPORT_VEHICLES, airportToday, validateAirportChecklist } from '../lib/airportChecklist'
import { loadAirportVehicles, loadAirportHistory, saveAirportChecklist, uploadAirportPhoto, loadAirportPhotos } from '../lib/airportChecklistApi'
import './AirportVehicleChecklist.css'

const emptyForm=()=>({km:'',combustible:'',respuestas:{},observaciones:'',observaciones_puntos:{}})
function Evidence({check}) {
  const [photos,setPhotos]=useState(null)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  return <div><button type="button" className="btn-ghost" disabled={loading} onClick={async()=>{setLoading(true);setError('');try{setPhotos(await loadAirportPhotos(check))}catch(e){setError(e.message)}finally{setLoading(false)}}}>{loading?'Cargando fotos…':'Ver fotos'}</button>
    {error&&<p role="alert">{error}</p>}{photos?.length===0&&<p>Sin fotos adjuntas.</p>}
    <div className="airport-photos">{photos?.map(p=><a key={p.path} href={p.signedUrl} target="_blank" rel="noreferrer"><img src={p.signedUrl} alt="Evidencia del control" loading="lazy"/></a>)}</div></div>
}
export default function AirportVehicleChecklist({activoId=null,onBack}) {
  const {perfil}=useAuth()
  const [vehicles,setVehicles]=useState([])
  const [selectedId,setSelectedId]=useState(activoId||'')
  const [history,setHistory]=useState([])
  const [form,setForm]=useState(emptyForm)
  const [photos,setPhotos]=useState([])
  const [saved,setSaved]=useState(null)
  const [error,setError]=useState('')
  const [historyError,setHistoryError]=useState('')
  const [loading,setLoading]=useState(true)
  const [historyLoading,setHistoryLoading]=useState(false)
  const [saving,setSaving]=useState(false)
  const kmEdited=useRef(false)
  const submitLock=useRef(false)
  const requestId=useRef(crypto.randomUUID())
  const selected=vehicles.find(v=>v.id===selectedId)
  const findings=useChecklistFindings(selected,(item,value,detail)=>setForm(f=>({...f,respuestas:{...f.respuestas,[item.id]:value},observaciones_puntos:{...f.observaciones_puntos,[item.id]:detail}})))
  const submissionForm = () => ({...form,
    respuestas:Object.fromEntries(Object.entries(form.respuestas).map(([key,value])=>[key,value==='critico'?'nc':value])),
    observaciones:[form.observaciones,...AIRPORT_ITEMS.flatMap(item=>{
      const detail=form.observaciones_puntos[item.id]
      return detail ? [`${item.label} · ${form.respuestas[item.id]}: ${detail.texto}${detail.ticket_id ? ' (ticket '+detail.ticket_id+')' : ''}`] : []
    })].filter(Boolean).join('\n')
  })
  const identity=AIRPORT_VEHICLES.find(v=>v.id===selectedId)
  useEffect(()=>{
    let active=true;setLoading(true);setError('')
    loadAirportVehicles().then(v=>{if(active)setVehicles(v||[])}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[perfil?.id])
  useEffect(()=>{setSelectedId(activoId||'')},[activoId])
  useEffect(()=>{
    kmEdited.current=false;setForm(emptyForm());setPhotos([]);setSaved(null);setHistory([]);setHistoryError('');requestId.current=crypto.randomUUID()
    if(!selectedId)return
    let active=true;setHistoryLoading(true)
    loadAirportHistory(selectedId).then(h=>{if(active){setHistory(h||[]);if(!kmEdited.current)setForm(f=>({...f,km:previousChecklistReading(h||[])}))}}).catch(e=>{if(active)setHistoryError(e.message)}).finally(()=>{if(active)setHistoryLoading(false)})
    return()=>{active=false}
  },[selectedId])
  const set=(key,value)=>setForm(f=>({...f,[key]:value}))
  const answered=AIRPORT_ITEMS.filter(i=>form.respuestas[i.id]).length
  async function uploadPending(check) {
    const pending=[]
    for(const photo of photos){try{await uploadAirportPhoto(perfil.id,check.id,photo)}catch{pending.push(photo)}}
    setPhotos(pending)
    if(pending.length) setError(`El control quedó guardado. No se pudieron subir ${pending.length} fotos; podés reintentar sin duplicarlo.`)
  }
  async function submit(event) {
    event.preventDefault()
    if(submitLock.current||!selected||selected.puede_controlar===false)return
    const payload=submissionForm()
    const invalid=validateAirportChecklist(payload)
    if(invalid){setError(invalid);return}
    submitLock.current=true;setSaving(true);setError('')
    try {
      const check=await saveAirportChecklist(requestId.current,selected.id,payload)
      setSaved(check);setHistory(h=>[check,...h.filter(c=>c.id!==check.id)])
      await uploadPending(check)
    } catch(e){setError(e.message)}finally{setSaving(false);submitLock.current=false}
  }
  return <section className="airport-checklist">
    <header><div><p className="airport-eyebrow">FLYKITCHEN · AEROPUERTOS</p><h1>Control de vehículos de gran porte</h1><p>Control vehicular · Fecha y hora automáticas</p></div>{onBack&&<button type="button" className="btn-ghost" disabled={saving} onClick={onBack}>Volver</button>}</header>
    {loading?<p role="status">Cargando vehículos asignados…</p>:<>
      {!activoId&&<label>Vehículo<select aria-label="Vehículo de gran porte" value={selectedId} disabled={saving} onChange={e=>{setSelectedId(e.target.value);setError('')}}><option value="">Seleccioná una unidad</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.nombre}</option>)}</select></label>}
      {!vehicles.length&&!error&&<p>No tenés vehículos de gran porte asignados a tus sedes.</p>}
      {activoId&&!selected&&!error&&<p role="alert">El vehículo no está disponible para tu cuenta o no pertenece a tus sedes.</p>}
      {selected&&<><div className="airport-identity"><h2>{identity?.plate}</h2><p>{selected.nombre} · {selected.sede_nombre||`Sede ${selected.sede_id}`}</p><p>Estado en Flota: <strong>{String(selected.estado||'sin informar').replaceAll('_',' ')}</strong></p><p>Podés realizar el control también durante una reparación. Guardarlo no modifica el estado de mantenimiento.</p></div>
        {findings.panel}
        {saved?<div className="airport-saved" role="status"><h2>Control guardado</h2><p>{fleetDateTime(saved.creado_at)} · {saved.resultado==='con_novedades'?'Con novedades':'Sin novedades'}</p><p>Responsable: {saved.responsable}</p>
          {photos.length>0&&<button disabled={saving} className="btn-primary" onClick={async()=>{setSaving(true);setError('');try{await uploadPending(saved)}finally{setSaving(false)}}}>Reintentar fotos pendientes</button>}
          {!photos.length&&<button className="btn-ghost" onClick={()=>{setSaved(null);kmEdited.current=false;setForm({...emptyForm(),km:previousChecklistReading(history)});requestId.current=crypto.randomUUID()}}>Nuevo control</button>}</div>:
        <form onSubmit={submit}>{selected.puede_controlar===false&&<p>Tu acceso permite consultar el historial, sin cargar controles.</p>}<fieldset disabled={saving||selected.puede_controlar===false}><legend>Datos del control</legend><div className="airport-fields"><label>Responsable<input value={perfil?.nombre||''} readOnly/></label><label>Fecha<input value={airportToday()} readOnly/></label>
          <p>La fecha y hora de carga se registran automáticamente al guardar. Podés realizar varios controles por día.</p>
          <label>Kilometraje<input aria-label="Kilometraje" type="number" min="0" max="2147483647" step="1" value={form.km} onChange={e=>{kmEdited.current=true;set('km',e.target.value)}} required/><small>Última lectura precargada. Editá lo que cambió; puede mantenerse igual.</small></label>
          <label>Combustible<select value={form.combustible} onChange={e=>set('combustible',e.target.value)} required><option value="">Seleccioná</option>{AIRPORT_FUEL.map(t=><option key={t}>{t}</option>)}</select></label></div>
          <p>{answered} de {AIRPORT_ITEMS.length} controles respondidos. OK: cumple · NC: no cumple · NA: no aplica.</p>
          {[...new Set(AIRPORT_ITEMS.map(i=>i.group))].map(group=><div key={group}><h2>{group}</h2>{AIRPORT_ITEMS.filter(i=>i.group===group).map(item=><div className="airport-item" key={item.id}><strong id={`aero-${item.id}`}>{item.label}</strong><div role="group" aria-labelledby={`aero-${item.id}`}>{(item.allowNa?['ok','nc','critico','na']:['ok','nc','critico']).map(value=><button type="button" key={value} aria-pressed={form.respuestas[item.id]===value} className={`airport-answer ${form.respuestas[item.id]===value?value:''}`} onClick={()=>findings.choose(item,value,value==='na')}>{value.toUpperCase()}</button>)}</div>{form.observaciones_puntos[item.id]&&<small>{form.observaciones_puntos[item.id].texto}</small>}</div>)}</div>)}
          <label>Observaciones<textarea value={form.observaciones} maxLength={4000} onChange={e=>set('observaciones',e.target.value)} placeholder="Describí cada NC y justificá los puntos NA. Si todo está OK, podés dejarlo vacío."/></label>
          <label>Fotos opcionales (hasta 5, máximo 10 MB cada una)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{const files=[...e.target.files];if(files.length>5||files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>10*1024*1024)){setError('Elegí hasta 5 fotos JPG, PNG o WebP de hasta 10 MB.');e.target.value='';setPhotos([])}else{setPhotos(files);setError('')}}}/></label>
          {error&&<p role="alert" className="airport-error">{error}</p>}
          <button className="btn-primary" disabled={saving}>{saving?'Guardando…':'Guardar control'}</button>
        </fieldset></form>}
        <section className="airport-history"><h2>Historial del vehículo</h2>{historyLoading&&<p>Cargando historial…</p>}{historyError&&<p role="alert">{historyError}</p>}{!history.length&&!historyLoading&&!historyError&&<p>Todavía no hay controles de gran porte registrados.</p>}
          {history.length>100&&<p>Mostrando los últimos 100 controles. El informe del vehículo conserva el historial completo.</p>}
          {history.slice(0,100).map(check=><details key={check.id}><summary><span className={check.resultado==='con_novedades'?'airport-nc':'airport-ok'}>{check.resultado==='con_novedades'?'Con novedades':'Sin novedades'}</span> · {checklistDateTime(check.creado_at || check.fecha)} · {check.responsable}</summary><p>Km {check.km} · Combustible {check.combustible}</p><p>{check.observaciones||'Sin novedades informadas.'}</p><ul>{AIRPORT_ITEMS.map(i=><li key={i.id}>{i.label}: {check.respuestas[i.id]?.toUpperCase()||'—'}</li>)}</ul><Evidence check={check}/></details>)}
        </section></>}
    </>}{error&&<p role="alert" className="airport-error">{error}</p>}
  </section>
}
