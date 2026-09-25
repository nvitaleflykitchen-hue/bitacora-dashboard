import { db, supabase } from './supabase'

const BUCKET = 'airline-performance'

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
  if (months.some(month => month.total_score === '' || !Number.isFinite(Number(month.total_score)) || Number(month.total_score) < 0 || Number(month.total_score) > 100)) throw new Error('Revisá los puntajes mensuales (0 a 100).')
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
