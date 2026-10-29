import CredencialAutorizanteSelect from './CredencialAutorizanteSelect'
import { sectorColor, sectorShortName, sectorStateLabel, sectorTileLayout, credentialFrontLayout } from '../lib/credentialCatalog'
import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { X } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../lib/auth'
import { getPersonaFotoDataUrl } from '../lib/personaFotos'
import { getFaMultisedeEligibility, actualizarPrivacidadCredencial, cambiarEstadoCredencial, descargarCredencialPdf, emitirCredencial, fechaVencimientoCredencial, getCredencialPersona, getSectoresCredencial, urlValidacionCredencial } from '../lib/credenciales'
import { CREDENTIAL_AREA_OPTIONS, credentialPresentation, resolveCredentialArea } from '../lib/credentialAreas'
import { globalCredentialGroup, toggleCredentialSector, credentialSectorSites, hasIncompatibleCredentialSectors, credentialIsValid, groupCredentialSectors, selectedCredentialSectors } from '../lib/credentialAccess'
import { mensajeError } from '../lib/errores'
import { confirmar, toast } from '../lib/feedback'

const GRUPOS=['','A+','A-','B+','B-','AB+','AB-','O+','O-']
const dateLabel = value => format(new Date(`${value}T12:00:00`),'dd/MM/yyyy')
const defaults = { compartirTelefono:false, compartirEmail:false, grupo:'', fotoX:50, fotoY:50, fotoZoom:1, autorizacionResponsable:'', autorizacionMotivo:'', faVencimiento:'' }

