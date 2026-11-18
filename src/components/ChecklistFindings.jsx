import React,{useEffect,useState} from 'react'
import {getTickets,createTicket,updateTicket} from '../lib/queries'
import {closedTicket} from '../lib/flotaModel'
import {useAuth} from '../lib/auth'

export function useChecklistFindings(vehicle,onAnswer){
 const {perfil}=useAuth(),[pending,P]=useState(null),[note,N]=useState(''),[tickets,T]=useState([]),[error,E]=useState(''),[busy,B]=useState(false)
 useEffect(()=>{let live=true;T([]);P(null);E('');if(vehicle?.id)getTickets({activo_id:vehicle.id}).then(ts=>{if(live)T(ts.filter(t=>!closedTicket(t)))}).catch(e=>{if(live)E(e.message)});return()=>{live=false}},[vehicle?.id])
 const choose=(item,value)=>{if(['nc','observado','critico'].includes(value)){if(!vehicle){E('Seleccioná primero el vehículo.');return}P({item,value});N('');E('')}else onAnswer(item,value,null)}
 const confirm=async()=>{if(busy||!note.trim())return;B(true);E('');try{
  const marker=`[CHECKLIST:${pending.item.id}]`
  const fresh=(await getTickets({activo_id:vehicle.id})).filter(t=>!closedTicket(t))
  const existing=fresh.find(t=>String(t.descripcion).includes(marker))
  const entry=`${new Date().toISOString()} · ${perfil?.nombre||'Operador'} · ${pending.value}: ${note.trim()}`
  const priority=pending.value==='critico'?'critica':'alta'
  const ticket=existing?await updateTicket(existing.id,{diagnostico:[existing.diagnostico,entry].filter(Boolean).join('\n\n'),prioridad:existing.prioridad==='critica'?'critica':priority}):await createTicket({tipo:'correctivo',prioridad:priority,estado:'abierto',categoria:'Vehiculos',activo_id:vehicle.id,activo_nombre:vehicle.nombre,sede_id:vehicle.sede_id,sede:vehicle.sede_nombre||vehicle.sede,creado_por:perfil?.id,descripcion:`${marker} ${pending.item.label} · ${vehicle.nombre}`,diagnostico:entry})
  T([...fresh.filter(t=>t.id!==existing?.id),ticket||{...existing,diagnostico:entry}]);onAnswer(pending.item,pending.value,{texto:note.trim(),ticket_id:ticket?.id||existing?.id});P(null)
 }catch(e){E(`No se pudo registrar el ticket: ${e.message}. La respuesta todavía no fue confirmada.`)}finally{B(false)}}
 const panel=<><section className="glass p-3" style={{margin:'12px 0'}}><h3>Novedades pendientes del vehículo</h3>{tickets.length?tickets.map(t=><details key={t.id}><summary>#{t.numero||t.id} · {t.descripcion} · {t.prioridad}</summary><p style={{whiteSpace:'pre-wrap'}}>{t.diagnostico}</p><p>Estado: {t.estado}</p></details>):<p>Sin tickets pendientes cargados.</p>}</section>{error&&<p role="alert">{error}</p>}{pending&&<div className="modal-overlay" style={{zIndex:100}}><div className="glass p-5" role="dialog" aria-modal="true" aria-label="Observación del punto" style={{background:'var(--surface)',width:'min(560px,95vw)'}}><h2>{pending.item.label} · {pending.value==='critico'?'Crítico':'No conforme'}</h2><p>Al confirmar se registra un ticket del vehículo o se agrega la novedad al ticket pendiente de este punto.</p><textarea autoFocus aria-label="Observación del punto" className="input-dark w-full" rows={5} value={note} onChange={e=>N(e.target.value)}/>{error&&<p role="alert">{error}</p>}<button type="button" className="btn-ghost" disabled={busy} onClick={()=>P(null)}>Cancelar</button><button type="button" className="btn-primary" disabled={busy||!note.trim()} onClick={confirm}>{busy?'Registrando…':'Confirmar observación y ticket'}</button></div></div>}</>
 return {choose,panel}
}
