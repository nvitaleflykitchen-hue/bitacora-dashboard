import { createPortal } from 'react-dom'
import React from 'react'
import { destinoCorreo, personasCorreo } from '../lib/correoDestinos'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CORREO_PAGE_SIZE, correoError, downloadCorreoFile, getCorreoContext, getCorreoDetail, getCorreos, reviewCorreo } from '../lib/correos'

const states = { pendiente: 'Por revisar', vinculado: 'Vinculados', ignorado: 'Archivados', todos: 'Todos' }
const title = plan => plan?.titulo || plan?.objetivo || plan?.auditoria_codigo || 'Gestión'
const dateText = value => value ? new Date(value).toLocaleString('es-AR') : 'Sin fecha en el original'
const destinationTabs = [
  ['tickets', 'Mantenimiento'], ['compras', 'Compras'], ['tareas', 'Tareas'],
  ['planes', 'Planes de acción'], ['proyectos', 'Proyectos'], ['grupos', 'Grupos'], ['sedes', 'Sedes'],
  ['vehiculos', 'Vehículos'], ['id', 'I+D'], ['personas', 'Personas'],
]
const destinationHelp = {
  planes: 'Hallazgos, inspecciones, auditorías, incumplimientos y sus acciones correctivas.',
  proyectos: 'Iniciativas con un objetivo, alcance, responsables y entregables.',
  grupos: 'Información transversal que corresponde a todas las sedes de un grupo.',
  sedes: 'Documentación o información general que pertenece a una unidad.',
  vehiculos: 'Documentación, novedades o gestiones de una unidad de flota.',
  id: 'Desarrollos de producto, pruebas e iniciativas de innovación.',
}
const categoryFor = (value, destinations = {}) => value?.startsWith('ticket:') ? 'tickets'
  : value?.startsWith('compra:') ? 'compras'
    : value?.startsWith('tarea:') ? 'tareas'
      : value?.startsWith('persona:') ? 'personas'
        : value?.startsWith('grupo:') ? 'grupos'
          : value?.startsWith('sede:') ? 'sedes'
          : value?.startsWith('vehiculo:') ? 'vehiculos'
            : value?.startsWith('idproyecto:') ? 'id'
              : Object.entries(destinations).find(([, items]) => items.some(item => String(item.id) === String(value)))?.[0] || 'planes'
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function DestinationPicker({ destinations, selected, selectedPeople = [], onSelect, onTogglePerson, disabled }) {
  const [category, setCategory] = useState(() => selectedPeople.length ? 'personas' : categoryFor(selected, destinations))
  const [search, setSearch] = useState('')
  useEffect(() => { if (selected) setCategory(categoryFor(selected, destinations)) }, [selected, destinations])
  const options = destinations?.[category] || []
  const needle = normalize(search)
  const visible = needle ? options.filter(item => normalize(`${item.search || ''} ${title(item)} ${item.meta || ''}`).includes(needle)) : options
  const selectedItem = Object.values(destinations || {}).flat().find(item => item.kind !== 'persona' && String(item.id) === String(selected))
  const people = (destinations?.personas || []).filter(item => selectedPeople.includes(String(item.id)))
  return <div className="space-y-3" aria-label="Asociar correo">
    <div>
      <strong className="block mb-2">¿Dónde querés asociar este correo?</strong>
      <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Tipos de destino">
        {destinationTabs.map(([key, label]) => <button type="button" role="tab" aria-selected={category === key} key={key}
          className={category === key ? 'btn-primary' : 'btn-ghost'} disabled={disabled}
          onClick={() => { setCategory(key); setSearch('') }}>{label} <span aria-label={`${destinations?.[key]?.length || 0} disponibles`}>({destinations?.[key]?.length || 0})</span></button>)}
      </div>
    </div>
    {selectedItem && <div className="glass p-3" style={{ borderColor: 'var(--primary)' }}><span className="text-xs block" style={{ color: 'var(--text-dim)' }}>VÍNCULO SELECCIONADO</span><strong>{title(selectedItem)}</strong>{selectedItem.meta && <span className="block text-sm">{selectedItem.meta}</span>}</div>}
    {!!people.length && <div className="glass p-3" style={{ borderColor: 'var(--primary)' }}>
      <span className="text-xs block mb-2" style={{ color: 'var(--text-dim)' }}>PERSONAS ASOCIADAS ({people.length})</span>
      <div className="flex gap-2 flex-wrap">{people.map(person => <button type="button" className="btn-ghost" key={person.id} disabled={disabled} onClick={() => onTogglePerson(String(person.id))} aria-label={`Quitar a ${title(person)}`}>{title(person)} ×</button>)}</div>
    </div>}
    <label className="block">Buscar en {destinationTabs.find(([key]) => key === category)?.[1]}
      <input className="input-dark w-full mt-1" type="search" value={search} onChange={e => setSearch(e.target.value)} disabled={disabled}
        placeholder={category === 'personas' ? 'Nombre, apellido o puesto…' : 'Asunto, número, sede, responsable o estado…'} />
    </label>
    {destinationHelp[category] && <p className="text-sm" style={{ color: 'var(--text-dim)' }}>{destinationHelp[category]}</p>}
    <div role="listbox" aria-label={`Resultados de ${category}`} style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #ffffff20', borderRadius: 6 }}>
      {!visible.length && <p className="p-4" style={{ color: 'var(--text-dim)' }}>{search ? 'No hay coincidencias.' : 'No hay elementos abiertos en esta categoría.'}</p>}
      {visible.map(item => { const isPerson = category === 'personas'; const isSelected = isPerson ? selectedPeople.includes(String(item.id)) : String(selected) === String(item.id); const style = { display: 'block', borderBottom: '1px solid #ffffff18', background: isSelected ? 'rgba(52,255,28,.12)' : 'transparent', color: 'inherit' }; return isPerson
        ? <label key={item.id} className="w-full p-3 flex items-start gap-3 cursor-pointer" style={style}>
          <input type="checkbox" checked={isSelected} disabled={disabled} onChange={() => onTogglePerson(String(item.id))} aria-label={`Asociar a ${title(item)}`} />
          <span><strong style={{ overflowWrap: 'anywhere' }}>{title(item)}</strong>{item.meta && <span className="block text-sm mt-1" style={{ color: 'var(--text-dim)' }}>{item.meta}</span>}</span>
        </label>
        : <button type="button" role="option" aria-selected={isSelected} key={item.id} disabled={disabled}
          onClick={() => onSelect(String(item.id))} className="w-full text-left p-3" style={style}>
          <strong style={{ overflowWrap: 'anywhere' }}>{title(item)}</strong>
          {item.meta && <span className="block text-sm mt-1" style={{ color: 'var(--text-dim)' }}>{item.meta}</span>}
          {isSelected && <span className="block text-sm mt-1" style={{ color: 'var(--primary)' }}>Seleccionado</span>}
        </button>})}
    </div>
  </div>
}

