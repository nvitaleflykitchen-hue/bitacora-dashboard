import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import { seguridadRpc, parseSeguridadQr, escanearSeguridad } from '../lib/seguridad'
import { descargarPase } from '../lib/pasesAcompanados'
import AssetQrScannerModal from '../components/AssetQrScannerModal'
import { ScanLine, ShieldCheck, MapPin, Users, CreditCard, ClipboardCheck } from 'lucide-react'
import SeguridadScanResult from '../components/SeguridadScanResult'
import './SeguridadPorteria.css'
const time = value => value ? new Date(value).toLocaleString('es-AR') : 'Pendiente'
const localTime = () => { const d = new Date(Date.now() + 4 * 3600000); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0,16) }
function Modal({ title, children, onClose, busy }) {
  const ref = useRef(null)
  useEffect(() => { const d=ref.current; d.showModal(); return () => d.close() }, [])
  return <dialog ref={ref} aria-label={title} onCancel={e=>{e.preventDefault();if(!busy)onClose()}} style={{ background:'var(--surface)',color:'var(--text)',width:'min(94vw,600px)',maxHeight:'90dvh',overflowY:'auto',padding:20,borderRadius:10 }}><h2 className="text-lg font-bold mb-4">{title}</h2>{children}</dialog>
}
export default function SeguridadPorteria({ embedded = false }) {
  const { perfil, signOut } = useAuth()
  const [sedes,setSedes]=useState([]),[sede,setSede]=useState(''),[data,setData]=useState({sectores:[],personas:[],pases:[],entregas:[]})
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[scan,setScan]=useState(false),[result,setResult]=useState(null),[form,setForm]=useState(null),[closing,setClosing]=useState(null),[companions,setCompanions]=useState([]),[companionsLoading,setCompanionsLoading]=useState(false),[message,setMessage]=useState('')
  const opRef=useRef(false)
  useEffect(()=>{let active=true;seguridadRpc('sedes').then(rows=>{if(active){setSedes(rows);setSede(rows[0]?.id||'');if(!rows.length)setLoading(false)}}).catch(e=>{if(active){setError(e.message);setLoading(false)}});return()=>{active=false}},[])
  const load=useCallback(async()=>{if(!sede)return;setLoading(true);try{setData(await seguridadRpc('listar',sede));setError('')}catch(e){setError(e.message);setData({sectores:[],personas:[],pases:[],entregas:[]})}finally{setLoading(false)}},[sede])
  useEffect(()=>{setResult(null);load()},[load])
  const sector=form?.sector
  useEffect(()=>{let active=true;setCompanions([]);if(!sector)return;setCompanionsLoading(true);seguridadRpc('acompanantes',sede,{sector}).then(rows=>{if(active)setCompanions(rows)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setCompanionsLoading(false)});return()=>{active=false}},[sector,sede])
  const run=async fn=>{if(opRef.current)return;opRef.current=true;setBusy(true);setError('');setMessage('');try{await fn()}catch(e){setError(e.message)}finally{opRef.current=false;setBusy(false)}}
  const open=pase=>{setError('');setForm({pase:pase?.id||'',persona:'',visitante:'',empresa:'',dni:'',patente:'',sector:'',acompanante:'',hasta:localTime(),autorizacion:false,dni_recibido:false,induccion:false})}
  const change=(key,value)=>setForm(f=>({...f,[key]:value,...(key==='sector'?{acompanante:''}:{})}))
  const submit=e=>{e.preventDefault();run(async()=>{await seguridadRpc('entregar',sede,{...form,hasta:new Date(form.hasta).toISOString()});setForm(null);setMessage('Pase entregado. La visita figura en las entregas abiertas.');await load()})}
  const onScan=qr=>{setScan(false);setResult(null);run(async()=>{setResult(await escanearSeguridad(sede,qr))})}
  const field=(key,label,props={})=><label className="block mb-3 text-sm">{label}<input className="input-dark w-full mt-1" value={form[key]} onChange={e=>change(key,e.target.value)} {...props}/></label>
  const check=(key,label)=><label className="flex gap-2 mb-3 text-sm"><input type="checkbox" required checked={form[key]} onChange={e=>change(key,e.target.checked)}/>{label}</label>
  const vencidos = data.entregas.filter(e => new Date(e.hasta) < new Date()).length
  const dniPendientes = data.entregas.filter(e => e.dni_pendiente).length
  const sedeNombre = sedes.find(s => String(s.id) === String(sede))?.nombre || 'Sin sede'
  return <main className="porteria-page" style={embedded ? {height:'auto'} : undefined}><div className="porteria-shell">
    <header className="porteria-header"><div><span className="porteria-eyebrow">Fly Kitchen · Control de accesos</span><h1>Seguridad · Portería</h1><p>Operador: {perfil?.nombre} · Identificación, visitas y devoluciones</p></div>{!embedded&&<button className="btn-ghost" onClick={signOut}>Cerrar sesión</button>}</header>
    <div className="porteria-station"><MapPin size={24} style={{color:'var(--phosphor)'}}/><label>Puesto / sede<select className="input-dark w-full" value={sede} disabled={busy||loading||!!form||!!closing||scan} onChange={e=>setSede(e.target.value)}>{!sedes.length&&<option value="">Sin sedes asignadas</option>}{sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label><button className="btn-ghost" disabled={!sede||busy||loading} onClick={load}>Actualizar</button></div>
    {error&&!form&&!closing&&<p role="alert" className="porteria-alert">{error}</p>}{message&&<p role="status" className="my-3">{message}</p>}
    <div className="porteria-stats">
      <div className="porteria-stat"><Users size={18}/><strong>{loading?'—':data.entregas.length}</strong><span>Pases en circulación en esta sede</span></div>
      <div className="porteria-stat"><ClipboardCheck size={18}/><strong>{loading?'—':dniPendientes}</strong><span>DNI en custodia</span></div>
      <div className={'porteria-stat '+(vencidos?'is-warning':'')}><ShieldCheck size={18}/><strong>{loading?'—':vencidos}</strong><span>Pases vencidos por recuperar</span></div>
      <div className="porteria-stat"><CreditCard size={18}/><strong>{loading?'—':data.pases.length}</strong><span>Pases temporales disponibles</span></div>
    </div>
    <div className="porteria-workspace">
      <section className="porteria-panel">
        <h2>Control de ingreso</h2><p className="porteria-muted">Escaneá el QR y compará la identidad antes de habilitar el paso.</p>
        <div className="porteria-actions"><button className="btn-primary" disabled={!sede||busy||loading} onClick={()=>setScan(true)}>Escanear credencial o pase</button></div>
        {busy&&<p role="status">Procesando…</p>}{loading&&<p role="status">Cargando puesto…</p>}
        {result ? <SeguridadScanResult key={JSON.stringify(result)} result={result} sedeNombre={sedeNombre}/> : <div className="porteria-empty"><ScanLine size={48}/><h3>Listo para escanear</h3><p>La ficha mostrará la foto, los datos de la persona y los sectores habilitados en este puesto.</p><p style={{marginTop:14}}>El primer escaneo válido registra la entrega física de la credencial.</p></div>}
      </section>
      <section className="porteria-panel">
        <h2>Visitas y pases</h2><p className="porteria-muted">Entrega contra DNI, acompañamiento y control de salida.</p>
        <div className="porteria-actions"><button className="btn-primary" disabled={!sede||busy||loading} onClick={()=>open(null)}>Entregar pase de visita</button></div>
        <h3 className="font-bold my-3">Entregas abiertas · {data.entregas.length}</h3>
        {!loading&&!data.entregas.length&&<div className="porteria-empty"><ClipboardCheck size={32}/><h3>Sin devoluciones pendientes</h3><p>No hay pases pendientes de devolución en esta sede.</p></div>}
        {data.entregas.map(e=><article key={e.id} className="porteria-loan"><h3>{e.visitante}</h3><p>{e.codigo}</p><p>{e.sector} · Acompaña {e.acompanante}</p><p>Ingreso: {time(e.desde)}<br/>Hasta: {time(e.hasta)}</p>{new Date(e.hasta)<new Date()&&<p className="text-red-400">Vencido · devolución pendiente</p>}{e.dni_pendiente&&<p>DNI {e.dni} en custodia</p>}<div className="porteria-actions"><button className="btn-ghost" disabled={busy} onClick={()=>run(()=>descargarPase(e))}>Descargar pase PDF</button><button className="btn-primary" disabled={busy} onClick={()=>{setError('');setClosing({...e,dni_devuelto:false,pase_recibido:false,extravio:false})}}>Registrar devolución / salida</button></div></article>)}
        <details className="porteria-fold"><summary>Pases temporales disponibles · {data.pases.length}</summary>{data.pases.map(p=><button key={p.id} className="btn-ghost m-2" disabled={busy||loading} onClick={()=>open(p)}>{p.codigo} · Entregar a operario</button>)}</details>
        <details className="porteria-fold"><summary>Historial de salidas recientes · {data.historial?.length||0}</summary><div style={{maxHeight:300,overflowY:'auto'}}>{data.historial?.map(e=><p key={e.id} className="my-2 text-sm">{e.visitante} · {e.codigo} · {e.cierre} · {time(e.devuelto_at)}{e.dni_devuelto_at ? ' · DNI devuelto' : ''}</p>)}{!data.historial?.length&&<p className="porteria-muted mt-3">Todavía no hay salidas registradas en esta sede.</p>}</div></details>
      </section>
    </div>
    {scan&&<AssetQrScannerModal onClose={()=>setScan(false)} onScan={onScan} parseValue={parseSeguridadQr} title="Escanear credencial o pase" subtitle="Control de Seguridad" prompt="Apuntá al QR de Fly Kitchen." invalidMessage="El QR no corresponde a una credencial o pase." placeholder="Pegá el enlace del QR" help="El primer escaneo válido en este puesto registra la entrega de la credencial con tu usuario y fecha."/>}
    {form&&<Modal title={form.pase?'Entregar pase temporal':'Entregar pase de visita'} busy={busy} onClose={()=>setForm(null)}><form onSubmit={submit}><fieldset disabled={busy}>
      {form.pase?<label className="block mb-3">Operario<select required className="input-dark w-full" value={form.persona} onChange={e=>change('persona',e.target.value)}><option value="">Seleccionar</option>{data.personas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>:<>{field('visitante','Nombre completo',{required:true,minLength:3,maxLength:150})}{field('dni','DNI original recibido',{required:true,inputMode:'numeric',pattern:'[0-9]{6,10}',maxLength:10})}{field('empresa','Empresa',{maxLength:150})}{field('patente','Patente (si corresponde)',{maxLength:20})}</>}
      <label className="block mb-3">Sector<select required className="input-dark w-full" value={form.sector} onChange={e=>change('sector',e.target.value)}><option value="">Seleccionar</option>{data.sectores.map(s=><option key={s.id} value={s.id}>{s.codigo} · {s.nombre}</option>)}</select></label>
      <label className="block mb-3">Anfitrión / acompañante<select required disabled={companionsLoading} className="input-dark w-full" value={form.acompanante} onChange={e=>change('acompanante',e.target.value)}><option value="">{companionsLoading?'Consultando…':'Seleccionar autorizado'}</option>{companions.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
      {field('hasta','Válido hasta',{required:true,type:'datetime-local'})}
      {check('autorizacion','Confirmo la autorización del anfitrión y su presencia para acompañar durante la visita.')}
      {!form.pase&&<>{check('dni_recibido','Recibí el DNI original en contraentrega del pase. Queda en custodia hasta la salida.')}{check('induccion','Verifiqué la declaración de ingreso, inducción de bioseguridad y EPP que corresponda.')}</>}
      {error&&<p role="alert" className="text-red-400 my-3">{error}</p>}<div className="flex justify-end gap-3"><button type="button" className="btn-ghost" onClick={()=>setForm(null)}>Cancelar</button><button className="btn-primary" disabled={companionsLoading}>Registrar entrega</button></div>
    </fieldset></form></Modal>}
    {closing&&<Modal title="Devolución y egreso" busy={busy} onClose={()=>setClosing(null)}><form onSubmit={e=>{e.preventDefault();run(async()=>{await seguridadRpc('devolver',sede,{entrega:closing.id,dni_devuelto:closing.dni_devuelto,pase_recibido:closing.pase_recibido,extravio:closing.extravio});setClosing(null);setMessage('Salida registrada.');await load()})}}><fieldset disabled={busy}><p className="mb-3">{closing.visitante} · {closing.codigo}</p><label className="flex gap-2 mb-3"><input type="checkbox" required={!closing.extravio} checked={closing.pase_recibido} onChange={e=>setClosing(c=>({...c,pase_recibido:e.target.checked}))}/>Recibí el pase y verifiqué el control de salida y EPP.</label><label className="flex gap-2 mb-3"><input type="checkbox" checked={closing.extravio} onChange={e=>setClosing(c=>({...c,extravio:e.target.checked}))}/>El pase se extravió: anularlo para impedir su reutilización.</label>{closing.dni_pendiente&&<label className="flex gap-2 mb-3"><input type="checkbox" required checked={closing.dni_devuelto} onChange={e=>setClosing(c=>({...c,dni_devuelto:e.target.checked}))}/>Devolví el DNI a su titular.</label>}{error&&<p role="alert" className="text-red-400">{error}</p>}<div className="flex justify-end gap-3 mt-4"><button type="button" className="btn-ghost" onClick={()=>setClosing(null)}>Cancelar</button><button className="btn-primary">Confirmar salida</button></div></fieldset></form></Modal>}
  </div></main>
}
