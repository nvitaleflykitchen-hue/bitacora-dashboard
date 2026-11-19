import React from 'react'

export const defaultReportOptions = () => ({ includeChecklistDetails:false, from:'', to:'' })

export default function VehicleReportOptions({value, onChange}) {
  const set = (key, next) => onChange({...value, [key]:next})
  return <fieldset style={{margin:'16px 0', padding:12, border:'1px solid var(--text-dim)'}}>
    <legend>Checklists en el informe</legend>
    <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
      <label>Desde<input className="input-dark" type="date" value={value.from} onChange={e=>set('from',e.target.value)}/></label>
      <label>Hasta<input className="input-dark" type="date" value={value.to} onChange={e=>set('to',e.target.value)}/></label>
    </div>
    <label style={{display:'block', marginTop:12}}><input type="checkbox" checked={value.includeChecklistDetails} onChange={e=>set('includeChecklistDetails',e.target.checked)}/> Incluir detalle de novedades de checklists</label>
    <p>Siempre incluye un resumen. El detalle muestra solo desvíos y observaciones, en dos columnas; omite los puntos OK. Las fechas filtran los checklists, no el resto de la ficha.</p>
  </fieldset>
}
