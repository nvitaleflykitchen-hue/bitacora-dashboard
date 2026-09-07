import { useEffect, useRef, useState } from 'react'
import { Download, Eye, RefreshCw, X } from 'lucide-react'
import { cargarInformeSede, rangoInformeSede, validarRangoInforme } from '../lib/sedeReport'
import { crearInformeSedePDF, nombreInformeSede } from '../lib/sedeReportRenderer'
import './SedeReportModal.css'

export default function SedeReportModal({ sede, onClose }) {
  const [range, setRange] = useState(rangoInformeSede)
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('resumen')
  const dialog = useRef(null)
  const sequence = useRef(0)
  const changed = snapshot && (snapshot.report.desde !== range.desde || snapshot.report.hasta !== range.hasta)
  async function load(selected) {
    try { validarRangoInforme(selected.desde, selected.hasta) }
    catch (e) { setError(e.message); return }
    const current = ++sequence.current
    setLoading(true); setError(''); setSnapshot(null)
    try {
      const report = await cargarInformeSede({ sedeId: sede.id, sedeNombre: sede.nombre, ...selected })
      if (current !== sequence.current) return
      const doc = crearInformeSedePDF(report)
      setSnapshot({ report, doc, url: URL.createObjectURL(doc.output('blob')) })
    } catch (e) { if (current === sequence.current) setError(e.message || 'No se pudo preparar el informe.') }
    finally { if (current === sequence.current) setLoading(false) }
  }
  useEffect(() => {
    dialog.current.showModal(); load(rangoInformeSede())
    return () => { sequence.current++ }
    // Draft dates apply through Actualizar. Parent remounts for another sede.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede.id])
  useEffect(() => () => { if (snapshot?.url) URL.revokeObjectURL(snapshot.url) }, [snapshot])
  return <dialog ref={dialog} className="sede-report-dialog" aria-labelledby="sede-report-title" onCancel={onClose}>
    <header className="sede-report-header"><div><h2 id="sede-report-title">Informe de sede</h2><p>{sede.nombre} · Previsualización</p></div><button type="button" className="btn-ghost" aria-label="Cerrar previsualización" onClick={onClose}><X size={18}/></button></header>
    <div className="sede-report-controls">
      <label>Desde<input type="date" value={range.desde} onChange={e => setRange(r => ({ ...r, desde: e.target.value }))}/></label>
      <label>Hasta<input type="date" value={range.hasta} onChange={e => setRange(r => ({ ...r, hasta: e.target.value }))}/></label>
      <button type="button" className="btn-ghost" onClick={() => load(range)} disabled={loading}><RefreshCw size={14}/> {loading ? 'Preparando…' : 'Actualizar informe'}</button>
      <button type="button" className="btn-primary" disabled={!snapshot || loading || changed || Boolean(error)} onClick={() => snapshot.doc.save(nombreInformeSede(snapshot.report))}><Download size={14}/> Descargar PDF</button>
    </div>
    {error && <p className="sede-report-alert" role="alert">{error}</p>}
    {changed && <p className="sede-report-alert">Actualizá el informe para aplicar las fechas seleccionadas.</p>}
    {loading && <p className="sede-report-message" role="status">Consultando la información de la sede y preparando la vista previa…</p>}
    {snapshot && <>
      <div className="sede-report-tabs" aria-label="Formato de previsualización">
        <button type="button" className="btn-ghost" aria-pressed={view === 'resumen'} onClick={() => setView('resumen')}>Resumen y detalle</button>
        <button type="button" className="btn-ghost" aria-pressed={view === 'pdf'} onClick={() => setView('pdf')}><Eye size={14}/> Vista PDF</button>
        <small>Datos consultados: {snapshot.report.generado}</small>
      </div>
      {snapshot.report.warnings.length > 0 && <p className="sede-report-alert" role="status">Informe parcial: algunas fuentes no se pudieron consultar. Se identifican en el detalle.</p>}
      {view === 'pdf' ? <div className="sede-report-pdf"><iframe title={`Vista PDF de ${sede.nombre}`} src={snapshot.url}/><p>Si tu navegador no muestra el PDF, usá “Resumen y detalle” o descargalo.</p></div> : <div className="sede-report-content">
        <p>Reportes: <strong>{snapshot.report.desde} al {snapshot.report.hasta}</strong>. Evaluaciones: última disponible hasta {snapshot.report.hasta}. Operación y documentación: situación actual.</p>
        <div className="sede-report-grid">{snapshot.report.summary.map(s => <a key={s.id} href={`#sede-report-${s.id}`} className={s.error ? 'sede-report-failed' : ''}><span>{s.area}</span><strong>{s.valor}</strong></a>)}</div>
        {snapshot.report.sections.map(section => <section key={section.id} id={`sede-report-${section.id}`}><h3>{section.title}</h3><p>{section.note}</p>
          {section.rows.length ? <div className="sede-report-table"><table><thead><tr>{section.columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{section.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div> : <p>{section.error ? 'No se pudo consultar esta sección.' : 'Sin registros para detallar.'}</p>}
        </section>)}
      </div>}
    </>}
  </dialog>
}
