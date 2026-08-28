import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Dna, FileText, FlaskConical, Plus, Search, Trash2, Upload } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../lib/auth'
import { getSedes } from '../lib/queries'
import {
  MICROBIOLOGIA_PARAMETROS,
  buildMicroStats,
  createMicroRecords,
  deleteMicroRecord,
  getMicroRecords,
  normalizeMicroRecord,
} from '../lib/microbiologia'

const EMPTY_FORM = {
  sedeId:'', fecha:new Date().toISOString().slice(0, 10), protocolo:'', laboratorio:'',
  muestra:'', parametroId:'salmonella', valor:'Ausencia', unidad:'/25 g', archivoNombre:'',
}

const STATUS = {
  cumple:{ label:'Cumple', color:'var(--phosphor)', className:'chip-green' },
  observado:{ label:'Observado', color:'var(--warn)', className:'chip-yellow' },
  no_cumple:{ label:'No cumple', color:'var(--alert)', className:'chip-red' },
}

function MetricCard({ label, value, detail, icon: Icon, color = 'var(--phosphor)' }) {
  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between gap-3">
        <div><p className="kpi-value" style={{ color }}>{value}</p><p className="kpi-label">{label}</p></div>
        <Icon size={22} style={{ color, opacity:0.78 }} />
      </div>
      <p style={{ color:'var(--text-dim)', fontSize:'0.65rem', marginTop:8 }}>{detail}</p>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="block"><span className="font-metric block mb-1" style={{ color:'var(--text-dim)', fontSize:'0.62rem' }}>{label}</span>{children}</label>
}

