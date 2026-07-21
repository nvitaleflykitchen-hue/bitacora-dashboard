import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldX, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'

export default function CredencialVerificacion({ token }) {
  const [data,setData]=useState(null), [loading,setLoading]=useState(true), [error,setError]=useState(false)
  useEffect(()=>{ supabase.rpc('verificar_credencial',{p_token:token}).then(({data,error})=>{
    if(error || !data?.length) setError(true); else setData(data[0]); setLoading(false)
  }) },[token])
  const valida = data?.estado === 'activa'
  const descargarContacto = () => {
    const escape = value => String(value || '').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')
    const lines=['BEGIN:VCARD','VERSION:3.0',`FN:${escape(data.nombre)}`,`ORG:${escape(data.empresa)}`,`TITLE:${escape(data.puesto)}`]
    if(data.telefono) lines.push(`TEL;TYPE=WORK,VOICE:${escape(data.telefono)}`)
    if(data.email) lines.push(`EMAIL;TYPE=WORK:${escape(data.email)}`)
    lines.push('END:VCARD')
    const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'text/vcard;charset=utf-8'}));link.download=`${data.nombre.replace(/\s+/g,'-')}.vcf`;link.click();URL.revokeObjectURL(link.href)
  }
  return <div style={{ minHeight:'100vh', background:'#f2f2f0', display:'grid', placeItems:'center', padding:24, fontFamily:'Arial,sans-serif' }}>
    <main style={{ width:'min(440px,100%)', background:'#fff', color:'#111', borderRadius:22, padding:'34px 28px', textAlign:'center', boxShadow:'0 20px 70px rgba(0,0,0,.16)' }}>
      <img src="/fly-kitchen-credencial.png" alt="Fly Kitchen" style={{ width:260, maxWidth:'90%', margin:'0 auto 28px' }}/>
      {loading ? <><Loader2 size={42} style={{ animation:'spin 1s linear infinite', color:'#eb6600' }}/><p>Verificando credencial…</p></> : error ? <><ShieldX size={58} color="#b91c1c"/><h1 style={{ color:'#b91c1c' }}>CREDENCIAL NO ENCONTRADA</h1><p>El código escaneado no corresponde a una credencial emitida por Fly Kitchen.</p></> : <>
        {valida ? <ShieldCheck size={62} color="#16803b"/> : <ShieldX size={62} color="#b91c1c"/>}
        <h1 style={{ color:valida?'#16803b':'#b91c1c', fontSize:24 }}>{valida?'CREDENCIAL VÁLIDA':`CREDENCIAL ${String(data.estado).toUpperCase()}`}</h1>
        <h2 style={{ margin:'24px 0 6px', fontSize:22, color:'#111' }}>{data.nombre}</h2><p style={{ margin:4, color:'#333' }}>{data.puesto}</p><p style={{ fontWeight:700, color:'#111' }}>{data.empresa}</p>
        <p style={{ marginTop:24, color:'#666' }}>Vigente hasta {format(new Date(`${data.fecha_vencimiento}T12:00:00`),'dd/MM/yyyy')}</p>
        {valida && (data.telefono || data.email) && <button onClick={descargarContacto} style={{marginTop:12,border:0,borderRadius:10,padding:'12px 18px',background:'#eb6600',color:'#fff',fontWeight:700,cursor:'pointer'}}>Guardar contacto</button>}
      </>}
    </main>
  </div>
}
