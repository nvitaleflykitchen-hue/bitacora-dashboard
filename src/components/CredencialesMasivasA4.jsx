import { credentialIsValid } from '../lib/credentialAccess'
import { useCallback,useEffect,useMemo,useState } from 'react'
import { CheckSquare,FileDown,Loader2,Search,Square } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { descargarCredencialesA4,hojasCredencialesA4,expandCredentialCards } from '../lib/credencialesA4'
import { mensajeError } from '../lib/errores'
import { toast } from '../lib/feedback'
import { PersonaAvatar } from './PersonaAvatar'

export default function CredencialesMasivasA4({personas,sedes}){
  const {perfil}=useAuth()
  const [credenciales,setCredenciales]=useState([]),[loading,setLoading]=useState(true)
  const [generating,setGenerating]=useState(false),[selected,setSelected]=useState(new Set())
  const [search,setSearch]=useState(''),[sedeId,setSedeId]=useState('')

  useEffect(()=>{
    let mounted=true
    supabase.schema('equipo').from('credenciales_personal').select('*').eq('estado','activa').order('fecha_emision',{ascending:false})
      .then(({data,error})=>{
        if(!mounted)return
        if(error)toast.error(`No se pudieron cargar las credenciales: ${mensajeError(error)}`)
        setCredenciales((data||[]).filter(credential=>credentialIsValid(credential)));setLoading(false)
      })
    return()=>{mounted=false}
  },[])

  const normalizar=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  const sedePersona=useCallback(persona=>sedes.filter(s=>persona.sede_ids?.some(id=>String(id)===String(s.id))).map(s=>s.nombre).sort((a,b)=>a.localeCompare(b,'es')).join(' · ')||'Sin sede',[sedes])
  const filas=useMemo(()=>{
    const personasById=new Map(personas.map(persona=>[String(persona.id),persona])),q=normalizar(search.trim())
    return credenciales.map(credencial=>({credencial,persona:personasById.get(String(credencial.persona_id))}))
      .filter(({persona})=>persona)
      .filter(({persona})=>!sedeId||persona.sede_ids?.some(id=>String(id)===sedeId))
      .filter(({persona})=>!q||normalizar(`${persona.nombre} ${persona.apellido||''} ${persona.dni||''} ${persona.legajo||''} ${persona.puesto||''} ${sedePersona(persona)}`).includes(q))
      .sort((a,b)=>sedePersona(a.persona).localeCompare(sedePersona(b.persona),'es',{sensitivity:'base'}) || `${a.persona.nombre} ${a.persona.apellido||''}`.localeCompare(`${b.persona.nombre} ${b.persona.apellido||''}`,'es',{sensitivity:'base'}))
  },[credenciales,personas,search,sedeId,sedePersona])

  if(perfil?.rol!=='admin')return null
  const visibleIds=filas.map(({credencial})=>credencial.id)
  const allVisibleSelected=visibleIds.length>0&&visibleIds.every(id=>selected.has(id))
  const seleccionadas=filas.filter(({credencial})=>selected.has(credencial.id))
  const toggleAll=()=>setSelected(current=>{
    const next=new Set(current)
    if(allVisibleSelected)visibleIds.forEach(id=>next.delete(id));else visibleIds.forEach(id=>next.add(id))
    return next
  })
  const toggle=id=>setSelected(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next})
  const descargar=async()=>{
    setGenerating(true)
    try{await descargarCredencialesA4(seleccionadas);toast.ok('PDF A4 generado.')}
    catch(error){toast.error(mensajeError(error))}
    finally{setGenerating(false)}
  }

  return <div className="max-w-6xl space-y-4">
    <div className="glass p-4 flex items-start justify-between gap-5">
      <div><p className="font-title font-bold" style={{color:'var(--phosphor)'}}>CREDENCIALES EMITIDAS · IMPRESIÓN A4</p>
        <p style={{color:'var(--text-dim)',fontSize:'.72rem',marginTop:4}}>9 tarjetas CR80 por hoja; una tarjeta por sede autorizada. Primero se generan los frentes y luego los dorsos alineados para impresión doble faz por borde largo.</p></div>
      <button className="btn-primary flex items-center gap-2" disabled={!seleccionadas.length||generating} onClick={descargar}>
        {generating?<Loader2 size={14} className="animate-spin"/>:<FileDown size={14}/>}
        {generating?'Generando…':'Imprimir en A4'}
      </button>
    </div>
    <div className="grid grid-cols-3 gap-3">
      {[['EMITIDAS ACTIVAS',credenciales.length],['SELECCIONADAS',seleccionadas.length],['HOJAS A4 DOBLE FAZ',hojasCredencialesA4(expandCredentialCards(seleccionadas).length)]].map(([label,value])=>
        <div key={label} className="glass p-3 text-center"><p className="font-title font-bold text-xl" style={{color:'var(--phosphor)'}}>{value}</p><p className="font-metric" style={{color:'var(--text-dim)',fontSize:'.58rem'}}>{label}</p></div>)}
    </div>
    <div className="glass p-3" style={{position:'sticky',top:0,zIndex:5,background:'var(--surface)',display:'flex',flexWrap:'wrap',gap:12}}>
      <select aria-label="Filtrar credenciales por sede" style={{flex:'1 1 240px',width:'auto',minWidth:0}} className="input-dark" value={sedeId} onChange={event=>setSedeId(event.target.value)}>
        <option value="">Todas las sedes</option>{[...sedes].sort((a,b)=>a.nombre.localeCompare(b.nombre,'es',{sensitivity:'base'})).map(sede=><option key={sede.id} value={sede.id}>{sede.nombre}</option>)}
      </select>
      <div className="relative" style={{flex:'2 1 300px',minWidth:240}}><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--text-dim)'}}/>
        <input aria-label="Buscar personas con credencial" className="input-dark w-full pl-9" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar nombre, DNI, legajo, puesto o sede…"/></div>
      <button className="btn-ghost flex items-center gap-2" onClick={toggleAll} disabled={!filas.length}>
        {allVisibleSelected?<CheckSquare size={14}/>:<Square size={14}/>} {allVisibleSelected?'Quitar visibles':'Seleccionar visibles'}
      </button>
    </div>
    <p style={{color:'var(--text-dim)'}}>{filas.length} resultados · Ordenados por sede y nombre A–Z</p>
    {loading?<div className="glass p-10 flex items-center justify-center gap-2" style={{color:'var(--text-dim)'}}><Loader2 size={16} className="animate-spin"/> Cargando credenciales emitidas…</div>
      :filas.length===0?<div className="glass p-10 text-center" style={{color:'var(--text-dim)'}}>No hay credenciales activas que coincidan con los filtros.</div>
      :<div className="space-y-2">{filas.map(({persona,credencial},index)=>{
        const checked=selected.has(credencial.id),sede=sedePersona(persona)
        return <div key={credencial.id}>{(index===0||sedePersona(filas[index-1].persona)!==sede)&&<h3 style={{padding:'16px 0 8px',color:'var(--phosphor)',fontWeight:700}}>{sede}</h3>}<button type="button" className="glass w-full p-3 flex items-center gap-4 text-left" onClick={()=>toggle(credencial.id)} style={{borderColor:checked?'rgba(57,255,20,.5)':undefined}}>
          {checked?<CheckSquare size={18} style={{color:'var(--phosphor)'}}/>:<Square size={18} style={{color:'var(--text-dim)'}}/>}
          <PersonaAvatar persona={persona} size={42}/><div className="flex-1 min-w-0"><p className="font-title font-bold">{persona.nombre} {persona.apellido||''}</p><p style={{color:'var(--text-dim)',fontSize:'.7rem'}}>{persona.puesto||'Sin puesto'} · {sede}</p></div>
          <div className="text-right"><p className="font-metric" style={{color:'var(--phosphor)',fontSize:'.62rem'}}>ACTIVA</p><p style={{color:'var(--text-dim)',fontSize:'.66rem'}}>Vence {credencial.fecha_vencimiento}</p></div>
        </button></div>})}</div>}
  </div>
}
