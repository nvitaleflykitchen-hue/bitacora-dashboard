import React from 'react'
import { checklistDateTime } from '../lib/checklistReading'

export default function VehicleReadingSummary({ report, loading, error }) {
  const reading = report?.reading
  return <section aria-label="Kilometraje del vehículo" style={{padding:'1rem', marginBottom:'1rem', border:'1px solid var(--border)', borderRadius:8, background:'var(--surface)'}}>
    <h3 style={{margin:'0 0 .5rem', fontSize:'.9rem'}}>Último kilometraje registrado</h3>
    {loading ? <p role="status">Consultando lecturas…</p> : !report ? <p>{error ? 'No se pudo consultar el kilometraje.' : 'Consultando lecturas…'}</p> : <>
      <strong style={{fontSize:'1.8rem', color:'var(--phosphor)'}}>{reading?.km == null ? 'Sin registro' : `${Number(reading.km).toLocaleString('es-AR')} km`}</strong>
      {reading?.km != null && <div style={{display:'flex', flexWrap:'wrap', gap:'.5rem 2rem', marginTop:'.5rem', color:'var(--text-dim)'}}>
        <span>Fecha: {reading.fecha ? checklistDateTime(reading.fecha) : 'Sin fecha registrada'}</span>
        <span>Origen: {reading.fuente}</span>
        {reading.responsable && <span>Responsable registrado: {reading.responsable}</span>}
      </div>}
    </>}
  </section>
}
