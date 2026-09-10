import { useCallback, useEffect, useRef, useState } from 'react'
import { CORREO_PAGE_SIZE, correoError, downloadCorreoFile, getCorreoContext, getCorreoDetail, getCorreos, reviewCorreo } from '../lib/correos'

const states = { pendiente: 'Por revisar', vinculado: 'Vinculados', ignorado: 'Archivados', todos: 'Todos' }
const title = plan => plan?.titulo || plan?.objetivo || plan?.auditoria_codigo || 'Gestión'
const dateText = value => value ? new Date(value).toLocaleString('es-AR') : 'Sin fecha en el original'

export function CorreoDetail({ id, plans, canReview, onClose, onSaved }) {
  const [detail, setDetail] = useState(null)
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setDetail(null)
    setError('')
    getCorreoDetail(id).then(data => {
      if (!active) return
      setDetail(data)
      setSelected(data.message.plan_id || data.message.sugerido_plan_id || '')
    }).catch(err => active && setError(correoError(err)))
    return () => { active = false }
  }, [id])
  async function save(state) {
    setBusy(true); setError('')
    try {
      await reviewCorreo(detail.message, state === 'vinculado' ? selected : null, state)
      onSaved()
    } catch (err) { setError(correoError(err)) }
    finally { setBusy(false) }
  }
  async function download(path, name) {
    setBusy(true); setError('')
    try { await downloadCorreoFile(path, name) }
    catch (err) { setError(correoError(err)) }
    finally { setBusy(false) }
  }
  const message = detail?.message
  return <section aria-label="Detalle del correo" className="glass rounded p-4 space-y-4" style={{ minWidth: 0 }}>
    <button className="btn-ghost" onClick={onClose} disabled={busy}>Cerrar detalle</button>
    {error && <p role="alert" style={{ color: 'var(--alert)' }}>{error}</p>}
    {!message && !error && <p role="status">Cargando correo…</p>}
    {message && <>
      <h2 className="font-bold text-lg" style={{ overflowWrap: 'anywhere' }}>{message.asunto}</h2>
      <p style={{ overflowWrap: 'anywhere' }}>De: {message.remitente}<br />Para: {message.destinatarios.join(', ')}<br />{dateText(message.fecha_correo)}</p>
      <div className="glass p-3 space-y-2">
        <p><strong>{message.tipo}</strong> · {states[message.estado]}</p>
        {message.resumen && <p>{message.resumen}</p>}
        {message.motivo && <p style={{ color: 'var(--text-dim)' }}>Motivo de la sugerencia: {message.motivo}</p>}
        {message.ai_estado === 'pendiente' && <p>Guardado como evidencia. Clasificación pendiente.</p>}
        {message.ai_estado === 'error' && <p>La clasificación se reintentará. El original está guardado.</p>}
        {message.nueva_gestion && <p>Posible gestión nueva: {message.nueva_gestion}</p>}
        {canReview && <div className="space-y-2">
          <label className="block">Gestión
            <select className="input-dark w-full mt-1" value={selected} onChange={e => setSelected(e.target.value)} disabled={busy}>
              <option value="">Elegir gestión</option>
              {plans.map(plan => <option key={plan.id} value={plan.id}>{title(plan)}</option>)}
            </select>
          </label>
          <div className="flex gap-2 flex-wrap">
            <button className="btn-primary" disabled={busy || !selected} onClick={() => save('vinculado')}>Guardar vínculo</button>
            <button className="btn-ghost" disabled={busy} onClick={() => save('pendiente')}>Dejar por revisar</button>
            <button className="btn-ghost" disabled={busy} onClick={() => save('ignorado')}>Archivar sin gestión</button>
          </div>
        </div>}
      </div>
      <div className="flex gap-2 flex-wrap">
        <button className="btn-ghost" disabled={busy} onClick={() => download(message.original_path, `${message.asunto}.eml`)}>Descargar correo original</button>
        {message.adjuntos.map(file => <button className="btn-ghost" key={file.path} disabled={busy} onClick={() => download(file.path, file.nombre)}>{file.nombre} · {Math.ceil(file.bytes / 1024)} KB</button>)}
      </div>
      <details><summary className="cursor-pointer">Leer mensaje</summary><pre className="mt-3 text-sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'inherit' }}>{message.cuerpo || 'El mensaje no contiene texto legible. Descargá el original.'}</pre></details>
      <details><summary className="cursor-pointer">Historial de asociaciones</summary>
        <ul className="mt-2 space-y-2">{detail.history.map(event => <li key={event.id}>{dateText(event.created_at)} · {states[event.despues.estado]}{event.despues.plan_id ? ` · ${title(plans.find(p => p.id === event.despues.plan_id))}` : ''} · {event.actor_id ? 'Revisión de usuario' : 'Importación'}</li>)}</ul>
      </details>
    </>}
  </section>
}

