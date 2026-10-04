import React, { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Plus, X } from 'lucide-react'
import { confirmar, toast } from '../lib/feedback'
import { FORM_ACTIONS, FORM_STATES, formHistory, formWarnings, getFormPdf, listForms, loadFormContext, newManualPerson, newVariables, personName, saveAirport, saveForm, saveRoleActions, saveSupervisor, saveTemplate, sectors, setTemplateActive, stateLabel, transitionForm, uploadFormPdf, validateForm } from '../lib/formulariosPermisos'
import FormularioPersonaManual from './FormularioPersonaManual'
import { createFormularioPdf } from '../lib/formulariosPdf'

const input = 'input-dark w-full'
const formatDate = value => value ? new Date(value).toLocaleString('es-AR') : '—'
function Field({ label, children }) { return <label className="block text-sm"><span className="block mb-1">{label}</span>{children}</label> }
function AirportData({ person, editable, onSaved, run, busy }) {
  const [values, setValues] = useState(person.aeroportuario || {})
  return <details className="glass p-3 mt-3"><summary>Datos aeroportuarios · {personName(person)}</summary>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
      {[['ppa','Nº PPA'],['tipo','Tipo de permiso'],['sectores','Sectores autorizados (1 a 7)'],['aeropuerto','Aeropuerto'],['emision','Fecha emisión','date'],['vencimiento','Fecha vencimiento','date']].map(([key,label,type]) => <Field key={key} label={label}><input className={input} type={type || 'text'} value={values[key] || ''} disabled={!editable || busy} onChange={e=>setValues({...values,[key]:e.target.value})}/></Field>)}
      <Field label="Estado del permiso"><select className={input} disabled={!editable || busy} value={values.estado || ''} onChange={e=>setValues({...values,estado:e.target.value})}><option value="">Sin informar</option>{['vigente','vencido','suspendido','en_tramite'].map(s=><option key={s} value={s}>{stateLabel(s)}</option>)}</select></Field>
    </div>
    {editable && <button disabled={busy} className="btn-primary mt-3" onClick={()=>run(async()=>{await saveAirport(person.id,values);await onSaved();toast.ok('Datos aeroportuarios guardados.')})}>Guardar datos aeroportuarios</button>}
  </details>
}

