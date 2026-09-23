import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, FileText, Plus, RefreshCw } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { getSedes } from '../lib/queries'
import { buildMicroStats, MICROBIOLOGIA_PARAMETROS } from '../lib/microbiologia'
import { attachMicroPdf, createMicroResult, listMicroResults, openMicroPdf, annulMicroResult } from '../lib/microbiologiaQueries'
import { toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'

const today = () => new Date().toLocaleDateString('en-CA')
const emptyForm = () => ({ sede_id:'', fecha:today(), protocolo:'', laboratorio:'', muestra:'', parametro:'', resultado:'', unidad:'', conclusion:'', criterio:'', observaciones:'' })
const STATUS = { cumple:'Cumple', observado:'Observado', no_cumple:'No cumple' }

export default function Microbiologia({ onOpenTab }) {
  const { allowedSedeIds, can, user } = useAuth()
  const canWrite = can('calidad', 'manage')
  const [sedes, setSedes] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [siteFilter, setSiteFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [sites, results] = await Promise.all([
        Array.isArray(allowedSedeIds) && !allowedSedeIds.length ? [] : getSedes(allowedSedeIds),
        listMicroResults(allowedSedeIds),
      ])
      setSedes(sites)
      setRows(results)
      setForm(current => current.sede_id || !sites.length ? current : { ...current, sede_id:String(sites[0].id) })
    } catch (e) {
      setError(mensajeError(e))
    } finally { setLoading(false) }
  }, [allowedSedeIds])
  useEffect(() => { load() }, [load])

  const siteNames = useMemo(() => new Map(sedes.map(site => [String(site.id), site.nombre])), [sedes])
  const visible = useMemo(() => rows.filter(row => {
    if (siteFilter && String(row.sede_id) !== siteFilter) return false
    if (statusFilter && row.estado !== statusFilter) return false
    const needle = query.trim().toLocaleLowerCase()
    return !needle || [row.protocolo, row.muestra, row.parametro, row.laboratorio, siteNames.get(String(row.sede_id))].some(value => String(value || '').toLocaleLowerCase().includes(needle))
  }), [rows, siteFilter, statusFilter, query, siteNames])
  const stats = buildMicroStats(visible)

  async function submit(event) {
    event.preventDefault()
    if (!canWrite) return
    setSaving(true)
    try {
      const payload = {
        sede_id:Number(form.sede_id), fecha:form.fecha,
        protocolo:form.protocolo.trim(), laboratorio:form.laboratorio.trim() || null,
        muestra:form.muestra.trim(), parametro:form.parametro.trim(),
        valor:form.resultado.trim(), unidad:form.unidad.trim() || null,
        estado:form.conclusion, criterio:form.criterio.trim() || null,
        notas:form.observaciones.trim() || null, creado_por:user.id,
      }
      const created = await createMicroResult(payload)
      let pdfFailed = false
      if (file) {
        try { await attachMicroPdf(created.id, file) }
        catch (uploadError) { pdfFailed = true; toast.error(`Resultado guardado, pero no se adjuntó el PDF: ${mensajeError(uploadError)}. Podés subirlo desde el registro.`) }
      }
      setForm({ ...emptyForm(), sede_id:form.sede_id })
      setFile(null)
      setShowForm(false)
      await load()
      if (!pdfFailed) toast.ok('Resultado microbiológico registrado.')
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  async function uploadLater(row, selected) {
    if (!selected) return
    try { await attachMicroPdf(row.id, selected); await load(); toast.ok('PDF adjuntado.') }
    catch (e) { toast.error(mensajeError(e)) }
  }

  async function annul(row) {
    const reason = window.prompt(`Motivo para anular el protocolo ${row.protocolo}:`)
    if (!reason?.trim()) return
    try { await annulMicroResult(row.id, user.id, reason); await load(); toast.ok('Resultado anulado; el historial permanece.') }
    catch (e) { toast.error(mensajeError(e)) }
  }

  return <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4 fade-in">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-title text-xl font-bold">Control microbiológico</h2><p className="text-sm" style={{ color:'var(--text-dim)' }}>Protocolos de laboratorio, resultados y evidencia PDF por sede.</p></div>
      <div className="flex gap-2"><button type="button" className="btn-ghost" onClick={load}><RefreshCw size={14} /> Actualizar</button>{canWrite && <button type="button" className="btn-primary" onClick={() => setShowForm(!showForm)}><Plus size={14} /> Nuevo resultado</button>}</div>
    </div>
    {error && <div role="alert" className="glass p-3" style={{ color:'var(--alert)' }}>No se pudieron cargar los resultados: {error}</div>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{[['Resultados',stats.total],['Cumple',stats.cumple],['Observados',stats.observado],['No cumple',stats.noCumple]].map(([label,value]) => <div key={label} className="kpi-card"><strong className="kpi-value">{value}</strong><span className="kpi-label">{label}</span></div>)}</div>
    {showForm && <form onSubmit={submit} className="glass p-4 space-y-3">
      <div><strong>Registrar resultado</strong><p className="text-xs" style={{ color:'var(--text-dim)' }}>La conclusión y el criterio deben provenir del protocolo de laboratorio o de una evaluación técnica. La app no aplica límites automáticos.</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="block">Sede *<select required className="input-dark w-full" value={form.sede_id} onChange={e => setForm({ ...form, sede_id:e.target.value })}><option value="">Seleccionar</option>{sedes.map(site => <option key={site.id} value={site.id}>{site.nombre}</option>)}</select></label>
        <label className="block">Fecha *<input required type="date" className="input-dark w-full" value={form.fecha} onChange={e => setForm({ ...form, fecha:e.target.value })} /></label>
        <label className="block">N.º de protocolo *<input required className="input-dark w-full" value={form.protocolo} onChange={e => setForm({ ...form, protocolo:e.target.value })} /></label>
        <label className="block">Laboratorio<input className="input-dark w-full" value={form.laboratorio} onChange={e => setForm({ ...form, laboratorio:e.target.value })} /></label>
        <label className="block">Muestra / matriz *<input required className="input-dark w-full" value={form.muestra} onChange={e => setForm({ ...form, muestra:e.target.value })} /></label>
        <label className="block">Parámetro *<input required list="micro-parametros" className="input-dark w-full" value={form.parametro} onChange={e => setForm({ ...form, parametro:e.target.value })} /><datalist id="micro-parametros">{MICROBIOLOGIA_PARAMETROS.map(value => <option key={value} value={value} />)}</datalist></label>
        <label className="block">Resultado *<input required className="input-dark w-full" value={form.resultado} onChange={e => setForm({ ...form, resultado:e.target.value })} placeholder="Ej. Ausencia, &lt;10, 250" /></label>
        <label className="block">Unidad<input className="input-dark w-full" value={form.unidad} onChange={e => setForm({ ...form, unidad:e.target.value })} placeholder="Ej. UFC/g o /25 g" /></label>
        <label className="block">Conclusión *<select required className="input-dark w-full" value={form.conclusion} onChange={e => setForm({ ...form, conclusion:e.target.value })}><option value="">Seleccionar</option>{Object.entries(STATUS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="block md:col-span-2">Criterio aplicado<input className="input-dark w-full" value={form.criterio} onChange={e => setForm({ ...form, criterio:e.target.value })} placeholder="Norma, especificación o dictamen del laboratorio" /></label>
        <label className="block">PDF original (hasta 10 MB)<input type="file" accept="application/pdf,.pdf" className="input-dark w-full" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
      </div>
      <label className="block">Observaciones<textarea className="input-dark w-full" rows={2} value={form.observaciones} onChange={e => setForm({ ...form, observaciones:e.target.value })} /></label>
      <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="btn-primary" disabled={saving || !sedes.length}>{saving ? 'Guardando…' : 'Guardar resultado'}</button></div>
    </form>}
    <div className="glass p-3 flex flex-wrap gap-2">
      <input aria-label="Buscar resultados" className="input-dark flex-1 min-w-48" placeholder="Buscar protocolo, muestra, parámetro…" value={query} onChange={e => setQuery(e.target.value)} />
      <select aria-label="Filtrar por sede" className="input-dark" value={siteFilter} onChange={e => setSiteFilter(e.target.value)}><option value="">Todas las sedes</option>{sedes.map(site => <option key={site.id} value={site.id}>{site.nombre}</option>)}</select>
      <select aria-label="Filtrar por estado" className="input-dark" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Todos los estados</option>{Object.entries(STATUS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select>
    </div>
    <div className="glass overflow-x-auto"><table className="w-full text-sm" style={{ minWidth:900 }}><thead><tr>{['Fecha / protocolo','Sede','Muestra','Parámetro','Resultado','Conclusión','Evidencia','Acciones'].map(label => <th key={label} className="p-3 text-left">{label}</th>)}</tr></thead><tbody>{visible.map(row => <tr key={row.id} className="border-t border-white/10" style={{ opacity:row.anulado_en ? 0.55 : 1 }}>
      <td className="p-3"><strong>{row.protocolo}</strong><div>{row.fecha}</div>{row.anulado_en && <span>Anulado: {row.motivo_anulacion}</span>}</td><td className="p-3">{siteNames.get(String(row.sede_id)) || row.sede_id}</td><td className="p-3">{row.muestra}</td><td className="p-3">{row.parametro}</td><td className="p-3">{row.valor} {row.unidad}</td><td className="p-3">{STATUS[row.estado] || row.estado}{row.criterio && <div className="text-xs" title={row.criterio}>{row.criterio}</div>}</td>
      <td className="p-3">{row.pdf_path ? <button type="button" className="btn-ghost" onClick={() => openMicroPdf(row.pdf_path).catch(e => toast.error(mensajeError(e)))}><FileText size={14} /> {row.pdf_nombre}</button> : <div>{row.evidencia && <p className="text-xs" title="El respaldo solo conservó el nombre; el PDF aún no está adjuntado">Referencia histórica: {row.evidencia} (sin archivo)</p>}{canWrite && !row.anulado_en ? <label className="btn-ghost cursor-pointer">Adjuntar PDF<input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={e => uploadLater(row, e.target.files?.[0])} /></label> : !row.evidencia ? '—' : null}</div>}</td>
      <td className="p-3">{canWrite && !row.anulado_en && <button type="button" className="btn-ghost" onClick={() => annul(row)}>Anular</button>}</td>
    </tr>)}</tbody></table>{!loading && !visible.length && <p className="p-8 text-center" style={{ color:'var(--text-dim)' }}>No hay resultados para estos filtros.</p>}{loading && <p className="p-4">Cargando…</p>}</div>
    {stats.noCumple > 0 && <div className="glass p-4 flex flex-wrap justify-between gap-2"><span><AlertTriangle size={15} className="inline" /> Hay {stats.noCumple} resultado(s) no conforme(s). Revisá el protocolo y registrá el tratamiento.</span><span className="flex gap-2"><button type="button" className="btn-ghost" onClick={() => onOpenTab?.('nc')}>No conformidades</button><button type="button" className="btn-primary" onClick={() => onOpenTab?.('capa')}>CAPA</button></span></div>}
  </div>
}
