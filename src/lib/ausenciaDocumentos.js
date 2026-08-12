import { supabase } from './supabase'

export const AUSENCIA_DOCUMENTOS_BUCKET = 'certificados-ausentismo'
export const AUSENCIA_DOCUMENTOS_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
export const AUSENCIA_DOCUMENTOS_MAX_BYTES = 10 * 1024 * 1024

export function validarDocumentoAusencia(file) {
  if (!file) return
  if (!AUSENCIA_DOCUMENTOS_ACCEPT.split(',').includes(file.type)) {
    throw new Error('El certificado debe ser PDF, JPG, PNG o WebP.')
  }
  if (file.size > AUSENCIA_DOCUMENTOS_MAX_BYTES) {
    throw new Error('El certificado no puede superar los 10 MB.')
  }
}

export async function uploadDocumentoAusencia(personaNovedad, file) {
  validarDocumentoAusencia(file)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('La sesión venció. Volvé a ingresar para adjuntar el certificado.')
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const path = `persona_novedades/${personaNovedad.id}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from(AUSENCIA_DOCUMENTOS_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
  if (uploadError) throw uploadError

  const { data, error } = await supabase.schema('equipo').from('ausencia_documentos').insert({
    persona_novedad_id: personaNovedad.id,
    persona_id: personaNovedad.persona_id,
    nombre: file.name,
    storage_path: path,
    mime_type: file.type,
    tamano_bytes: file.size,
    uploaded_by: user.id,
  }).select().single()
  if (error) {
    await supabase.storage.from(AUSENCIA_DOCUMENTOS_BUCKET).remove([path])
    throw error
  }
  return data
}

export async function getDocumentosAusencias(personaId) {
  const { data, error } = await supabase.schema('equipo').from('ausencia_documentos')
    .select('*').eq('persona_id', personaId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function abrirDocumentoAusencia(documento) {
  const { data, error } = await supabase.storage
    .from(AUSENCIA_DOCUMENTOS_BUCKET)
    .createSignedUrl(documento.storage_path, 60)
  if (error) throw error
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}
