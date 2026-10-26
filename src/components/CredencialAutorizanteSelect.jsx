import { useEffect, useState } from 'react'
import { getAutorizantesCredencial } from '../lib/credenciales'

export default function CredencialAutorizanteSelect({ sedeIds, value, onChange }) {
  const [items,setItems]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState(false)
  const [retry,setRetry]=useState(0)
  const scope=[...new Set(sedeIds.map(Number))].sort((a,b)=>a-b).join(',')
  useEffect(()=>{
    let cancelled=false
    setLoading(true);setError(false);setItems([])
    getAutorizantesCredencial(scope?scope.split(',').map(Number):[])
      .then(data=>{if(!cancelled)setItems(data)})
      .catch(()=>{if(!cancelled)setError(true)})
      .finally(()=>{if(!cancelled)setLoading(false)})
    return ()=>{cancelled=true}
  },[scope,retry])
  const historical=value&&!items.some(item=>item.label===value)
  return <div>
    <label>Responsable que autoriza
      <select aria-label="Responsable que autoriza" className="input-dark w-full" value={value} disabled={loading||error} onChange={e=>onChange(e.target.value)}>
        <option value="">{loading?'Cargando autorizantes…':'Seleccionar autorizante…'}</option>
        {historical&&<option value={value} disabled>{value} · registrado anteriormente</option>}
        {items.map(item=><option key={item.id} value={item.label}>{item.label}</option>)}
      </select>
    </label>
    {error?<p role="alert">No se pudieron cargar los autorizantes. <button type="button" className="btn-ghost" onClick={()=>setRetry(n=>n+1)}>Reintentar autorizantes</button></p>:!loading&&!items.length?<p>No hay jefes o responsables activos asignados a estas sedes. Cargalos en Sedes → Responsables.</p>:null}
  </div>
}
