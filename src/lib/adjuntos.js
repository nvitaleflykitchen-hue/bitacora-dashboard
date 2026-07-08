import { supabase } from './supabase'

// Helper compartido de adjuntos (tabla bitacora.adjuntos + bucket de Storage).
// Usado por AdjuntosPanel.jsx (desktop, entityId ya existente) y por
// MobileReporte.jsx (mobile, sube recién después de crear el registro).

export const ADJUNTOS_BUCKET = 'bitacora-adjuntos'

export async function getAdjuntos(entityType, entityId) {
  const entityKey = String(entityId)
  const { data, error } = await supabase
    .schema('bitacora')
    .from('adjuntos')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityKey)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function uploadAdjunto(entityType, entityId, file, uploadedBy = 'usuario') {
  const entityKey = String(entityId)
  const ext = file.name.split('.').pop()
  const path = `${entityType}/${entityKey}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from(ADJUNTOS_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (uploadErr) throw uploadErr

  const { data: { publicUrl } } = supabase.storage.from(ADJUNTOS_BUCKET).getPublicUrl(path)

  const { data, error: dbErr } = await supabase
    .schema('bitacora')
    .from('adjuntos')
    .insert({
      entity_type: entityType,
      entity_id: entityKey,
      nombre: file.name,
      tipo: 'archivo',
      url: publicUrl,
      storage_path: path,
      mime_type: file.type,
      tamaño_bytes: file.size,
      uploaded_by: uploadedBy,
    })
    .select()
    .single()

  if (dbErr) {
    await supabase.storage.from(ADJUNTOS_BUCKET).remove([path])
    throw dbErr
  }
  return data
}

export async function addAdjuntoLink(entityType, entityId, { url, nombre, descripcion, uploadedBy = 'usuario' }) {
  const entityKey = String(entityId)
  const { data, error } = await supabase
    .schema('bitacora')
    .from('adjuntos')
    .insert({
      entity_type: entityType,
      entity_id: entityKey,
      nombre,
      tipo: 'link',
      url,
      descripcion,
      uploaded_by: uploadedBy,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAdjunto(adjunto) {
  if (adjunto.storage_path) {
    await supabase.storage.from(ADJUNTOS_BUCKET).remove([adjunto.storage_path])
  }
  const { error } = await supabase
    .schema('bitacora')
    .from('adjuntos')
    .delete()
    .eq('id', adjunto.id)
  if (error) throw error
}
