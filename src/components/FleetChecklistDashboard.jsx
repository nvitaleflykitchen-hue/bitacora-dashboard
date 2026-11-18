import React,{useEffect,useState} from 'react'
import {useAuth} from '../lib/auth'
import {getActivos} from '../lib/queries'
import {supabase} from '../lib/supabase'
import {readAll} from '../lib/flotaReportData'
import {loadAirportHistory} from '../lib/airportChecklistApi'
import {isAirportVehicle} from '../lib/airportChecklist'
import {fleetToday,closedTicket,FLEET_TZ} from '../lib/flotaModel'
const day=v=>new Intl.DateTimeFormat('en-CA',{timeZone:FLEET_TZ}).format(new Date(v))
export default function FleetChecklistDashboard({onStart}){
 const {allowedSedeIds}=useAuth(),[vehicles,V]=useState([]),[checks,C]=useState([]),[tickets,T]=useState([]),[error,E]=useState(''),[busy,B]=useState(true)
 const [site,S]=useState(''),[vehicle,A]=useState(''),[from,F]=useState(fleetToday()),[to,U]=useState(fleetToday())
 const load=async()=>{B(true);E('');try{
  const vs=Array.isArray(allowedSedeIds)&&!allowedSedeIds.length?[]:await getActivos({tipo:'VEHICULO',...(allowedSedeIds?.length?{sedeIds:allowedSedeIds}:{})})
  const active=vs.filter(v=>!['baja','inactivo'].includes(v.estado));V(active);if(!active.length){C([]);T([]);return}
  const ids=active.map(v=>v.id)
  const [visits,ts,aero]=await Promise.all([
   readAll(supabase.from('mnt_visitas').select('*').in('activo_id',ids).like('observacion','CHECKLIST_VEHICULO::%').order('id')),
   readAll(supabase.from('mnt_tickets').select('*').in('activo_id',ids).order('id')),
   Promise.all(ids.filter(isAirportVehicle).map(loadAirportHistory))])
  C([...visits.flatMap(v=>{try{return [{...JSON.parse(v.observacion.slice('CHECKLIST_VEHICULO::'.length)),id:v.id,fecha:day(v.fecha)}]}catch{return []}}),...aero.flat().map(c=>({...c,conductor:c.responsable,estado:c.resultado}))]);T(ts)
 }catch(e){E(e.message)}finally{B(false)}}
 useEffect(()=>{load()},[allowedSedeIds])
 const visible=vehicles.filter(v=>(!site||String(v.sede_id)===site)&&(!vehicle||v.id===vehicle)),ids=new Set(visible.map(v=>v.id))
 const rows=checks.filter(c=>ids.has(c.activo_id)&&c.fecha>=from&&c.fecha<=to).sort((a,b)=>b.fecha.localeCompare(a.fecha))
 const today=new Set(checks.filter(c=>c.fecha===fleetToday()&&ids.has(c.activo_id)).map(c=>c.activo_id))
 const open=tickets.filter(t=>ids.has(t.activo_id)&&!closedTicket(t)),bad=rows.filter(c=>Object.values(c.respuestas||{}).some(a=>['nc','observado','critico'].includes(a)))
 const sites=[...new Map(vehicles.map(v=>[String(v.sede_id),v.sede_nombre||v.sede||'Sin sede'])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'es'))
 const counts={};rows.forEach(c=>Object.entries(c.respuestas||{}).forEach(([k,v])=>{if(['nc','observado','critico'].includes(v))counts[k]=(counts[k]||0)+1}))
 return <section aria-label="Tablero de checklists de flota" tabIndex={0} style={{padding:24, flex:1, minHeight:0, overflowY:'auto'}}><h2>Tablero de checklists de flota</h2><p>Flota general y gran porte · Estado actual y controles del período</p>
 <div style={{display:'flex',flexWrap:'wrap',gap:12,margin:'16px 0'}}>
 <label>Sede<select aria-label="Sede del tablero" className="input-dark" value={site} onChange={e=>{S(e.target.value);A('')}}><option value="">Todas las sedes</option>{sites.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
 <label>Vehículo<select aria-label="Vehículo del tablero" className="input-dark" value={vehicle} onChange={e=>A(e.target.value)}><option value="">Todos los vehículos</option>{vehicles.filter(v=>!site||String(v.sede_id)===site).map(v=><option key={v.id} value={v.id}>{v.nombre}</option>)}</select></label>
 <label>Desde<input className="input-dark" type="date" value={from} onChange={e=>F(e.target.value)}/></label><label>Hasta<input className="input-dark" type="date" value={to} onChange={e=>U(e.target.value)}/></label>
 <button className="btn-ghost" disabled={busy} onClick={load}>Actualizar tablero</button><button className="btn-primary" onClick={()=>onStart(vehicle)}>Nuevo checklist</button></div>
 {error?<p role="alert">No se pudo completar el tablero: {error}</p>:busy?<p>Cargando controles…</p>:<>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>{[
 ['Unidades activas',visible.length],['Operativas ahora',visible.filter(v=>v.estado==='operativo').length],['Controladas hoy',`${today.size}/${visible.length}`],['Pendientes hoy',visible.length-today.size],['Controles del período',rows.length],['Con novedades',bad.length],['Tickets pendientes',open.length],['Tickets críticos',open.filter(t=>t.prioridad==='critica').length]
 ].map(([label,value])=><article className="glass p-4" key={label}><p>{label}</p><strong style={{fontSize:28,color:'var(--phosphor)'}}>{value}</strong></article>)}</div>
 <p style={{marginTop:12}}>Controladas y pendientes cuentan unidades únicas hoy, incluyendo las que están en reparación. Completar un checklist no habilita el vehículo.</p>
 <h3 style={{marginTop:24}}>Problemas más frecuentes del período</h3>{Object.keys(counts).length?Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,n])=><p key={k}>{k.replaceAll('_',' ')}: {n}</p>):<p>Sin no conformidades registradas en el período.</p>}
 <h3 style={{marginTop:24}}>Estado por vehículo</h3>{visible.map(v=>{const last=checks.filter(c=>c.activo_id===v.id).sort((a,b)=>b.fecha.localeCompare(a.fecha))[0];return <div className="glass p-3" key={v.id} style={{marginTop:8,display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><strong>{v.nombre}</strong><p>{v.sede_nombre} · {v.estado} · Último control: {last?.fecha||'Sin controles'} · {today.has(v.id)?'Controlado hoy':'Pendiente hoy'}</p></div><button className="btn-ghost" onClick={()=>onStart(v.id)}>Realizar control</button></div>})}
 <h3 style={{marginTop:24}}>Historial del período ({rows.length})</h3>{rows.map(c=><details className="glass p-3" key={c.id}><summary>{c.fecha} · {vehicles.find(v=>v.id===c.activo_id)?.nombre} · {c.conductor||'Sin responsable'} · {c.estado}</summary><p>{c.observaciones||'Sin observaciones'}</p>{Object.entries(c.respuestas||{}).map(([k,v])=><p key={k}>{k}: {v}</p>)}</details>)}
 </>}
 </section>
}
