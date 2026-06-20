import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Paperclip, Link2, Upload, X, FileText, Image, File, ExternalLink, Trash2, Plus } from 'lucide-react'
import { useAuth } from '../lib/auth'

const BUCKET = 'bitacora-adjuntos'

async function getAdjuntos(entityType, entityId) {
  const entityKey = String(entityId)
  const { data, error } = await supabase
    .schema('bitacora')
    .from('adjuntos')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityKey)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

async function deleteAdjunto(adjunto) {
  if (adjunto.storage_path) {
    await supabase.storage.from(BUCKET).remove([adjunto.storage_path])
  }
  const { error } = await supabase
    .schema('bitacora')
    .from('adjuntos')
    .delete()
    .eq('id', adjunto.id)
  if (error) throw error
}

function iconForMime(mime) {
  if (!mime) return <File size={16} />
  if (mime.startsWith('image/')) return <Image size={16} style={{ color:'#60A5FA' }} />
  if (mime === 'application/pdf') return <FileText size={16} style={{ color:'#F87171' }} />
  return <FileText size={16} style={{ color:'#A78BFA' }} />
}

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function LinkForm({ onAdd, onCancel }) {
  const [url, setUrl] = useState('')
  const [nombre, setNombre] = useState('')
  const [desc, setDesc] = useState('')

  const handleAdd = () => {
    if (!url.trim()) return
    onAdd({ url: url.trim(), nombre: nombre.trim() || url.trim(), descripcion: desc.trim() })
  }

  return (
    <div className="glass rounded p-3 space-y-2 fade-in" style={{ borderRadius:3, border:'1px solid rgba(96,165,250,0.2)' }}>
      <p className="font-metric text-xs tracking-wider uppercase" style={{ color:'#60A5FA' }}>Agregar link</p>
      <input className="input-dark w-full" value={url} onChange={e => setUrl(e.target.value)}
        placeholder="https://..." autoFocus />
      <input className="input-dark w-full" value={nombre} onChange={e => setNombre(e.target.value)}
        placeholder="Título (opcional)" />
      <input className="input-dark w-full" value={desc} onChange={e => setDesc(e.target.value)}
        placeholder="Descripción (opcional)" />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-ghost" style={{ padding:'0.25rem 0.6rem', fontSize:'0.72rem' }}>Cancelar</button>
        <button onClick={handleAdd} disabled={!url.trim()} className="btn-primary" style={{ padding:'0.25rem 0.6rem', fontSize:'0.72rem' }}>
          Agregar
        </button>
      </div>
    </div>
  )
}