export function CorreoDetail({ id, plans = [], destinations, canReview, onClose, onSaved }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = overflow
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])
  const [detail, setDetail] = useState(null)
  const [selected, setSelected] = useState('')
  const [selectedPeople, setSelectedPeople] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const destinationGroups = destinations || {
    planes: plans.filter(p => !String(p.id).includes(':')), proyectos: [],
    tareas: plans.filter(p => String(p.id).startsWith('tarea:')), compras: plans.filter(p => String(p.id).startsWith('compra:')),
    tickets: plans.filter(p => String(p.id).startsWith('ticket:')), personas: plans.filter(p => String(p.id).startsWith('persona:')),
    grupos: plans.filter(p => String(p.id).startsWith('grupo:')), sedes: plans.filter(p => String(p.id).startsWith('sede:')), vehiculos: plans.filter(p => String(p.id).startsWith('vehiculo:')),
    id: plans.filter(p => String(p.id).startsWith('idproyecto:')),
  }
  const allDestinations = Object.values(destinationGroups).flat()
  useEffect(() => {
    let active = true
    setDetail(null)
    setError('')
    getCorreoDetail(id).then(data => {
      if (!active) return
      setDetail(data)
      const current = destinoCorreo(data.message)
      const suggested = destinoCorreo(data.message, true)
      setSelected(current?.startsWith('persona:') ? '' : (current || (suggested?.startsWith('persona:') ? '' : suggested) || ''))
      setSelectedPeople(personasCorreo(data.message).length ? personasCorreo(data.message) : personasCorreo(data.message, true))
    }).catch(err => active && setError(correoError(err)))
    return () => { active = false }
  }, [id])
  async function save(state) {
    setBusy(true); setError('')
    try {
      await reviewCorreo(detail.message, state === 'vinculado' ? selected : null, state, state === 'vinculado' ? selectedPeople : [])
      onSaved()
    } catch (err) { setError(correoError(err)) }
    finally { setBusy(false) }
  }
  function togglePerson(key) {
    setSelectedPeople(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])
  }
  async function download(path, name) {
    setBusy(true); setError('')
    try { await downloadCorreoFile(path, name) }
    catch (err) { setError(correoError(err)) }
    finally { setBusy(false) }
  }
  function handleDialogKey(event) {
    if (event.key === 'Escape') { event.stopPropagation(); if (!busy) onClose(); return }
    if (event.key !== 'Tab') return
    const items = [...dialogRef.current.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled),summary,[tabindex="0"]')]
    const first = items[0], last = items[items.length - 1]
    if (!first) { event.preventDefault(); return }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus() }
  }
  const message = detail?.message
  return createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,.65)', display: 'flex', justifyContent: 'flex-end' }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Detalle del correo" tabIndex={-1} onKeyDown={handleDialogKey} style={{ width: 'min(860px,100%)', height: '100dvh', minWidth: 0, background: 'var(--bg, #111215)', color: 'var(--text)', display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px #0008' }}>
      <header style={{ padding: '12px 20px', borderBottom: '1px solid #ffffff25', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><strong>Revisar correo</strong><button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cerrar detalle</button></header>
      <div className="p-4 space-y-4" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
    {error && <p role="alert" style={{ color: 'var(--alert)' }}>{error}</p>}
    {!message && !error && <p role="status">Cargando correo…</p>}
    {message && <>
      <h2 className="font-bold text-lg" style={{ overflowWrap: 'anywhere' }}>{message.asunto}</h2>
      <p style={{ overflowWrap: 'anywhere' }}>De: {message.remitente}<br />Para: {message.destinatarios.join(', ')}<br />{dateText(message.fecha_correo)}</p>
      <div className="glass p-3 space-y-2">
        <p><strong>{message.tipo}</strong> · {states[message.estado]}</p>
        {message.resumen && <p>{message.resumen}</p>}
        {message.motivo && <p style={{ color: 'var(--text-dim)' }}>Motivo de la sugerencia: {message.motivo}</p>}
        {message.ai_fuente === 'aprendizaje' && <p className="text-sm" style={{ color: 'var(--green)' }}>
          Sugerencia aprendida de tus vínculos anteriores{message.ai_confianza != null ? ` · ${message.ai_confianza}% de confianza` : ''}
        </p>}
        {message.ai_estado === 'pendiente' && <p>Guardado como evidencia. Clasificación pendiente.</p>}
        {message.ai_estado === 'error' && <p>La clasificación se reintentará. El original está guardado.</p>}
        {message.nueva_gestion && <p>Posible gestión nueva: {message.nueva_gestion}</p>}
        {!canReview && !!personasCorreo(message).length && <p>Personas asociadas: {personasCorreo(message).map(key => title(allDestinations.find(item => item.id === key))).join(', ')}</p>}
        {canReview && <div className="space-y-2">
          <DestinationPicker destinations={destinationGroups} selected={selected} selectedPeople={selectedPeople} onSelect={setSelected} onTogglePerson={togglePerson} disabled={busy} />
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="btn-primary" disabled={busy || (!selected && !selectedPeople.length)} onClick={() => save('vinculado')}>Guardar vínculo</button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => save('pendiente')}>Dejar por revisar</button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => save('ignorado')}>Archivar sin gestión</button>
          </div>
        </div>}
      </div>
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => download(message.original_path, `${message.asunto}.eml`)}>Descargar correo original</button>
        {message.adjuntos.map(file => <button type="button" className="btn-ghost" key={file.path} disabled={busy} onClick={() => download(file.path, file.nombre)}>{file.nombre} · {Math.ceil(file.bytes / 1024)} KB</button>)}
      </div>
      <details><summary className="cursor-pointer">Leer mensaje</summary><pre className="mt-3 text-sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'inherit' }}>{message.cuerpo || 'El mensaje no contiene texto legible. Descargá el original.'}</pre></details>
      <details><summary className="cursor-pointer">Historial de asociaciones</summary>
        <ul className="mt-2 space-y-2">{detail.history.map(event => { const eventPeople = personasCorreo(event.despues).map(key => title(allDestinations.find(p => p.id === key))); return <li key={event.id}>{dateText(event.created_at)} · {states[event.despues.estado]}{destinoCorreo(event.despues) && !destinoCorreo(event.despues).startsWith('persona:') ? ` · ${title(allDestinations.find(p => p.id === destinoCorreo(event.despues)))}` : ''}{eventPeople.length ? ` · Personas: ${eventPeople.join(', ')}` : ''} · {event.actor_id ? 'Revisión de usuario' : 'Agente automático'}</li>})}</ul>
      </details>
    </>}
      </div>
    </section>
  </div>, document.body)
}

