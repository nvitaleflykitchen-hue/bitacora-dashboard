import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { getRrhhEmpresas, saveRrhhPerson, saveRrhhUnit, renameRrhhEmpresa, getRrhhOperators, saveRrhhOperator, getRrhhHistory, filterRrhhPeople } from '../../lib/rrhhEmpresas'
import { mensajeError } from '../../lib/errores'
import './RrhhEmpresas.css'
const empty={empresas:[],unidades:[],personas:[]}
const personFields=[['nombre','Nombre','text',true],['apellido','Apellido','text',true],['dni','DNI','text',true],['legajo','Legajo','text',false],['puesto','Puesto','text',false],['telefono','Teléfono','tel',false],['email','Correo de contacto','email',false],['fecha_ingreso','Fecha de ingreso','date',false]]
function Dialog({title,children,onClose,busy}) {
 const ref=useRef(null)
 useEffect(()=>{ref.current.showModal();const d=ref.current;return()=>d.close()},[])
 return <dialog ref={ref} className="rrhh-dialog" onCancel={e=>{e.preventDefault();if(!busy)onClose()}} aria-label={title}><header><h2>{title}</h2><button className="btn-ghost" disabled={busy} onClick={onClose} aria-label="Cerrar">✕</button></header>{children}</dialog>
}
export default function RrhhEmpresas({onBack,onOpenPersona}) {
 const {perfil}=useAuth(), admin=perfil?.rol==='admin'
 const [data,setData]=useState(empty),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const [empresa,setEmpresa]=useState('flykitchen'),[unidad,setUnidad]=useState(''),[search,setSearch]=useState(''),[estado,setEstado]=useState('activos')
 const [modal,setModal]=useState(null),[form,setForm]=useState({}),[history,setHistory]=useState([]),[operators,setOperators]=useState([]),[notice,setNotice]=useState('')
 const pending=useRef(false),mounted=useRef(true)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 async function load() {
  setLoading(true);setError('')
  try{const next=await getRrhhEmpresas();if(mounted.current)setData(next)}
  catch(e){if(mounted.current){setData(empty);setError(mensajeError(e))}}
  finally{if(mounted.current)setLoading(false)}
 }
 useEffect(()=>{load()},[]) // Data only loads when central RRHH is opened.
 async function run(fn) {
  if(pending.current)return
  pending.current=true;setBusy(true);setError('');setNotice('')
  try{await fn()}catch(e){if(mounted.current)setError(mensajeError(e))}
  finally{pending.current=false;if(mounted.current)setBusy(false)}
 }
 const close=()=>{if(!pending.current){setModal(null);setError('')}}
 const companyName=id=>data.empresas.find(e=>e.id===id)?.nombre||id
 const unitNames=p=>p.unidad_ids.map(id=>data.unidades.find(u=>u.id===id)?.nombre).filter(Boolean).join(' · ')||'Equipo central / sin unidad'
 const rows=filterRrhhPeople(data,empresa,unidad,search,estado)
 const selectedUnits=data.unidades.filter(u=>empresa==='todas'||u.empresa_id===empresa)
 const change=(key,value)=>setForm(f=>({...f,[key]:value,...(key==='empresa_id'?{unidad_id:''}:{})}))
 function openPerson(p) {
  setError('');setNotice('');setForm(p?{...p,motivo_cambio:''}:{empresa_id:empresa,unidad_id:unidad||'',nombre:'',apellido:'',dni:'',legajo:'',puesto:'',telefono:'',email:'',fecha_ingreso:'',activo:true,motivo_cambio:'Alta inicial en RRHH'});setModal('persona')
 }
 function exportCsv() {
  const cell=v=>`"${String(v??'').replace(/^[=+@\-\t\r\n]/,"'$&").replaceAll('"','""')}"`
  const content=[['Empresa','Unidad / sede','Nombre','Apellido','DNI','Legajo','Puesto','Estado'],...rows.map(p=>[companyName(p.empresa_id),unitNames(p),p.nombre,p.apellido,p.dni,p.legajo,p.puesto,p.activo?'Activo':'Inactivo'])].map(row=>row.map(cell).join(';')).join('\r\n')
  const url=URL.createObjectURL(new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=`rrhh-${empresa}-${new Date().toISOString().slice(0,10)}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 const newAllowed=['drill','tempura'].includes(empresa)
 return <section className="rrhh-page">
  <header className="rrhh-heading"><div><button className="btn-ghost" disabled={busy} onClick={onBack}>← Volver a FlyKitchen</button><h1>RRHH · Empresas</h1><p>Un equipo de RRHH · Tres empresas · Un empleador por colaborador</p></div><div className="rrhh-actions"><button className="btn-ghost" disabled={busy||loading} onClick={load}>Actualizar</button>{admin&&<button className="btn-ghost" disabled={busy||loading||!data.empresas.length} onClick={()=>run(async()=>{setOperators(await getRrhhOperators());setModal('operadores')})}>Equipo de RRHH</button>}</div></header>
  {error&&<div role="alert" className="rrhh-error">{error}{!modal&&<button className="btn-ghost" disabled={loading} onClick={load}>Reintentar</button>}</div>}
  {notice&&<p role="status" className="rrhh-notice">{notice}</p>}
  {loading?<p role="status">Cargando empresas y legajos…</p>:data.empresas.length>0&&<>
   <div className="rrhh-filters"><label>Empresa<select className="input-dark" value={empresa} onChange={e=>{setEmpresa(e.target.value);setUnidad('');setSearch('')}}>{data.empresas.map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}<option value="todas">Todas las empresas</option></select></label><label>Unidad / sede<select className="input-dark" value={unidad} onChange={e=>setUnidad(e.target.value)}><option value="">Todas las unidades</option>{selectedUnits.map(u=><option key={u.id} value={u.id}>{empresa==='todas'?`${companyName(u.empresa_id)} · `:''}{u.nombre}{!u.activa?' (inactiva)':''}</option>)}</select></label><label>Buscar<input className="input-dark" placeholder="Nombre, DNI, legajo o puesto" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>Estado<select className="input-dark" value={estado} onChange={e=>setEstado(e.target.value)}><option value="activos">Activos</option><option value="inactivos">Inactivos</option><option value="todos">Todos</option></select></label></div>
   <div className="rrhh-summary"><div><h2>{empresa==='todas'?'Consolidado de RRHH':companyName(empresa)}</h2><p>{rows.length} colaboradores en esta consulta</p></div><div className="rrhh-actions"><button className="btn-ghost" disabled={!rows.length} onClick={exportCsv}>Exportar consulta CSV</button>{newAllowed&&<><button className="btn-ghost" onClick={()=>{setError('');setModal('unidades')}}>Unidades</button><button className="btn-primary" onClick={()=>openPerson()}>+ Colaborador</button></>}{admin&&newAllowed&&<button className="btn-ghost" onClick={()=>{setError('');setForm({nombre:companyName(empresa)});setModal('empresa')}}>Nombre de empresa</button>}</div></div>
   {empresa==='flykitchen'&&<p className="rrhh-note">Las fichas y los procesos de FlyKitchen se mantienen en Equipo. Abrí un legajo para trabajar con sus herramientas habituales.</p>}
   {newAllowed&&<p className="rrhh-note">Registro inicial de RRHH: datos del colaborador, unidad, estado e historial de cambios. Las altas de esta empresa no generan cuentas de acceso ni credenciales operativas de FlyKitchen.</p>}
   {!rows.length?<div className="rrhh-empty">No hay colaboradores para los filtros elegidos.{newAllowed&&' Podés crear una unidad y registrar el primer colaborador.'}</div>:<div className="rrhh-people">{rows.map(p=><article className="rrhh-person" key={`${p.origen}:${p.id}`}><span className="rrhh-company">{companyName(p.empresa_id)}</span><h3>{p.nombre} {p.apellido}</h3><p>{p.puesto||'Puesto sin completar'}</p><p>{unitNames(p)}</p><dl><div><dt>Legajo</dt><dd>{p.legajo||'Sin asignar'}</dd></div><div><dt>DNI</dt><dd>{p.dni||'Sin completar'}</dd></div><div><dt>Estado</dt><dd>{p.activo?'Activo':'Inactivo'}</dd></div></dl><div className="rrhh-actions">{p.origen==='flykitchen'?<button className="btn-primary" onClick={()=>onOpenPersona(p.id)}>Abrir ficha FlyKitchen</button>:<><button className="btn-primary" onClick={()=>openPerson(p)}>Editar legajo</button><button className="btn-ghost" disabled={busy} onClick={()=>run(async()=>{setHistory(await getRrhhHistory(p.id));setForm(p);setModal('historial')})}>Historial</button></>}</div></article>)}</div>}
  </>}
  {modal&&<Dialog title={{persona:form.id?'Editar legajo':'Nuevo colaborador',unidades:`Unidades · ${companyName(empresa)}`,unidad:'Unidad de RRHH',empresa:'Nombre de empresa',operadores:'Equipo central de RRHH',historial:`Historial · ${form.nombre} ${form.apellido||''}`}[modal]} busy={busy} onClose={close}>
   {error&&<p role="alert" className="rrhh-error">{error}</p>}
   {modal==='persona'&&<form onSubmit={e=>{e.preventDefault();run(async()=>{await saveRrhhPerson(form);setModal(null);setNotice('Legajo guardado. El cambio quedó registrado en su historial.');await load()})}}><div className="rrhh-form-grid"><label>Empresa empleadora<select required className="input-dark" value={form.empresa_id} onChange={e=>change('empresa_id',e.target.value)}>{data.empresas.filter(e=>e.id!=='flykitchen').map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}</select></label><label>Unidad<select required className="input-dark" value={form.unidad_id} onChange={e=>change('unidad_id',e.target.value)}><option value="">Seleccionar unidad</option>{data.unidades.filter(u=>u.empresa_id===form.empresa_id&&(u.activa||u.id===form.unidad_id)).map(u=><option key={u.id} value={u.id}>{u.nombre}{u.activa?'':' (inactiva)'}</option>)}</select></label>{personFields.map(([key,label,type,required])=><label key={key}>{label}<input className="input-dark" required={required} type={type} value={form[key]||''} onChange={e=>change(key,e.target.value)} maxLength={key==='dni'?9:key==='email'?254:key==='legajo'?40:key==='telefono'?60:100} pattern={key==='dni'?'[0-9]{7,9}':undefined} inputMode={key==='dni'?'numeric':undefined}/></label>)}<label>Estado<select className="input-dark" value={form.activo?'activo':'inactivo'} onChange={e=>change('activo',e.target.value==='activo')}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label><label>Motivo del cambio<input className="input-dark" required minLength={5} maxLength={500} value={form.motivo_cambio} onChange={e=>change('motivo_cambio',e.target.value)} placeholder="Alta, traslado de empresa, cambio de unidad…"/></label></div><p className="rrhh-note">Un colaborador pertenece a una sola empresa. Los cambios entre Drill y Tempura quedan fechados. Los traslados desde o hacia FlyKitchen requieren revisión del legajo existente.</p><button className="btn-primary" disabled={busy||!form.unidad_id}>{busy?'Guardando…':'Guardar legajo'}</button></form>}
   {modal==='unidades'&&<><button className="btn-primary" onClick={()=>{setForm({empresa_id:empresa,nombre:'',activa:true});setModal('unidad')}}>+ Nueva unidad</button><div className="rrhh-unit-list">{selectedUnits.map(u=><div key={u.id}><span>{u.nombre} · {u.activa?'Activa':'Inactiva'}</span><button className="btn-ghost" onClick={()=>{setForm(u);setModal('unidad')}}>Editar {u.nombre}</button></div>)}</div></>}
   {modal==='unidad'&&<form onSubmit={e=>{e.preventDefault();run(async()=>{await saveRrhhUnit(form);setModal(null);await load()})}}><label>Nombre de la unidad<input required minLength={2} maxLength={120} className="input-dark" value={form.nombre} onChange={e=>change('nombre',e.target.value)}/></label><label className="rrhh-checkbox"><input type="checkbox" checked={form.activa} onChange={e=>change('activa',e.target.checked)}/>Unidad activa</label><button className="btn-primary" disabled={busy}>Guardar unidad</button></form>}
   {modal==='empresa'&&<form onSubmit={e=>{e.preventDefault();run(async()=>{await renameRrhhEmpresa(empresa,form.nombre);setModal(null);await load()})}}><label>Nombre visible<input required minLength={2} maxLength={100} className="input-dark" value={form.nombre} onChange={e=>change('nombre',e.target.value)}/></label><p className="rrhh-note">El cambio conserva los legajos y sus relaciones.</p><button className="btn-primary" disabled={busy}>Guardar nombre</button></form>}
   {modal==='operadores'&&<><p className="rrhh-note">Los administradores conservan acceso central. Podés habilitar a los editores de RRHH para administrar las tres empresas sin cambiar su rol ni su correo de acceso.</p><div className="rrhh-unit-list">{operators.map(p=><label className="rrhh-checkbox" key={p.id}><input type="checkbox" disabled={p.rol==='admin'||busy} checked={p.central} onChange={e=>{const active=e.target.checked;run(async()=>{await saveRrhhOperator(p.id,active);setOperators(await getRrhhOperators())})}}/><span>{p.nombre}<small>{p.email} · {p.rol}</small></span></label>)}</div></>}
   {modal==='historial'&&<div className="rrhh-history">{history.length?history.map(h=><article key={h.id}><strong>{new Date(h.fecha).toLocaleString('es-AR')}</strong><p>{h.accion==='INSERT'?'Alta de legajo':'Actualización'} · {h.despues?.motivo_cambio}</p><p>{h.antes&&h.antes.empresa_id!==h.despues?.empresa_id?`${companyName(h.antes.empresa_id)} → `:''}{companyName(h.despues?.empresa_id)}</p><p>Unidad: {data.unidades.find(u=>u.id===h.despues?.unidad_id)?.nombre||'Sin referencia'} · {h.despues?.activo?'Activo':'Inactivo'}</p></article>):<p>No hay cambios registrados.</p>}</div>}
  </Dialog>}
 </section>
}
