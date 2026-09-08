import { useState } from 'react'
import { CheckCircle2, PackageCheck, QrCode } from 'lucide-react'
import { escanearSeguimientoCompra } from '../lib/comprasWorkflow'
import { mensajeError } from '../lib/errores'

export default function PurchaseTrackingView({ token }) {
  const [result,setResult]=useState(null)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  const register=async()=>{setLoading(true);setError('');try{setResult(await escanearSeguimientoCompra(token))}catch(e){setError(mensajeError(e))}finally{setLoading(false)}}
  return <main style={{minHeight:'100vh',background:'var(--abyss)',display:'grid',placeItems:'center',padding:'1rem'}}>
    <section className="glass" style={{width:'min(460px,100%)',padding:'1.4rem',border:'1px solid rgba(57,255,20,.25)',borderRadius:10,textAlign:'center'}}>
      <QrCode size={42} style={{color:'var(--phosphor)',margin:'0 auto 12px'}}/>
      <h1 style={{color:'var(--text)',fontSize:'1.12rem',fontWeight:800}}>Seguimiento de pedido</h1>
      {!result&&<><p style={{color:'var(--text-dim)',fontSize:'.76rem',lineHeight:1.5,margin:'9px 0 18px'}}>Confirmá la lectura. Si el pedido está en compra se registrará su ingreso a depósito; si ya fue recibido, el solicitante confirmará la entrega final.</p><button className="btn-primary" onClick={register} disabled={loading} style={{width:'100%',justifyContent:'center',padding:'.75rem'}}><PackageCheck size={16}/>{loading?'Registrando…':'Registrar lectura del QR'}</button></>}
      {error&&<p style={{color:'#F87171',fontSize:'.74rem',lineHeight:1.5,marginTop:14}}>{error}</p>}
      {result&&<div style={{marginTop:14,padding:14,background:'rgba(57,255,20,.07)',border:'1px solid rgba(57,255,20,.22)',borderRadius:6}}><CheckCircle2 size={30} style={{color:'var(--phosphor)',margin:'0 auto 8px'}}/><strong style={{color:'var(--text)',display:'block'}}>{result.estado==='Recibido'?'Pedido recibido en depósito':'Pedido finalizado · cumplido'}</strong><p style={{color:'var(--text-dim)',fontSize:'.7rem',marginTop:5}}>Requerimiento #{result.numero||result.id}</p></div>}
      <a href="/?view=requerimientos" style={{display:'inline-block',color:'var(--phosphor)',fontSize:'.7rem',marginTop:18}}>Volver a Compras</a>
    </section>
  </main>
}
