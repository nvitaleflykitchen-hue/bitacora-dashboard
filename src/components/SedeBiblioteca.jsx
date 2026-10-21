import React, { useEffect, useRef, useState } from 'react'
import { Upload, ExternalLink, Library } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { getAdjuntos, uploadAdjunto } from '../lib/adjuntos'
import { mensajeError } from '../lib/errores'

const ENTITY = 'sede_biblioteca'
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export default function SedeBiblioteca({ sedeId, sedeNombre }) {
  const { perfil, can, allowedSedeIds } = useAuth()
  const allowed = allowedSedeIds === null || (allowedSedeIds || []).some(id => String(id) === String(sedeId))
  const canUpload = allowed && can('sedes', 'manage')
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const input = useRef(null)
  const generation = useRef(0)

  useEffect(() => {
    const current = ++generation.current
    setRows([]); setError(''); setNotice(''); setQuery(''); setLoading(true)
    if (!allowed || !sedeId) { setLoading(false); return }
    getAdjuntos(ENTITY, sedeId)
      .then(data => { if (generation.current === current) setRows(data) })
      .catch(e => { if (generation.current === current) setError(mensajeError(e)) })
      .finally(() => { if (generation.current === current) setLoading(false) })
    return () => { generation.current = current + 1 }
  }, [sedeId, allowed])

  async function upload(files) {
    if (!canUpload || busy || !files?.length) return
    const selected = Array.from(files)
    if (selected.some(file => file.size > 50 * 1024 * 1024 || !/\.(pdf|docx?|xlsx?|txt|png|jpe?g)$/i.test(file.name))) {
      setError('Seleccioná archivos PDF, Word, Excel, TXT, PNG o JPG de hasta 50 MB cada uno.'); return
    }
    const current = generation.current
    setBusy(true); setError(''); setNotice('')
    let count = 0
    try {
      for (const file of selected) {
        const row = await uploadAdjunto(ENTITY, sedeId, file, perfil?.nombre || 'usuario')
        count++
        if (generation.current === current) setRows(previous => [row, ...previous])
      }
    } catch (e) {
      if (generation.current === current) setError(`Se cargaron ${count} de ${selected.length} archivos. ${mensajeError(e)}`)
    } finally {
      if (generation.current === current) {
        setBusy(false)
        if (count) setNotice(`${count} documento${count === 1 ? '' : 's'} incorporado${count === 1 ? '' : 's'}.`)
        if (input.current) input.current.value = ''
      }
    }
  }

  if (!allowed) return <p>No tenés acceso a la biblioteca de esta sede.</p>
  const visible = rows.filter(row => normalize(`${row.nombre} ${row.uploaded_by || ''}`).includes(normalize(query)))
  return <section className="glass p-4 space-y-4" aria-label="Biblioteca de documentos">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-title font-bold flex items-center gap-2"><Library size={20} /> Biblioteca de documentos</h2>
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Informes internos y documentos de {sedeNombre}.</p></div>
      {canUpload && <button type="button" className="btn-primary flex items-center gap-2" disabled={busy || loading} onClick={() => input.current?.click()}><Upload size={15} />{busy ? 'Subiendo…' : 'Subir documentos'}</button>}
      <input ref={input} type="file" multiple hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg" onChange={e => upload(e.target.files)} />
    </div>
    <p className="text-xs" style={{ color: 'var(--text-dim)' }}>PDF, Word, Excel, TXT e imágenes · Hasta 50 MB por archivo. Usá nombres descriptivos con la fecha del informe.</p>
    <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Los archivos se comparten por enlace: cualquier persona que tenga el enlace puede abrirlos. No cargues documentación confidencial.</p>
    <input type="search" className="input-dark w-full" aria-label="Buscar documentos por nombre o autor de carga" placeholder="Buscar por nombre o quién lo subió…" value={query} onChange={e => setQuery(e.target.value)} />
    {error && <p role="alert" className="text-sm" style={{ color: 'var(--alert)' }}>{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {loading ? <p role="status">Cargando biblioteca…</p> : <>
      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{visible.length} de {rows.length} documentos · Más recientes primero</p>
      {!visible.length && !error && <p className="text-sm">{query ? 'No hay documentos que coincidan con la búsqueda.' : 'Todavía no hay documentos en esta biblioteca.'}</p>}
      <ul className="space-y-2">{visible.map(row => <li key={row.id} className="p-3 flex items-center justify-between gap-3" style={{ border: '1px solid var(--border)', borderRadius: 4 }}>
        <div className="min-w-0"><p className="text-sm break-words">{row.nombre}</p><p className="text-xs" style={{ color: 'var(--text-dim)' }}>
          Cargado {row.created_at ? new Date(row.created_at).toLocaleDateString('es-AR') : 'sin fecha'} · {row.uploaded_by || 'Autor no informado'}
        </p></div>
        <a className="btn-ghost flex items-center gap-1 shrink-0" href={row.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${row.nombre}`}><ExternalLink size={14} /> Abrir</a>
      </li>)}</ul>
    </>}
  </section>
}
