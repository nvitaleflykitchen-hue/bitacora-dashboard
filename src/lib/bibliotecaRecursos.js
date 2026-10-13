import { db, supabase } from './supabase'
export const RESOURCE_BUCKET = 'biblioteca-recursos'
const MIME = {pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'}
export function validateResource(draft, file) {
  if (!draft.titulo?.trim()) throw new Error('Completá el título.')
  if (file) {
    const extension=file.name.split('.').pop().toLowerCase()
    if (!MIME[extension] || file.size>20*1024*1024 || !file.size) throw new Error('Elegí PDF, DOCX, XLSX, PNG o JPG de hasta 20 MB.')
    return {extension,contentType:MIME[extension]}
  }
  let url
  try { url=new URL(draft.url) } catch { throw new Error('Agregá un archivo o un enlace HTTPS válido.') }
  if (url.protocol!=='https:' || url.username || url.password) throw new Error('Usá un enlace HTTPS sin credenciales.')
  return null
}
export async function loadResources(categoria) {
  let query=db().from('biblioteca_recursos').select('*').order('created_at',{ascending:false})
  if(categoria) query=query.eq('categoria',categoria)
  const {data,error}=await query
  if(error) throw error
  return data || []
}
export async function saveResource(draft,file,userId) {
  const format=validateResource(draft,file)
  let path=null
  if(file) {
    path=`${userId}/${crypto.randomUUID()}.${format.extension}`
    const {error}=await supabase.storage.from(RESOURCE_BUCKET).upload(path,file,{contentType:format.contentType,upsert:false})
    if(error) throw error
  }
  const {data,error}=await db().from('biblioteca_recursos').insert({titulo:draft.titulo.trim(),descripcion:draft.descripcion.trim(),categoria:draft.categoria,grupo_id:draft.grupo_id ? Number(draft.grupo_id):null,url:path ? null : draft.url.trim(),archivo_path:path,archivo_nombre:file?.name || null}).select().single()
  if(error) {
    if(path) await supabase.storage.from(RESOURCE_BUCKET).remove([path])
    throw error
  }
  return data
}
export async function resourceUrl(resource) {
  if(resource.url) { validateResource(resource,null); return resource.url }
  const {data,error}=await supabase.storage.from(RESOURCE_BUCKET).createSignedUrl(resource.archivo_path,60)
  if(error) throw error
  return data.signedUrl
}
