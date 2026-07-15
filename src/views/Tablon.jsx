import { useState, useEffect, useCallback } from 'react'
import { getAnuncios, crearAnuncio, marcarAnunciosLeidos, getSedes, getGrupos } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import AdjuntosPanel from '../components/AdjuntosPanel'

const PRIORIDADES = [
  { v: 'baja', label: 'Baja', color: 'var(--text-dim)' },
  { v: 'media', label: 'Media', color: 'var(--phosphor)' },
  { v: 'alta', label: 'Alta', color: '#FFA500' },
  { v: 'critica', label: 'Crítica', color: '#FF2A2A' },
]
const colorPrioridad = (p) => PRIORIDADES.find(x => x.v === p)?.color || 'var(--text-dim)'
const labelPrioridad = (p) => PRIORIDADES.find(x => x.v === p)?.label || p

// Carga en batch los adjuntos de todos los anuncios de una vez
async function getAdjuntosPorAnuncios(entidadIds) {
  if (!entidadIds.length) return {}
  const { data } = await supabase.schema('bitacora').from('adjuntos')
    .select('*').eq('entity_type', 'anuncio').in('entity_id', entidadIds.map(String))
  const mapa = {}
  for (const adj of data || []) {
    if (!mapa[adj.entity_id]) mapa[adj.entity_id] = []
    mapa[adj.entity_id].push(adj)
  }
  return mapa
}

