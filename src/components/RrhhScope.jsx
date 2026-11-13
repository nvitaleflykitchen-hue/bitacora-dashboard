import React, { lazy, Suspense, useState } from 'react'
import { useAuth } from '../lib/auth'
import { isQualityOnlyProfile, isSafetyOnlyProfile } from '../lib/access'
const RrhhEmpresas=lazy(()=>import('../views/equipo/RrhhEmpresas'))
export default function RrhhScope({children}) {
 const {perfil}=useAuth()
 const [central,setCentral]=useState(false),[focus,setFocus]=useState(null)
 const allowed=['admin','editor'].includes(perfil?.rol)&&!isQualityOnlyProfile(perfil)&&!isSafetyOnlyProfile(perfil)
 if(central&&allowed)return <Suspense fallback={<p role="status">Cargando RRHH…</p>}><RrhhEmpresas onBack={()=>{setFocus(null);setCentral(false)}} onOpenPersona={id=>{setFocus(id);setCentral(false)}}/></Suspense>
 return <div style={{height:'100%',minHeight:0,display:'flex',flexDirection:'column'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',padding:'8px 16px',borderBottom:'1px solid var(--line)',background:'var(--surface)',flexShrink:0}}><span style={{fontSize:12,color:'var(--text-dim)'}}>Empresa · <strong>FlyKitchen</strong></span>{allowed&&<button className="btn-ghost" onClick={()=>{setFocus(null);setCentral(true)}}>Empresas · RRHH</button>}</div><div style={{flex:1,minHeight:0}}>{children(focus)}</div></div>
}
