import { db } from './supabase'

const isSchemaUnavailable = error =>
  ['42P01', 'PGRST205', 'PGRST204'].includes(error?.code) ||
  String(error?.message || '').includes('organigramas')

export async function loadSharedOrganigrama(groupKey) {
  const { data, error } = await db()
    .from('organigramas')
    .select('grupo_clave,nombre,borrador,publicado,version_publicada,actualizado_en,publicado_en')
    .eq('grupo_clave', String(groupKey))
    .maybeSingle()
  if (error) {
    if (isSchemaUnavailable(error)) return { available:false, record:null }
    throw error
  }
  return { available:true, record:data }
}

export async function saveSharedOrganigramaDraft({ groupKey, name, model, userId }) {
  const payload = {
    grupo_clave:String(groupKey),
    nombre:name,
    borrador:model,
    actualizado_por:userId,
    actualizado_en:new Date().toISOString(),
  }
  const { data, error } = await db()
    .from('organigramas')
    .upsert(payload, { onConflict:'grupo_clave' })
    .select('grupo_clave,actualizado_en')
    .single()
  if (error) {
    if (isSchemaUnavailable(error)) return { available:false }
    throw error
  }
  return { available:true, record:data }
}

export async function publishSharedOrganigrama({ groupKey, name, model, userId, currentVersion = 0 }) {
  const now = new Date().toISOString()
  const payload = {
    grupo_clave:String(groupKey),
    nombre:name,
    borrador:model,
    publicado:model,
    version_publicada:Number(currentVersion || 0) + 1,
    actualizado_por:userId,
    publicado_por:userId,
    actualizado_en:now,
    publicado_en:now,
  }
  const { data, error } = await db()
    .from('organigramas')
    .upsert(payload, { onConflict:'grupo_clave' })
    .select('grupo_clave,version_publicada,publicado_en')
    .single()
  if (error) {
    if (isSchemaUnavailable(error)) return { available:false }
    throw error
  }
  return { available:true, record:data }
}
