import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../lib/auth'
import { getSedes } from '../lib/queries'
import { getAdjuntos } from '../lib/adjuntos'
import { auditDate, auditDelta, auditEvolution, listFoodAudits, saveFoodAudit } from '../lib/foodAudits'
import { mensajeError } from '../lib/errores'
import { fmtFecha } from '../lib/dateUtils'

const percent = value => value == null ? '—' : `${Number(value).toLocaleString('es-AR')} %`
const blankDraft = () => ({ id:crypto.randomUUID(), sede_id:'', organismo_auditor:'', fecha_auditoria:'', porcentaje_cumplimiento:'', resumen:'' })

function AuditDetails({ report, onOpenTab }) {
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    getAdjuntos('auditoria_informe', report.id).then(data => { if (active) setFiles(data) }).catch(e => { if (active) setError(mensajeError(e)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [report.id])
  const areas = Array.isArray(report.resultados_area) ? report.resultados_area : []
  return <section className="glass p-4 space-y-4" aria-label="Detalle de auditoría">
    <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-title text-lg font-bold">{report.sedes?.nombre} · {fmtFecha(auditDate(report))}</h3><p>{report.organismo_auditor || 'Sin organismo'} · {report.codigo}</p></div><strong className="text-2xl" style={{ color:'var(--phosphor)' }}>{percent(report.porcentaje_cumplimiento)}</strong></div>
    {loading && <p role="status">Cargando documentos…</p>}{error && <p role="alert">{error}</p>}
    <div className="flex flex-wrap gap-2">{files.map(file => <a key={file.id} className="btn-ghost" href={file.url} target="_blank" rel="noopener noreferrer">Abrir PDF original · {file.nombre}</a>)}</div>
    {!loading && !error && !files.length && <p style={{ color:'var(--text-dim)' }}>Este registro histórico no tiene PDF vinculado en esta vista.</p>}
    {report.resumen && <p style={{ whiteSpace:'pre-wrap' }}>{report.resumen}</p>}
    {report.observaciones && <p className="p-3 border border-amber-400/30 rounded" style={{ whiteSpace:'pre-wrap', color:'#fbbf24' }}>{report.observaciones}</p>}
    {areas.length > 0 && <div className="overflow-x-auto"><h4 className="font-bold mb-2">Resultado por área</h4><table className="w-full text-sm"><thead><tr><th className="text-left p-2">Área</th><th className="p-2">Puntos obtenidos / peso</th><th className="p-2">Cumplimiento del área</th></tr></thead><tbody>{areas.map((area, i) => <tr key={i} className="border-t border-white/10"><td className="p-2">{area.nombre}</td><td className="p-2 text-center">{area.obtenido ?? '—'} / {area.maximo ?? '—'}</td><td className="p-2 text-center">{percent(area.porcentaje)}</td></tr>)}</tbody></table><p className="text-xs mt-2">Se conserva el total oficial del informe; los subtotales redondeados pueden no sumar exactamente lo mismo.</p></div>}
    <h4 className="font-bold">Hallazgos y seguimiento</h4>
    {(report.auditoria_hallazgos || []).length ? <div className="space-y-3">{report.auditoria_hallazgos.map(h => <article key={h.id} className="border border-white/10 rounded p-3"><div className="flex flex-wrap justify-between gap-2"><strong>{h.titulo}</strong><span>{h.estado}{h.es_reincidente ? ' · Reiterado' : ''}</span></div><p style={{ whiteSpace:'pre-wrap' }}>{h.descripcion}</p><p className="text-sm mt-2" style={{ color:'var(--text-dim)' }}>Responsable: {h.responsable_nombre || 'Sin asignar'} · Plazo: {h.fecha_limite ? fmtFecha(h.fecha_limite) : 'Sin definir'}</p></article>)}</div> : <p>Sin hallazgos cargados en este registro.</p>}
    <button className="btn-ghost" onClick={() => onOpenTab?.('auditorias')}>Gestionar hallazgos en Auditorías</button>
  </section>
}

export default function FoodAudits({ onOpenTab }) {
  const { allowedSedeIds, perfil, user } = useAuth()
  const canWrite = ['admin', 'editor'].includes(perfil?.rol)
  const [sites, setSites] = useState([])
  const [reports, setReports] = useState([])
  const [siteId, setSiteId] = useState('')
  const [organism, setOrganism] = useState('')
  const [year, setYear] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [draft, setDraft] = useState(null)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const generation = useRef(0)
  const load = useCallback(async () => {
    const version = ++generation.current
    setLoading(true); setError(''); setReports([])
    try {
      const [siteRows, auditRows] = await Promise.all([Array.isArray(allowedSedeIds) && !allowedSedeIds.length ? [] : getSedes(allowedSedeIds), listFoodAudits(allowedSedeIds)])
      if (version !== generation.current) return
      setSites(siteRows); setReports(auditRows)
      setSiteId(current => siteRows.some(site => String(site.id) === current) ? current : String(auditRows[0]?.sede_id || siteRows[0]?.id || ''))
    } catch (e) { if (version === generation.current) setError(mensajeError(e)) }
    finally { if (version === generation.current) setLoading(false) }
  }, [allowedSedeIds])
  useEffect(() => { const requestGeneration = generation; load(); return () => { requestGeneration.current++ } }, [load])
  const siteReports = reports.filter(row => String(row.sede_id) === siteId)
  const organisms = [...new Set(siteReports.map(row => row.organismo_auditor || 'Sin organismo'))].sort()
  const selectedOrganism = organisms.includes(organism) ? organism : organisms[0] || ''
  const years = [...new Set(siteReports.map(row => auditDate(row).slice(0, 4)).filter(Boolean))].sort().reverse()
  const evolution = useMemo(() => auditEvolution(reports, siteId, selectedOrganism, year), [reports, siteId, selectedOrganism, year])
  const selected = evolution.find(row => row.id === selectedId) || evolution.at(-1)
  const delta = auditDelta(evolution)
  const latest = evolution.at(-1)
  const pending = siteReports.filter(row => row.estado === 'Borrador')
  async function save(event) {
    event.preventDefault()
    if (!canWrite || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const id = await saveFoodAudit({ draft, file, userId:user.id, userName:perfil?.nombre, allowedIds:allowedSedeIds })
      setSiteId(String(draft.sede_id)); setOrganism(draft.organismo_auditor); setYear(''); setSelectedId(id)
      setDraft(null); setFile(null); await load(); setNotice('Auditoría publicada y PDF vinculado a la biblioteca de la sede.')
    } catch (e) { setError(`${mensajeError(e)} Si se creó un borrador, podés completar la carga sin duplicarlo.`) }
    finally { setBusy(false) }
  }
  return <div className="flex-1 h-full min-h-0 overflow-y-auto p-4 md:p-6 space-y-5">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-title text-xl font-bold">Auditorías de calidad e inocuidad</h2><p style={{ color:'var(--text-dim)' }}>Informes externos por sede y organismo, PDF original, hallazgos y evolución entre auditorías.</p></div><div className="flex gap-2"><button className="btn-ghost" onClick={load} disabled={busy || loading}>Actualizar</button>{canWrite && <button className="btn-primary" disabled={busy} onClick={() => { setDraft(blankDraft()); setFile(null) }}>Subir auditoría</button>}</div></div>
    {error && <p role="alert" className="p-3 border border-red-400/40">{error}</p>}{notice && <p role="status">{notice}</p>}
    {draft && <form onSubmit={save} className="glass p-4 space-y-3"><h3 className="font-bold">Cargar informe original</h3><p>Copiá la fecha y el porcentaje informados en el PDF. Cada carga se conserva como una auditoría independiente.</p><fieldset disabled={busy || reports.some(row => row.id === draft.id)} className="grid grid-cols-1 md:grid-cols-2 gap-3"><label>Sede<select required className="input-dark w-full" value={draft.sede_id} onChange={e => setDraft({ ...draft, sede_id:e.target.value })}><option value="">Seleccionar</option>{sites.map(site => <option key={site.id} value={site.id}>{site.nombre}</option>)}</select></label><label>Organismo auditor<input required className="input-dark w-full" value={draft.organismo_auditor} onChange={e => setDraft({ ...draft, organismo_auditor:e.target.value })} /></label><label>Fecha de auditoría<input required type="date" className="input-dark w-full" value={draft.fecha_auditoria} onChange={e => setDraft({ ...draft, fecha_auditoria:e.target.value })} /></label><label>Cumplimiento (%)<input required type="number" min="0" max="100" step="0.01" className="input-dark w-full" value={draft.porcentaje_cumplimiento} onChange={e => setDraft({ ...draft, porcentaje_cumplimiento:e.target.value })} /></label><label className="md:col-span-2">Resumen / observaciones<textarea className="input-dark w-full" value={draft.resumen || ''} onChange={e => setDraft({ ...draft, resumen:e.target.value })} /></label></fieldset><label className="block">PDF original (hasta 15 MB)<input aria-label="PDF original" disabled={busy} type="file" accept="application/pdf,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} /></label><div className="flex gap-2"><button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar y publicar'}</button><button type="button" className="btn-ghost" disabled={busy} onClick={() => setDraft(null)}>Cerrar</button></div></form>}
    <div className="glass p-3 grid grid-cols-1 md:grid-cols-3 gap-3"><label>Sede<select aria-label="Sede de auditorías" className="input-dark w-full" value={siteId} onChange={e => { setSiteId(e.target.value); setYear(''); setSelectedId('') }}>{sites.map(site => <option key={site.id} value={site.id}>{site.nombre}</option>)}</select></label><label>Organismo<select className="input-dark w-full" value={selectedOrganism} onChange={e => { setOrganism(e.target.value); setSelectedId('') }}>{organisms.map(value => <option key={value}>{value}</option>)}</select></label><label>Año<select className="input-dark w-full" value={year} onChange={e => { setYear(e.target.value); setSelectedId('') }}><option value="">Todos los años</option>{years.map(value => <option key={value}>{value}</option>)}</select></label></div>
    {loading ? <p role="status">Cargando auditorías…</p> : <>
      {canWrite && pending.length > 0 && <div className="glass p-3"><h3 className="font-bold">Cargas pendientes</h3>{pending.map(row => <div key={row.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{fmtFecha(auditDate(row))} · {row.organismo_auditor}</span><button className="btn-ghost" onClick={() => { setDraft(row); setFile(null) }}>Completar carga</button></div>)}</div>}
      {!evolution.length ? <p>No hay auditorías finalizadas para esta selección.</p> : <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{[['Auditorías', evolution.length], ['Último cumplimiento', percent(latest?.score)], ['Variación vs. anterior', delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toLocaleString('es-AR')} puntos`]].map(([label, value]) => <div key={label} className="glass p-4"><div className="text-3xl font-bold" style={{ color:'var(--phosphor)' }}>{value}</div><div>{label}</div></div>)}</div>
        <section className="glass p-4"><h3 className="font-bold">Evolución · {selectedOrganism}</h3><p className="text-sm">Porcentaje oficial por fecha de auditoría. No se mezclan organismos ni se calculan promedios mensuales.</p><div style={{ height:290, width:'100%' }}><ResponsiveContainer><LineChart data={evolution} margin={{ top:20, right:25, bottom:10, left:0 }}><CartesianGrid stroke="#444" strokeDasharray="3 3" /><XAxis dataKey="fecha" tickFormatter={fmtFecha} /><YAxis domain={[0, 100]} tickFormatter={value => `${value}%`} /><Tooltip labelFormatter={fmtFecha} formatter={percent} contentStyle={{ background:'#202027', border:'1px solid #555', color:'#fff' }} /><Line type="linear" dataKey="score" name="Cumplimiento" stroke="#39ff14" strokeWidth={3} connectNulls={false} /></LineChart></ResponsiveContainer></div></section>
        <div className="glass p-3 overflow-x-auto"><table className="w-full text-sm"><caption className="text-left font-bold mb-2">Historial de auditorías</caption><thead><tr><th className="p-2 text-left">Fecha</th><th className="p-2">Cumplimiento</th><th className="p-2">Hallazgos abiertos</th><th className="p-2">Detalle</th></tr></thead><tbody>{evolution.map(row => <tr key={row.id} className="border-t border-white/10"><td className="p-2">{fmtFecha(row.fecha)}</td><td className="p-2 text-center">{percent(row.score)}</td><td className="p-2 text-center">{(row.auditoria_hallazgos || []).filter(h => !['Cerrado','Descartado'].includes(h.estado)).length}</td><td className="p-2"><button className="btn-ghost" aria-pressed={selected?.id === row.id} onClick={() => setSelectedId(row.id)}>Ver auditoría</button></td></tr>)}</tbody></table></div>
        {selected && <AuditDetails key={selected.id} report={selected} onOpenTab={onOpenTab} />}
      </>}
    </>}
  </div>
}
