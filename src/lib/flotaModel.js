export const FLEET_TZ = 'America/Argentina/Buenos_Aires'
export const fleetToday = () => new Intl.DateTimeFormat('en-CA',{timeZone:FLEET_TZ}).format(new Date())
export function fleetDate(value) {
  if (!value) return 'Sin registrar'
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Intl.DateTimeFormat('en-CA',{timeZone:FLEET_TZ}).format(new Date(value))
  return day.split('-').reverse().join('/')
}
export const fleetDateTime = value => value ? new Date(value).toLocaleString('es-AR',{timeZone:FLEET_TZ,hour12:false}) + ' (Argentina)' : 'Sin registrar'
export const interventionDate = t => t.fecha_intervencion || t.fecha_cierre || null
export const ticketDate = t => interventionDate(t) || t.created_at
export const closedTicket = t => ['resuelto','cerrado','rechazado','cancelado'].includes(t.estado)
export function interventionKind(t) {
  if (['cancelado','rechazado'].includes(t.estado)) return 'Cancelado / rechazado'
  if (!closedTicket(t)) return 'Pendiente'
  return /diagn[oó]stico/i.test(t.descripcion || '') ? 'Diagnóstico' : 'Intervención realizada'
}
export function vehicleIdentity(v) {
  const plate = text => String(text || '').toUpperCase().replace(/[\s-]/g,'')
  const valid = text => /^(?:[A-Z]{2}\d{3}[A-Z]{2}|[A-Z]{3}\d{3})$/.test(text)
  const code = plate(v.codigo_interno)
  const match = String(v.nombre || '').toUpperCase().match(/\b(?:[A-Z]{2}\s?\d{3}\s?[A-Z]{2}|[A-Z]{3}\s?\d{3})\b/)
  return {
    ...v,
    dominio: v.dominio || (valid(code) ? code : match ? plate(match[0]) : null),
    dominio_fuente: v.dominio ? 'Ficha' : valid(code) ? 'Código interno' : match ? 'Nombre del vehículo' : 'Sin registrar',
    anio: v.anio ?? (v.notas?.match(/AÑO:\s*(\d{4})/i)?.[1] || null),
    combustible: v.combustible || v.notas?.match(/COMBUSTIBLE:\s*([^.|\n]+)/i)?.[1]?.trim() || null,
    datos_en_notas: (!v.anio && /AÑO:/i.test(v.notas || '')) || (!v.combustible && /COMBUSTIBLE:/i.test(v.notas || '')),
  }
}
export function lastReading(v,tickets=[],checks=[]) {
  const candidates = tickets.filter(t=>t.lectura_km!=null && interventionDate(t)).map(t=>({km:t.lectura_km,fecha:interventionDate(t),fuente:`Ticket ${t.numero || t.id}`}))
  candidates.push(...checks.filter(c=>c.km!=null&&c.fecha).map(c=>({km:c.km,fecha:c.fecha,fuente:'Checklist'})))
  if (v.km_actual!=null && v.km_lectura_fecha) candidates.push({km:v.km_actual,fecha:v.km_lectura_fecha,fuente:'Ficha'})
  candidates.sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)))
  return candidates[0] || {km:v.km_actual ?? null,fecha:null,fuente:'Ficha sin fecha de lectura'}
}
export function fleetWarnings(v,docs,plans) {
  const warnings=[]; const today=fleetToday()
  for (const [field,code,label] of [['vencimiento_senasa','habilitacion_senasa','SENASA'],['vencimiento_seguro','poliza_seguro','Seguro'],['vencimiento_vtv','itv_pov_cov','VTV']]) {
    const d=docs.find(d=>d.codigo===code)
    if (v[field] && d?.fecha_vencimiento && v[field]!==d.fecha_vencimiento) warnings.push(`${label}: ficha ${fleetDate(v[field])} y documentación ${fleetDate(d.fecha_vencimiento)} no coinciden. Revisar respaldo; no se presume renovación.`)
  }
  for(const d of docs) if(d.fecha_vencimiento && d.fecha_vencimiento<today) warnings.push(`${d.titulo}: vencido el ${fleetDate(d.fecha_vencimiento)}; estado declarado: ${d.estado || 'sin registrar'}.`)
  const preventive=docs.find(d=>d.codigo==='plan_mantenimiento_preventivo')
  if(plans.some(p=>p.activo===true || p.estado==='activo') && (!preventive?.registered || !preventive.attachments?.length)) warnings.push('Existe un plan preventivo activo, pero falta documentación respaldatoria del plan. No equivale a un servicio realizado.')
  if(!v.km_lectura_fecha) warnings.push('La ficha no tiene fecha estructurada de lectura. Se informa la última lectura con fecha disponible, no el odómetro actual.')
  return warnings
}
export const FLEET_EDIT_FIELDS = ['nombre','dominio','marca','modelo','anio','combustible','km_actual','km_lectura_fecha','sede_id','categoria','responsable','estado','proveedor_servicio_id','vencimiento_seguro','vencimiento_vtv','vencimiento_senasa','vencimiento_rmtsa','numero_poliza','notas','notas_tecnico','ubicacion_detalle','bien_concesionado','concesion_propietario','concesion_referencia']
export function fleetPatch(form,changed) {
  const payload={}
  for (const key of changed) if(FLEET_EDIT_FIELDS.includes(key)) payload[key]=form[key]==='' ? null : form[key]
  if(payload.anio!=null && (!Number.isInteger(Number(payload.anio)) || Number(payload.anio)<1900 || Number(payload.anio)>new Date().getFullYear()+1)) throw Error('Revisá el año de fabricación.')
  if(payload.km_actual!=null && (!Number.isInteger(Number(payload.km_actual)) || Number(payload.km_actual)<0)) throw Error('Revisá el kilometraje.')
  if(changed.includes('km_actual') && payload.km_actual!=null && !form.km_lectura_fecha) throw Error('Indicá la fecha de la lectura de kilometraje.')
  if(payload.km_actual!=null) payload.km_lectura_fecha=form.km_lectura_fecha
  return payload
}