export default function AdjuntosPanel({ entityType, entityId, compact = false }) {
  const { perfil } = useAuth()
  const [adjuntos, setAdjuntos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const fileRef = useRef()

  const load = async () => {
    if (!entityId) return
    try {
      setAdjuntos(await getAdjuntos(entityType, entityId))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [entityType, entityId])

  const handleFiles = async (files) => {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const entityKey = String(entityId)
        const ext = file.name.split('.').pop()
        const path = `${entityType}/${entityKey}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { cacheControl: '3600', upsert: false })
        if (uploadErr) throw uploadErr

        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

        const { error: dbErr } = await supabase.schema('bitacora').from('adjuntos').insert({
          entity_type: entityType,
          entity_id: entityKey,
          nombre: file.name,
          tipo: 'archivo',
          url: publicUrl,
          storage_path: path,
          mime_type: file.type,
          tamaño_bytes: file.size,
          uploaded_by: perfil?.nombre || 'usuario',
        })
        if (dbErr) {
          await supabase.storage.from(BUCKET).remove([path])
          throw dbErr
        }
      }
      await load()
    } catch (e) {
      alert('Error subiendo archivo: ' + e.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleAddLink = async ({ url, nombre, descripcion }) => {
    try {
      const entityKey = String(entityId)
      const { error } = await supabase.schema('bitacora').from('adjuntos').insert({
        entity_type: entityType,
        entity_id: entityKey,
        nombre,
        tipo: 'link',
        url,
        descripcion,
        uploaded_by: perfil?.nombre || 'usuario',
      })
      if (error) throw error
      setShowLinkForm(false)
      await load()
    } catch (e) { alert('Error: ' + e.message) }
  }

  const handleDelete = async (adj) => {
    if (!confirm(`¿Eliminar "${adj.nombre}"?`)) return
    try {
      await deleteAdjunto(adj)
      await load()
    } catch (e) { alert('Error: ' + e.message) }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  const imagenes = adjuntos.filter(a => a.tipo === 'archivo' && a.mime_type?.startsWith('image/'))
  const archivos = adjuntos.filter(a => a.tipo === 'archivo' && !a.mime_type?.startsWith('image/'))
  const links    = adjuntos.filter(a => a.tipo === 'link')

  if (!entityId) return null

  return (
    <div style={{ marginTop: compact ? 0 : 12 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Paperclip size={13} style={{ color:'var(--phosphor)' }} />
          <span className="font-metric" style={{ fontSize:'0.68rem', color:'var(--text-dim)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
            Adjuntos {adjuntos.length > 0 && `(${adjuntos.length})`}
          </span>
        </div>
        <div style={{ display:'flex', gap:5 }}>
          <button
            onClick={() => setShowLinkForm(v => !v)}
            className="btn-ghost"
            style={{ padding:'0.2rem 0.5rem', fontSize:'0.65rem', display:'flex', alignItems:'center', gap:4 }}>
            <Link2 size={11} /> Link
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="btn-ghost"
            style={{ padding:'0.2rem 0.5rem', fontSize:'0.65rem', display:'flex', alignItems:'center', gap:4 }}>
            <Upload size={11} /> {uploading ? 'Subiendo...' : 'Archivo'}
          </button>
          <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            style={{ display:'none' }} onChange={e => handleFiles(e.target.files)} />
        </div>
      </div>

      {/* Link form */}
      {showLinkForm && (
        <div style={{ marginBottom:8 }}>
          <LinkForm onAdd={handleAddLink} onCancel={() => setShowLinkForm(false)} />
        </div>
      )}

      {/* Drop zone (visible solo si no hay adjuntos) */}
      {adjuntos.length === 0 && !loading && !showLinkForm && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          style={{
            border:'1px dashed rgba(255,255,255,0.12)',
            borderRadius:3, padding:'16px 12px',
            textAlign:'center', cursor:'pointer',
            color:'var(--text-dim)', fontSize:'0.72rem',
            transition:'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(57,255,20,0.3)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
        >
          <Upload size={18} style={{ margin:'0 auto 6px', opacity:0.4 }} />
          <p>Arrastrá archivos o hacé click para subir</p>
          <p style={{ fontSize:'0.62rem', marginTop:2, opacity:0.6 }}>JPG, PNG, PDF, Word, Excel · máx. 50 MB</p>
        </div>
      )}

      {/* Galería de imágenes */}
      {imagenes.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
          {imagenes.map(img => (
            <div key={img.id} style={{ position:'relative', width:72, height:72 }}>
              <img
                src={img.url} alt={img.nombre}
                onClick={() => setLightbox(img)}
                style={{
                  width:72, height:72, objectFit:'cover', borderRadius:3,
                  cursor:'zoom-in', border:'1px solid rgba(255,255,255,0.08)',
                }}
              />
              <button
                onClick={() => handleDelete(img)}
                style={{
                  position:'absolute', top:2, right:2,
                  background:'rgba(0,0,0,0.7)', border:'none', borderRadius:'50%',
                  width:18, height:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#fff', padding:0,
                }}><X size={10} /></button>
            </div>
          ))}
          {/* Drop zone pequeña inline */}
          <div
            onDrop={handleDrop} onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            style={{
              width:72, height:72, border:'1px dashed rgba(255,255,255,0.15)',
              borderRadius:3, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              color:'var(--text-dim)',
            }}
          ><Plus size={18} /></div>
        </div>
      )}

      {/* Archivos no-imagen */}
      {archivos.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:8 }}>
          {archivos.map(a => (
            <div key={a.id} style={{
              display:'flex', alignItems:'center', gap:8, padding:'6px 8px',
              background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:3,
            }}>
              {iconForMime(a.mime_type)}
              <div style={{ flex:1, minWidth:0 }}>
                <a href={a.url} target="_blank" rel="noreferrer"
                  style={{ color:'var(--text)', fontSize:'0.72rem', textDecoration:'none', display:'block',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {a.nombre}
                </a>
                {(a.tamaño_bytes || a.descripcion) && (
                  <p style={{ color:'var(--text-dim)', fontSize:'0.6rem', marginTop:1 }}>
                    {[formatBytes(a.tamaño_bytes), a.descripcion].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                <a href={a.url} target="_blank" rel="noreferrer" className="btn-ghost"
                  style={{ padding:'0.15rem 0.35rem', display:'flex', alignItems:'center' }}>
                  <ExternalLink size={11} />
                </a>
                <button onClick={() => handleDelete(a)} className="btn-ghost"
                  style={{ padding:'0.15rem 0.35rem', display:'flex', alignItems:'center', color:'var(--alert)' }}>
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Links externos */}
      {links.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {links.map(l => (
            <div key={l.id} style={{
              display:'flex', alignItems:'center', gap:8, padding:'6px 8px',
              background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.15)',
              borderRadius:3,
            }}>
              <Link2 size={14} style={{ color:'#60A5FA', flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <a href={l.url} target="_blank" rel="noreferrer"
                  style={{ color:'#60A5FA', fontSize:'0.72rem', textDecoration:'none', display:'block',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {l.nombre}
                </a>
                {l.descripcion && (
                  <p style={{ color:'var(--text-dim)', fontSize:'0.6rem', marginTop:1 }}>{l.descripcion}</p>
                )}
              </div>
              <button onClick={() => handleDelete(l)} className="btn-ghost"
                style={{ padding:'0.15rem 0.35rem', display:'flex', alignItems:'center', color:'var(--alert)' }}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,0.88)',
            display:'flex', alignItems:'center', justifyContent:'center',
            zIndex:9999, cursor:'zoom-out',
          }}>
          <div style={{ position:'relative', maxWidth:'90vw', maxHeight:'90vh' }}>
            <img src={lightbox.url} alt={lightbox.nombre}
              style={{ maxWidth:'90vw', maxHeight:'85vh', objectFit:'contain', borderRadius:4 }} />
            <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.72rem', textAlign:'center', marginTop:6 }}>
              {lightbox.nombre}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
