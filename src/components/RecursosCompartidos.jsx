import { useCallback, useEffect, useState } from 'react'
import { Plus, FileText } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { db } from '../lib/supabase'
import { loadResources, saveResource, resourceUrl } from '../lib/bibliotecaRecursos'

export default function RecursosCompartidos({ categoria=null, compact=false }) {
  const { perfil, user }=useAuth()
  const admin=perfil?.rol==='admin' && perfil?.activo!==false
  const [rows,setRows]=useState([]),[groups,setGroups]=useState([]),[editing,setEditing]=useState(false)
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[notice,setNotice]=useState('')
  const [file,setFile]=useState(null),[draft,setDraft]=useState({titulo:'',descripcion:'',categoria:categoria || 'General',grupo_id:'',url:''})
  const load=useCallback(async()=>{
    setLoading(true);setError('')
    try {
      const [resources,grupos]=await Promise.all([loadResources(categoria),db().from('grupos').select('id,nombre').order('nombre')])
      if(grupos.error) throw grupos.error
      setRows(resources);setGroups(grupos.data || [])
    } catch(e){setError(e.message || 'No se pudieron cargar los recursos.')} finally {setLoading(false)}
  },[categoria])
  useEffect(()=>{load()},[load])
  const change=(key,value)=>setDraft(current=>({...current,[key]:value}))
  async function submit(e){
    e.preventDefault();setBusy(true);setError('');setNotice('')
    try {
      const resource=await saveResource(draft,file,user.id)
      setRows(current=>[resource,...current]);setEditing(false);setFile(null)
      setDraft({titulo:'',descripcion:'',categoria:categoria || 'General',grupo_id:'',url:''});setNotice('Recurso agregado.')
    } catch(e){setError(e.message || 'No se pudo guardar.')} finally {setBusy(false)}
  }
  async function open(resource){
    const tab=window.open('about:blank','_blank')
    if(tab) tab.opener=null
    try {const url=await resourceUrl(resource);if(tab) tab.location.href=url;else setError('Permití abrir pestañas para consultar el recurso.')} catch(e){tab?.close();setError(e.message)}
  }
  async function update(resource,changes){
    setBusy(true);setError('')
    try {
      const {data,error}=await db().from('biblioteca_recursos').update(changes).eq('id',resource.id).select().single()
      if(error) throw error
      setRows(current=>current.map(row=>row.id===data.id ? data:row))
    } catch(e){setError(e.message)} finally {setBusy(false)}
  }
  return <section aria-label="Recursos compartidos" className="mb-4">
    {admin && !compact && <button type="button" className="btn-primary mb-4" onClick={()=>setEditing(value=>!value)} disabled={busy}><Plus size={14}/> {editing ? 'Cerrar carga':'Agregar recurso'}</button>}
    {loading && <p role="status">Cargando recursos compartidos…</p>}
    {error && <p role="alert" className="mb-3">{error} <button type="button" className="btn-ghost" onClick={load} disabled={busy}>Reintentar</button></p>}
    {notice && <p role="status">{notice}</p>}
    {editing && <form onSubmit={submit} className="glass p-4 mb-4">
      <h3 className="font-bold mb-3">Nuevo recurso</h3>
      <fieldset disabled={busy} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label>Título *<input className="input-dark w-full" required maxLength={200} value={draft.titulo} onChange={e=>change('titulo',e.target.value)}/></label>
        <label>Grupo con acceso<select className="input-dark w-full" value={draft.grupo_id} onChange={e=>change('grupo_id',e.target.value)}><option value="">Todos los grupos</option>{groups.map(g=><option key={g.id} value={g.id}>{g.nombre}</option>)}</select></label>
        <label>Categoría<select className="input-dark w-full" value={draft.categoria} disabled={Boolean(categoria)} onChange={e=>change('categoria',e.target.value)}>{['General','Calidad e inocuidad','Evaluaciones de desempeño','Asistentes y consultas'].map(c=><option key={c}>{c}</option>)}</select></label>
        <label>Archivo (hasta 20 MB)<input className="input-dark w-full" type="file" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg" onChange={e=>setFile(e.target.files?.[0] || null)}/></label>
        {!file && <label>Enlace HTTPS *<input className="input-dark w-full" type="url" required maxLength={2000} value={draft.url} onChange={e=>change('url',e.target.value)} placeholder="https://…"/></label>}
        <label>Descripción<textarea className="input-dark w-full" maxLength={2000} value={draft.descripcion} onChange={e=>change('descripcion',e.target.value)}/></label>
      </fieldset>
      <p className="text-sm my-3">El grupo incluye a sus usuarios y a los usuarios de sus sedes. Admin, editor y consultor mantienen su acceso global. Los enlaces externos conservan los permisos del sitio de origen.</p>
      <button className="btn-primary" disabled={busy}>{busy ? 'Guardando…':'Guardar recurso'}</button>
    </form>}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{rows.map(resource=><article key={resource.id} className="glass p-4" style={{overflowWrap:'anywhere'}}>
      <h3 className="font-bold"><FileText size={16}/> {resource.titulo}</h3>
      <p className="my-2 text-sm">{resource.descripcion}</p>
      <p className="text-sm mb-3">Acceso: {resource.grupo_id ? groups.find(g=>g.id===resource.grupo_id)?.nombre || 'Grupo asignado':'Todos los grupos'}{!resource.activo && ' · Archivado'}</p>
      <button type="button" className="btn-ghost" onClick={()=>open(resource)}>Abrir recurso</button>
      {admin && !compact && <details className="mt-3"><summary>Administrar recurso</summary>
        <label>Grupo con acceso<select className="input-dark w-full" disabled={busy} value={resource.grupo_id || ''} onChange={e=>update(resource,{grupo_id:e.target.value ? Number(e.target.value):null})}><option value="">Todos los grupos</option>{groups.map(g=><option key={g.id} value={g.id}>{g.nombre}</option>)}</select></label>
        <button type="button" className="btn-ghost mt-2" disabled={busy} onClick={()=>update(resource,{activo:!resource.activo})}>{resource.activo ? 'Archivar':'Reactivar'}</button>
      </details>}
    </article>)}</div>
  </section>
}