export default function Microbiologia({ onOpenTab }) {
  const { allowedSedeIds, can } = useAuth()
  const canWrite = can('calidad', 'manage')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [storageError, setStorageError] = useState('')
  const [sedes, setSedes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [scanResult, setScanResult] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')

  useEffect(() => {
    let active = true
    getSedes(allowedSedeIds).then(data => {
      if (!active) return
      const next = data || []
      setSedes(next)
      setForm(current => current.sedeId || !next.length ? current : { ...current, sedeId:String(next[0].id) })
    }).catch(error => console.error('[microbiologia] no se pudieron cargar sedes', error))
    return () => { active = false }
  }, [allowedSedeIds])

  useEffect(() => {
    let active = true
    setLoading(true)
    getMicroRecords()
      .then(data => { if (active) setRecords(data) })
      .catch(error => {
        console.error('[microbiologia] no se pudieron cargar resultados', error)
        if (active) setStorageError('No se pudieron cargar los resultados desde la base de datos.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const visibleRecords = useMemo(() => {
    const allowed = allowedSedeIds ? new Set(allowedSedeIds.map(String)) : null
    const text = query.trim().toLowerCase()
    return records
      .filter(record => !record.sedeId || !allowed || allowed.has(String(record.sedeId)))
      .filter(record => statusFilter === 'todos' || record.estado === statusFilter)
      .filter(record => !text || [record.protocolo, record.muestra, record.parametro, record.laboratorio, record.sedeNombre].some(value => String(value || '').toLowerCase().includes(text)))
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
  }, [records, allowedSedeIds, query, statusFilter])

  const stats = useMemo(() => buildMicroStats(visibleRecords), [visibleRecords])

  const updateParameter = parametroId => {
    const parameter = MICROBIOLOGIA_PARAMETROS.find(item => item.id === parametroId)
    setForm(current => ({ ...current, parametroId, unidad:parameter?.unidad || '' }))
  }

  const submit = async event => {
    event.preventDefault()
    try {
      setStorageError('')
      const sede = sedes.find(item => String(item.id) === String(form.sedeId))
      const nextRecord = normalizeMicroRecord({ ...form, sedeNombre:sede?.nombre || 'Sin sede' })
      const [saved] = await createMicroRecords([nextRecord])
      setRecords(current => [saved, ...current])
      setForm(current => ({ ...EMPTY_FORM, sedeId:current.sedeId, fecha:new Date().toISOString().slice(0, 10) }))
      setShowForm(false)
    } catch (error) {
      console.error('[microbiologia] no se pudo guardar el resultado', error)
      setStorageError('No se pudo guardar el resultado en la base de datos.')
    }
  }

  const handlePdf = async file => {
    if (!file) return
    setScanning(true)
    setScanError('')
    try {
      const { extractMicrobiologyPdf } = await import('../lib/microbiologiaPdf')
      const extracted = await extractMicrobiologyPdf(file)
      setScanResult(extracted)
      const first = extracted.resultados[0]
      setForm(current => ({
        ...current,
        protocolo:extracted.protocolo || current.protocolo,
        fecha:extracted.fecha || current.fecha,
        muestra:extracted.muestra || current.muestra,
        parametroId:first?.parametroId || current.parametroId,
        valor:first?.valor || current.valor,
        unidad:first?.unidad || current.unidad,
        archivoNombre:file.name,
      }))
      if (!extracted.resultados.length) setScanError('El PDF se leyó, pero no se identificaron ensayos compatibles. Podés completar el resultado manualmente.')
    } catch (error) {
      console.error('[microbiologia] no se pudo leer el PDF', error)
      setScanResult(null)
      setScanError('No se pudo leer el PDF. Verificá que no esté dañado o protegido con contraseña.')
    } finally {
      setScanning(false)
    }
  }

  const importExtractedResults = async () => {
    if (!scanResult?.resultados?.length) return
    if (!form.sedeId) return setScanError('Seleccioná una sede antes de importar los resultados.')
    const sede = sedes.find(item => String(item.id) === String(form.sedeId))
    const imported = scanResult.resultados.map(result => normalizeMicroRecord({
      ...form,
      ...result,
      protocolo:scanResult.protocolo || form.protocolo,
      fecha:scanResult.fecha || form.fecha,
      muestra:scanResult.muestra || form.muestra,
      sedeNombre:sede?.nombre || 'Sin sede',
    }))
    try {
      setStorageError('')
      const saved = await createMicroRecords(imported)
      setRecords(current => [...saved, ...current])
      setScanResult(null)
      setForm(current => ({ ...EMPTY_FORM, sedeId:current.sedeId, fecha:new Date().toISOString().slice(0, 10) }))
      setShowForm(false)
    } catch (error) {
      console.error('[microbiologia] no se pudieron importar resultados', error)
      setStorageError('No se pudieron importar los resultados del PDF en la base de datos.')
    }
  }

  const remove = async id => {
    if (!window.confirm('¿Eliminar este resultado microbiológico?')) return
    try {
      setStorageError('')
      await deleteMicroRecord(id)
      setRecords(current => current.filter(record => record.id !== id))
    } catch (error) {
      console.error('[microbiologia] no se pudo eliminar el resultado', error)
      setStorageError('No se pudo eliminar el resultado de la base de datos.')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 fade-in">
      <PageHeader title="Control microbiológico" subtitle="Protocolos, muestras, tendencias y desvíos por sede · datos sincronizados">
        {canWrite ? <button type="button" onClick={() => setShowForm(value => !value)} className="btn-primary flex items-center gap-1.5" style={{ padding:'0.4rem 0.75rem' }}><Plus size={13} /> Nuevo resultado</button> : null}
      </PageHeader>

      {storageError ? <div className="glass rounded p-3 flex items-start gap-3" style={{ borderRadius:3, borderColor:'rgba(239,68,68,0.35)', background:'rgba(239,68,68,0.06)' }}><AlertTriangle size={17} style={{ color:'var(--alert)', flexShrink:0, marginTop:1 }} /><p style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>{storageError}</p></div> : null}
      {loading ? <p style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>Cargando resultados microbiológicos…</p> : null}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard label="Resultados" value={stats.total} detail="En el filtro actual" icon={FlaskConical} />
        <MetricCard label="Cumplimiento" value={`${stats.cumplimiento}%`} detail={`${stats.cumple} resultados conformes`} icon={CheckCircle2} />
        <MetricCard label="Observados" value={stats.observado} detail="Cercanos al límite o sin criterio" icon={Dna} color="var(--warn)" />
        <MetricCard label="No conformes" value={stats.noCumple} detail="Requieren evaluación y posible NC/CAPA" icon={AlertTriangle} color="var(--alert)" />
      </div>

      {showForm ? (
        <form onSubmit={submit} className="glass rounded p-4 space-y-4" style={{ borderRadius:3, borderColor:'rgba(57,255,20,0.2)' }}>
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-title font-bold" style={{ color:'var(--text)' }}>Registrar protocolo</h2><p style={{ color:'var(--text-dim)', fontSize:'0.68rem', marginTop:3 }}>Cargá un PDF para extraer sus ensayos o completá un resultado manualmente.</p></div><FileText size={20} style={{ color:'var(--phosphor)' }} /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <Field label="SEDE"><select required value={form.sedeId} onChange={e => setForm({ ...form, sedeId:e.target.value })} className="input w-full">{sedes.length ? sedes.map(sede => <option key={sede.id} value={sede.id}>{sede.nombre}</option>) : <option value="">Sin sedes disponibles</option>}</select></Field>
            <Field label="FECHA"><input required type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha:e.target.value })} className="input w-full" /></Field>
            <Field label="N.º DE PROTOCOLO"><input required value={form.protocolo} onChange={e => setForm({ ...form, protocolo:e.target.value })} className="input w-full" placeholder="Ej. 40948A" /></Field>
            <Field label="LABORATORIO"><input value={form.laboratorio} onChange={e => setForm({ ...form, laboratorio:e.target.value })} className="input w-full" placeholder="Laboratorio emisor" /></Field>
            <Field label="MUESTRA / MATRIZ"><input required value={form.muestra} onChange={e => setForm({ ...form, muestra:e.target.value })} className="input w-full" placeholder="Ensalada, superficie, manipulador…" /></Field>
            <Field label="PARÁMETRO"><select value={form.parametroId} onChange={e => updateParameter(e.target.value)} className="input w-full">{MICROBIOLOGIA_PARAMETROS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="RESULTADO"><input required value={form.valor} onChange={e => setForm({ ...form, valor:e.target.value })} className="input w-full" placeholder="Ausencia, &lt;10, 250…" /></Field>
            <Field label="UNIDAD"><input value={form.unidad} onChange={e => setForm({ ...form, unidad:e.target.value })} className="input w-full" /></Field>
          </div>
          <Field label="PDF ORIGINAL"><label className="btn-ghost inline-flex items-center gap-2 cursor-pointer" style={{ padding:'0.45rem 0.75rem' }}><Upload size={13} />{scanning ? 'Leyendo protocolo…' : form.archivoNombre || 'Seleccionar y analizar PDF'}<input type="file" accept="application/pdf" disabled={scanning} className="sr-only" onChange={e => handlePdf(e.target.files?.[0])} /></label></Field>
          {scanError ? <p role="alert" style={{ color:'var(--warn)', fontSize:'.7rem' }}>{scanError}</p> : null}
          {scanResult?.resultados?.length ? <div className="rounded p-3" style={{ background:'rgba(96,165,250,.05)', border:'1px solid rgba(96,165,250,.2)' }}>
            <div className="flex items-center justify-between gap-2 mb-2"><div><p className="font-metric" style={{ color:'#60A5FA', fontSize:'.65rem' }}>EXTRACCIÓN PDF · {scanResult.resultados.length} ENSAYOS</p><p style={{ color:'var(--text-dim)', fontSize:'.65rem', marginTop:3 }}>Revisá los valores antes de importarlos.</p></div><button type="button" className="btn-primary" onClick={importExtractedResults}>Importar todos</button></div>
            <div className="space-y-1">{scanResult.resultados.map(result => { const parameter=MICROBIOLOGIA_PARAMETROS.find(item=>item.id===result.parametroId); return <div key={result.parametroId} className="flex justify-between gap-3" style={{ color:'var(--text)', fontSize:'.7rem' }}><span>{parameter?.label || result.parametroId}</span><strong className="font-metric" style={{ color:'var(--phosphor)' }}>{result.valor} {result.unidad}</strong></div> })}</div>
          </div> : null}
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button><button type="submit" className="btn-primary">Guardar un resultado</button></div>
        </form>
      ) : null}

      <div className="glass rounded overflow-hidden" style={{ borderRadius:3 }}>
        <div className="p-3 flex flex-wrap items-center gap-2" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <label className="flex-1 min-w-56 flex items-center gap-2 input"><Search size={13} style={{ color:'var(--text-dim)' }} /><input value={query} onChange={e => setQuery(e.target.value)} aria-label="Buscar resultados microbiológicos" placeholder="Buscar protocolo, muestra, parámetro o sede" style={{ width:'100%', background:'transparent', border:0, outline:0, color:'var(--text)' }} /></label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input"><option value="todos">Todos los estados</option><option value="cumple">Cumple</option><option value="observado">Observado</option><option value="no_cumple">No cumple</option></select>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table className="w-full" style={{ minWidth:900 }}>
            <thead><tr>{['Fecha / protocolo','Sede','Muestra','Parámetro','Resultado','Estado','PDF',''].map(label => <th key={label} className="text-left p-3 font-metric" style={{ color:'var(--text-dim)', fontSize:'0.6rem' }}>{label.toUpperCase()}</th>)}</tr></thead>
            <tbody>{visibleRecords.map(record => { const status = STATUS[record.estado] || STATUS.observado; return <tr key={record.id} style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <td className="p-3"><strong className="block" style={{ color:'var(--text)', fontSize:'0.75rem' }}>{record.protocolo}</strong><span style={{ color:'var(--text-dim)', fontSize:'0.65rem' }}>{record.fecha}</span></td>
              <td className="p-3" style={{ color:'var(--text)', fontSize:'0.72rem' }}>{record.sedeNombre}</td><td className="p-3" style={{ color:'var(--text)', fontSize:'0.72rem' }}>{record.muestra}</td><td className="p-3" style={{ color:'var(--text)', fontSize:'0.72rem' }}>{record.parametro}</td>
              <td className="p-3 font-metric" style={{ color:status.color, fontSize:'0.72rem' }}>{record.valor} {record.unidad}</td><td className="p-3"><span className={`chip ${status.className}`}>{status.label}</span></td>
              <td className="p-3" style={{ color:'var(--text-dim)', fontSize:'0.65rem' }}>{record.archivoNombre || '—'}</td><td className="p-3">{canWrite ? <button type="button" aria-label={`Eliminar protocolo ${record.protocolo}`} onClick={() => remove(record.id)} className="btn-ghost" style={{ padding:5, color:'var(--alert)' }}><Trash2 size={13} /></button> : null}</td>
            </tr> })}</tbody>
          </table>
          {!visibleRecords.length ? <div className="text-center py-12"><FlaskConical size={30} style={{ color:'var(--text-dim)', margin:'0 auto 10px' }} /><p style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>Todavía no hay resultados microbiológicos para mostrar.</p></div> : null}
        </div>
      </div>

      {stats.noCumple ? <div className="glass rounded p-4 flex flex-wrap items-center justify-between gap-3" style={{ borderRadius:3, borderColor:'rgba(255,42,42,0.3)' }}><div><h3 className="font-title font-bold" style={{ color:'var(--alert)' }}>Hay {stats.noCumple} resultado(s) no conforme(s)</h3><p style={{ color:'var(--text-dim)', fontSize:'0.72rem', marginTop:3 }}>Revisá el protocolo y documentá el tratamiento en No conformidades o CAPA.</p></div><div className="flex gap-2"><button type="button" onClick={() => onOpenTab?.('nc')} className="btn-ghost">Abrir NC</button><button type="button" onClick={() => onOpenTab?.('capa')} className="btn-primary">Abrir CAPA</button></div></div> : null}
    </div>
  )
}
