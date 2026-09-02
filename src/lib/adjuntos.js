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

export async function updateAdjuntoMetadata(adjuntoId, { nombre, descripcion, url }) {
  const changes = {
    nombre: String(nombre || '').trim(),
    descripcion: String(descripcion || '').trim() || null,
  }
  if (url !== undefined) changes.url = String(url || '').trim()
  const { data, error } = await supabase
    .schema('bitacora')
    .from('adjuntos')
    .update(changes)
    .eq('id', adjuntoId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function replaceAdjuntoFile(adjunto, file, uploadedBy = 'usuario') {
  if (!adjunto?.id || adjunto.tipo !== 'archivo') throw new Error('El adjunto no es reemplazable')
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
  const path = `${adjunto.entity_type}/${adjunto.entity_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error: uploadErr } = await supabase.storage
    .from(ADJUNTOS_BUCKET)
    .upload(path, file, { cacheControl:'3600', upsert:false })
  if (uploadErr) throw uploadErr

  const { data: { publicUrl } } = supabase.storage.from(ADJUNTOS_BUCKET).getPublicUrl(path)
  const { data, error: updateErr } = await supabase
    .schema('bitacora')
    .from('adjuntos')
    .update({
      nombre:file.name,
      url:publicUrl,
      storage_path:path,
      mime_type:file.type,
      tamaño_bytes:file.size,
      uploaded_by:uploadedBy,
    })
    .eq('id', adjunto.id)
    .select()
    .single()
  if (updateErr) {
    await supabase.storage.from(ADJUNTOS_BUCKET).remove([path])
    throw updateErr
  }
  if (adjunto.storage_path) await supabase.storage.from(ADJUNTOS_BUCKET).remove([adjunto.storage_path])
  return data
}

export async function deleteAdjunto(adjunto) {
  const { error } = await supabase
    .schema('bitacora')
    .from('adjuntos')
    .delete()
    .eq('id', adjunto.id)
  if (error) throw error
  if (adjunto.storage_path) {
    const { error: storageError } = await supabase.storage.from(ADJUNTOS_BUCKET).remove([adjunto.storage_path])
    if (storageError) console.warn('[adjuntos] Registro eliminado; no se pudo limpiar Storage:', storageError.message)
  }
}