function AnuncioCard({ anuncio, adjuntos = [] }) {
  const [lightbox, setLightbox] = useState(null)
  const imagenes = adjuntos.filter(a => a.mime_type?.startsWith('image/'))
  const archivos  = adjuntos.filter(a => !a.mime_type?.startsWith('image/'))

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 3, padding: '1.1rem 1.25rem', borderLeft: `3px solid ${colorPrioridad(anuncio.prioridad)}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
        <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.92rem' }}>{anuncio.titulo}</p>
        <span style={{ color: colorPrioridad(anuncio.prioridad), fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
          {labelPrioridad(anuncio.prioridad)}
        </span>
      </div>
      <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: '0.4rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{anuncio.cuerpo}</p>

      {/* Imágenes adjuntas */}
      {imagenes.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          {imagenes.map(img => (
            <img
              key={img.id}
              src={img.url}
              alt={img.nombre}
              onClick={() => setLightbox(img.url)}
              style={{
                height: 80, width: 'auto', maxWidth: 120,
                objectFit: 'cover', borderRadius: 2, cursor: 'zoom-in',
                border: '1px solid rgba(57,255,20,0.12)',
              }}
            />
          ))}
        </div>
      )}

      {/* Archivos no-imagen */}
      {archivos.length > 0 && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {archivos.map(a => (
            <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '0.68rem', color: 'var(--phosphor)', background: 'rgba(57,255,20,0.06)',
                padding: '0.2rem 0.5rem', borderRadius: 2, textDecoration: 'none' }}>
              📎 {a.nombre}
            </a>
          ))}
        </div>
      )}

      <p style={{ color: 'rgba(107,114,128,0.6)', fontSize: '0.62rem', marginTop: '0.6rem' }}>
        {new Date(anuncio.created_at).toLocaleString('es-AR')}
      </p>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 4, objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}

export default function Tablon() {
  const { user, isAdmin, allowedSedeIds } = useAuth()
  const [anuncios, setAnuncios]     = useState([])
  const [adjuntosMap, setAdjuntosMap] = useState({})
  const [sedes, setSedes]           = useState([])
  const [grupos, setGrupos]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [nuevoModal, setNuevoModal] = useState(false)

  useEffect(() => { getSedes(allowedSedeIds).then(setSedes) }, [allowedSedeIds])
  useEffect(() => { if (isAdmin) getGrupos().then(setGrupos).catch(() => {}) }, [isAdmin])

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getAnuncios().catch(() => [])
    setAnuncios(data)
    // Batch-fetch adjuntos para todos los anuncios
    const ids = data.map(a => a.entidad_id).filter(Boolean)
    const mapa = await getAdjuntosPorAnuncios(ids).catch(() => ({}))
    setAdjuntosMap(mapa)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    if (user?.id) marcarAnunciosLeidos(user.id).catch(() => {})
  }, [load, user?.id])

  return (
    <div style={{ padding: '1.5rem 2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 className='font-title' style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.4rem' }}>📣 Tablón operativo</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: 4 }}>Avisos para la operación. Las versiones y funciones nuevas se publican en Actualizaciones.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setNuevoModal(true)}
            style={{ background: 'var(--phosphor)', color: '#0A0A0E', border: 'none', borderRadius: 3, padding: '0.55rem 1.1rem', fontWeight: 700, cursor: 'pointer' }}>
            + Anuncio
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--phosphor)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : anuncios.length === 0 ? (
          <p style={{ padding: '2rem', color: 'var(--text-dim)', textAlign: 'center', background: 'var(--surface)', borderRadius: 3 }}>
            Sin anuncios publicados todavía.
          </p>
        ) : anuncios.map(a => (
          <AnuncioCard
            key={a.id}
            anuncio={a}
            adjuntos={adjuntosMap[String(a.entidad_id)] || []}
          />
        ))}
      </div>

      {nuevoModal && (
        <NuevoAnuncioModal
          sedes={sedes}
          grupos={grupos}
          onClose={() => setNuevoModal(false)}
          onSaved={() => { setNuevoModal(false); load() }}
        />
      )}
    </div>
  )
}

function NuevoAnuncioModal({ sedes, grupos, onClose, onSaved }) {
  const [titulo, setTitulo]           = useState('')
  const [cuerpo, setCuerpo]           = useState('')
  const [prioridad, setPrioridad]     = useState('media')
  const [alcance, setAlcance]         = useState('todas')
  const [sedeIdsSel, setSedeIdsSel]   = useState([])
  const [grupoIdsSel, setGrupoIdsSel] = useState([])
  const [saving, setSaving]           = useState(false)
  const [err, setErr]                 = useState(null)
  // Paso 2: después de publicar, mostrar adjuntos
  const [savedEntidadId, setSavedEntidadId] = useState(null)

  const toggleSede  = (id) => setSedeIdsSel(prev  => prev.includes(id)  ? prev.filter(x => x !== id)  : [...prev, id])
  const toggleGrupo = (id) => setGrupoIdsSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const sedeIdsDeGrupos = (ids) => sedes.filter(s => ids.includes(s.grupo_id)).map(s => s.id)

  const handleSave = async () => {
    if (!titulo.trim()) { setErr('Título requerido'); return }
    if (!cuerpo.trim()) { setErr('Mensaje requerido'); return }
    if (alcance === 'sedes' && !sedeIdsSel.length) { setErr('Seleccioná al menos una sede'); return }
    if (alcance === 'grupos' && !grupoIdsSel.length) { setErr('Seleccioná al menos un grupo'); return }
    let sedeIds = null
    if (alcance === 'sedes') sedeIds = sedeIdsSel
    if (alcance === 'grupos') {
      sedeIds = sedeIdsDeGrupos(grupoIdsSel)
      if (!sedeIds.length) { setErr('El/los grupo(s) seleccionados no tienen sedes activas'); return }
    }
    setSaving(true); setErr(null)
    try {
      await crearAnuncio({ titulo: titulo.trim(), cuerpo: cuerpo.trim(), prioridad, sedeIds })
      // Buscar el entidad_id del anuncio recién creado para poder adjuntar archivos
      const recientes = await getAnuncios(1).catch(() => [])
      const entidadId = recientes[0]?.entidad_id || null
      setSavedEntidadId(entidadId)
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  const INPUT = { width: '100%', padding: '0.7rem 0.9rem', borderRadius: 2, background: 'var(--bg)', border: '1px solid rgba(57,255,20,0.08)', color: 'var(--text)', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' }
  const LABEL = { color: 'var(--text-dim)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.35rem' }

  // ── Paso 2: anuncio publicado, adjuntar imágenes ──────────────────────────
  if (savedEntidadId) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 3, padding: '1.75rem', width: '100%', maxWidth: 500, maxHeight: '85vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h2 style={{ color: 'var(--text)', fontWeight: 700 }}>✓ Anuncio publicado</h2>
            <button onClick={onSaved} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginBottom: '1rem' }}>
            Podés adjuntar imágenes o archivos a este anuncio. Los destinatarios los verán en el Tablón.
          </p>
          <AdjuntosPanel entityType="anuncio" entityId={savedEntidadId} compact={false} readOnly={false} />
          <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
            <button onClick={onSaved}
              style={{ padding: '0.65rem 1.4rem', borderRadius: 2, background: 'var(--phosphor)', color: '#0A0A0E', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Paso 1: formulario del anuncio ────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 3, padding: '1.75rem', width: '100%', maxWidth: 460, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700 }}>Nuevo Anuncio</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={LABEL}>Título *</label>
          <input value={titulo} onChange={e => setTitulo(e.target.value)} style={INPUT} placeholder="Ej: Corte de luz programado" />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={LABEL}>Mensaje *</label>
          <textarea value={cuerpo} onChange={e => setCuerpo(e.target.value)} style={{ ...INPUT, minHeight: 100, resize: 'vertical' }} placeholder="Detalle del anuncio..." />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={LABEL}>Prioridad</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {PRIORIDADES.map(p => (
              <button key={p.v} onClick={() => setPrioridad(p.v)}
                style={{ flex: 1, padding: '0.5rem', borderRadius: 2, fontSize: '0.72rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: prioridad === p.v ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.03)',
                  color: prioridad === p.v ? p.color : 'var(--text-dim)' }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={LABEL}>Alcance</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: alcance !== 'todas' ? '0.6rem' : 0 }}>
            <button onClick={() => setAlcance('todas')}
              style={{ flex: 1, padding: '0.5rem', borderRadius: 2, fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                background: alcance === 'todas' ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.03)',
                color: alcance === 'todas' ? 'var(--phosphor)' : 'var(--text-dim)' }}>
              Todas las sedes
            </button>
            <button onClick={() => setAlcance('grupos')}
              style={{ flex: 1, padding: '0.5rem', borderRadius: 2, fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                background: alcance === 'grupos' ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.03)',
                color: alcance === 'grupos' ? 'var(--phosphor)' : 'var(--text-dim)' }}>
              Grupos
            </button>
            <button onClick={() => setAlcance('sedes')}
              style={{ flex: 1, padding: '0.5rem', borderRadius: 2, fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                background: alcance === 'sedes' ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.03)',
                color: alcance === 'sedes' ? 'var(--phosphor)' : 'var(--text-dim)' }}>
              Sedes específicas
            </button>
          </div>
          {alcance === 'grupos' && (
            grupos.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem', padding: '0.5rem' }}>No hay grupos configurados.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: 140, overflowY: 'auto', padding: '0.5rem', background: 'var(--bg)', borderRadius: 2 }}>
                {grupos.map(g => (
                  <button key={g.id} onClick={() => toggleGrupo(g.id)}
                    style={{ padding: '0.3rem 0.6rem', borderRadius: 2, fontSize: '0.68rem', fontWeight: 600, border: '1px solid rgba(57,255,20,0.15)', cursor: 'pointer',
                      background: grupoIdsSel.includes(g.id) ? 'rgba(57,255,20,0.2)' : 'transparent',
                      color: grupoIdsSel.includes(g.id) ? 'var(--phosphor)' : 'var(--text-dim)' }}>
                    {g.nombre}
                  </button>
                ))}
              </div>
            )
          )}
          {alcance === 'sedes' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: 140, overflowY: 'auto', padding: '0.5rem', background: 'var(--bg)', borderRadius: 2 }}>
              {sedes.map(s => (
                <button key={s.id} onClick={() => toggleSede(s.id)}
                  style={{ padding: '0.3rem 0.6rem', borderRadius: 2, fontSize: '0.68rem', fontWeight: 600, border: '1px solid rgba(57,255,20,0.15)', cursor: 'pointer',
                    background: sedeIdsSel.includes(s.id) ? 'rgba(57,255,20,0.2)' : 'transparent',
                    color: sedeIdsSel.includes(s.id) ? 'var(--phosphor)' : 'var(--text-dim)' }}>
                  {s.nombre}
                </button>
              ))}
            </div>
          )}
        </div>

        {err && <p style={{ color: 'var(--alert)', fontSize: '0.8rem', marginBottom: '1rem' }}>{err}</p>}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.65rem 1.2rem', borderRadius: 2, background: 'rgba(57,255,20,0.05)', color: 'var(--text-dim)', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '0.65rem 1.4rem', borderRadius: 2, background: saving ? 'rgba(57,255,20,0.4)' : 'var(--phosphor)', color: '#0A0A0E', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
            {saving ? 'Publicando...' : 'Publicar →'}
          </button>
        </div>
      </div>
    </div>
  )
}
