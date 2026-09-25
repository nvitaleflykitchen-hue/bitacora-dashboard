import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Plus, RefreshCw } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../lib/auth'
import { getSedes } from '../lib/queries'
import { createAirlineReport, listAirlineReports, openAirlinePdf, publishAirlineReport } from '../lib/airlinePerformanceQueries'
import { extractCopaPdf, latestPublishedReports, PERFORMANCE_CATEGORIES } from '../lib/airlinePerformance'
import { toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const emptyDraft = () => ({ siteId:'', airline:'Copa Airlines', year:new Date().getFullYear(), cumulativeScore:'', months:[] })
const scoreColor = score => score >= 90 ? 'var(--accent)' : score >= 80 ? '#f59e0b' : '#ef4444'

export default function AirlinePerformance() {
  const { allowedSedeIds, perfil, user } = useAuth()
  const canWrite = ['admin', 'editor'].includes(perfil?.rol)
  const [sites, setSites] = useState([])
  const [reports, setReports] = useState([])
  const [siteId, setSiteId] = useState('')
  const [year, setYear] = useState('')
  const [airline, setAirline] = useState('')
  const [selectedReportId, setSelectedReportId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [file, setFile] = useState(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [working, setWorking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [allSites, allReports] = await Promise.all([
        Array.isArray(allowedSedeIds) && !allowedSedeIds.length ? [] : getSedes(allowedSedeIds),
        listAirlineReports(allowedSedeIds),
      ])
      setSites(allSites.filter(site => /aeropuerto/i.test(site.nombre) || /aeropuerto/i.test(site.tipo || '')))
      setReports(allReports)
    } catch (e) { setError(mensajeError(e)) }
    finally { setLoading(false) }
  }, [allowedSedeIds])
  useEffect(() => { load() }, [load])

  const siteNames = useMemo(() => new Map(sites.map(site => [String(site.id), site.nombre])), [sites])
  const published = useMemo(() => latestPublishedReports(reports), [reports])
  const filtered = useMemo(() => published.filter(report => (!siteId || String(report.site_id) === siteId) && (!year || String(report.report_year) === year) && (!airline || report.airline === airline)), [published, siteId, year, airline])
  const selected = filtered.find(report => report.id === selectedReportId) || filtered[0] || null
  const chartRows = useMemo(() => [...(selected?.airline_performance_months || [])].sort((a, b) => a.month - b.month).map(row => ({ ...row, name:MONTHS[row.month - 1] })), [selected])
  const priorVersions = selected ? reports.filter(report => report.status === 'published' && report.id !== selected.id && report.site_id === selected.site_id && report.airline === selected.airline && report.report_year === selected.report_year).sort((a, b) => String(b.published_at).localeCompare(String(a.published_at))) : []
  const drafts = reports.filter(report => report.status === 'draft')
  const years = [...new Set(published.map(report => report.report_year))].sort((a, b) => b - a)
  const airlines = [...new Set(published.map(report => report.airline))].sort()
  const comparisonYear = Number(year || years[0])
  const comparisonReports = filtered.filter(report => report.report_year === comparisonYear && report.airline === (airline || selected?.airline))
  const comparisonRows = MONTHS.map((name, index) => {
    const row = { name }
    comparisonReports.forEach(report => {
      const point = report.airline_performance_months?.find(month => month.month === index + 1)
      if (point) row[siteNames.get(String(report.site_id)) || String(report.site_id)] = point.total_score
    })
    return row
  })

  async function selectFile(selectedFile) {
    if (!selectedFile) return
    setFile(selectedFile); setWorking(true)
    try {
      const extracted = await extractCopaPdf(selectedFile)
      const suggestedSite = sites.find(site => extracted.siteCode && site.nombre.toUpperCase().includes(({ ROS:'ROSARIO', COR:'CÓRDOBA', MDZ:'MENDOZA', TUC:'TUCUMÁN' })[extracted.siteCode] || extracted.siteCode))
      setDraft(current => ({ ...current, airline:extracted.airline, year:extracted.year, cumulativeScore:extracted.cumulative_score ?? '', months:extracted.months, siteId:suggestedSite ? String(suggestedSite.id) : current.siteId }))
      toast.ok(`${extracted.months.length} meses detectados. Revisá sede, puntajes y acumulado antes de guardar.`)
    } catch (e) { setDraft(current => ({ ...current, months:[] })); toast.error(mensajeError(e)) }
    finally { setWorking(false) }
  }

  function updateMonth(index, field, value) {
    setDraft(current => ({ ...current, months:current.months.map((row, i) => i === index ? { ...row, [field]:value } : row) }))
  }

  function updateMetric(index, key, field, value) {
    setDraft(current => ({ ...current, months:current.months.map((row, i) => i === index ? { ...row, metrics:{ ...row.metrics, [key]:{ ...(row.metrics?.[key] || {}), [field]:value || null } } } : row) }))
  }

  async function save(event) {
    event.preventDefault()
    if (!file) { toast.error('Adjuntá el PDF original.'); return }
    if (!draft.months.length) { toast.error('Agregá al menos un mes con resultado publicado.'); return }
    if (new Set(draft.months.map(month => Number(month.month))).size !== draft.months.length) { toast.error('Hay meses repetidos.'); return }
    setWorking(true)
    try {
      await createAirlineReport({ ...draft, file, userId:user.id })
      setShowUpload(false); setFile(null); setDraft(emptyDraft())
      await load(); toast.ok('Informe guardado como borrador. Revisalo y publicalo para incorporarlo al tablero.')
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setWorking(false) }
  }

  async function publish(id) {
    setWorking(true)
    try { await publishAirlineReport(id); await load(); toast.ok('Informe publicado en el tablero.') }
    catch (e) { toast.error(mensajeError(e)) }
    finally { setWorking(false) }
  }

  return <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4 fade-in">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-title text-xl font-bold">Desempeño de escalas aéreas</h2><p className="text-sm" style={{ color:'var(--text-dim)' }}>Informes de Copa Airlines por aeropuerto y período, con PDF original y evolución mensual.</p></div><div className="flex gap-2"><button type="button" className="btn-ghost" onClick={load}><RefreshCw size={14} /> Actualizar</button>{canWrite && <button type="button" className="btn-primary" onClick={() => setShowUpload(value => !value)}><Plus size={14} /> Subir informe</button>}</div></div>
    {error && <div className="glass p-3" role="alert" style={{ color:'var(--alert)' }}>No se pudieron cargar los informes: {error}</div>}
    {showUpload && <form onSubmit={save} className="glass p-4 space-y-3"><div><strong>Nuevo informe</strong><p className="text-xs" style={{ color:'var(--text-dim)' }}>El PDF se lee en tu navegador. Solo se toman meses con TOTAL; los valores precargados sin resultado quedan fuera. Revisá todos los datos antes de guardar.</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="block">PDF original *<input required type="file" accept="application/pdf,.pdf" className="input-dark w-full" onChange={e => selectFile(e.target.files?.[0])} /></label>
        <label className="block">Sede aeroportuaria *<select required className="input-dark w-full" value={draft.siteId} onChange={e => setDraft({ ...draft, siteId:e.target.value })}><option value="">Seleccionar</option>{sites.map(site => <option key={site.id} value={site.id}>{site.nombre}</option>)}</select></label>
        <label className="block">Aerolínea *<input required className="input-dark w-full" value={draft.airline} onChange={e => setDraft({ ...draft, airline:e.target.value })} /></label>
        <label className="block">Año *<input required type="number" min="2020" max="2100" className="input-dark w-full" value={draft.year} onChange={e => setDraft({ ...draft, year:e.target.value })} /></label>
        <label className="block">Acumulado informado (%)<input type="number" min="0" max="100" step="0.1" className="input-dark w-full" value={draft.cumulativeScore} onChange={e => setDraft({ ...draft, cumulativeScore:e.target.value })} /></label>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm" style={{ minWidth:650 }}><thead><tr><th className="p-2 text-left">Mes</th><th className="p-2 text-left">Total (%)</th><th className="p-2 text-left">Nivel informado</th><th className="p-2 text-left">Acción</th></tr></thead><tbody>{draft.months.map((row, index) => <tr key={index} className="border-t border-white/10"><td className="p-2"><select aria-label={`Mes ${index + 1}`} className="input-dark" value={row.month} onChange={e => updateMonth(index, 'month', e.target.value)}>{MONTHS.map((month, i) => <option key={month} value={i + 1}>{month}</option>)}</select></td><td className="p-2"><input aria-label={`Total ${index + 1}`} required type="number" min="0" max="100" step="0.1" className="input-dark w-28" value={row.total_score} onChange={e => updateMonth(index, 'total_score', e.target.value)} /></td><td className="p-2"><input aria-label={`Nivel ${index + 1}`} className="input-dark w-full" value={row.level || ''} onChange={e => updateMonth(index, 'level', e.target.value)} /></td><td className="p-2"><button type="button" className="btn-ghost" onClick={() => setDraft(current => ({ ...current, months:current.months.filter((_, i) => i !== index) }))}>Quitar</button></td></tr>)}</tbody></table></div>
      <details><summary className="cursor-pointer">Revisar indicadores por mes (incluye NA y ceros)</summary><div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-3">{draft.months.map((row, index) => <div key={index} className="border border-white/10 rounded p-3"><strong>{MONTHS[Number(row.month) - 1] || 'Mes'} · {row.total_score}%</strong><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">{PERFORMANCE_CATEGORIES.map(([key, label]) => <div key={key}><span className="text-xs">{label}</span><div className="flex gap-1"><input aria-label={`${label} dato ${index + 1}`} className="input-dark min-w-0 w-1/2" placeholder="Dato / NA" value={row.metrics?.[key]?.reported_value ?? ''} onChange={e => updateMetric(index, key, 'reported_value', e.target.value)} /><input aria-label={`${label} puntos ${index + 1}`} className="input-dark min-w-0 w-1/2" placeholder="Puntos" value={row.metrics?.[key]?.awarded ?? ''} onChange={e => updateMetric(index, key, 'awarded', e.target.value)} /></div></div>)}</div></div>)}</div></details>
      <div className="flex flex-wrap justify-between gap-2"><button type="button" className="btn-ghost" onClick={() => setDraft(current => ({ ...current, months:[...current.months, { month:1, total_score:'', level:'', metrics:{} }] }))}>+ Agregar mes</button><div className="flex gap-2"><button type="button" className="btn-ghost" onClick={() => setShowUpload(false)}>Cancelar</button><button type="submit" className="btn-primary" disabled={working || !sites.length}>{working ? 'Procesando…' : 'Guardar borrador'}</button></div></div>
    </form>}
    {canWrite && drafts.length > 0 && <div className="glass p-4 space-y-2"><h3 className="font-semibold">Pendientes de publicación</h3>{drafts.map(report => <div key={report.id} className="flex flex-wrap justify-between items-center gap-2 border-t border-white/10 pt-2"><span>{report.airline} · {siteNames.get(String(report.site_id)) || report.site_id} · {report.report_year} · {(report.airline_performance_months || []).length} meses</span><div className="flex gap-2">{report.storage_path && <button type="button" className="btn-ghost" onClick={() => openAirlinePdf(report.storage_path).catch(e => toast.error(mensajeError(e)))}><FileText size={14} /> PDF</button>}<button type="button" className="btn-primary" disabled={working || !report.storage_path || !report.airline_performance_months?.length} onClick={() => publish(report.id)}>Publicar</button></div></div>)}</div>}
    <div className="glass p-3 flex flex-col md:flex-row gap-2"><div className="w-full md:w-72 md:shrink-0"><select aria-label="Filtrar por aeropuerto" className="input-dark" value={siteId} onChange={e => setSiteId(e.target.value)}><option value="">Todos los aeropuertos</option>{sites.map(site => <option key={site.id} value={site.id}>{site.nombre}</option>)}</select></div><div className="w-full md:w-36 md:shrink-0"><select aria-label="Filtrar por año" className="input-dark" value={year} onChange={e => setYear(e.target.value)}><option value="">Todos los años</option>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></div><div className="w-full md:w-56 md:shrink-0"><select aria-label="Filtrar por aerolínea" className="input-dark" value={airline} onChange={e => setAirline(e.target.value)}><option value="">Todas las aerolíneas</option>{airlines.map(value => <option key={value} value={value}>{value}</option>)}</select></div></div>
    {selected ? <><div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{[['Informes vigentes', filtered.length], ['Meses publicados', chartRows.length], ['Último mes', chartRows.length ? `${chartRows.at(-1).total_score}%` : '—'], ['Acumulado informado', selected.cumulative_score == null ? '—' : `${selected.cumulative_score}%`]].map(([label, value]) => <div key={label} className="kpi-card"><strong className="kpi-value">{value}</strong><span className="kpi-label">{label}</span></div>)}</div>
      <div className="glass p-4"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">{selected.airline} · {siteNames.get(String(selected.site_id)) || selected.site_id} · {selected.report_year}</h3><p className="text-xs" style={{ color:'var(--text-dim)' }}>Puntaje mensual publicado en el informe; el acumulado se conserva por separado.</p></div>{selected.storage_path && <button type="button" className="btn-ghost" onClick={() => openAirlinePdf(selected.storage_path).catch(e => toast.error(mensajeError(e)))}><FileText size={14} /> Abrir PDF original</button>}</div><div style={{ width:'100%', height:260 }}><ResponsiveContainer><LineChart data={chartRows} margin={{ top:20, right:20, bottom:5, left:0 }}><CartesianGrid stroke="#444" strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} /><Tooltip formatter={v => `${v}%`} /><Line type="monotone" dataKey="total_score" name="Resultado" stroke="#41e500" strokeWidth={3} connectNulls={false} /></LineChart></ResponsiveContainer></div></div>
      <div className="glass overflow-x-auto"><table className="w-full text-sm" style={{ minWidth:900 }}><thead><tr><th className="p-3 text-left">Mes</th><th className="p-3 text-left">Total</th><th className="p-3 text-left">Nivel</th>{PERFORMANCE_CATEGORIES.map(([key, label]) => <th key={key} className="p-3 text-left">{label}</th>)}</tr></thead><tbody>{chartRows.map(row => <tr key={row.id} className="border-t border-white/10"><td className="p-3">{MONTHS[row.month - 1]}</td><td className="p-3 font-bold" style={{ color:scoreColor(row.total_score) }}>{row.total_score}%</td><td className="p-3">{row.level || '—'}</td>{PERFORMANCE_CATEGORIES.map(([key]) => { const metric = row.metrics?.[key]; return <td key={key} className="p-3" title={metric && typeof metric === 'object' ? `Dato: ${metric.reported_value ?? '—'} · Puntaje: ${metric.awarded ?? '—'}` : ''}>{metric && typeof metric === 'object' ? <><div>{metric.reported_value ?? '—'}</div><small style={{ color:'var(--text-dim)' }}>{metric.awarded ?? '—'} pts</small></> : metric || '—'}</td> })}</tr>)}</tbody></table></div>
      {priorVersions.length > 0 && <details className="glass p-4"><summary className="cursor-pointer">Versiones anteriores ({priorVersions.length})</summary><div className="space-y-2 mt-3">{priorVersions.map(report => <div key={report.id} className="flex flex-wrap justify-between items-center gap-2 border-t border-white/10 pt-2"><span>{new Date(report.published_at).toLocaleDateString('es-AR')} · {report.airline_performance_months?.length || 0} meses · acumulado {report.cumulative_score == null ? '—' : `${report.cumulative_score}%`}</span>{report.storage_path && <button type="button" className="btn-ghost" onClick={() => openAirlinePdf(report.storage_path).catch(e => toast.error(mensajeError(e)))}>Abrir PDF</button>}</div>)}</div></details>}
      {filtered.length > 1 && <div className="glass p-4"><h3 className="font-semibold mb-2">Comparar sedes y períodos</h3>{comparisonReports.length > 1 && <><p className="text-xs mb-2" style={{ color:'var(--text-dim)' }}>{selected.airline} · {comparisonYear}. Cada línea conserva la sede; los meses sin resultado quedan vacíos.</p><div style={{ width:'100%', height:280 }}><ResponsiveContainer><LineChart data={comparisonRows} margin={{ top:10, right:20, bottom:5, left:0 }}><CartesianGrid stroke="#444" strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} /><Tooltip formatter={v => `${v}%`} /><Legend />{comparisonReports.map((report, index) => <Line key={report.id} type="monotone" dataKey={siteNames.get(String(report.site_id)) || String(report.site_id)} stroke={['#41e500', '#38bdf8', '#f59e0b', '#f472b6', '#a78bfa'][index % 5]} strokeWidth={2} connectNulls={false} />)}</LineChart></ResponsiveContainer></div></>}<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Sede</th><th className="p-2 text-left">Aerolínea</th><th className="p-2 text-left">Año</th><th className="p-2 text-left">Acumulado</th><th className="p-2 text-left">Meses</th><th className="p-2 text-left">Acción</th></tr></thead><tbody>{filtered.map(report => <tr key={report.id} className="border-t border-white/10"><td className="p-2">{siteNames.get(String(report.site_id))}</td><td className="p-2">{report.airline}</td><td className="p-2">{report.report_year}</td><td className="p-2">{report.cumulative_score == null ? '—' : `${report.cumulative_score}%`}</td><td className="p-2">{report.airline_performance_months?.length || 0}</td><td className="p-2"><button type="button" className="btn-ghost" aria-current={report.id === selected.id ? 'true' : undefined} onClick={() => setSelectedReportId(report.id)}>Ver evolución</button></td></tr>)}</tbody></table></div></div>}
    </> : !loading && <div className="glass p-8 text-center" style={{ color:'var(--text-dim)' }}>Todavía no hay informes publicados para estos filtros.</div>}
    {loading && <p>Cargando informes…</p>}
  </div>
}
