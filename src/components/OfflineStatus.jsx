import {useEffect,useState} from 'react'
import {Cloud,CloudOff,RefreshCw} from 'lucide-react'

export default function OfflineStatus(){
  const [online,setOnline]=useState(()=>navigator.onLine)
  const [updating,setUpdating]=useState(false)
  useEffect(()=>{
    const connected=()=>setOnline(true)
    const disconnected=()=>setOnline(false)
    window.addEventListener('online',connected)
    window.addEventListener('offline',disconnected)
    return()=>{window.removeEventListener('online',connected);window.removeEventListener('offline',disconnected)}
  },[])
  const update=async()=>{
    setUpdating(true)
    try{const registration=await navigator.serviceWorker?.getRegistration();await registration?.update();window.location.reload()}
    finally{setUpdating(false)}
  }
  return <div role="status" aria-live="polite" style={{position:'fixed',right:14,bottom:14,zIndex:10000,display:'flex',alignItems:'center',gap:8,padding:'8px 11px',border:`1px solid ${online?'rgba(57,255,20,.4)':'rgba(255,170,0,.65)'}`,background:'rgba(10,10,14,.94)',color:online?'#39ff14':'#ffaa00',fontSize:11,fontFamily:'monospace',boxShadow:'0 8px 28px rgba(0,0,0,.35)'}}>
    {online?<Cloud size={15}/>:<CloudOff size={15}/>}<span>{online?'EN LÍNEA':'SIN CONEXIÓN · TRABAJO LOCAL'}</span>
    {online&&<button aria-label="Buscar actualización" title="Buscar actualización" onClick={update} disabled={updating} style={{border:0,background:'transparent',color:'inherit',padding:0,cursor:'pointer'}}><RefreshCw size={13} className={updating?'animate-spin':''}/></button>}
  </div>
}
