import { useState } from 'react'
import { FileDown, Upload } from 'lucide-react'
import { openAirlineAnalysis, uploadAirlineAnalysis } from '../lib/airlinePerformanceQueries'
import { mensajeError } from '../lib/errores'
import { toast } from '../lib/feedback'

export default function AirlineAnalysisAttachments({ title, items, reportId, airline, year, canWrite, userId, onUploaded }) {
  const [uploading, setUploading] = useState(false)

  async function addFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      await uploadAirlineAnalysis({ file, reportId, airline, year, title:file.name.replace(/\.docx$/i, '').replaceAll('_', ' '), userId })
      await onUploaded()
      toast.ok('Análisis adjuntado al informe.')
    } catch (error) { toast.error(`No se pudo adjuntar el análisis: ${mensajeError(error)}`) }
    finally { setUploading(false) }
  }

  return <section className="glass p-4 space-y-3" aria-label={title}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-semibold">{title}</h3><p className="text-xs" style={{ color:'var(--text-dim)' }}>Documentos Word vinculados al informe; el PDF original se conserva por separado.</p></div>
      {canWrite && <label className="btn-ghost cursor-pointer inline-flex items-center gap-2"><Upload size={14} /> {uploading ? 'Adjuntando…' : 'Adjuntar DOCX'}<input className="sr-only" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={uploading} onChange={addFile} /></label>}
    </div>
    {items.length ? <ul className="space-y-2">{items.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2"><span>{item.title}</span><button type="button" className="btn-ghost" onClick={() => openAirlineAnalysis(item.storage_path).catch(error => toast.error(mensajeError(error)))}><FileDown size={14} /> Descargar Word</button></li>)}</ul> : <p className="text-sm" style={{ color:'var(--text-dim)' }}>Todavía no hay análisis adjuntos.</p>}
  </section>
}
