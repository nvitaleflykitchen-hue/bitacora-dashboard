import React from 'react'

export default function FormularioPersonaManual({ value, onChange, label, airport = false, onRemove }) {
  const change = (key,text) => onChange({...value,[key]:text})
  const field = (key,title,type='text',aero=false) => <label className="block text-sm" key={key}>
    <span className="block mb-1">{title}</span>
    <input className="input-dark w-full" type={type} maxLength={180} value={(aero ? value.aeroportuario?.[key] : value[key]) || ''}
      onChange={e=>aero ? change('aeroportuario',{...value.aeroportuario,[key]:e.target.value}) : change(key,e.target.value)}/>
  </label>
  return <fieldset className="glass p-3 space-y-3" aria-label={label}>
    <legend className="font-semibold">{label}</legend>
    <p className="text-sm" style={{color:'var(--text-dim)'}}>Estos datos se guardan sólo en este formulario; no modifican las fichas de Equipo.</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {field('nombre','Nombre/s')}{field('apellido','Apellido/s')}{field('dni','DNI')}{field('puesto','Cargo / función')}{field('legajo','Legajo (opcional)')}
      {airport && <>{field('ppa','Nº PPA','text',true)}{field('sectores','Sectores autorizados','text',true)}{field('aeropuerto','Aeropuerto del permiso','text',true)}{field('vencimiento','Vencimiento del PPA','date',true)}</>}
    </div>
    {onRemove && <button type="button" className="btn-ghost" onClick={onRemove}>Quitar esta persona</button>}
  </fieldset>
}