export default function FormulariosPermisos({ personaId = null, onOpenSection }) {
  const [context,setContext] = useState(null), [forms,setForms] = useState([]), [draft,setDraft] = useState(null)
  const [error,setError] = useState(''), [busy,setBusy] = useState(false), [query,setQuery] = useState('')
  const [filters,setFilters] = useState({tipo:'',sede:'',persona:'',estado:'',fecha:''})
  const [preview,setPreview] = useState(null), [audit,setAudit] = useState(null)
  const [templateEdit,setTemplateEdit] = useState({tipo:'ppa_auto',nombre:'',instrucciones:''})
  const lock = useRef(false), frame = useRef(null), previewCounter = useRef(0)
  const load = useCallback(async()=>{
    const [c,f]=await Promise.all([loadFormContext(),listForms(personaId)])
    setContext(c);setForms(f)
  },[personaId])
  useEffect(()=>{let active=true;Promise.all([loadFormContext(),listForms(personaId)]).then(([c,f])=>{if(active){setContext(c);setForms(f)}}).catch(e=>active&&setError(e.message));return()=>{active=false}},[personaId])
  useEffect(()=>()=>{if(preview?.url) URL.revokeObjectURL(preview.url)},[preview])
  function invalidatePreview(){previewCounter.current++;setPreview(null)}
  async function run(task){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await task()}catch(e){setError(e.message || 'No se pudo completar la operación.')}finally{lock.current=false;setBusy(false)}}
  const can = (sede,action) => !!context?.sedes.find(s=>s.id===Number(sede))?.acciones?.includes(action)
  const canAny = action => context?.sedes.some(s=>s.acciones?.includes(action))
  function start(template, source){
    invalidatePreview();setQuery('');setAudit(null)
    const person=context.personas.find(p=>p.id===personaId)
    const sede=source?.sede_id || person?.sede_ids?.find(id=>can(id,'crear')) || context.sedes.find(s=>can(s.id,'crear'))?.id || ''
    setDraft({template_id:template.id,sede_id:sede,persona_ids:source?.persona_ids || (person?.sede_ids?.includes(Number(sede))?[person.id]:[]),acompanante_id:source?.acompanante_id || '',variables:source?.datos.variables || {...newVariables(),aeropuerto:person?.aeroportuario?.aeropuerto || ''}})
  }
  const template = context?.plantillas.find(t=>t.id===draft?.template_id)
  const selectedPeople = context?.personas.filter(p=>draft?.persona_ids.includes(p.id)) || []
  const manualPeople = draft?.variables.personas_manuales || []
  const responsibleOptions = context?.responsables || context?.personas || []
  const totalPeople = selectedPeople.length + manualPeople.length
  const snapshot = draft && template ? { id:draft.id,plantilla:template,datos:{personas:[...selectedPeople,...manualPeople],acompanante:draft.variables.responsable_manual || responsibleOptions.find(p=>p.id===draft.acompanante_id),variables:draft.variables,sede:context.sedes.find(s=>s.id===Number(draft.sede_id))?.nombre} } : null
  const warnings = snapshot ? formWarnings(snapshot.datos,template.tipo) : []
  function change(values){invalidatePreview();setDraft(d=>({...d,...values}))}
  function variable(key,value){change({variables:{...draft.variables,[key]:value}})}
  function changeManual(index,person){variable('personas_manuales',manualPeople.map((p,i)=>i===index?person:p))}
  async function save(){const saved=await saveForm(draft);setDraft({...draft,id:saved.id,version:saved.version});await load();return saved}
  async function previewDraft(){
    validateForm(draft.variables,draft.persona_ids,template.tipo)
    const form=await save()
    const token=++previewCounter.current
    const bytes=await createFormularioPdf(form,{preview:true})
    if(token===previewCounter.current)setPreview({url:URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),final:false,form})
  }
  async function generate(){
    if(!preview || preview.final)throw new Error('Primero revisá la vista previa actualizada.')
    validateForm(draft.variables,draft.persona_ids,template.tipo)
    const form=preview.form
    // Generate the exact persisted snapshot that was previewed; version checks reject concurrent edits.
    const currentWarnings=formWarnings(form.datos,form.plantilla.tipo)
    if(currentWarnings.length && !await confirmar({titulo:'Generar con advertencias',mensaje:currentWarnings.join('\n'),confirmText:'Confirmo y generar',cancelText:'Revisar datos'}))return
    const bytes=await createFormularioPdf(form)
    const path=await uploadFormPdf(form,bytes)
    await transitionForm(form,'generado',path,currentWarnings)
    setDraft(null);invalidatePreview();setPreview({url:URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),final:true,name:`formulario-${form.id}.pdf`})
    await load();toast.ok('PDF generado y guardado en el historial y las fichas de las personas.')
  }
  async function changeState(form,state){
    if(!await confirmar({titulo:stateLabel(state),mensaje:state==='firmado'?'Confirmá que el documento ya fue firmado fuera de la aplicación. Este botón registra el estado; no agrega una firma.':state==='presentado'?'Confirmá que el documento fue presentado ante el organismo.':`El formulario quedará ${stateLabel(state).toLowerCase()} y conservará su archivo e historial.`,confirmText:'Confirmar',cancelText:'Volver'}))return
    await transitionForm(form,state);await load();toast.ok('Estado actualizado.')
  }
  async function openPdf(form){const blob=await getFormPdf(form);invalidatePreview();setPreview({url:URL.createObjectURL(blob),final:true,name:`formulario-${form.id}.pdf`})}
  const filtered=forms.filter(f=>(!filters.tipo||f.plantilla.tipo===filters.tipo)&&(!filters.sede||f.sede_id===Number(filters.sede))&&(!filters.estado||f.estado===filters.estado)&&(!filters.persona||f.persona_ids.includes(filters.persona)||f.acompanante_id===filters.persona)&&(!filters.fecha||f.datos.variables.fecha===filters.fecha))
  return <section className="p-3 md:p-5 space-y-4" aria-label="Formularios y permisos" style={{color:'var(--text)'}}>
    <header className="flex flex-wrap justify-between items-center gap-3"><div><h2 className="font-title text-lg">FORMULARIOS Y PERMISOS</h2><p className="text-sm" style={{color:'var(--text-dim)'}}>Equipo · documentos y permisos aeroportuarios</p></div><button className="btn-ghost" disabled={busy} onClick={()=>run(load)}>Actualizar</button></header>
    {error && <p role="alert" className="glass p-3" style={{color:'var(--danger, #ff7373)'}}>{error}</p>}
    {!context && !error && <p role="status">Cargando formularios…</p>}
    {context && <>
      {!draft && canAny('crear') && <details className="glass p-3" open={!!personaId}><summary className="cursor-pointer"><Plus size={15} className="inline"/> {personaId?`Generar para ${personName(context.personas.find(p=>p.id===personaId)||{})}`:'Nuevo formulario'}</summary><div className="flex flex-wrap gap-2 mt-3">{context.plantillas.filter(t=>t.activa).map(t=><button disabled={busy} key={t.id} className="btn-primary" onClick={()=>start(t)}><FileText size={15} className="inline"/> {t.nombre} · v{t.version}</button>)}{onOpenSection && <><button className="btn-ghost" onClick={()=>onOpenSection('vacaciones')}>Vacaciones</button><button className="btn-ghost" onClick={()=>onOpenSection('uniformes-epp')}>Entrega EPP</button></>}</div><p className="text-sm mt-3">Otros formularios: se incorporan como nuevas plantillas cuando esté disponible su modelo.</p></details>}
      {draft && <div className="glass p-4 space-y-4">
        <div className="flex justify-between gap-3"><h3>{template?.nombre} · {draft.id?'Editar borrador':'Nuevo formulario'}</h3><button disabled={busy} className="btn-ghost" aria-label="Cerrar editor" onClick={()=>{setDraft(null);invalidatePreview()}}><X size={16}/></button></div>
        {template?.instrucciones && <p className="text-sm">{template.instrucciones}</p>}
        <fieldset disabled={busy} className="space-y-4">
          <Field label="Sede / escala"><select className={input} value={draft.sede_id} onChange={e=>change({sede_id:e.target.value,persona_ids:[],acompanante_id:''})}><option value="">Seleccionar sede</option>{context.sedes.filter(s=>can(s.id,draft.id?'editar':'crear')).map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}</select></Field>
          <h4>Personas que solicitan el permiso</h4><Field label="Buscar colaborador activo"><input className={input} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nombre, apellido o legajo"/></Field>
          <div className="space-y-2 overflow-auto" style={{maxHeight:210}}>{context.personas.filter(p=>p.sede_ids?.includes(Number(draft.sede_id))&&`${personName(p)} ${p.legajo||''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(p=><label key={p.id} className="flex gap-2 items-center p-2"><input type={template?.tipo==='ppa_auto'?'radio':'checkbox'} name="participantes" checked={draft.persona_ids.includes(p.id)} disabled={template?.tipo==='ppa_auto'&&manualPeople.length>0} onChange={()=>change({persona_ids:template.tipo==='ppa_auto'?[p.id]:draft.persona_ids.includes(p.id)?draft.persona_ids.filter(id=>id!==p.id):[...draft.persona_ids,p.id]})}/>{personName(p)} · {p.legajo||'Sin legajo'}</label>)}</div>
          <p className="text-sm">{totalPeople} persona/s: {selectedPeople.length} de Equipo y {manualPeople.length} de carga manual.</p>
          <button type="button" className="btn-ghost" disabled={totalPeople>=100||(template?.tipo==='ppa_auto'&&totalPeople>0)} onClick={()=>variable('personas_manuales',[...manualPeople,newManualPerson()])}><Plus size={14} className="inline"/> Agregar persona manual</button>
          {template?.tipo==='ppa_auto'&&selectedPeople.length>0&&<button type="button" className="btn-ghost ml-2" onClick={()=>change({persona_ids:[],variables:{...draft.variables,personas_manuales:[newManualPerson(selectedPeople[0])]}})}>Completar persona manualmente</button>}
          {manualPeople.map((p,i)=><FormularioPersonaManual key={i} label={`Persona manual ${i+1}`} value={p} airport={template?.tipo==='ppa_auto'} onChange={v=>changeManual(i,v)} onRemove={()=>variable('personas_manuales',manualPeople.filter((_,j)=>j!==i))}/>)}
          {selectedPeople.map(p=><div className="text-sm" key={p.id}><strong>{personName(p)}</strong> · DNI {p.dni||'sin cargar'} · {p.puesto||'sin cargo'} · Categoría {p.categoria||'sin cargar'}<AirportData key={`${p.id}-${JSON.stringify(p.aeroportuario)}`} person={p} editable={can(draft.sede_id,'editar')} busy={busy} run={run} onSaved={async()=>{invalidatePreview();await load()}}/></div>)}
          {template?.tipo==='anexo_e' && <>
            <Field label="Responsable del acompañamiento"><select className={input} value={draft.variables.responsable_manual?'manual':draft.acompanante_id} onChange={e=>change({acompanante_id:e.target.value==='manual'?'':e.target.value,variables:{...draft.variables,responsable_manual:e.target.value==='manual'?newManualPerson(snapshot?.datos.acompanante || {}):null}})}><option value="">Seleccionar responsable</option><option value="manual">Completar responsable manualmente</option>{responsibleOptions.map(p=><option key={p.id} value={p.id}>{personName(p)} · PPA {p.aeroportuario?.ppa||'sin cargar'}</option>)}</select></Field>
            {draft.variables.responsable_manual ? <FormularioPersonaManual label="Responsable manual" value={draft.variables.responsable_manual} airport onChange={v=>variable('responsable_manual',v)}/> : snapshot?.datos.acompanante && <>
              <AirportData key={`${snapshot.datos.acompanante.id}-${JSON.stringify(snapshot.datos.acompanante.aeroportuario)}`} person={snapshot.datos.acompanante} editable={snapshot.datos.acompanante.sede_ids?.some(s=>can(s,'editar'))} busy={busy} run={run} onSaved={async()=>{invalidatePreview();await load()}}/>
              <button type="button" className="btn-ghost" onClick={()=>change({acompanante_id:'',variables:{...draft.variables,responsable_manual:newManualPerson(snapshot.datos.acompanante)}})}>Completar datos del responsable sólo para este formulario</button>
            </>}
          </>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[['fecha','Fecha','date'],['dias','Días adicionales (opcional)','text'],['desde','Desde','time'],['hasta','Hasta','time'],['empresa','Empresa / organismo','text'],['aeropuerto','Aeropuerto','text'],['sectores','Sectores solicitados (1 a 7)','text']].map(([key,label,type])=><Field key={key} label={label}><input className={input} type={type} value={draft.variables[key]||''} onChange={e=>variable(key,e.target.value)} maxLength={180}/></Field>)}</div>
          <Field label="Tareas a desarrollar"><textarea className={input} value={draft.variables.tareas} onChange={e=>variable('tareas',e.target.value)} maxLength={4000}/></Field>
          {template?.tipo==='anexo_e' && sectors(draft.variables.sectores).map(s=><Field key={s} label={`Justificación sector ${s}`}><input className={input} value={draft.variables.justificaciones?.[s]||''} maxLength={500} onChange={e=>variable('justificaciones',{...draft.variables.justificaciones,[s]:e.target.value})}/></Field>)}
          <Field label="Observaciones"><textarea className={input} value={draft.variables.observaciones} onChange={e=>variable('observaciones',e.target.value)} maxLength={4000}/></Field>
        </fieldset>
        {!!warnings.length && <ul className="text-sm space-y-1" style={{color:'#ff7373'}}>{warnings.map(w=><li key={w}>{w}</li>)}</ul>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" disabled={busy||!draft.sede_id||!totalPeople} onClick={()=>run(async()=>{invalidatePreview();await save();toast.ok('Borrador guardado.')})}>Guardar borrador</button>
          <button className="btn-ghost" disabled={busy||!totalPeople} onClick={()=>run(previewDraft)}>Vista previa</button>
          {can(draft.sede_id,'generar') && <button className="btn-primary" disabled={busy||!preview||preview.final} onClick={()=>run(generate)}>{busy?'Procesando…':'Generar PDF'}</button>}
        </div>
      </div>}
      {personaId && !draft && context.personas.filter(p=>p.id===personaId).map(p=><AirportData key={`${p.id}-${JSON.stringify(p.aeroportuario)}`} person={p} editable={p.sede_ids?.some(s=>can(s,'editar'))} busy={busy} run={run} onSaved={load}/>)}
      {preview && <div className="glass p-3 space-y-3"><div className="flex flex-wrap gap-2 items-center"><h3>{preview.final?'PDF guardado':'VISTA PREVIA'}</h3><button className="btn-ghost" onClick={()=>setPreview(null)}>Cerrar vista previa</button>{preview.final && <><a className="btn-primary" href={preview.url} download={preview.name}>Descargar</a><button className="btn-ghost" onClick={()=>{try{frame.current?.contentWindow?.print()}catch{window.open(preview.url,'_blank','noopener')}}}>Imprimir</button></>}</div><iframe ref={frame} title="Vista previa del formulario PDF" src={preview.url} className="w-full" style={{height:600,background:'white'}}/><a href={preview.url} target="_blank" rel="noreferrer" className="btn-ghost">Abrir PDF en otra pestaña</a></div>}
      <h3 className="font-title">Historial de formularios</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">{[['tipo','Tipo de formulario',[['ppa_auto','Auto-acompañamiento'],['anexo_e','Anexo E']]],['sede','Sede / escala',context.sedes.map(s=>[s.id,s.nombre])],['persona','Colaborador',context.personas.map(p=>[p.id,personName(p)])],['estado','Estado',FORM_STATES.map(s=>[s,stateLabel(s)])]].map(([key,label,options])=><Field key={key} label={label}><select className={input} value={filters[key]} onChange={e=>setFilters({...filters,[key]:e.target.value})}><option value="">Todos</option>{options.map(([id,text])=><option key={id} value={id}>{text}</option>)}</select></Field>)}<Field label="Fecha del formulario"><input className={input} type="date" value={filters.fecha} onChange={e=>setFilters({...filters,fecha:e.target.value})}/></Field></div>
      {!filtered.length && <p>No hay formularios para estos filtros.</p>}
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>{['Fecha','Tipo','Persona/s','Sede','Estado','Creado por','Archivo / Acciones'].map(t=><th key={t} className="p-2">{t}</th>)}</tr></thead><tbody>{filtered.map(f=><tr className="border-b border-white/10" key={f.id}><td className="p-2">{formatDate(f.created_at)}</td><td className="p-2">{f.plantilla.nombre} · v{f.plantilla.version}</td><td className="p-2">{f.datos.personas.map(personName).join('; ')}</td><td className="p-2">{f.datos.sede}</td><td className="p-2">{stateLabel(f.estado)}</td><td className="p-2">{f.created_name}</td><td className="p-2"><div className="flex flex-wrap gap-2">
        {f.archivo&&<button className="btn-ghost" disabled={busy} onClick={()=>run(()=>openPdf(f))}>Ver / descargar PDF</button>}
        {f.estado==='borrador'&&can(f.sede_id,'editar')&&<button className="btn-ghost" disabled={busy} onClick={()=>{invalidatePreview();setDraft({id:f.id,version:f.version,template_id:f.template_id,sede_id:f.sede_id,persona_ids:f.persona_ids,acompanante_id:f.acompanante_id||'',variables:f.datos.variables})}}>Editar borrador</button>}
        {can(f.sede_id,'crear')&&<button className="btn-ghost" disabled={busy} onClick={()=>{const t=context.plantillas.find(t=>t.tipo===f.plantilla.tipo&&t.activa);if(t)start(t,f);else setError('No hay una plantilla activa de este tipo.')}}>Duplicar</button>}
        {f.estado==='generado'&&can(f.sede_id,'generar')&&<button className="btn-ghost" disabled={busy} onClick={()=>run(()=>changeState(f,'pendiente_firma'))}>Pendiente de firma</button>}
        {['generado','pendiente_firma'].includes(f.estado)&&can(f.sede_id,'firmar')&&<button className="btn-ghost" disabled={busy} onClick={()=>run(()=>changeState(f,'firmado'))}>Marcar firmado</button>}
        {f.estado==='firmado'&&can(f.sede_id,'presentar')&&<button className="btn-ghost" disabled={busy} onClick={()=>run(()=>changeState(f,'presentado'))}>Marcar presentado</button>}
        {!['borrador','vencido','anulado'].includes(f.estado)&&can(f.sede_id,'editar')&&<button className="btn-ghost" disabled={busy} onClick={()=>run(()=>changeState(f,'vencido'))}>Marcar vencido</button>}
        {f.estado!=='anulado'&&can(f.sede_id,'anular')&&<button className="btn-ghost" disabled={busy} onClick={()=>run(()=>changeState(f,'anulado'))}>Anular</button>}
        <button className="btn-ghost" disabled={busy} onClick={()=>run(async()=>setAudit(await formHistory(f.id)))}>Trazabilidad</button>
      </div></td></tr>)}</tbody></table></div>
      {audit && <div className="glass p-3"><h3>Trazabilidad</h3><button className="btn-ghost" onClick={()=>setAudit(null)}>Cerrar</button>{audit.map(a=><details key={a.id} className="mt-2"><summary>{formatDate(a.created_at)} · {a.actor_nombre} · {stateLabel(a.despues?.estado)}</summary><pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify({antes:a.antes,despues:a.despues},null,2)}</pre></details>)}</div>}
      {canAny('plantillas') && <details className="glass p-3"><summary>Administrar plantillas</summary><p className="text-sm my-3">Cada nueva versión conserva el diseño del tipo elegido. Los formularios ya emitidos mantienen su versión. Un cambio de diseño oficial requiere incorporar su nuevo PDF y distribución de campos.</p><div className="grid sm:grid-cols-2 gap-3"><Field label="Diseño"><select className={input} value={templateEdit.tipo} onChange={e=>setTemplateEdit({...templateEdit,tipo:e.target.value})}><option value="ppa_auto">Auto-acompañamiento</option><option value="anexo_e">Anexo E</option></select></Field><Field label="Nombre de la nueva versión"><input className={input} maxLength={200} value={templateEdit.nombre} onChange={e=>setTemplateEdit({...templateEdit,nombre:e.target.value})}/></Field><Field label="Instrucciones"><textarea className={input} maxLength={2000} value={templateEdit.instrucciones} onChange={e=>setTemplateEdit({...templateEdit,instrucciones:e.target.value})}/></Field></div><button disabled={busy} className="btn-primary mt-3" onClick={()=>run(async()=>{await saveTemplate(templateEdit.tipo,templateEdit.nombre,templateEdit.instrucciones);await load();toast.ok('Nueva versión creada.')})}>Crear versión</button>{context.plantillas.map(t=><div key={t.id} className="flex gap-3 mt-3">{t.nombre} · v{t.version}<button className="btn-ghost" disabled={busy} onClick={()=>run(async()=>{await setTemplateActive(t.id,!t.activa);await load()})}>{t.activa?'Desactivar':'Activar'}</button></div>)}</details>}
      {context.admin && <details className="glass p-3"><summary>Permisos por rol</summary><p className="text-sm my-3">Sólo aeropuertos. Administrador: todos. Encargados y supervisores designados: sus sedes asignadas. Habilitar acciones aquí no habilita el acceso al módulo Equipo.</p><h4>Supervisores habilitados</h4><p className="text-sm">Esta designación habilita sólo esta función; no cambia el rol general ni las sedes asignadas.</p>{(context.supervisores || []).map(u=><label key={u.id} className="block my-2"><input type="checkbox" checked={u.habilitado} disabled={busy} onChange={()=>run(async()=>{await saveSupervisor(u.id,!u.habilitado);await load()})}/> {u.nombre}</label>)}{context.roles.filter(r=>r.rol!=='admin').map(r=><RoleActions key={`${r.rol}-${r.acciones.join()}`} row={r} busy={busy} run={run} load={load}/>)}</details>}
    </>}
  </section>
}
function RoleActions({row,busy,run,load}){
  const [actions,setActions]=useState(row.acciones)
  return <div className="border-b border-white/10 py-3"><strong>{row.rol}</strong><div className="flex flex-wrap gap-3 my-2">{FORM_ACTIONS.map(a=><label key={a}><input type="checkbox" disabled={busy} checked={actions.includes(a)} onChange={()=>setActions(actions.includes(a)?actions.filter(x=>x!==a):[...actions,a])}/> {a}</label>)}</div><button className="btn-ghost" disabled={busy} onClick={()=>run(async()=>{if(await confirmar({titulo:'Actualizar permisos',mensaje:`Se actualizarán las acciones del rol ${row.rol}.`,confirmText:'Guardar permisos'})){await saveRoleActions(row.rol,actions);await load()}})}>Guardar permisos de {row.rol}</button></div>
}
