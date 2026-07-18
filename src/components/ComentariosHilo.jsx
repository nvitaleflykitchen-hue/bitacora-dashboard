import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { MessageSquare, Send, Trash2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { getComentarios, crearComentario, eliminarComentario, getPersonasMencionables, getReacciones, toggleReaccion } from '../lib/queries'
import { confirmar, toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'

const EMOJIS_RAPIDOS = ['👍', '✅', '👀', '🙌']
const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const personaNombre = persona => `${persona?.nombre || ''} ${persona?.apellido || ''}`.trim().replace(/\s+/g, ' ')
const unique = values => [...new Set(values.filter(Boolean).map(String))]

function getMentionContext(text, caret) {
  const before = text.slice(0, caret)
  const start = before.lastIndexOf('@')
  if (start < 0) return null
  if (start > 0 && !/\s/.test(before[start - 1])) return null
  const query = before.slice(start + 1)
  if (query.length > 50 || /[\n\r,.;:!?()[\]{}]/.test(query)) return null
  return { start, query }
}

function MentionText({ text }) {
  const parts = String(text || '').split(/(@[^@\s,.;:!?()[\]{}]+(?:\s+[^@\s,.;:!?()[\]{}]+){0,3})/g)
  return parts.map((part, index) => {
    if (!part.startsWith('@')) return part
    return (
      <span key={`${part}-${index}`} style={{ color:'var(--phosphor)', fontWeight:700 }}>
        {part}
      </span>
    )
  })
}

// Hilo de comentarios genérico, reutilizable en cualquier ficha.
// entidadTipo: 'ticket' | 'tarea' | 'escalamiento' | 'no_conformidad'
export default function ComentariosHilo({ entidadTipo, entidadId, compact = false }) {
  const { user, perfil } = useAuth()
  const [comentarios, setComentarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [texto, setTexto] = useState('')
  const [caretPos, setCaretPos] = useState(0)
  const [personas, setPersonas] = useState([])
  const [mentions, setMentions] = useState([])
  const [mentionIndex, setMentionIndex] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const listRef = useRef()
  const textareaRef = useRef()

  const [reacciones, setReacciones] = useState([])

  const load = useCallback(async () => {
    if (!entidadId) return
    try {
      const coms = await getComentarios(entidadTipo, entidadId)
      setComentarios(coms)
      const ids = coms.map(c => c.id)
      setReacciones(ids.length ? await getReacciones(ids) : [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [entidadTipo, entidadId])

  const reaccionar = async (comentarioId, emoji) => {
    // Optimista: reflejar el toggle al instante
    const yaEsta = reacciones.some(r => r.comentario_id === comentarioId && r.usuario_id === user?.id && r.emoji === emoji)
    setReacciones(prev => yaEsta
      ? prev.filter(r => !(r.comentario_id === comentarioId && r.usuario_id === user?.id && r.emoji === emoji))
      : [...prev, { id: `tmp-${Date.now()}`, comentario_id: comentarioId, usuario_id: user?.id, usuario_nombre: perfil?.nombre, emoji }])
    try {
      await toggleReaccion({ comentarioId, usuarioId: user?.id, usuarioNombre: perfil?.nombre || perfil?.email, emoji })
    } catch (e) {
      toast.error(mensajeError(e))
      load()
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    let alive = true
    getPersonasMencionables()
      .then(rows => { if (alive) setPersonas((rows || []).filter(persona => persona.perfil_id)) })
      .catch(error => console.warn('[comentarios] No se pudo cargar personas para menciones:', error.message))
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [comentarios.length])

  const mentionContext = useMemo(() => getMentionContext(texto, caretPos), [texto, caretPos])
  const mentionOptions = useMemo(() => {
    if (!mentionContext) return []
    const query = norm(mentionContext.query)
    return personas
      .filter(persona => {
        const searchable = norm(`${personaNombre(persona)} ${persona.puesto || ''} ${persona.area || ''} ${persona.rol || ''} ${persona.email || ''}`)
        return !query || query.split(/\s+/).filter(Boolean).every(term => searchable.includes(term))
      })
      .slice(0, compact ? 5 : 7)
  }, [compact, mentionContext, personas])

  useEffect(() => { setMentionIndex(0) }, [mentionContext?.query])

  const syncCaret = event => {
    const position = event.target.selectionStart || 0
    setCaretPos(position)
  }

  const insertMention = persona => {
    if (!mentionContext) return
    const nombre = personaNombre(persona)
    const mention = `@${nombre}`
    const before = texto.slice(0, mentionContext.start)
    const after = texto.slice(caretPos).replace(/^\s+/, '')
    const next = `${before}${mention} ${after}`
    const nextCaret = before.length + mention.length + 1
    setTexto(next)
    setMentions(current => {
      if (!persona.perfil_id || current.some(item => String(item.perfil_id) === String(persona.perfil_id))) return current
      return [...current, { perfil_id:persona.perfil_id, persona_id:persona.id, nombre }]
    })
    setCaretPos(nextCaret)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret)
    })
  }

  const handleEnviar = async () => {
    const valor = texto.trim()
    if (!valor || !user?.id || enviando) return
    const mentionedUserIds = resolveMentionedUserIds(valor)
    setEnviando(true)
    try {
      await crearComentario({
        entidadTipo, entidadId,
        autorId: user.id,
        autorNombre: perfil?.nombre || user.email,
        texto: valor,
        mencionadoUserIds: mentionedUserIds,
      })
      setTexto('')
      setMentions([])
      await load()
    } catch (e) {
      toast.error('Error al enviar el comentario: ' + mensajeError(e))
    } finally {
      setEnviando(false)
    }
  }

  const handleDelete = async (c) => {
    if (!await confirmar({ mensaje: '¿Eliminar este comentario?', peligro: true, confirmText: 'Eliminar' })) return
    try {
      await eliminarComentario(c.id)
      setComentarios(prev => prev.filter(x => x.id !== c.id))
    } catch (e) {
      toast.error('Error: ' + mensajeError(e))
    }
  }

  const resolveMentionedUserIds = value => {
    const selected = mentions
      .filter(item => value.includes(`@${item.nombre}`))
      .map(item => item.perfil_id)
    const nameCounts = personas.reduce((counts, persona) => {
      const key = norm(personaNombre(persona))
      counts.set(key, (counts.get(key) || 0) + 1)
      return counts
    }, new Map())
    const exactTyped = personas
      .filter(persona => nameCounts.get(norm(personaNombre(persona))) === 1 && value.includes(`@${personaNombre(persona)}`))
      .map(persona => persona.perfil_id)
    return unique([...selected, ...exactTyped]).filter(id => String(id) !== String(user?.id))
  }

  const handleKeyDown = (e) => {
    if (mentionOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex(index => (index + 1) % mentionOptions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex(index => (index - 1 + mentionOptions.length) % mentionOptions.length)
        return
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        insertMention(mentionOptions[mentionIndex] || mentionOptions[0])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setCaretPos(0)
        return
      }
    }
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
                  <span style={{ color:'rgba(107,114,128,0.6)', fontSize:'0.6rem' }}>
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
                <MentionText text={c.texto} />
              </p>
              {(() => {
                const rc = reacciones.filter(r => r.comentario_id === c.id)
                const porEmoji = {}
                rc.forEach(r => { (porEmoji[r.emoji] = porEmoji[r.emoji] || []).push(r) })
                return (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:5, alignItems:'center' }}>
                    {Object.entries(porEmoji).map(([emoji, lista]) => {
                      const mia = lista.some(r => r.usuario_id === user?.id)
                      const nombres = lista.map(r => r.usuario_nombre).filter(Boolean).join(', ')
                      return (
                        <button key={emoji} onClick={() => reaccionar(c.id, emoji)} title={nombres}
                          style={{
                            display:'flex', alignItems:'center', gap:3, padding:'1px 7px', borderRadius:10, cursor:'pointer',
                            fontSize:'0.72rem', lineHeight:1.6,
                            background: mia ? 'rgba(57,255,20,0.12)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${mia ? 'rgba(57,255,20,0.35)' : 'rgba(255,255,255,0.1)'}`,
                            color:'var(--text)',
                          }}>
                          {emoji} <span style={{ fontSize:'0.62rem', color:'var(--text-dim)' }}>{lista.length}</span>
                        </button>
                      )
                    })}
                    <span style={{ display:'flex', gap:2, marginLeft: rc.length ? 4 : 0 }}>
                      {EMOJIS_RAPIDOS.map(emoji => (
                        <button key={emoji} onClick={() => reaccionar(c.id, emoji)} title="Reaccionar"
                          style={{
                            padding:'1px 5px', borderRadius:8, cursor:'pointer', fontSize:'0.72rem', opacity:0.5,
                            background:'transparent', border:'1px solid transparent',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = 0.5; e.currentTarget.style.background = 'transparent' }}>
                          {emoji}
                        </button>
                      ))}
                    </span>
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>

      <div style={{ display:'flex', gap:6, alignItems:'flex-end', position:'relative' }}>
        <div style={{ flex:1, position:'relative' }}>
          {mentionOptions.length > 0 && (
            <div style={{
              position:'absolute', left:0, right:0, bottom:'calc(100% + 6px)', zIndex:20,
              border:'1px solid rgba(57,255,20,0.22)', background:'rgba(18,18,24,0.98)', borderRadius:4,
              boxShadow:'0 12px 30px rgba(0,0,0,0.35)', overflow:'hidden'
            }}>
              {mentionOptions.map((persona, index) => {
                const active = index === mentionIndex
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onMouseDown={event => { event.preventDefault(); insertMention(persona) }}
                    style={{
                      width:'100%', textAlign:'left', padding:'0.5rem 0.6rem', border:0,
                      background:active ? 'rgba(57,255,20,0.12)' : 'transparent', color:'var(--text)', cursor:'pointer'
                    }}
                  >
                    <div style={{ fontWeight:700, fontSize:'0.72rem' }}>@{personaNombre(persona)}</div>
                    {(persona.puesto || persona.area || persona.rol) && (
                      <div style={{ color:'var(--text-dim)', fontSize:'0.62rem', marginTop:2 }}>
                        {[persona.puesto, persona.area, persona.rol].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
          <textarea
            ref={textareaRef}
            className="input-dark w-full"
            value={texto}
            onChange={e => { setTexto(e.target.value); syncCaret(e) }}
            onClick={syncCaret}
            onKeyUp={syncCaret}
            onSelect={syncCaret}
            onKeyDown={handleKeyDown}
            placeholder="Escribir un comentario... (@ para mencionar, Enter para enviar)"
            rows={2}
            style={{ resize:'none', flex:1 }}
          />
        </div>
        <button onClick={handleEnviar} disabled={!texto.trim() || enviando} className="btn-primary"
          style={{ padding:'0.45rem 0.65rem', display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
          <Send size={13} />
        </button>
      </div>
    </div>
  )
}
