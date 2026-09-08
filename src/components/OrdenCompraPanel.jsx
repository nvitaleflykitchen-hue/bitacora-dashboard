import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Download, FileUp, Mail, MessageCircle, QrCode, Send } from 'lucide-react'
import { aprobarRequerimientoCompra, cargarOrdenCompra, getComprasProveedores, marcarOrdenCompraEnviada, vendorEmailHref, vendorWhatsappHref } from '../lib/comprasWorkflow'
import { confirmar, toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'

export default function OrdenCompraPanel({ requerimiento, perfil, canManage, isAdmin, onChanged }) {
  const [proveedores,setProveedores]=useState([])
  const [proveedorId,setProveedorId]=useState(requerimiento.proveedor_id||'')
  const [numero,setNumero]=useState(requerimiento.orden_compra_numero||'')
  const [fechaEstimada,setFechaEstimada]=useState(requerimiento.fecha_estimada_entrega||'')
  const [notas,setNotas]=useState(requerimiento.gestion_compras_notas||'')
  const [processing,setProcessing]=useState(false)
  const fileRef=useRef(null)
  useEffect(()=>{ if(canManage) getComprasProveedores().then(setProveedores).catch(()=>{}) },[canManage])
  useEffect(()=>{ setProveedorId(requerimiento.proveedor_id||'');setNumero(requerimiento.orden_compra_numero||'');setFechaEstimada(requerimiento.fecha_estimada_entrega||'');setNotas(requerimiento.gestion_compras_notas||'') },[requerimiento])
  const proveedor=useMemo(()=>proveedores.find(item=>item.id===proveedorId)||null,[proveedores,proveedorId])
  const run=async action=>{setProcessing(true);try{const updated=await action();onChanged(updated)}catch(error){toast.error(mensajeError(error))}finally{setProcessing(false)}}
  const approve=async()=>{if(!await confirmar({titulo:'Aprobar requerimiento',mensaje:'Tu identidad, fecha y hora quedarán registradas como firma digital interna.',confirmText:'Aprobar y firmar'}))return;await run(async()=>{const r=await aprobarRequerimientoCompra(requerimiento.id);toast.ok('Requerimiento aprobado y firmado.');return r})}
  const upload=async file=>{if(!file)return;await run(async()=>{const r=await cargarOrdenCompra({requerimiento,proveedorId,numero,fechaEstimada,notas,file,uploadedBy:perfil?.id||'usuario'});toast.ok('Orden cargada con el QR de seguimiento.');return r});if(fileRef.current)fileRef.current.value=''}
  const share=async channel=>{if(!proveedor)return;window.open(channel==='whatsapp'?vendorWhatsappHref(proveedor,requerimiento):vendorEmailHref(proveedor,requerimiento),'_blank','noopener,noreferrer');if(!await confirmar({titulo:'Confirmar envío al proveedor',mensaje:'¿Confirmás que enviaste la orden? El pedido pasará automáticamente a EN CURSO · EN COMPRA.',confirmText:'Sí, fue enviada'}))return;await run(async()=>{const r=await marcarOrdenCompraEnviada(requerimiento.id);toast.ok('Pedido en curso · en compra.');return r})}
  return <section style={{padding:'12px',border:'1px solid rgba(167,139,250,.28)',background:'rgba(167,139,250,.055)',borderRadius:4}}>
    <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:8}}><QrCode size={15} style={{color:'#A78BFA'}}/><strong style={{color:'var(--text)',fontSize:'.76rem'}}>Orden de compra y seguimiento QR</strong></div>
    {requerimiento.estado==='Pendiente'&&<div>{isAdmin?<button type="button" className="btn-primary" disabled={processing} onClick={approve}><CheckCircle2 size={14}/> Aprobar y firmar</button>:<p style={{color:'var(--text-dim)',fontSize:'.68rem'}}>Pendiente de aprobación y firma de un administrador.</p>}</div>}
    {requerimiento.aprobado_por_nombre&&<p style={{color:'#60A5FA',fontSize:'.65rem',marginBottom:8}}>Aprobado por {requerimiento.aprobado_por_nombre} · {new Date(requerimiento.aprobado_at).toLocaleString('es-AR')}</p>}
    {requerimiento.proveedor_seleccionado&&<p style={{color:'var(--text-dim)',fontSize:'.66rem',marginBottom:8}}>Proveedor: <strong style={{color:'var(--text)'}}>{requerimiento.proveedor_seleccionado}</strong>{requerimiento.orden_compra_numero?` · OC ${requerimiento.orden_compra_numero}`:''}</p>}
    {requerimiento.estado==='Aprobado'&&canManage&&<div style={{display:'grid',gridTemplateColumns:'1.4fr .8fr .8fr',gap:8,alignItems:'end'}}>
      <div><label style={L}>Proveedor *</label><select className="input-dark" value={proveedorId} onChange={e=>setProveedorId(e.target.value)}><option value="">Seleccionar de la lista</option>{proveedores.map(item=><option key={item.id} value={item.id}>{item.razon_social}{item.cuit?` · ${item.cuit}`:''}</option>)}</select></div>
      <div><label style={L}>N° orden de compra</label><input className="input-dark" value={numero} onChange={e=>setNumero(e.target.value)} placeholder="00000-00029234"/></div>
      <div><label style={L}>Entrega estimada</label><input type="date" className="input-dark" value={fechaEstimada} onChange={e=>setFechaEstimada(e.target.value)}/></div>
      <div style={{gridColumn:'1 / span 2'}}><label style={L}>Registro / notas de Compras</label><input className="input-dark" value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Condiciones, seguimiento o referencia interna"/></div>
      <button type="button" className="btn-primary" disabled={processing||!proveedorId} onClick={()=>fileRef.current?.click()}><FileUp size={14}/> {requerimiento.orden_compra_url?'Reemplazar OC':'Cargar OC PDF'}</button>
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={e=>upload(e.target.files?.[0])}/>
    </div>}
    {requerimiento.orden_compra_url&&<div style={{marginTop:10,paddingTop:10,borderTop:'1px solid rgba(255,255,255,.08)'}}>
      <p style={{color:'var(--phosphor)',fontSize:'.68rem',marginBottom:8}}>QR agregado automáticamente · {requerimiento.orden_compra_nombre}</p>
      {requerimiento.orden_compra_generada_por_nombre&&<p style={{color:'var(--text-dim)',fontSize:'.62rem',marginBottom:8}}>Registrada por {requerimiento.orden_compra_generada_por_nombre} · {new Date(requerimiento.orden_compra_generada_at).toLocaleString('es-AR')}</p>}
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        <a className="btn-ghost" href={requerimiento.orden_compra_url} download target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:5,textDecoration:'none'}}><Download size={13}/> Descargar</a>
        {requerimiento.estado==='Aprobado'&&canManage&&<><button type="button" className="btn-ghost" disabled={processing} onClick={()=>share('whatsapp')} style={{color:'#25D366'}}><MessageCircle size={13}/> WhatsApp proveedor</button><button type="button" className="btn-ghost" disabled={processing} onClick={()=>share('email')} style={{color:'#60A5FA'}}><Mail size={13}/> Email proveedor</button></>}
      </div>
    </div>}
    {requerimiento.estado==='En compra'&&<p style={STATUS}><Send size={13}/> Orden enviada{requerimiento.orden_compra_enviada_por_nombre?` por ${requerimiento.orden_compra_enviada_por_nombre}`:''}. A la espera de recepción con QR.</p>}
    {requerimiento.estado==='Recibido'&&<p style={STATUS}><CheckCircle2 size={13}/> Recibido por {requerimiento.recibido_por_nombre||'Depósito'}. Falta la lectura del solicitante.</p>}
    {requerimiento.estado==='Cumplido'&&<p style={STATUS}><CheckCircle2 size={13}/> Entrega final confirmada por {requerimiento.cumplido_por_nombre||requerimiento.solicitante}.</p>}
  </section>
}
const L={display:'block',color:'var(--text-dim)',fontSize:'.6rem',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4}
const STATUS={display:'flex',alignItems:'center',gap:6,color:'var(--phosphor)',fontSize:'.68rem',marginTop:8}
