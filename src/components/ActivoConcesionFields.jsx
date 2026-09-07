import { concesionLabel } from '../lib/activoConcesion'

export function ActivoConcesionBadge({ activo }) {
  return <span style={{ display:'inline-block', fontSize:'.65rem', padding:'3px 7px', borderRadius:3, color:activo.bien_concesionado === true ? '#c4b5fd' : 'var(--text-dim)', background:activo.bien_concesionado === true ? 'rgba(167,139,250,.15)' : 'rgba(128,128,128,.1)' }}>
    {concesionLabel(activo.bien_concesionado)}
  </span>
}

export default function ActivoConcesionFields({ form, onChange }) {
  const field = { display:'grid', gap:5, marginBottom:12, fontSize:'.72rem', color:'var(--text-dim)' }
  return <fieldset style={{ border:'1px solid rgba(167,139,250,.25)', borderRadius:4, padding:12, margin:'0 0 16px', minWidth:0 }}>
    <legend style={{ color:'var(--text)', fontSize:'.8rem', padding:'0 5px' }}>Titularidad del activo</legend>
    <label style={field}>Bien concesionado
      <select className="input-dark w-full" value={form.bien_concesionado === true ? 'si' : form.bien_concesionado === false ? 'no' : ''}
        onChange={e => onChange('bien_concesionado', e.target.value === '' ? null : e.target.value === 'si')}>
        <option value="">Sin definir</option><option value="si">Sí</option><option value="no">No</option>
      </select>
    </label>
    {form.bien_concesionado === true && <>
      <label style={field}>Propietario / entidad concedente
        <input className="input-dark w-full" value={form.concesion_propietario || ''} maxLength={250} onChange={e => onChange('concesion_propietario', e.target.value)} placeholder="Ej: Universidad Santa Fe"/>
      </label>
      <label style={field}>Referencia de contrato o acta (opcional)
        <input className="input-dark w-full" value={form.concesion_referencia || ''} maxLength={500} onChange={e => onChange('concesion_referencia', e.target.value)} placeholder="Número o referencia del documento"/>
      </label>
    </>}
    <p style={{ margin:0, fontSize:'.65rem', color:'var(--text-dim)' }}>Identifica la condición del bien. El custodio se registra por separado.</p>
  </fieldset>
}
import React from 'react'
