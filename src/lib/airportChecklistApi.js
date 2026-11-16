import { supabase } from './supabase'
const BUCKET='checklist-aeropuerto-fotos'
async function rpc(name,args={}) {
  const {data,error}=await supabase.rpc(name,args)
  if(error) throw new Error(['PGRST202','42883'].includes(error.code) ? 'El checklist aeroportuario todavía no está habilitado en la base de datos.' : error.message)
  return data
}
export const loadAirportVehicles=()=>rpc('aero_checklist_vehiculos')
export const loadAirportHistory=id=>rpc('aero_checklist_historial',{p_activo:id})
export const saveAirportChecklist=(id,vehicle,form)=>rpc('aero_checklist_guardar',{p_id:id,p_activo:vehicle,p_turno:form.turno,p_km:Number(form.km),p_combustible:form.combustible,p_respuestas:form.respuestas,p_observaciones:form.observaciones.trim()})
export async function uploadAirportPhoto(userId,checkId,file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024) throw Error('Usá fotos JPG, PNG o WebP de hasta 10 MB.')
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type]
  const {error}=await supabase.storage.from(BUCKET).upload(`${userId}/${checkId}/${crypto.randomUUID()}.${ext}`,file,{upsert:false})
  if(error) throw error
}
export async function loadAirportPhotos(check) {
  const prefix=`${check.creado_por}/${check.id}`
  const {data,error}=await supabase.storage.from(BUCKET).list(prefix,{limit:100})
  if(error) throw error
  const paths=(data||[]).filter(f=>f.id).map(f=>`${prefix}/${f.name}`)
  if(!paths.length) return []
  const signed=await supabase.storage.from(BUCKET).createSignedUrls(paths,300)
  if(signed.error) throw signed.error
  return (signed.data||[]).filter(f=>f.signedUrl)
}
