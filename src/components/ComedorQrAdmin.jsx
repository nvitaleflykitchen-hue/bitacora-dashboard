import React from 'react'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { comedorApi, comedorUrl, TEMAS_COMEDOR } from '../lib/comedorQr'

const empty={activo:false,coordinacion:{nombre:'',telefono:''},gerencia:{nombre:'',telefono:''}}
export default function ComedorQrAdmin({ sede }) {
  const {perfil}=useAuth()
  const [open,setOpen]=useState(false), [config,setConfig]=useState(empty), [reports,setReports]=useState([])
  const [error,setError]=useState(''), [busy,setBusy]=useState(false), [saved,setSaved]=useState(false)
  useEffect(()=>{setOpen(false);setConfig(empty);setReports([]);setError('');setSaved(false)},[sede.id])
  if(perfil?.rol!=='admin')return null
  async function load(){
    setOpen(true);setBusy(true);setError('')
    try{const [c,r]=await Promise.all([comedorApi({action:'config',sede_id:sede.id}),comedorApi({action:'reports',sede_id:sede.id})]);setConfig(c.config||empty);setSaved(!!c.config);setReports(r.items)}catch(e){setError(e.message)}finally{setBusy(false)}
  }
  async function save(e){
    e.preventDefault();setBusy(true);setError('')
    try{setConfig(await comedorApi({action:'save',sede_id:sede.id,activo:config.activo,coordinacion:config.coordinacion,gerencia:config.gerencia}));setSaved(true)}catch(e){setError(e.message)}finally{setBusy(false)}
  }
  async function print(){
    setBusy(true);setError('')
    try{
      const [{jsPDF},{default:QRCode}]=await Promise.all([import('jspdf'),import('qrcode')])
      const pdf=new jsPDF({unit:'mm',format:'a4'}), url=comedorUrl(config.token)
      pdf.setFontSize(24);pdf.text('Fly Kitchen',105,35,{align:'center'})
      pdf.setFontSize(19);pdf.text(pdf.splitTextToSize(sede.nombre,170),105,55,{align:'center'})
      pdf.setFontSize(16);pdf.text('Tu opinion nos ayuda a mejorar',105,90,{align:'center'})
      const qr=await QRCode.toDataURL(url,{width:700,margin:4})
      pdf.addImage(qr,'PNG',65,105,80,80)
      pdf.setFontSize(12);pdf.text(['Escanea para enviar novedades por tema','y contactar a Coordinacion o Gerencia.','No necesitas una cuenta.'],105,200,{align:'center'})
      pdf.save(`QR-comedor-${sede.id}.pdf`)
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <section className="glass" style={{padding:16,margin:'14px 0'}}>
    <button className="btn-ghost" onClick={()=>open?setOpen(false):load()}>QR del comedor · novedades de clientes</button>
    {open && <>
      <p>El QR abre un formulario sin cuenta. Solo se publican el nombre del comedor y estos dos contactos. Las novedades se consultan aquí.</p>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={save}><fieldset disabled={busy} style={{border:0,padding:0}}>
        {['coordinacion','gerencia'].map(key=><div key={key} style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:12}}>
          <label>{key==='gerencia'?'Gerencia':'Coordinación'} · nombre<input required maxLength={100} value={config[key].nombre} onChange={e=>{setSaved(false);setConfig(c=>({...c,[key]:{...c[key],nombre:e.target.value}}))}}/></label>
          <label>Teléfono con país (ej. 5493511234567)<input required inputMode="tel" pattern="[1-9][0-9]{9,14}" value={config[key].telefono} onChange={e=>{setSaved(false);setConfig(c=>({...c,[key]:{...c[key],telefono:e.target.value}}))}}/></label>
        </div>)}
        <label><input type="checkbox" checked={config.activo} onChange={e=>{setSaved(false);setConfig(c=>({...c,activo:e.target.checked}))}}/> Habilitar acceso público de este comedor</label>
        <div style={{display:'flex',gap:12,marginTop:12,flexWrap:'wrap'}}><button className="btn-primary" type="submit">Guardar contactos y estado</button>
          <button type="button" className="btn-ghost" onClick={print} disabled={!saved||!config.activo||!config.token}>Imprimir cartel QR · A4</button>
          {saved&&config.activo&&config.token&&<a className="btn-ghost" href={comedorUrl(config.token)} target="_blank" rel="noreferrer">Ver página del comedor</a>}
        </div>
      </fieldset></form>
      <h3>Novedades externas recibidas</h3><button className="btn-ghost" disabled={busy} onClick={load}>Actualizar</button>
      {!busy&&!reports.length&&<p>Sin novedades externas recibidas.</p>}
      {reports.map(r=><article key={r.id} style={{borderTop:'1px solid var(--border)',padding:'12px 0'}}><strong>COM-{String(r.numero).padStart(6,'0')} · {r.nombre}</strong><p>{new Date(r.created_at).toLocaleString('es-AR')} · {[r.empresa,r.contacto].filter(Boolean).join(' · ')} · Origen: QR público</p>{r.items.map(i=><p key={i.tema} style={{whiteSpace:'pre-wrap'}}><strong>{TEMAS_COMEDOR.find(t=>t[0]===i.tema)?.[1]}: </strong>{i.detalle}</p>)}</article>)}
      {reports.length>0&&reports.length%50===0&&<button className="btn-ghost" disabled={busy} onClick={async()=>{setBusy(true);try{const r=await comedorApi({action:'reports',sede_id:sede.id,offset:reports.length});setReports(old=>[...old,...r.items])}catch(e){setError(e.message)}finally{setBusy(false)}}}>Cargar anteriores</button>}
    </>}
  </section>
}
