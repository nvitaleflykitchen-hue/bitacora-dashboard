import { db, supabase } from './supabase'

const BUCKET = 'microbiologia-protocolos'

export async function listMicroResults(sedeIds = null) {
  if (Array.isArray(sedeIds) && sedeIds.length === 0) return []
  let query = db().from('microbiologia_resultados').select('*').order('fecha', { ascending:false }).order('created_at', { ascending:false }).limit(1000)
  if (sedeIds?.length) query = query.in('sede_id', sedeIds)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createMicroResult(payload) {
  const { data, error } = await db().from('microbiologia_resultados').insert(payload).select('*').single()
  if (error) throw error
  return data
}

export async function attachMicroPdf(resultId, file) {
  if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) throw new Error('Elegí un PDF de hasta 10 MB.')
  const path = `${resultId}/${crypto.randomUUID()}.pdf`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType:'application/pdf', upsert:false })
  if (uploadError) throw uploadError
  const { error } = await db().from('microbiologia_resultados').update({ pdf_path:path, pdf_nombre:file.name }).eq('id', resultId)
  if (error) throw error
}

export async function openMicroPdf(path) {
  const tab = window.open('about:blank', '_blank')
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
    if (error) throw error
    if (tab) {
      tab.opener = null
      tab.location.href = data.signedUrl
    } else {
      window.location.href = data.signedUrl
    }
  } catch (error) {
    tab?.close()
    throw error
  }
}

export async function annulMicroResult(id, userId, reason) {
  const { error } = await db().from('microbiologia_resultados').update({ anulado_en:new Date().toISOString(), anulado_por:userId, motivo_anulacion:reason.trim() }).eq('id', id)
  if (error) throw error
}
