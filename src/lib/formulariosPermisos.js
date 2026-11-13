import { db, supabase } from './supabase'

export const FORM_STATES = ['borrador', 'generado', 'pendiente_firma', 'firmado', 'presentado', 'vencido', 'anulado']
export const FORM_ACTIONS = ['ver', 'crear', 'editar', 'generar', 'firmar', 'presentar', 'anular', 'plantillas']
export const stateLabel = value => ({ pendiente_firma:'Pendiente de firma' }[value] || value?.replace(/^./, c => c.toUpperCase()))
export const personName = p => [p.apellido, p.nombre].filter(Boolean).join(', ')
export const todayLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,10) }
export const sectors = value => [...new Set(String(value || '').split(/[^0-9]+/).filter(s => /^[1-7]$/.test(s)))].sort()
export const newManualPerson = (person = {}) => ({
  id:null, origen:'manual', nombre:person.nombre || '', apellido:person.apellido || '',
  dni:person.dni || '', legajo:person.legajo || '', puesto:person.puesto || '',
  aeroportuario:Object.fromEntries(['ppa','tipo','sectores','aeropuerto','emision','vencimiento','estado'].map(k=>[k,person.aeroportuario?.[k] || ''])),
})
export function formWarnings(data, type, today = todayLocal()) {
  const warnings = []
  for (const p of data.personas || []) {
    if (!p.dni) warnings.push(`Falta DNI de ${personName(p)}.`)
    if (!p.puesto) warnings.push(`Falta cargo de ${personName(p)}.`)
  }
  const holders = type === 'ppa_auto' ? data.personas || [] : data.acompanante ? [data.acompanante] : []
  if (type === 'anexo_e' && !data.acompanante) warnings.push('Falta el responsable del acompañamiento.')
  for (const p of holders) {
    const a = p.aeroportuario || {}
    if (!a.ppa) warnings.push(`Falta PPA de ${personName(p)}.`)
    if (!a.vencimiento) warnings.push(`Falta vencimiento del PPA de ${personName(p)}.`)
    else if (a.vencimiento < (data.variables?.fecha || today) || a.vencimiento < today) warnings.push(`PPA VENCIDO de ${personName(p)} (${a.vencimiento}).`)
    if (a.estado && a.estado !== 'vigente') warnings.push(`PPA ${a.estado} de ${personName(p)}.`)
    const requested = sectors(data.variables?.sectores)
    const allowed = sectors(a.sectores)
    if (requested.some(s => !allowed.includes(s))) warnings.push(`Hay sectores solicitados no autorizados para ${personName(p)}.`)
  }
  if (type === 'anexo_e') for (const s of sectors(data.variables?.sectores)) {
    if (!data.variables?.justificaciones?.[s]?.trim()) warnings.push(`Falta justificar el sector ${s}.`)
  }
  return warnings
}
export function validateForm(variables, ids, type) {
  const manual = variables.personas_manuales || []
  const count = ids.length + manual.length
  if (!count || count > 100 || (type === 'ppa_auto' && count !== 1)) throw new Error('Seleccioná o cargá una persona para auto-acompañamiento o hasta 100 para Anexo E.')
  if ([...manual,...(variables.responsable_manual ? [variables.responsable_manual] : [])].some(p=>!p.nombre?.trim())) throw new Error('Completá el nombre de cada persona manual.')
  if (!variables.fecha || !variables.desde || !variables.hasta || !variables.tareas?.trim()) throw new Error('Completá fecha, horario desde/hasta y tareas.')
  if (variables.hasta <= variables.desde) throw new Error('El horario hasta debe ser posterior al horario desde.')
  if (!/^[1-7]([ ,;/]+[1-7])*$/.test(String(variables.sectores).trim())) throw new Error('Indicá al menos un sector solicitado (1 a 7).')
}
export const newVariables = () => ({ fecha:todayLocal(), dias:'', desde:'', hasta:'', tareas:'', sectores:'', justificaciones:{}, observaciones:'', empresa:'Fly Kitchen', aeropuerto:'' })
async function rpc(name, params = {}) {
  const { data, error } = await db().rpc(name, params)
  if (error) throw new Error(['PGRST202','42P01'].includes(error.code) ? 'Formularios y permisos está pendiente de habilitación en la base de datos.' : error.message)
  // Composite PostgreSQL rows may arrive as a one-element PostgREST array.
  if (name === 'fp_save' || name === 'fp_transition') {
    const form = Array.isArray(data) ? data[0] : data
    if (!form?.id) throw new Error('No se recibió el formulario guardado. Actualizá el historial antes de reintentar.')
    return form
  }
  return data
}
export const loadFormContext = () => rpc('fp_context')
export const listForms = (personId = null) => rpc('fp_list', { p_persona:personId })
export const formHistory = id => rpc('fp_history', { p_id:id })
export const saveForm = draft => rpc('fp_save', { p_id:draft.id || null, p_version:draft.version || 0, p_template:draft.template_id, p_sede:Number(draft.sede_id), p_personas:draft.persona_ids, p_acompanante:draft.acompanante_id || null, p_variables:draft.variables })
export const transitionForm = (form, state, path = null, warnings = []) => rpc('fp_transition', { p_id:form.id, p_version:form.version, p_estado:state, p_archivo:path, p_advertencias:warnings })
export const saveAirport = (id, values) => rpc('fp_airport_save', { p_persona:id, p_data:values })
export const saveTemplate = (type, title, instructions) => rpc('fp_template_version', { p_tipo:type, p_nombre:title, p_instrucciones:instructions })
export const setTemplateActive = (id, active) => rpc('fp_template_active', { p_id:id, p_activa:active })
export const saveRoleActions = (role, actions) => rpc('fp_role_save', { p_rol:role, p_acciones:actions })
export const saveSupervisor = (id, enabled) => rpc('fp_supervisor_save', { p_usuario:id, p_habilitado:enabled })
export async function uploadFormPdf(form, bytes) {
  const path = `${form.id}/${crypto.randomUUID()}.pdf`
  const { error } = await supabase.storage.from('formularios-permisos').upload(path, new Blob([bytes], { type:'application/pdf' }), { upsert:false, contentType:'application/pdf' })
  if (error) throw new Error(error.message)
  return path
}
export async function getFormPdf(form) {
  const { data, error } = await supabase.storage.from('formularios-permisos').download(form.archivo)
  if (error) throw new Error(error.message)
  return data
}
