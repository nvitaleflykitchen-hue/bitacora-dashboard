import React, {useCallback,useEffect,useState,useRef} from 'react'
import {supabase} from '../lib/supabase'
export default function PaseVerificacion({token,onClose}) {
 const request=useRef(0)
 const invalidate=useCallback(()=>{request.current+=1},[])
 const [now,setNow]=useState(Date.now())
 const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true)
 const load=useCallback(async()=>{const id=++request.current;setLoading(true);setError('');try{const r=await supabase.rpc('verificar_pase_acompanado',{p_token:token});if(id!==request.current)return;if(r.error||!r.data)throw Error('No se pudo validar este pase.');setData(r.data)}catch(e){if(id===request.current){setData(null);setError(e.message)}}finally{if(id===request.current)setLoading(false)}},[token])
 useEffect(()=>{load();const timer=setInterval(load,60000);const tick=setInterval(()=>setNow(Date.now()),1000);return()=>{invalidate();clearInterval(timer);clearInterval(tick)}},[load,invalidate])
 const current=data?.vigente && new Date(data.hasta).getTime()>now
 return <div style={{position:'fixed',inset:0,zIndex:13000,overflowY:'auto',background:'#f2f2f0',color:'#111',padding:20,boxSizing:'border-box'}}><main style={{maxWidth:480,margin:'0 auto',background:'#fff',padding:24,borderRadius:16}}>
 {onClose&&<button onClick={onClose}>Volver</button>}<h1>{data?.tipo==='visita'?'Visita acompañada':'Acceso temporal acompañado'}</h1>
 <button disabled={loading} onClick={load}>Volver a verificar</button>
 {loading?<p>Verificando…</p>:error?<p role="alert">{error} No permitir el ingreso sin validar.</p>:<><h2 style={{color:current?'#166534':'#b91c1c'}}>{current?'VIGENTE · SÓLO CON ACOMPAÑANTE':'NO AUTORIZA EL INGRESO'}</h2><p>{data.codigo} · {data.estado}</p>{current&&<dl>{[['Titular',data.titular],['Acompañante',data.acompanante],['Sede',data.sede],['Sector',`${data.codigo_sector} · ${data.sector}`],['Clasificación',data.restringido?'Restringido':'General'],['Desde',new Date(data.desde).toLocaleString('es-AR')],['Hasta',new Date(data.hasta).toLocaleString('es-AR')]].map(([k,v])=><div key={k} style={{padding:'12px 0',borderTop:'1px solid #ddd'}}><dt>{k}</dt><dd style={{margin:0,fontWeight:700}}>{v}</dd></div>)}</dl>}</>}
 <p>Verificar la identidad del titular y la presencia del acompañante durante toda la permanencia. No permite circular solo, no concede acceso a otros sectores ni reemplaza habilitaciones aeroportuarias.</p>
 </main></div>
}
