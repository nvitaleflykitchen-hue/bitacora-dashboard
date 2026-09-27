import { db, supabase } from './supabase'

const BUCKET = 'airline-performance'
const ANALYSES_BUCKET = 'airline-analyses'
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export async function listAirlineReports(siteIds) {
  if (Array.isArray(siteIds) && siteIds.length === 0) return []
  let query = db().from('airline_performance_reports').select('*, airline_performance_months(id,month,total_score,level,metrics)').order('created_at', { ascending:false }).limit(500)
  if (siteIds?.length) query = query.in('site_id', siteIds)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createAirlineReport({ siteId, airline, year, cumulativeScore, months, file, userId }) {
  if (!Number.isInteger(Number(siteId)) || !airline?.trim() || !Number.isInteger(Number(year)) || !months?.length) throw new Error('Completá sede, aerolínea, año y al menos un mes.')
  if (!file || (file.type !== 'application/pdf' && !file.name?.toLowerCase().endsWith('.pdf')) || file.size > 15 * 1024 * 1024) throw new Error('Adjuntá un PDF de hasta 15 MB.')
  if (months.some(month => month.total_score === '' || !Number.isFinite(Number(month.total_score)) || Number(month.total_score) < 0 || Number(month.total_score) > 200)) throw new Error('Revisá los puntajes mensuales (0 a 200).')
  const { data:report, error } = await db().from('airline_performance_reports').insert({
    site_id:Number(siteId), airline:airline.trim(), report_year:Number(year),
    cumulative_score:cumulativeScore === '' || cumulativeScore == null ? null : Number(cumulativeScore),
    source_name:file?.name || null, created_by:userId, status:'draft',
  }).select('*').single()
  if (error) throw error
  if (file) {
    const path = `${report.id}/${crypto.randomUUID()}.pdf`
    const { error:uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType:'application/pdf', upsert:false })
    if (uploadError) throw new Error(`El borrador se creó, pero el PDF no se adjuntó: ${uploadError.message}`)
    const { error:updateError } = await db().from('airline_performance_reports').update({ storage_path:path }).eq('id', report.id)
    if (updateError) throw updateError
  }
  const rows = months.map(month => ({ report_id:report.id, month:Number(month.month), total_score:Number(month.total_score), level:month.level?.trim() || null, metrics:month.metrics || {} }))
  const { error:monthsError } = await db().from('airline_performance_months').insert(rows)
  if (monthsError) throw monthsError
  return report
}

export async function publishAirlineReport(reportId) {
  const { data, error } = await db().from('airline_performance_reports').update({ status:'published', published_at:new Date().toISOString() }).eq('id', reportId).eq('status', 'draft').select('id').single()
  if (error) throw error
  return data
}

export async function openAirlinePdf(path) {
  if (!path) throw new Error('Este informe no tiene PDF adjunto.')
  const tab = window.open('about:blank', '_blank')
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
    if (error) throw error
    if (tab) { tab.opener = null; tab.location.href = data.signedUrl }
    else window.location.href = data.signedUrl
  } catch (error) { tab?.close(); throw error }
}

export async function listAirlineAnalyses() {
  const { data, error } = await db().from('airline_performance_analyses')
    .select('id,scope,report_id,airline,report_year,title,source_name,storage_path,file_size,created_at')
    .eq('status', 'ready').order('created_at', { ascending:false }).limit(500)
  if (error) throw error
  return data || []
}

export async function uploadAirlineAnalysis({ file, reportId = null, airline = null, year = null, title, userId }) {
  if (!file || !file.name?.toLowerCase().endsWith('.docx') || file.size > 15 * 1024 * 1024 || file.size === 0) {
    throw new Error('Elegí un documento Word .docx de hasta 15 MB.')
  }
  if (!reportId && (!airline || !Number.isInteger(Number(year)))) throw new Error('Seleccioná un informe o una comparación válida.')
  if (!title?.trim() || !userId) throw new Error('No se pudo identificar el documento o el usuario.')
  const id = crypto.randomUUID()
  const path = `analysis/${id}.docx`
  const { error:insertError } = await db().from('airline_performance_analyses').insert({
    id, scope:reportId ? 'site' : 'comparison', report_id:reportId,
    airline:reportId ? null : airline, report_year:reportId ? null : Number(year),
    title:title.trim(), source_name:file.name, storage_path:path, file_size:file.size,
    status:'pending', created_by:userId,
  })
  if (insertError) throw insertError
  let uploaded = false
  try {
    const { error:uploadError } = await supabase.storage.from(ANALYSES_BUCKET).upload(path, file, { contentType:DOCX_MIME, upsert:false })
    if (uploadError) throw uploadError
    uploaded = true
    const { error:finishError } = await db().from('airline_performance_analyses')
      .update({ status:'ready' }).eq('id', id).eq('status', 'pending').select('id').single()
    if (finishError) throw finishError
  } catch (error) {
    const { error:removeError } = uploaded
      ? await supabase.storage.from(ANALYSES_BUCKET).remove([path])
      : { error:null }
    if (!removeError) await db().from('airline_performance_analyses').delete().eq('id', id)
    throw error
  }
  return id
}

export async function openAirlineAnalysis(path) {
  if (!path) throw new Error('Este análisis no tiene archivo adjunto.')
  const tab = window.open('about:blank', '_blank')
  try {
    const { data, error } = await supabase.storage.from(ANALYSES_BUCKET).createSignedUrl(path, 60, { download:true })
    if (error) throw error
    if (tab) { tab.opener = null; tab.location.href = data.signedUrl }
    else window.location.href = data.signedUrl
  } catch (error) { tab?.close(); throw error }
}