export default function Correos({ planId = null, readOnly = false }) {
  const [context, setContext] = useState(null)
  const [mailboxId, setMailboxId] = useState('')
  const [state, setState] = useState(planId ? 'vinculado' : 'pendiente')
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
    getCorreos({ mailboxId, state, planId, analysis, page }).then(data => {
      if (request.current === sequence) setResult(data)
    }).catch(err => { if (request.current === sequence) setError(correoError(err)) })
      .finally(() => { if (request.current === sequence) setLoading(false) })
    return () => { request.current += 1 }
  }, [mailboxId, state, planId, page, analysis, revision])
  const reviewer = !readOnly && context?.memberships.some(m => m.buzon_id === mailboxId && m.puede_revisar)
  function filter(setter, value) { setter(value); setPage(0); setOpened(null) }
  return <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4" style={{ color: 'var(--text)' }}>
    <header className="flex items-center justify-between gap-3 flex-wrap">
      <div><h1 className="font-title text-xl font-bold">{planId ? 'Correos y evidencias' : 'Correos'}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>Ollama resume y clasifica cada correo. Abrilo para vincularlo a una gestión, proyecto, sede, vehículo, iniciativa de I+D o persona.</p></div>
      <button type="button" className="btn-ghost" onClick={refresh} disabled={loading}>Actualizar</button>
    </header>
    {error && <p role="alert" className="glass p-4">{error}</p>}
    {context && !context.mailboxes.length && <p className="glass p-4">No tenés buzones habilitados. El acceso a los correos se asigna de forma individual.</p>}
    {!!context?.mailboxes.length && <>
      <div className="flex gap-3 flex-wrap">
        <label>Análisis<select className="input-dark block" value={analysis} onChange={e => filter(setAnalysis, e.target.value)}><option value="todos">Todos</option><option value="lista">Analizados por Ollama</option><option value="sugerencia">Con gestión sugerida</option><option value="pendiente">Pendientes de análisis</option></select></label>
        <label>Buzón<select className="input-dark block" value={mailboxId} onChange={e => filter(setMailboxId, e.target.value)}>{context.mailboxes.map(box => <option key={box.id} value={box.id}>{box.nombre}</option>)}</select></label>
        {!planId && <label>Estado<select className="input-dark block" value={state} onChange={e => filter(setState, e.target.value)}>{Object.entries(states).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
      </div>
      {opened && <CorreoDetail key={opened} id={opened} plans={context.plans} destinations={context.destinations} canReview={reviewer} onClose={() => setOpened(null)} onSaved={refresh} />}
      {loading ? <p role="status">Cargando correos…</p> : <>
        {!result.items.length && !error && <p className="glass p-6">No hay correos en esta selección. Los mensajes aparecerán cuando el agente complete la importación.</p>}
        <div className="grid gap-3">{result.items.map(message => <button type="button" key={message.id} className="glass rounded p-4 text-left" onClick={() => setOpened(message.id)} aria-pressed={opened === message.id}>
          <span className="block font-bold" style={{ overflowWrap: 'anywhere' }}>{message.asunto}</span>
          <span className="block text-sm" style={{ color: 'var(--text-dim)', overflowWrap: 'anywhere' }}>{message.remitente} · {dateText(message.fecha_correo)}</span>
          <span className="block text-sm mt-2">{message.resumen || (message.ai_estado === 'error' ? 'Clasificación pendiente de reintento' : 'Clasificación pendiente')}</span>
          {message.ai_estado === 'lista' && <span className="block text-sm mt-2">Analizado por Ollama · {message.tipo}{!destinoCorreo(message) && !destinoCorreo(message, true) ? ' · Sin gestión coincidente' : ''}</span>}
          {message.nueva_gestion && <span className="block text-sm mt-2">Propuesta para revisar: {message.nueva_gestion}</span>}
          <span className="block text-sm mt-2" style={{ color: 'var(--primary)' }}>Abrir análisis, vínculo y adjuntos</span>
          {(destinoCorreo(message) || destinoCorreo(message, true)) && <span className="block text-sm mt-2">{destinoCorreo(message) ? 'Vinculado a: ' : 'Sugerencia: '}{title(context.plans.find(p => p.id === (destinoCorreo(message) || destinoCorreo(message, true))))}</span>}
          {!!personasCorreo(message).length && <span className="block text-sm mt-1">Personas: {personasCorreo(message).map(key => title(context.plans.find(item => item.id === key))).join(', ')}</span>}
          {!destinoCorreo(message) && destinoCorreo(message, true) && message.ai_fuente === 'aprendizaje' && <span className="block text-xs mt-1" style={{ color: 'var(--green)' }}>Aprendido de tus decisiones anteriores{message.ai_confianza != null ? ` · ${message.ai_confianza}%` : ''}</span>}
        </button>)}</div>
        {result.total > CORREO_PAGE_SIZE && <nav aria-label="Páginas de correos" className="flex gap-3 items-center"><button type="button" className="btn-ghost" disabled={page === 0} onClick={() => { setPage(page - 1); setOpened(null) }}>Anterior</button><span>{page + 1} / {Math.ceil(result.total / CORREO_PAGE_SIZE)}</span><button type="button" className="btn-ghost" disabled={(page + 1) * CORREO_PAGE_SIZE >= result.total} onClick={() => { setPage(page + 1); setOpened(null) }}>Siguiente</button></nav>}
      </>}
    </>}
  </div>
}
