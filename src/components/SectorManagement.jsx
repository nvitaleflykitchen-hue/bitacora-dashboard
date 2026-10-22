import { groupCredentialSectors } from '../lib/credentialAccess'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { canManageSectorAccess, sectorCode } from '../lib/sectorMatrix'
import { mensajeError } from '../lib/errores'
import SectorMatrix from './SectorMatrix'
import CredencialPersonalModal from './CredencialPersonalModal'

export default function SectorManagement({ sedes = [], personas = [] }) {
  const { perfil } = useAuth()
  const admin = perfil?.rol === 'admin'
  const manager = canManageSectorAccess(perfil)
  const [site, setSite] = useState(String(sedes.find(s => s.id === 24)?.id || sedes[0]?.id || ''))
  const [catalog, setCatalog] = useState([])
  const [events, setEvents] = useState([])
  const [own, setOwn] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  const [edit, setEdit] = useState(null)
  const [personId, setPersonId] = useState('')
  const [showCredential, setShowCredential] = useState(false)
  const [tab, setTab] = useState('matriz')
  useEffect(() => {
    setSite(current => sedes.some(s => String(s.id) === current) ? current : String(sedes.find(s => s.id === 24)?.id || sedes[0]?.id || ''))
  }, [sedes])
  useEffect(() => {
    let active = true
    setError(''); setCatalog([]); setEvents([]); setEdit(null); setBusy(true)
    const load = async () => {
      if (!manager) {
        const { data, error } = await supabase.rpc('mis_sectores_autorizados')
        if (error) throw error
        if (active) setOwn(data)
        return
      }
      if (!site) return
      const { data, error } = await supabase.schema('equipo').from('credencial_sectores').select('*').eq('sede_id',Number(site)).order('numero').order('codigo')
      if (error) throw error
      if (active) setCatalog(data || [])
      if (admin && personId) {
        const { data:history, error:historyError } = await supabase.schema('equipo').from('credencial_eventos').select('*').eq('persona_id',personId).order('created_at',{ascending:false}).limit(100)
        if (historyError) throw historyError
        if (active) setEvents(history || [])
      }
    }
    load().catch(e => { if (active) setError(mensajeError(e)) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [site, reload, manager, admin, personId])
  const people = personas.filter(p => p.activo !== false && p.sede_ids?.includes(Number(site)))
  const person = people.find(p => p.id === personId)
  const visible = catalog.filter(s => s.version_matriz === 2)
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const payload = { nombre:edit.nombre.trim(), grupo:edit.grupo.trim(), color:edit.color, zra:edit.zra, clasificacion:edit.zra?'Restringido':'General', activo:edit.activo }
      let query = supabase.schema('equipo').from('credencial_sectores')
      if (edit.id) query = query.update(payload).eq('id',edit.id)
      else query = query.insert({ ...payload, sede_id:Number(site), numero:Number(edit.numero), simbolo:edit.simbolo, codigo:sectorCode(edit), tipo:'sector', version_matriz:2 })
      const { error } = await query.select('id').single()
      if (error) throw error
      setEdit(null); setReload(v => v+1)
    } catch (e) { setError(mensajeError(e)) } finally { setBusy(false) }
  }
  if (!manager) return <section className="space-y-4"><h2 className="text-xl font-bold">Mis sectores autorizados</h2>{error && <p role="alert">{error}</p>}{busy && <p>Cargando…</p>}{own && <><p>Credencial: {own.estado || 'Sin emitir'} · Vence: {own.fecha_vencimiento || '—'}</p>{groupCredentialSectors(own.sectores_autorizados || []).map(g=><section key={g.sedeId}><h3 className="font-bold">{g.nombre}</h3><SectorMatrix sectors={g.sectores}/></section>)}{!own.sectores_autorizados?.length && <p>No hay accesos vigentes.</p>}{own.sectores_autorizados?.filter(s=>s.tipo==='condicion'||s.codigo==='Z').map(s=><p key={s.id}>{s.sede_nombre}: acceso total {s.vigente_hasta?`hasta ${s.vigente_hasta}`:''}</p>)}</>}</section>
  return <section className="space-y-4">
    <h2 className="text-xl font-bold">Sectores y accesos</h2>
    <p>El color identifica el grupo funcional. Cada sector requiere autorización individual.</p>
    {error && <p role="alert" className="text-red-400">{error}</p>}
    <label>Sede<select className="input-dark w-full" value={site} disabled={busy} onChange={e=>{setSite(e.target.value);setPersonId('')}}>{sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
    <div className="flex flex-wrap gap-2">{[['matriz','Matriz de sectores'],['autorizaciones','Autorizaciones'],...(admin?[['historial','Auditoría de cambios']]:[])].map(([id,label])=><button key={id} className={tab===id?'btn-primary':'btn-ghost'} onClick={()=>setTab(id)}>{label}</button>)}</div>
    {busy && <p role="status">Cargando…</p>}
    {tab==='matriz' && <>
      <div className="flex flex-wrap gap-2">{[...new Map(visible.filter(s=>s.grupo).map(s=>[s.grupo,s.color])).entries()].map(([group,color])=><span key={group} style={{borderLeft:`5px solid ${color}`,paddingLeft:6}}>{group}</span>)}</div>
      <SectorMatrix sectors={visible} onSelect={setEdit} disabled={busy}/>
      {!busy && !visible.length && <p>Esta sede todavía no tiene matriz nueva configurada.</p>}
      {admin && <button className="btn-ghost" onClick={()=>setEdit({numero:'',simbolo:'',nombre:'',grupo:'',color:'#334155',activo:true,zra:false})}>Agregar sector físico</button>}
      {edit && <form onSubmit={save} className="glass p-4 space-y-3"><h3 className="font-bold">{edit.id?sectorCode(edit):'Nuevo sector'}</h3><fieldset disabled={!admin||busy} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label>Número<input required disabled={!!edit.id} type="number" min="1" max="999" className="input-dark w-full" value={edit.numero} onChange={e=>setEdit({...edit,numero:e.target.value})}/></label>
        <label>Símbolo<input required disabled={!!edit.id} pattern="[A-Z][a-z]" maxLength={2} className="input-dark w-full" value={edit.simbolo} onChange={e=>setEdit({...edit,simbolo:e.target.value})}/></label>
        {[['nombre','Denominación'],['grupo','Grupo funcional']].map(([key,label])=><label key={key}>{label}<input required maxLength={100} className="input-dark w-full" value={edit[key]||''} onChange={e=>setEdit({...edit,[key]:e.target.value})}/></label>)}
        <label>Color del grupo<input type="color" className="block" value={edit.color} onChange={e=>setEdit({...edit,color:e.target.value})}/></label>
        <div><label className="block"><input type="checkbox" checked={edit.zra} onChange={e=>setEdit({...edit,zra:e.target.checked})}/> Acceso restringido</label><label className="block"><input type="checkbox" checked={edit.activo} onChange={e=>setEdit({...edit,activo:e.target.checked})}/> Activo</label></div>
      </fieldset><p className="text-sm">Desactivar un sector retira su autorización de la validación QR. El historial se conserva.</p><div className="flex gap-2">{admin && <button disabled={busy} className="btn-primary">Guardar sector</button>}<button type="button" className="btn-ghost" onClick={()=>setEdit(null)}>Cerrar</button></div></form>}
    </>}
    {tab!=='matriz' && <label>Empleado<select className="input-dark w-full" value={personId} onChange={e=>setPersonId(e.target.value)}><option value="">Seleccionar empleado</option>{people.map(p=><option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>)}</select></label>}
    {tab==='autorizaciones' && person && <><p>Asignar, revocar o modificar vigencias requiere reemitir la credencial. El QR anterior quedará invalidado.</p><button className="btn-primary" onClick={()=>setShowCredential(true)}>Gestionar sectores y credencial</button></>}
    {tab==='historial' && person && <div className="space-y-2"><p>Últimos 100 eventos de esta persona.</p>{events.map(e=><article key={e.id} className="glass p-3"><strong>{e.operacion} · {e.detalle.codigo || 'Sector'}</strong><p>{new Date(e.created_at).toLocaleString('es-AR')} · Usuario: {e.actor_id || 'Sistema'}</p><p>{e.detalle.nombre} · Vigencia: {e.detalle.vigente_hasta || 'Hasta vencimiento de credencial'}</p></article>)}{!busy&&!events.length&&<p>Sin eventos registrados en el nuevo historial.</p>}</div>}
    {showCredential && person && <CredencialPersonalModal persona={person} sedes={sedes} onClose={()=>{setShowCredential(false);setReload(v=>v+1)}}/>}
  </section>
}
