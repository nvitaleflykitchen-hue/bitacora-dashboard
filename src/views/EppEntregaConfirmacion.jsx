import {useEffect,useState} from 'react'
import {CheckCircle2,Loader2,PackageCheck} from 'lucide-react'
import {useAuth} from '../lib/auth'
import LoginPage from '../components/LoginPage'
import {confirmarEntregaEpp,obtenerEntregaEpp} from '../lib/epp'

export default function EppEntregaConfirmacion({token}){
  const {user,loading}=useAuth();const [item,setItem]=useState(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false)
  useEffect(()=>{if(user)obtenerEntregaEpp(token).then(x=>x?setItem(x):setError('Esta entrega no corresponde a tu usuario Fly.')).catch(e=>setError(e.message))},[user,token])
  if(loading)return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin"/></div>
  if(!user)return <LoginPage/>
  const confirmar=async()=>{setBusy(true);setError('');try{await confirmarEntregaEpp(token);setItem(await obtenerEntregaEpp(token))}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <div style={{minHeight:'100vh',background:'#0a0a0e',display:'grid',placeItems:'center',padding:24,color:'#fff'}}><main className="glass p-6" style={{width:'min(480px,100%)',textAlign:'center'}}>{item?.estado==='confirmado'?<CheckCircle2 size={62} color="#39ff14"/>:<PackageCheck size={62} color="#39ff14"/>}<h1 className="font-title text-xl mt-3">{item?.estado==='confirmado'?'RECEPCIÓN CONFIRMADA':'CONFIRMAR RECEPCIÓN'}</h1>{error?<p style={{color:'var(--alert)',marginTop:18}}>{error}</p>:item&&<><h2 style={{fontSize:20,marginTop:22}}>{item.colaborador}</h2><p style={{marginTop:8}}>{item.codigo} · {item.producto}</p><p style={{color:'var(--text-dim)'}}>Talle: {item.talle||'Sin talle / Ajustable'} · Cantidad: {item.cantidad}</p><p style={{color:'var(--text-dim)'}}>{item.sede}</p>{item.estado==='confirmado'?<p style={{marginTop:18,color:'#39ff14'}}>Confirmado el {new Date(item.confirmado_at).toLocaleString('es-AR')}</p>:<button className="btn-primary mt-5" disabled={busy} onClick={confirmar}>{busy?'Confirmando...':'Sí, recibí este producto'}</button>}</>}</main></div>
}
