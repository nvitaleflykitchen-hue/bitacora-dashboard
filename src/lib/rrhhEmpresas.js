import { supabase } from './supabase'
const table = name => supabase.schema('equipo').from(name)
const value = result => {
 if(result.error) {
  if(result.error.code==='23505' && /^El DNI/.test(result.error.message||'')) throw new Error(result.error.message)
  if(['42P01','PGRST205'].includes(result.error.code)) throw new Error('RRHH multiempresa todavía no está habilitado. Las fichas de FlyKitchen siguen disponibles.')
  throw result.error
 }
 return result.data || []
}
async function allRows(makeQuery) {
  const rows=[]
  for(let start=0;;start+=500) {
    const page=value(await makeQuery().range(start,start+499))
    rows.push(...page)
    if(page.length<500) return rows
  }
}
export async function getRrhhEmpresas() {
  const empresas=value(await table('rrhh_empresas').select('id,nombre').order('nombre'))
  if(!empresas.length) throw new Error('El acceso a RRHH central debe ser habilitado por un administrador.')
  const [unidades,colaboradores,flykitchen,sedes] = await Promise.all([
    allRows(()=>table('rrhh_unidades').select('*').order('id')),
    allRows(()=>table('rrhh_colaboradores').select('*').order('id')),
    allRows(()=>table('personas').select('id,nombre,apellido,dni,legajo,puesto,telefono,email,fecha_ingreso,activo,sede_ids,tipo_vinculo').is('duplicado_de',null).order('id')),
    allRows(()=>supabase.schema('bitacora').from('sedes').select('id,nombre,activa').order('id')),
  ])
  const units=[...unidades,...sedes.map(s=>({id:`fk:${s.id}`,empresa_id:'flykitchen',nombre:s.nombre,activa:s.activa,operativa:true}))]
  const people=[...colaboradores.map(p=>({...p,origen:'rrhh',unidad_ids:[p.unidad_id]})),...flykitchen.filter(p=>p.tipo_vinculo!=='externo').map(p=>({...p,empresa_id:'flykitchen',origen:'flykitchen',unidad_ids:(p.sede_ids||[]).map(id=>`fk:${id}`)}))]
  return {empresas,unidades:units,personas:people}
}
export async function saveRrhhPerson(form) {
 const fields=['empresa_id','unidad_id','nombre','apellido','dni','legajo','puesto','telefono','email','fecha_ingreso','activo','motivo_cambio']
 const payload=Object.fromEntries(fields.map(key=>[key,form[key]]))
 payload.fecha_ingreso=payload.fecha_ingreso||null
 payload.dni=String(payload.dni||'').replace(/\D/g,'')
 const query=form.id?table('rrhh_colaboradores').update(payload).eq('id',form.id).eq('actualizado_at',form.actualizado_at):table('rrhh_colaboradores').insert(payload)
 const rows=value(await query.select('id'))
 if(rows.length!==1) throw new Error('No se guardó el legajo. Revisá los permisos y reintentá.')
 return rows[0]
}
export async function saveRrhhUnit(form) {
 const payload={empresa_id:form.empresa_id,nombre:form.nombre.trim(),activa:form.activa}
 const query=form.id?table('rrhh_unidades').update(payload).eq('id',form.id):table('rrhh_unidades').insert(payload)
 const rows=value(await query.select('id'));if(rows.length!==1)throw new Error('No se guardó la unidad.')
}
export async function renameRrhhEmpresa(id,nombre) {
 const rows=value(await table('rrhh_empresas').update({nombre:nombre.trim()}).eq('id',id).select('id'))
 if(rows.length!==1)throw new Error('No se pudo actualizar la empresa.')
}
export async function getRrhhOperators() {
 const [profiles,operators]=await Promise.all([
  supabase.schema('bitacora').from('perfiles').select('id,nombre,email,rol,activo').in('rol',['admin','editor']).eq('activo',true).order('nombre'),
  table('rrhh_operadores').select('perfil_id,activo'),
 ])
 const ids=new Set(value(operators).filter(p=>p.activo).map(p=>p.perfil_id))
 return value(profiles).map(p=>({...p,central:p.rol==='admin'||ids.has(p.id)}))
}
export async function saveRrhhOperator(perfil_id,activo) {
 const rows=value(await table('rrhh_operadores').upsert({perfil_id,activo}).select('perfil_id'))
 if(rows.length!==1)throw new Error('No se pudo actualizar el acceso de RRHH.')
}
export async function getRrhhHistory(id) {
 return allRows(()=>table('rrhh_auditoria').select('id,accion,antes,despues,fecha').eq('entidad','rrhh_colaboradores').eq('registro_id',id).order('id',{ascending:false}))
}
export function filterRrhhPeople(data,empresa,unidad,search,estado) {
 const normalized=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 const query=normalized(search).trim()
 return data.personas.filter(p=>(empresa==='todas'||p.empresa_id===empresa)&&(!unidad||p.unidad_ids.includes(unidad))&&(estado==='todos'||(estado==='activos'?p.activo:p.activo===false))&&normalized(`${p.nombre} ${p.apellido} ${p.dni} ${p.legajo} ${p.puesto}`).includes(query))
}