export default function CredencialPersonalModal({ persona, sedes = [], onClose }) {
  const { perfil } = useAuth()
  const [credencial,setCredencial] = useState(null)
  const [faEligible,setFaEligible] = useState(false)
  const [faTodasSedes,setFaTodasSedes] = useState(false)
  const [catalog,setCatalog] = useState([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [foto,setFoto] = useState(null)
  const [fotoError,setFotoError] = useState(false)
  const [fotoRetry,setFotoRetry] = useState(0)
  const [qr,setQr] = useState(null)
  const [area,setArea] = useState(resolveCredentialArea(persona).key)
  const [sectorIds,setSectorIds] = useState([])
  const [autorizacion,setAutorizacion] = useState(false)
  const [previewSede,setPreviewSede] = useState('')
  const [draft,setDraft] = useState(defaults)
  const admin = perfil?.rol === 'admin' && perfil?.activo !== false
  const set = (key,value) => setDraft(previous => ({...previous,[key]:value}))

  useEffect(() => {
    if (!admin) { setLoading(false); return }
    let cancelled = false
    Promise.all([getCredencialPersona(persona.id),getSectoresCredencial(),getFaMultisedeEligibility(persona.id)]).then(([value,sectors,eligible]) => {
      if (cancelled) return
      setCredencial(value); setCatalog(sectors);setFaEligible(eligible);setFaTodasSedes(!!value?.fa_todas_sedes)
      setArea(resolveCredentialArea(persona,value).key)
      setSectorIds((value?.sectores_autorizados || []).map(s=>s.id))
      setDraft({ compartirTelefono:!!value?.compartir_telefono, compartirEmail:!!value?.compartir_email,
        grupo:value?.grupo_sanguineo || '', fotoX:Number(value?.foto_pos_x ?? 50),
        fotoY:Number(value?.foto_pos_y ?? 50), fotoZoom:Number(value?.foto_zoom ?? 1), autorizacionResponsable:value?.autorizacion_responsable || '', autorizacionMotivo:value?.autorizacion_motivo || '', faVencimiento:value?.fa_vencimiento || '' })
    }).catch(e => { if (!cancelled) setError(`No se pudo cargar la configuración de accesos. ${mensajeError(e)}`) })
      .finally(()=> { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  },[persona,admin])
  useEffect(()=> {
    let cancelled = false
    setFoto(null);setFotoError(false)
    if (admin && persona.foto_url) getPersonaFotoDataUrl(persona.foto_url).then(value=>{if(!cancelled)setFoto(value)}).catch(()=>{if(!cancelled)setFotoError(true)})
    return ()=> { cancelled=true }
  },[persona.foto_url,admin,fotoRetry])
  useEffect(()=> {
    let cancelled=false
    setQr(null)
    if(credencial?.token) QRCode.toDataURL(urlValidacionCredencial(credencial.token),{width:500,margin:1})
      .then(value=>{if(!cancelled)setQr(value)}).catch(()=>{if(!cancelled)toast.error('No se pudo generar el QR.')})
    return ()=> { cancelled=true }
  },[credencial?.token])

  const sectorSites = credentialSectorSites(persona)
  const usesSectors = sectorSites.length>0
  const incompatible = hasIncompatibleCredentialSectors(persona,credencial,faEligible)
  const available = catalog.filter(s=>sectorSites.includes(Number(s.sede_id))&&sedes.some(d=>String(d.id)===String(s.sede_id)&&d.activa!==false))
    .map(s=>({...s,sede_nombre:sedes.find(d=>String(d.id)===String(s.sede_id)).nombre}))
  const selected = selectedCredentialSectors(available,sectorIds)
  const unavailable = sectorIds.filter(id=>!available.some(s=>s.id===id))
  const groups = faTodasSedes ? [globalCredentialGroup()] : groupCredentialSectors(selected)
  const fallbackSede = (persona.sede_ids || []).map(id=>sedes.find(s=>String(s.id)===String(id))?.nombre).filter(Boolean).join(' / ') || 'Administración Central'
  const preview = groups.find(g=>g.sedeId===previewSede) || groups[0] || {nombre:fallbackSede,sectores:[],showSectors:usesSectors}
  const presentation = credentialPresentation(persona,{...credencial,area_impresa:area})
  const originalIds = (credencial?.sectores_autorizados || []).map(s=>s.id).sort().join(',')
  const authorizationDirty = !!credencial && (draft.autorizacionResponsable!==(credencial.autorizacion_responsable||'') || draft.autorizacionMotivo!==(credencial.autorizacion_motivo||'') || draft.faVencimiento!==(credencial.fa_vencimiento||''))
  const hasFA = faTodasSedes || selected.some(s=>s.codigo==='FA')
  const authorizationReady = (!faTodasSedes || faEligible) && ((!selected.length && !faTodasSedes) || (draft.autorizacionResponsable.trim().length>=3 && (!hasFA || (draft.faVencimiento>=format(new Date(),'yyyy-MM-dd') && draft.faVencimiento<=fechaVencimientoCredencial()))))
  const accessDirty = faTodasSedes!==!!credencial?.fa_todas_sedes || authorizationDirty || area!==resolveCredentialArea(persona,credencial).key || [...sectorIds].sort().join(',')!==originalIds
  const settingsDirty = !!credencial && (draft.grupo!==(credencial.grupo_sanguineo || '') || draft.compartirTelefono!==!!credencial.compartir_telefono || draft.compartirEmail!==!!credencial.compartir_email || draft.fotoX!==Number(credencial.foto_pos_x??50) || draft.fotoY!==Number(credencial.foto_pos_y??50) || draft.fotoZoom!==Number(credencial.foto_zoom??1))
  const valid = credentialIsValid(credencial)
  const estado = credencial ? (credencial.estado==='activa'&&!valid?'vencida':credencial.estado) : 'sin emitir'
  const run = async action => { setBusy(true); try { await action() } catch(e) { toast.error(mensajeError(e)) } finally { setBusy(false) } }
  const toggle = id => { setSectorIds(ids=>toggleCredentialSector(available,ids,id));setAutorizacion(false) }
  const emitir = async () => {
    if (!(await confirmar({titulo:'Emitir credencial',mensaje:`${faTodasSedes?'Se autorizará FA en todas las sedes activas para esta persona.':`Se emitirán ${selected.length} sectores en ${groups.length} sedes para esta persona.`}${credencial?' La credencial anterior quedará invalidada.':''}`,confirmText:'Confirmar emisión'}))) return
    await run(async()=>{
      const value=await emitirCredencial({persona,sedeNombre:fallbackSede,anterior:credencial,area,faTodasSedes,sectorIds:faTodasSedes?[]:selected.map(s=>s.id),autorizacionConfirmada:autorizacion,...draft,grupoSanguineo:draft.grupo})
      setCredencial(value);setFaTodasSedes(!!value.fa_todas_sedes);setSectorIds((value.sectores_autorizados||[]).map(s=>s.id));setAutorizacion(false);toast.ok('Credencial emitida por dos años.')
    })
  }
  const invalidar = async estado => {
    if (!(await confirmar({titulo:estado==='extraviada'?'Informar extravío':'Anular credencial',mensaje:'El QR dejará de validar esta credencial inmediatamente.',peligro:true,confirmText:'Confirmar'}))) return
    await run(async()=>{setCredencial(await cambiarEstadoCredencial(credencial.id,estado,'Registrado por administración'));toast.ok('Credencial invalidada.')})
  }

  return <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="credential-title"><div className="glass hud-corner" style={{width:'min(1180px,97vw)',maxHeight:'95dvh',overflowY:'auto',padding:20}}>
    <header className="flex items-center justify-between mb-5" style={{gap:12}}><div><h2 id="credential-title" className="font-title font-bold">Control de accesos y credenciales</h2><p style={hint}>CR80 · asignación individual por sede · vigencia de 2 años</p></div><button className="btn-ghost" aria-label="Cerrar credencial" disabled={busy} onClick={onClose}><X size={16}/></button></header>
    {!admin?<p>Disponible únicamente para administradores.</p>:loading?<p>Cargando…</p>:error?<p role="alert">{error}</p>:<div style={{display:'flex',flexWrap:'wrap',gap:24,alignItems:'flex-start'}}>
      <div className="credential-preview-column" style={{flex:'1 1 560px',minWidth:0}}>
        <p style={{...hint,marginBottom:10}}>{!credencial||accessDirty||settingsDirty?'Vista previa · cambios pendientes':'Credencial emitida'} · El PDF incluye frente y dorso por cada sede autorizada.</p>
        {groups.length>1&&<label style={{display:'block',marginBottom:12}}>Vista previa por sede<select className="input-dark w-full" value={preview.sedeId} onChange={e=>setPreviewSede(e.target.value)}>{groups.map(g=><option key={g.sedeId} value={g.sedeId}>{g.nombre}</option>)}</select></label>}
        <CredentialPreview onPhotoError={()=>{setFoto(null);setFotoError(true)}} persona={persona} presentation={presentation} preview={preview} draft={draft} foto={foto} qr={accessDirty||incompatible?null:qr} vencimiento={(preview.sectores.some(s=>s.codigo==='FA')&&draft.faVencimiento)||credencial?.fecha_vencimiento||fechaVencimientoCredencial()}/>
      </div>
      <fieldset disabled={busy} style={{flex:'1 1 310px',minWidth:0,border:0,padding:0}}>
        <Panel title="ENCUADRE DE LA FOTO">{fotoError&&<div role="alert"><p>No se pudo cargar la fotografía.</p><button className="btn-ghost" onClick={()=>setFotoRetry(value=>value+1)}>Reintentar foto</button></div>}{[['Horizontal','fotoX',0,100,1],['Vertical','fotoY',0,100,1],['Zoom','fotoZoom',1,1.8,.05]].map(([label,key,min,max,step])=><label key={key} style={{display:'grid',gridTemplateColumns:'65px 1fr 40px',gap:8,fontSize:12,marginBottom:8}}>{label}<input type="range" min={min} max={max} step={step} value={draft[key]} onChange={e=>set(key,Number(e.target.value))}/><span>{key==='fotoZoom'?`${Math.round(draft[key]*100)}%`:draft[key]}</span></label>)}<button className="btn-ghost w-full" onClick={()=>setDraft(d=>({...d,fotoX:50,fotoY:50,fotoZoom:1}))}>Centrar automáticamente</button></Panel>
        <Panel title="ESTADO"><strong style={{color:valid?'var(--phosphor)':'var(--alert)'}}>{estado.toUpperCase()}</strong>{credencial&&<p style={hint}>Emitida {dateLabel(credencial.fecha_emision)} · vence {dateLabel(credencial.fecha_vencimiento)}</p>}</Panel>
        <Panel title="DEPARTAMENTO"><select aria-label="Departamento" className="input-dark w-full" value={area} onChange={e=>{setArea(e.target.value);setAutorizacion(false)}}>{CREDENTIAL_AREA_OPTIONS.map(a=><option key={a.value} value={a.value}>{a.code} — {a.label}</option>)}</select><p style={hint}>Identifica la función laboral. No otorga accesos automáticamente.</p></Panel>
        {(faEligible || credencial?.fa_todas_sedes)&&<Panel title="ACCESO MULTISEDE">
          <label style={{display:'flex',gap:8}}><input type="checkbox" checked={faTodasSedes} disabled={!faEligible && !faTodasSedes} onChange={e=>{setFaTodasSedes(e.target.checked);setSectorIds([]);setAutorizacion(false)}}/>FA · Todas las sedes</label>
          <p style={hint}>Autorización interna en todas las sedes activas, incluidas las que se activen durante su vigencia. Conserva la pertenencia a Equipo Central. No habilita áreas suspendidas o aún no puestas en servicio.</p>
          {!faEligible&&<p role="alert">La habilitación multisede fue retirada. Quitá FA y reemití.</p>}
        </Panel>}
        {usesSectors&&!faTodasSedes&&<details className="glass rounded p-4 mb-3">
          <summary className="font-metric text-xs" style={{cursor:'pointer',color:'var(--text-dim)'}}>SECTORES AUTORIZADOS POR SEDE · {selected.length} seleccionados en {groups.length} sedes</summary>
          <div style={{marginTop:12}}>
          <p style={hint}>Autorizaciones individuales. FA incluye sólo los sectores habilitados de esa sede; no se hereda del departamento. Rojo: restringido o FA. Negro: no restringido. Ae, Pp y Da se seleccionan por separado.</p>
          {groupCredentialSectors(available).map(g=><div key={g.sedeId} style={{marginTop:14}}><strong style={{fontSize:12}}>{g.nombre}</strong>{g.sectores.map(s=><label key={s.id} style={{display:'flex',gap:8,alignItems:'flex-start',marginTop:8,fontSize:12}}><input type="checkbox" checked={sectorIds.includes(s.id)} onChange={()=>toggle(s.id)}/><span><b>{s.codigo}</b> · {s.nombre}{s.zra&&<b style={{color:'#ef4444'}}> · {s.tipo==='permiso'?'FA':'Restringido'}</b>}<small style={{display:'block'}}>{sectorStateLabel(s)}</small></span></label>)}</div>)}
          {!available.length&&<p>No hay sectores configurados para las sedes disponibles.</p>}
          {!!unavailable.length&&<p role="alert" style={hint}>Hay {unavailable.length} sectores del catálogo anterior o no disponibles. Retiralos y seleccioná las nuevas siglas antes de reemitir. No se convierten automáticamente. <button className="btn-ghost" onClick={()=>{setSectorIds(ids=>ids.filter(id=>!unavailable.includes(id)));setAutorizacion(false)}}>Retirar de esta emisión</button></p>}
          <p style={{...hint,marginTop:12}}>{selected.length} sectores en {groups.length} sedes. Cambiar accesos requiere reemitir.</p>
          </div>
        </details>}
        {incompatible&&<p role="alert" style={hint}>Esta emisión contiene sectores de otra sede. Reemití para corregirla; la nueva credencial usará la sede de la ficha y únicamente sus sectores disponibles.</p>}

        {(!!selected.length || faTodasSedes)&&<Panel title="AUTORIZACIÓN NOMINAL">
          <CredencialAutorizanteSelect sedeIds={faTodasSedes ? sedes.filter(s=>s.activa!==false).map(s=>s.id) : sectorSites} value={draft.autorizacionResponsable} onChange={value=>{set('autorizacionResponsable',value);setAutorizacion(false)}}/>
          <label>Observación (opcional)<textarea aria-label="Observación (opcional)" className="input-dark w-full" value={draft.autorizacionMotivo} onChange={e=>{set('autorizacionMotivo',e.target.value);setAutorizacion(false)}}/></label>
          {hasFA&&<label>FA vigente hasta<input aria-label="FA vigente hasta" type="date" className="input-dark w-full" min={format(new Date(),'yyyy-MM-dd')} max={fechaVencimientoCredencial()} value={draft.faVencimiento} onChange={e=>{set('faVencimiento',e.target.value);setAutorizacion(false)}}/><p style={hint}>FA se autoriza expresamente por sede. Para revocarlo, retiralo y reemití; la emisión anterior deja de validar.</p></label>}
        </Panel>}
        <Panel title="DATOS OPCIONALES"><label style={{fontSize:12}}>Grupo sanguíneo<select className="input-dark w-full" value={draft.grupo} onChange={e=>set('grupo',e.target.value)}>{GRUPOS.map(g=><option key={g} value={g}>{g||'— No imprimir —'}</option>)}</select></label>{[['Compartir teléfono laboral','compartirTelefono'],['Compartir correo laboral','compartirEmail']].map(([label,key])=><label key={key} style={{display:'flex',gap:8,marginTop:10,fontSize:12}}><input type="checkbox" checked={draft[key]} onChange={e=>set(key,e.target.checked)}/>{label}</label>)}
          {credencial&&<button className="btn-ghost w-full mt-3" disabled={!settingsDirty||accessDirty} onClick={()=>run(async()=>{setCredencial(await actualizarPrivacidadCredencial(credencial.id,draft.compartirTelefono,draft.compartirEmail,draft.grupo,draft.fotoX,draft.fotoY,draft.fotoZoom));toast.ok('Datos y encuadre guardados.')})}>Guardar datos y encuadre</button>}
        </Panel>
        <label style={{display:'flex',gap:8,fontSize:12,marginBottom:12}}><input type="checkbox" checked={autorizacion} onChange={e=>setAutorizacion(e.target.checked)}/>{faTodasSedes?'Confirmo que esta persona cuenta con autorización FA para todas las sedes activas.':usesSectors?'Confirmo que esta persona cuenta con autorización para los sectores seleccionados.':'Confirmo la emisión de la credencial para la sede de esta persona.'}</label>
        {!persona.foto_url&&<p style={hint}>Cargá una fotografía en la ficha del personal antes de emitir.</p>}
        <div className="flex flex-col gap-2"><button className="btn-primary" disabled={!autorizacion||!foto||!authorizationReady} onClick={emitir}>{credencial?'Reemitir por 2 años':'Emitir credencial'}</button><button className="btn-ghost" disabled={!valid||accessDirty||settingsDirty||incompatible||!!unavailable.length} onClick={()=>run(()=>descargarCredencialPdf(persona,credencial))}>Descargar PDF CR80</button>{credencial?.estado==='activa'&&<><button className="btn-ghost" onClick={()=>invalidar('extraviada')}>Informar extravío</button><button className="btn-ghost" onClick={()=>invalidar('anulada')}>Anular credencial</button></>}</div>
        <p style={{...hint,marginTop:12}}>Credencial interna Fly Kitchen. No reemplaza habilitaciones PSA ni habilita puertas por sí sola. Validar el QR antes de permitir el acceso.</p>
      </fieldset>
    </div>}
  </div></div>
}

export function CredentialPreview({persona,presentation,preview,draft,foto,qr,vencimiento,onPhotoError}) {
  const tiles=sectorTileLayout(preview.sectores.length)
  const layout=credentialFrontLayout(preview.sectores.length,preview.showSectors!==false)
  const name=[persona.nombre,persona.apellido].filter(Boolean).join(' ').toUpperCase()
  return <div style={{display:'flex',gap:18,justifyContent:'center',flexWrap:'wrap'}}>
    <div style={card}>
      <div style={{height:46,flexShrink:0,display:'flex',justifyContent:'center',padding:3}}><img src="/fly-kitchen-credencial.png" alt="Fly Kitchen" style={{height:40,objectFit:'contain'}}/></div>
      <div style={{height:layout.photoHeight,flexShrink:0,display:'grid',gridTemplateColumns:'1fr 45px'}}><div style={{overflow:'hidden',background:'#dfe3e8'}}>{foto&&<img src={foto} alt="Fotografía del titular" onError={onPhotoError} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:`${draft.fotoX}% ${draft.fotoY}%`,transform:`scale(${draft.fotoZoom})`,transformOrigin:`${draft.fotoX}% ${draft.fotoY}%`}}/>}</div><div style={{background:presentation.area.color,color:'#fff',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontSize:27,fontWeight:900,lineHeight:1.05}}>{presentation.area.code.split('').map((letter,i)=><span key={i}>{letter}</span>)}</div></div>
      <div style={{padding:'7px 12px 4px',height:121,flexShrink:0,display:'flex',flexDirection:'column',gap:2,boxSizing:'border-box'}}>
        <strong style={{fontSize:name.length>40?11:15,lineHeight:1.1,overflowWrap:'anywhere'}}>{name}</strong>
        <strong style={{fontSize:10}}>DNI {persona.dni || '—'}</strong><strong style={{fontSize:11}}>FLY KITCHEN S.A.</strong>
        <b style={{fontSize:presentation.jobTitle.length>75?7:9,color:'#d75b00',lineHeight:1.1}}>{presentation.jobTitle}</b>
        <div style={{display:'flex',gap:5,justifyContent:'space-between',marginTop:'auto',fontSize:8}}><span>{preview.nombre.toUpperCase()}</span><b>{draft.grupo}</b></div>
      </div>
      <div style={{visibility:preview.showSectors===false?'hidden':'visible',height:layout.sectorsHeight,flexShrink:0,padding:'1px 12px',boxSizing:'border-box'}}><div style={{fontSize:6,color:'#555'}}>ACCESOS POR SEDE · VALIDAR QR ANTES DE INGRESAR</div><div style={{display:'grid',gridTemplateColumns:`repeat(${tiles.columns},${tiles.width}px)`,gap:3,marginTop:3}}>{preview.sectores.length?preview.sectores.map(sector=><span key={sector.id} title={`${sector.nombre} · ${sectorStateLabel(sector)}`} style={{background:sectorColor(sector),color:'#fff',minWidth:0,height:tiles.height,display:'flex',flexDirection:'column',justifyContent:'center',textAlign:'center',overflow:'hidden'}}><b style={{fontSize:Math.min(22,tiles.height*.55),lineHeight:1.1}}>{sector.codigo}</b><span style={{fontSize:Math.min(7,tiles.height*.20),lineHeight:1.1}}>{sectorShortName(sector)}</span></span>):<strong style={{fontSize:9}}>SIN SECTORES AUTORIZADOS</strong>}</div></div>
      <div style={expiry}>VENCE {dateLabel(vencimiento)}</div>
    </div>
    <div style={card}><img src="/fly-kitchen-credencial.png" alt="Fly Kitchen" style={{height:50,objectFit:'contain',margin:'12px auto 8px'}}/>{qr?<img src={qr} alt="QR de validación de la credencial emitida" style={{width:166,height:166,margin:'4px auto'}}/>:<div style={{height:174,display:'grid',placeItems:'center',fontSize:12,textAlign:'center',padding:20}}>El QR estará disponible<br/>al emitir la credencial.</div>}<div style={{borderTop:'2px solid #eb6600',borderBottom:'2px solid #eb6600',padding:9,fontWeight:900,fontSize:11}}>VALIDAR CREDENCIAL<br/>Y GUARDAR CONTACTO</div><div style={{padding:12,fontSize:9,lineHeight:1.6}}>Esta credencial es propiedad de<br/><b style={{color:'#eb6600'}}>Fly Kitchen S.A.</b><br/><br/>En caso de extravío,<br/>remitir a Recursos Humanos.</div><div style={{...expiry,fontSize:8}}>ALIMENTAMOS LO QUE NOS MUEVE</div></div>
  </div>
}

function Panel({title,children}) { return <section className="glass rounded p-4 mb-3"><h3 className="font-metric text-xs mb-3" style={{color:'var(--text-dim)'}}>{title}</h3>{children}</section> }
const hint={fontSize:11,color:'var(--text-dim)',lineHeight:1.5}
const card={width:270,height:428,background:'#fafafa',color:'#151515',borderRadius:18,border:'1px solid #d8d8d8',overflow:'hidden',display:'flex',flexDirection:'column',textAlign:'left',boxShadow:'0 14px 38px rgba(0,0,0,.25)',flexShrink:0}
const expiry={height:43,flexShrink:0,marginTop:'auto',background:'#eb6600',color:'#fff',fontSize:17,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',gap:5}
