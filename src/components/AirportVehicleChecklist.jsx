import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import { AIRPORT_ITEMS, AIRPORT_SHIFTS, AIRPORT_FUEL, AIRPORT_VEHICLES, airportToday, validateAirportChecklist } from '../lib/airportChecklist'
import { loadAirportVehicles, loadAirportHistory, saveAirportChecklist, uploadAirportPhoto, loadAirportPhotos } from '../lib/airportChecklistApi'
import './AirportVehicleChecklist.css'

const emptyForm=()=>({turno:'',km:'',combustible:'',respuestas:{},observaciones:''})
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
  const submitLock=useRef(false)
  const requestId=useRef(crypto.randomUUID())
  const selected=vehicles.find(v=>v.id===selectedId)
  const identity=AIRPORT_VEHICLES.find(v=>v.id===selectedId)
  useEffect(()=>{
    let active=true;setLoading(true);setError('')
    loadAirportVehicles().then(v=>{if(active)setVehicles(v||[])}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[perfil?.id])
  useEffect(()=>{setSelectedId(activoId||'')},[activoId])
  useEffect(()=>{
    setForm(emptyForm());setPhotos([]);setSaved(null);setHistory([]);setHistoryError('');requestId.current=crypto.randomUUID()
    if(!selectedId)return
    let active=true;setHistoryLoading(true)
    loadAirportHistory(selectedId).then(h=>{if(active)setHistory(h||[])}).catch(e=>{if(active)setHistoryError(e.message)}).finally(()=>{if(active)setHistoryLoading(false)})
    return()=>{active=false}
  },[selectedId])
  const set=(key,value)=>setForm(f=>({...f,[key]:value}))
  const answered=AIRPORT_ITEMS.filter(i=>form.respuestas[i.id]).length
  const duplicate=history.find(c=>c.fecha===airportToday()&&c.turno===form.turno)
  async function uploadPending(check) {
    const pending=[]
    for(const photo of photos){try{await uploadAirportPhoto(perfil.id,check.id,photo)}catch{pending.push(photo)}}
    setPhotos(pending)
    if(pending.length) setError(`El control quedó guardado. No se pudieron subir ${pending.length} fotos; podés reintentar sin duplicarlo.`)
  }
  async function submit(event) {
    event.preventDefault()
    if(submitLock.current||!selected||selected.puede_controlar===false)return
    const invalid=validateAirportChecklist(form)
    if(invalid){setError(invalid);return}
    submitLock.current=true;setSaving(true);setError('')
    try {
      const check=await saveAirportChecklist(requestId.current,selected.id,form)
      setSaved(check);setHistory(h=>[check,...h.filter(c=>c.id!==check.id)])
      await uploadPending(check)
    } catch(e){setError(e.message)}finally{setSaving(false);submitLock.current=false}
  }
  return <section className="airport-checklist">
    <header><div><p className="airport-eyebrow">FLYKITCHEN · AEROPUERTOS</p><h1>Control de vehículos de gran porte</h1><p>Checklist de inicio de turno</p></div>{onBack&&<button type="button" className="btn-ghost" disabled={saving} onClick={onBack}>Volver</button>}</header>
    {loading?<p role="status">Cargando vehículos asignados…</p>:<>
      {!activoId&&<label>Vehículo<select aria-label="Vehículo de gran porte" value={selectedId} disabled={saving} onChange={e=>{setSelectedId(e.target.value);setError('')}}><option value="">Seleccioná una unidad</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.nombre}</option>)}</select></label>}
      {!vehicles.length&&!error&&<p>No tenés vehículos de gran porte asignados a tus sedes.</p>}
      {activoId&&!selected&&!error&&<p role="alert">El vehículo no está disponible para tu cuenta o no pertenece a tus sedes.</p>}
      {selected&&<><div className="airport-identity"><h2>{identity?.plate}</h2><p>{selected.nombre} · {selected.sede_nombre||`Sede ${selected.sede_id}`}</p><p>Estado en Flota: <strong>{String(selected.estado||'sin informar').replaceAll('_',' ')}</strong></p><p>Podés realizar el control también durante una reparación. Guardarlo no modifica el estado de mantenimiento.</p></div>
        {saved?<div className="airport-saved" role="status"><h2>Control guardado</h2><p>{saved.fecha} · Turno {saved.turno} · {saved.resultado==='con_novedades'?'Con novedades':'Sin novedades'}</p><p>Responsable: {saved.responsable}</p>
          {photos.length>0&&<button disabled={saving} className="btn-primary" onClick={async()=>{setSaving(true);setError('');try{await uploadPending(saved)}finally{setSaving(false)}}}>Reintentar fotos pendientes</button>}
          {!photos.length&&<button className="btn-ghost" onClick={()=>{setSaved(null);setForm(emptyForm());requestId.current=crypto.randomUUID()}}>Otro turno</button>}</div>:
        <form onSubmit={submit}>{selected.puede_controlar===false&&<p>Tu acceso permite consultar el historial, sin cargar controles.</p>}<fieldset disabled={saving||selected.puede_controlar===false}><legend>Datos del control</legend><div className="airport-fields"><label>Responsable<input value={perfil?.nombre||''} readOnly/></label><label>Fecha<input value={airportToday()} readOnly/></label>
          <label>Turno<select value={form.turno} onChange={e=>set('turno',e.target.value)} required><option value="">Seleccioná</option>{AIRPORT_SHIFTS.map(t=><option key={t}>{t}</option>)}</select></label>
          <label>Kilometraje<input type="number" min="0" max="2147483647" step="1" value={form.km} onChange={e=>set('km',e.target.value)} required/></label>
          <label>Combustible<select value={form.combustible} onChange={e=>set('combustible',e.target.value)} required><option value="">Seleccioná</option>{AIRPORT_FUEL.map(t=><option key={t}>{t}</option>)}</select></label></div>
          <p>{answered} de {AIRPORT_ITEMS.length} controles respondidos. OK: cumple · NC: no cumple · NA: no aplica.</p>
          {[...new Set(AIRPORT_ITEMS.map(i=>i.group))].map(group=><div key={group}><h2>{group}</h2>{AIRPORT_ITEMS.filter(i=>i.group===group).map(item=><div className="airport-item" key={item.id}><strong id={`aero-${item.id}`}>{item.label}</strong><div role="group" aria-labelledby={`aero-${item.id}`}>{(item.allowNa?['ok','nc','na']:['ok','nc']).map(value=><button type="button" key={value} aria-pressed={form.respuestas[item.id]===value} className={`airport-answer ${form.respuestas[item.id]===value?value:''}`} onClick={()=>setForm(f=>({...f,respuestas:{...f.respuestas,[item.id]:value}}))}>{value.toUpperCase()}</button>)}</div></div>)}</div>)}
          <label>Observaciones<textarea value={form.observaciones} maxLength={4000} onChange={e=>set('observaciones',e.target.value)} placeholder="Describí cada NC y justificá los puntos NA. Si todo está OK, podés dejarlo vacío."/></label>
          <label>Fotos opcionales (hasta 5, máximo 10 MB cada una)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{const files=[...e.target.files];if(files.length>5||files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>10*1024*1024)){setError('Elegí hasta 5 fotos JPG, PNG o WebP de hasta 10 MB.');e.target.value='';setPhotos([])}else{setPhotos(files);setError('')}}}/></label>
          {duplicate&&<p role="status">Este vehículo ya tiene un control del turno {form.turno} de hoy. Consultalo en el historial.</p>}
          <button className="btn-primary" disabled={saving||!!duplicate}>{saving?'Guardando…':'Guardar control'}</button>
        </fieldset></form>}
        <section className="airport-history"><h2>Historial del vehículo</h2>{historyLoading&&<p>Cargando historial…</p>}{historyError&&<p role="alert">{historyError}</p>}{!history.length&&!historyLoading&&!historyError&&<p>Todavía no hay controles de gran porte registrados.</p>}
          {history.length>100&&<p>Mostrando los últimos 100 controles. El informe del vehículo conserva el historial completo.</p>}
          {history.slice(0,100).map(check=><details key={check.id}><summary><span className={check.resultado==='con_novedades'?'airport-nc':'airport-ok'}>{check.resultado==='con_novedades'?'Con novedades':'Sin novedades'}</span> · {check.fecha} · {check.turno} · {check.responsable}</summary><p>Km {check.km} · Combustible {check.combustible}</p><p>{check.observaciones||'Sin novedades informadas.'}</p><ul>{AIRPORT_ITEMS.map(i=><li key={i.id}>{i.label}: {check.respuestas[i.id]?.toUpperCase()||'—'}</li>)}</ul><Evidence check={check}/></details>)}
        </section></>}
    </>}{error&&<p role="alert" className="airport-error">{error}</p>}
  </section>
}
