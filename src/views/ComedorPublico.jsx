import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { comedorApi, TEMAS_COMEDOR } from '../lib/comedorQr'
import './ComedorPublico.css'

export default function ComedorPublico({ token }) {
  const [site,setSite]=useState(null), [error,setError]=useState(''), [loading,setLoading]=useState(true)
  const [name,setName]=useState(''), [contact,setContact]=useState(''), [company,setCompany]=useState('')
  const [details,setDetails]=useState({}), [sending,setSending]=useState(false), [receipt,setReceipt]=useState(null)
  const requestId=useRef(crypto.randomUUID()), busy=useRef(false)
  useEffect(()=>{
    let live=true
    setLoading(true); setError(''); setSite(null)
    comedorApi({action:'info',token}).then(data=>{if(live)setSite(data)}).catch(()=>{if(live)setError('Este QR no está disponible. Consultá al responsable del comedor.')}).finally(()=>{if(live)setLoading(false)})
    return ()=>{live=false}
  },[token])
  async function submit(e) {
    e.preventDefault()
    if(busy.current)return
    const items=Object.entries(details).map(([tema,detalle])=>({tema,detalle:detalle.trim()}))
    if(!items.length || items.some(i=>i.detalle.length<5)){setError('Seleccioná un tema y describí cada novedad con al menos 5 caracteres.');return}
    busy.current=true;setSending(true);setError('')
    try {setReceipt(await comedorApi({action:'submit',token,request_id:requestId.current,nombre:name.trim(),contacto:contact.trim(),empresa:company.trim(),items}))}
    catch(e){setError(e.message)}finally{busy.current=false;setSending(false)}
  }
  return <main className="comedor-publico"><div className="comedor-shell">
    <header><img src="/fly-kitchen-credencial.png" alt="Fly Kitchen"/><p>Canal de novedades del comedor</p><h1>{site?.nombre || 'Fly Gestión'}</h1></header>
    {loading && <p role="status">Consultando comedor…</p>}
    {error && <p className="comedor-error" role="alert">{error}</p>}
    {site && <>
      <section className="comedor-card"><h2>Contactanos</h2><div className="comedor-contacts">
        {site.contactos.map(c=><div key={c.telefono}><strong>{c.nombre}</strong><p>{c.rol}</p><a href={`https://wa.me/${c.telefono}?text=${encodeURIComponent("Consulta sobre "+site.nombre)}`} target="_blank" rel="noreferrer">WhatsApp</a> <a href={`tel:+${c.telefono}`}>Llamar</a></div>)}
      </div></section>
      <section className="comedor-card">{receipt ? <div role="status"><h2>Novedad recibida</h2><p>Tu número de referencia es <strong>{receipt.codigo}</strong>.</p><p>Gracias. El equipo revisará tu reporte.</p><button onClick={()=>{setReceipt(null);setDetails({});requestId.current=crypto.randomUUID()}}>Enviar otra novedad</button></div> : <form onSubmit={submit}>
        <h2>Contanos qué pasó</h2><p>No necesitás una cuenta. Podés incluir varios temas en un mismo reporte.</p>
        <label>Tu nombre<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label>
        <label>Empresa o función (opcional)<input maxLength={120} value={company} onChange={e=>setCompany(e.target.value)}/></label>
        <label>Teléfono o correo para responderte (opcional)<input maxLength={160} value={contact} onChange={e=>setContact(e.target.value)}/></label>
        <fieldset disabled={sending}><legend>Temas de tu novedad</legend>{TEMAS_COMEDOR.map(([key,label])=><div className="comedor-topic" key={key}>
          <label className="comedor-check"><input type="checkbox" checked={key in details} onChange={e=>setDetails(old=>{const next={...old};if(e.target.checked)next[key]='';else delete next[key];return next})}/>{label}</label>
          {key in details && <label>Detalle: {label}<textarea required minLength={5} maxLength={2000} value={details[key]} onChange={e=>setDetails(old=>({...old,[key]:e.target.value}))}/></label>}
        </div>)}</fieldset>
        <p className="comedor-note">Los datos se usarán para gestionar esta novedad. No incluyas contraseñas ni información médica. Si necesitás atención inmediata, llamá a Coordinación.</p>
        <button type="submit" disabled={sending}>{sending?'Enviando…':'Enviar novedad'}</button>
      </form>}</section>
    </>}
  </div></main>
}