export default function Correos({ planId = null }) {
  const [context, setContext] = useState(null)
  const [mailboxId, setMailboxId] = useState('')
  const [state, setState] = useState(planId ? 'vinculado' : 'pendiente')
  const [planFilter, setPlanFilter] = useState(planId || '')
  const [page, setPage] = useState(0)
  const [analysis, setAnalysis] = useState('todos')
  const [result, setResult] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [opened, setOpened] = useState(null)
  const [revision, setRevision] = useState(0)
  const request = useRef(0)
  const refresh = useCallback(() => { setOpened(null); setRevision(v => v + 1) }, [])
  useEffect(() => {
    let active = true
    getCorreoContext().then(data => {
      if (!active) return
      setContext(data)
      setMailboxId(current => current || data.mailboxes[0]?.id || '')
      if (!data.mailboxes.length) setLoading(false)
    }).catch(err => { if (active) { setError(correoError(err)); setLoading(false) } })
    return () => { active = false }
  }, [revision])
  useEffect(() => {
    const sequence = ++request.current
    if (!mailboxId) return
    setLoading(true); setError(''); setResult({ items: [], total: 0 })
    getCorreos({ mailboxId, state, planId: planId || planFilter, analysis, page }).then(data => {
      if (request.current === sequence) setResult(data)
    }).catch(err => { if (request.current === sequence) setError(correoError(err)) })
      .finally(() => { if (request.current === sequence) setLoading(false) })
    return () => { request.current += 1 }
  }, [mailboxId, state, planFilter, planId, page, analysis, revision])
  const reviewer = context?.memberships.some(m => m.buzon_id === mailboxId && m.puede_revisar)
  function filter(setter, value) { setter(value); setPage(0); setOpened(null) }
  return <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4" style={{ color: 'var(--text)' }}>
    <header className="flex items-center justify-between gap-3 flex-wrap">
      <div><h1 className="font-title text-xl font-bold">{planId ? 'Correos y evidencias' : 'Correos'}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>Ollama resume y clasifica cada correo. Abrilo para revisar la propuesta, vincularlo a un proyecto y consultar sus adjuntos.</p></div>
      <button className="btn-ghost" onClick={refresh} disabled={loading}>Actualizar</button>
    </header>
    {error && <p role="alert" className="glass p-4">{error}</p>}
    {context && !context.mailboxes.length && <p className="glass p-4">No tenés buzones habilitados. El acceso a los correos se asigna de forma individual.</p>}
    {!!context?.mailboxes.length && <>
      <div className="flex gap-3 flex-wrap">
        <label>Análisis<select className="input-dark block" value={analysis} onChange={e => filter(setAnalysis, e.target.value)}><option value="todos">Todos</option><option value="lista">Analizados por Ollama</option><option value="sugerencia">Con proyecto sugerido</option><option value="pendiente">Pendientes de análisis</option></select></label>
        <label>Buzón<select className="input-dark block" value={mailboxId} onChange={e => filter(setMailboxId, e.target.value)}>{context.mailboxes.map(box => <option key={box.id} value={box.id}>{box.nombre}</option>)}</select></label>
        {!planId && <><label>Estado<select className="input-dark block" value={state} onChange={e => filter(setState, e.target.value)}>{Object.entries(states).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label>Gestión vinculada<select className="input-dark block" value={planFilter} onChange={e => { filter(setPlanFilter, e.target.value); if (e.target.value) setState('vinculado') }}><option value="">Todas las gestiones</option>{context.plans.map(plan => <option key={plan.id} value={plan.id}>{title(plan)}</option>)}</select></label></>}
      </div>
      {opened && <CorreoDetail key={opened} id={opened} plans={context.plans} canReview={reviewer} onClose={() => setOpened(null)} onSaved={refresh} />}
      {loading ? <p role="status">Cargando correos…</p> : <>
        {!result.items.length && !error && <p className="glass p-6">No hay correos en esta selección. Los mensajes aparecerán cuando el agente complete la importación.</p>}
        <div className="grid gap-3">{result.items.map(message => <button key={message.id} className="glass rounded p-4 text-left" onClick={() => setOpened(message.id)} aria-pressed={opened === message.id}>
          <span className="block font-bold" style={{ overflowWrap: 'anywhere' }}>{message.asunto}</span>
          <span className="block text-sm" style={{ color: 'var(--text-dim)', overflowWrap: 'anywhere' }}>{message.remitente} · {dateText(message.fecha_correo)}</span>
          <span className="block text-sm mt-2">{message.resumen || (message.ai_estado === 'error' ? 'Clasificación pendiente de reintento' : 'Clasificación pendiente')}</span>
          {message.ai_estado === 'lista' && <span className="block text-sm mt-2">Analizado por Ollama · {message.tipo}{!message.plan_id && !message.sugerido_plan_id ? ' · Sin proyecto coincidente' : ''}</span>}
          {message.nueva_gestion && <span className="block text-sm mt-2">Propuesta para revisar: {message.nueva_gestion}</span>}
          <span className="block text-sm mt-2" style={{ color: 'var(--primary)' }}>Abrir análisis, vínculo y adjuntos</span>
          {(message.plan_id || message.sugerido_plan_id) && <span className="block text-sm mt-2">{message.plan_id ? 'Vinculado a: ' : 'Sugerencia: '}{title(context.plans.find(p => p.id === (message.plan_id || message.sugerido_plan_id)))}</span>}
        </button>)}</div>
        {result.total > CORREO_PAGE_SIZE && <nav aria-label="Páginas de correos" className="flex gap-3 items-center"><button className="btn-ghost" disabled={page === 0} onClick={() => { setPage(page - 1); setOpened(null) }}>Anterior</button><span>{page + 1} / {Math.ceil(result.total / CORREO_PAGE_SIZE)}</span><button className="btn-ghost" disabled={(page + 1) * CORREO_PAGE_SIZE >= result.total} onClick={() => { setPage(page + 1); setOpened(null) }}>Siguiente</button></nav>}
      </>}
    </>}
  </div>
}
