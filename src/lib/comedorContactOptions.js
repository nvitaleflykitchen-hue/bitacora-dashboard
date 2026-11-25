import {supabase} from './supabase'
import {telefonoEnlace} from './directorioPersonas'
const NICO='1d44ec86-aca3-4df8-b6f8-bd7e834a6c98'
const GERENCIA='de367ea8-3da1-439d-92ef-0b87c74023c6'
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
const phone=telefonoEnlace
export const blankComedorContact=()=>({nombre:'',rol:'',telefono:''})
export function comedorContactOptions(personas,assigned){
 const people=personas.map(p=>({id:`persona:${p.id}`,persona_id:p.id,perfil_id:p.perfil_id,nombre:[p.nombre,p.apellido].filter(Boolean).join(' '),rol:p.puesto||'Responsable del servicio',telefono:phone(p.telefono),sedes:p.sede_ids||[]}))
 const contacts=assigned.filter(a=>a.contactos).map(a=>({id:`contacto:${a.contactos.id}`,nombre:a.contactos.nombre,rol:a.rol||a.contactos.cargo||'Responsable del servicio',telefono:phone(a.contactos.telefono),perfil_id:a.contactos.perfil_id,assigned:true}))
 return [...contacts,...people].sort((a,b)=>a.nombre.localeCompare(b.nombre,'es',{sensitivity:'base'}))
}
export function contactValue(option){return option?{nombre:option.nombre,rol:option.rol,telefono:option.telefono}:blankComedorContact()}
export function comedorDefaults(options,sede){
 const nico=options.find(o=>o.persona_id===NICO)
 const gerencia=options.find(o=>o.persona_id===GERENCIA)
 const assigned=options.filter(o=>o.assigned && /responsable|encargad/i.test(o.rol))
 const exact=options.filter(o=>normalize(o.nombre)===normalize(sede.responsable))
 // Never guess among multiple assigned service leaders.
 const responsible=assigned.length===1?assigned[0]:exact.length===1?exact[0]:null
 return {activo:false,coordinacion:contactValue(nico),gerencia:[{...contactValue(gerencia),...(gerencia?{rol:'Gerente General'}:{})},contactValue(responsible)]}
}
export function matchingContact(options,value){
 return options.find(o=>normalize(o.nombre)===normalize(value.nombre) && o.telefono===phone(value.telefono))?.id || ''
}
export async function loadComedorContacts(sedeId){
 const people=[]
 for(let from=0;;from+=200){
  const r=await supabase.schema('equipo').from('personas').select('id,perfil_id,nombre,apellido,puesto,telefono,sede_ids').eq('activo',true).is('duplicado_de',null).order('id').range(from,from+199)
  if(r.error)throw r.error
  people.push(...(r.data||[]));if((r.data||[]).length<200)break
 }
 const r=await supabase.schema('bitacora').from('sede_contactos').select('rol,contactos(id,nombre,cargo,telefono,perfil_id)').eq('sede_id',sedeId).eq('activo',true)
 if(r.error)throw r.error
 return comedorContactOptions(people,r.data||[])
}
