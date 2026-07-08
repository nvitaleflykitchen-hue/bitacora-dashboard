import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, Send, Trash2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { getComentarios, crearComentario, eliminarComentario } from '../lib/queries'

// Hilo de comentarios genérico, reutilizable en cualquier ficha.
// entidadTipo: 'ticket' | 'tarea' | 'escalamiento' | 'no_conformidad'
export default function ComentariosHilo({ entidadTipo, entidadId, compact = false }) {
  const { user, perfil } = useAuth()
  const [comentarios, setComentarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const listRef = useRef()

  const load = useCallback(async () => {
    if (!entidadId) return
    try {
      setComentarios(await getComentarios(entidadTipo, entidadId))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [entidadTipo, entidadId])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [comentarios.length])

  const handleEnviar = async () => {
    const valor = texto.trim()
    if (!valor || !user?.id || enviando) return
    setEnviando(true)
    try {
      await crearComentario({
        entidadTipo, entidadId,
        autorId: user.id,
        autorNombre: perfil?.nombre || user.email,
        texto: valor,
      })
      setTexto('')
      await load()
    } catch (e) {
      alert('Error al enviar el comentario: ' + e.message)
    } finally {
      setEnviando(false)
    }
  }

  const handleDelete = async (c) => {
    if (!confirm('¿Eliminar este comentario?')) return
    try {
      await eliminarComentario(c.id)
      setComentarios(prev => prev.filter(x => x.id !== c.id))
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviar()
    }
  }

  if (!entidadId) return null

  return (
    <div style={{ marginTop: compact ? 0 : 12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
        <MessageSquare size={13} style={{ color:'var(--phosphor)' }} />
        <span className="font-metric" style={{ fontSize:'0.68rem', color:'var(--text-dim)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
          Comentarios {comentarios.length > 0 && `(${comentarios.length})`}
        </span>
      </div>

      <div ref={listRef} style={{ maxHeight: compact ? 200 : 320, overflowY:'auto', display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
        {loading ? (
          <p style={{ color:'var(--text-dim)', fontSize:'0.7rem', textAlign:'center', padding:'8px 0' }}>Cargando...</p>
        ) : comentarios.length === 0 ? (
          <p style={{ color:'var(--text-dim)', fontSize:'0.7rem', textAlign:'center', padding:'8px 0' }}>Sin comentarios todavía.</p>
        ) : comentarios.map(c => {
          const propio = c.autor_id === user?.id
          return (
            <div key={c.id} style={{
              padding:'6px 8px', borderRadius:3,
              background: propio ? 'rgba(57,255,20,0.05)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${propio ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.07)'}`,
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                <span style={{ color: propio ? 'var(--phosphor)' : 'var(--text)', fontSize:'0.7rem', fontWeight:700 }}>
                  {c.autor_nombre}
                </span>
                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                  <span style={{ color:'rgba(107,114,128,0.6)', fontSize:'0.58rem' }}>
                    {new Date(c.created_at).toLocaleString('es-AR')}
                  </span>
                  {propio && (
                    <button onClick={() => handleDelete(c)} className="btn-ghost"
                      style={{ padding:'0.1rem 0.25rem', display:'flex', alignItems:'center', color:'var(--alert)' }}>
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>
              <p style={{ color:'var(--text)', fontSize:'0.74rem', marginTop:3, lineHeight:1.4, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                {c.texto}
              </p>
            </div>
          )
        })}
      </div>

      <div style={{ display:'flex', gap:6, alignItems:'flex-end' }}>
        <textarea
          className="input-dark w-full"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribir un comentario... (Enter para enviar)"
          rows={2}
          style={{ resize:'none', flex:1 }}
        />
        <button onClick={handleEnviar} disabled={!texto.trim() || enviando} className="btn-primary"
          style={{ padding:'0.45rem 0.65rem', display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
          <Send size={13} />
        </button>
      </div>
    </div>
  )
}
