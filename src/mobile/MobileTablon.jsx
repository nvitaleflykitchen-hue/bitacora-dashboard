import { useState, useEffect, useCallback } from 'react'
import { getAnuncios, crearAnuncio, marcarAnunciosLeidos, getSedes, getGrupos } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { Megaphone, X, Plus } from 'lucide-react'

const PRIORIDADES = [
  { v: 'baja', label: 'Baja', color: 'var(--text-dim)' },
  { v: 'media', label: 'Media', color: 'var(--phosphor)' },
  { v: 'alta', label: 'Alta', color: '#FFA500' },
  { v: 'critica', label: 'Crítica', color: '#FF2A2A' },
]
const colorPrioridad = (p) => PRIORIDADES.find(x => x.v === p)?.color || 'var(--text-dim)'
const labelPrioridad = (p) => PRIORIDADES.find(x => x.v === p)?.label || p

export default function MobileTablon() {
  const { user, isAdmin, allowedSedeIds } = useAuth()
  const [anuncios, setAnuncios] = useState([])
  const [sedes, setSedes] = useState([])
  const [grupos, setGrupos] = useState([])
  const [loading, setLoading] = useState(true)
  const [nuevoModal, setNuevoModal] = useState(false)

  useEffect(() => { getSedes(allowedSedeIds).then(setSedes).catch(() => {}) }, [allowedSedeIds])
  useEffect(() => { if (isAdmin) getGrupos().then(setGrupos).catch(() => {}) }, [isAdmin])

  const load = useCallback(() => {
    setLoading(true)
    getAnuncios().then(setAnuncios).catch(console.error).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    if (user?.id) marcarAnunciosLeidos(user.id).catch(() => {})
  }, [load, user?.id])

  return (
    <div className="mobile-scroll" style={{ padding: '1.25rem 1rem 1rem', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexShrink: 0 }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontSize: '1.3rem', fontWeight: 700 }}>📣 Tablón operativo</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem', marginTop: 3 }}>Avisos de la operación; las versiones están en Actualizaciones.</p>
        </div>
      </div>

      <div style={{ flex: 1 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--phosphor)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : anuncios.length === 0 ? (
          <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '2rem', textAlign: 'center', marginTop: '1rem' }}>
            <Megaphone size={32} style={{ color: 'var(--phosphor)', margin: '0 auto 0.5rem', opacity: 0.8 }} />
            <p style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Sin anuncios publicados todavía</p>
          </div>
        ) : anuncios.map(a => (
          <div key={a.id} style={{
            background: 'var(--surface)', borderRadius: 10, padding: '1rem', marginBottom: '0.75rem',
            borderLeft: `3px solid ${colorPrioridad(a.prioridad)}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
              <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.88rem', flex: 1 }}>{a.titulo}</p>
              <span style={{ color: colorPrioridad(a.prioridad), fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                {labelPrioridad(a.prioridad)}
              </span>
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginTop: '0.4rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{a.cuerpo}</p>
            <p style={{ color: 'rgba(107,114,128,0.6)', fontSize: '0.62rem', marginTop: '0.5rem' }}>
              {new Date(a.created_at).toLocaleString('es-AR')}
            </p>
          </div>
        ))}
      </div>

      {isAdmin && (
        <button
          onClick={() => setNuevoModal(true)}
          style={{
            position: 'absolute', bottom: '1.5rem', right: '1.5rem',
            width: 50, height: 50, borderRadius: 25,
            background: 'var(--phosphor)', color: '#000',
            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(57,255,20,0.3)', zIndex: 10
          }}>
          <Plus size={24} />
        </button>
      )}

      {nuevoModal && (
        <NuevoAnuncioModal sedes={sedes} grupos={grupos} onClose={() => setNuevoModal(false)} onSaved={() => { setNuevoModal(false); load() }} />
      )}
    </div>
  )
}

function NuevoAnuncioModal({ sedes, grupos, onClose, onSaved }) {
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [prioridad, setPrioridad] = useState('media')
  const [alcance, setAlcance] = useState('todas') // 'todas' | 'grupos' | 'sedes'
  const [sedeIdsSel, setSedeIdsSel] = useState([])
  const [grupoIdsSel, setGrupoIdsSel] = useState([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const [okMsg, setOkMsg] = useState(null)

  const toggleSede = (id) => setSedeIdsSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const toggleGrupo = (id) => setGrupoIdsSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  // Los grupos no se mandan tal cual a la Edge Function (que solo entiende sede_ids):
  // se resuelven acá a las sedes que pertenecen a esos grupos.
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
      const res = await crearAnuncio({
        titulo: titulo.trim(),
        cuerpo: cuerpo.trim(),
        prioridad,
        sedeIds,
      })
      setOkMsg(`Enviado a ${res?.recipients ?? 0} destinatario(s).`)
      setTimeout(onSaved, 900)
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  const INPUT = { width: '100%', padding: '0.7rem 0.8rem', borderRadius: 6, background: 'var(--bg)', border: '1px solid rgba(57,255,20,0.08)', color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box' }
  const LABEL = { color: 'var(--text-dim)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '0.35rem' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: 'var(--surface)', borderRadius: '14px 14px 0 0', padding: '1.25rem 1rem calc(1.25rem + env(safe-area-inset-bottom))', width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem' }}>Nuevo Anuncio</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ marginBottom: '0.9rem' }}>
          <label style={LABEL}>Título *</label>
          <input value={titulo} onChange={e => setTitulo(e.target.value)} style={INPUT} placeholder="Ej: Corte de luz programado" />
        </div>
        <div style={{ marginBottom: '0.9rem' }}>
          <label style={LABEL}>Mensaje *</label>
          <textarea value={cuerpo} onChange={e => setCuerpo(e.target.value)} style={{ ...INPUT, minHeight: 90, resize: 'vertical' }} placeholder="Detalle del anuncio..." />
        </div>
        <div style={{ marginBottom: '0.9rem' }}>
          <label style={LABEL}>Prioridad</label>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {PRIORIDADES.map(p => (
              <button key={p.v} onClick={() => setPrioridad(p.v)}
                style={{ flex: 1, padding: '0.45rem', borderRadius: 6, fontSize: '0.68rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: prioridad === p.v ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.03)',
                  color: prioridad === p.v ? p.color : 'var(--text-dim)' }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: '0.9rem' }}>
          <label style={LABEL}>Alcance</label>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: alcance !== 'todas' ? '0.6rem' : 0 }}>
            <button onClick={() => setAlcance('todas')}
              style={{ flex: 1, padding: '0.45rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                background: alcance === 'todas' ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.03)',
                color: alcance === 'todas' ? 'var(--phosphor)' : 'var(--text-dim)' }}>
              Todas
            </button>
            <button onClick={() => setAlcance('grupos')}
              style={{ flex: 1, padding: '0.45rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                background: alcance === 'grupos' ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.03)',
                color: alcance === 'grupos' ? 'var(--phosphor)' : 'var(--text-dim)' }}>
              Grupos
            </button>
            <button onClick={() => setAlcance('sedes')}
              style={{ flex: 1, padding: '0.45rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                background: alcance === 'sedes' ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.03)',
                color: alcance === 'sedes' ? 'var(--phosphor)' : 'var(--text-dim)' }}>
              Sedes
            </button>
          </div>
          {alcance === 'grupos' && (
            grupos.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem', padding: '0.5rem' }}>No hay grupos configurados.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: 130, overflowY: 'auto', padding: '0.5rem', background: 'var(--bg)', borderRadius: 6 }}>
                {grupos.map(g => (
                  <button key={g.id} onClick={() => toggleGrupo(g.id)}
                    style={{ padding: '0.3rem 0.55rem', borderRadius: 6, fontSize: '0.66rem', fontWeight: 600, border: '1px solid rgba(57,255,20,0.15)', cursor: 'pointer',
                      background: grupoIdsSel.includes(g.id) ? 'rgba(57,255,20,0.2)' : 'transparent',
                      color: grupoIdsSel.includes(g.id) ? 'var(--phosphor)' : 'var(--text-dim)' }}>
                    {g.nombre}
                  </button>
                ))}
              </div>
            )
          )}
          {alcance === 'sedes' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: 130, overflowY: 'auto', padding: '0.5rem', background: 'var(--bg)', borderRadius: 6 }}>
              {sedes.map(s => (
                <button key={s.id} onClick={() => toggleSede(s.id)}
                  style={{ padding: '0.3rem 0.55rem', borderRadius: 6, fontSize: '0.66rem', fontWeight: 600, border: '1px solid rgba(57,255,20,0.15)', cursor: 'pointer',
                    background: sedeIdsSel.includes(s.id) ? 'rgba(57,255,20,0.2)' : 'transparent',
                    color: sedeIdsSel.includes(s.id) ? 'var(--phosphor)' : 'var(--text-dim)' }}>
                  {s.nombre}
                </button>
              ))}
            </div>
          )}
        </div>

        {err && <p style={{ color: 'var(--alert)', fontSize: '0.78rem', marginBottom: '0.9rem' }}>{err}</p>}
        {okMsg && <p style={{ color: 'var(--phosphor)', fontSize: '0.78rem', marginBottom: '0.9rem' }}>✓ {okMsg}</p>}

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '0.65rem', borderRadius: 6, background: 'rgba(57,255,20,0.05)', color: 'var(--text-dim)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || !!okMsg} style={{ flex: 1, padding: '0.65rem', borderRadius: 6, background: saving ? 'rgba(57,255,20,0.4)' : 'var(--phosphor)', color: '#0A0A0E', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
            {saving ? 'Publicando...' : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  )
}
