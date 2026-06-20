import { useState, useEffect } from 'react'
import { getMisTareas, updateTarea } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { getCategoriaLabel } from '../components/TareaForm'

const PRIORIDAD_COLOR = {
  alta: '#FF2A2A', media: '#F59E0B', baja: '#39FF14'
}

const ESTADOS_TAREA = ['pendiente', 'en_curso', 'resuelto']
const ESTADO_LABEL  = { pendiente: 'Pendiente', en_curso: 'En curso', resuelto: 'Resuelto' }

export default function MobileTareas() {
  const { perfil } = useAuth()
  const [tareas, setTareas] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  const load = () => {
    if (!perfil) return
    setLoading(true)
    getMisTareas(perfil.id)
      .then(setTareas)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [perfil])

  const avanzarEstado = async (tarea) => {
    const idx = ESTADOS_TAREA.indexOf(tarea.estado)
    const next = ESTADOS_TAREA[Math.min(idx + 1, ESTADOS_TAREA.length - 1)]
    if (next === tarea.estado) return
    setUpdating(tarea.id)
    try {
      await updateTarea(tarea.id, { estado: next })
      load()
    } catch (e) {
      alert(e.message)
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div style={{ padding: '1.25rem 1rem 0', height: '100%', overflowY: 'auto' }}>
      <h1 style={{ color: 'var(--text)', fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.25rem' }}>
        Mis Tareas
      </h1>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--phosphor)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : tareas.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--phosphor)', fontSize: '2rem', marginBottom: '0.5rem' }}>OK</p>
          <p style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Sin tareas pendientes</p>
        </div>
      ) : tareas.map(t => (
        <div key={t.id} style={{
          background: 'var(--surface)', borderRadius: 10, padding: '1rem',
          marginBottom: '0.75rem',
          borderLeft: `3px solid ${PRIORIDAD_COLOR[t.prioridad] || '#555'}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem', flex: 1, marginRight: '0.5rem' }}>
              {t.titulo}
            </p>
            <span style={{
              fontSize: '0.6rem', padding: '0.2rem 0.45rem', borderRadius: 4,
              background: `${PRIORIDAD_COLOR[t.prioridad]}22`,
              color: PRIORIDAD_COLOR[t.prioridad], fontWeight: 700, whiteSpace: 'nowrap'
            }}>
              {t.prioridad?.toUpperCase()}
            </span>
          </div>

          <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginBottom: '0.75rem' }}>
            {t.sedes?.nombre || '—'} {t.categoria ? '· ' + getCategoriaLabel(t.categoria) : ''}
          </p>

          {/* Avanzar estado */}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {ESTADOS_TAREA.filter(s => s !== 'resuelto').map(s => (
              <button key={s} onClick={() => t.estado !== s && avanzarEstado(t)}
                disabled={updating === t.id}
                style={{
                  flex: 1, padding: '0.45rem', borderRadius: 6, fontSize: '0.65rem',
                  fontWeight: 600, cursor: t.estado === s ? 'default' : 'pointer',
                  background: t.estado === s ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.04)',
                  color: t.estado === s ? 'var(--phosphor)' : 'var(--text-dim)',
                  border: t.estado === s ? '1px solid rgba(57,255,20,0.3)' : '1px solid transparent',
                }}>
                {ESTADO_LABEL[s]}
              </button>
            ))}
            <button onClick={() => avanzarEstado({ ...t, estado: 'en_curso' })}
              disabled={updating === t.id || t.estado === 'resuelto'}
              style={{
                flex: 1, padding: '0.45rem', borderRadius: 6, fontSize: '0.65rem',
                fontWeight: 700, cursor: 'pointer',
                background: 'rgba(57,255,20,0.08)',
                color: 'var(--phosphor)',
                border: '1px solid rgba(57,255,20,0.2)',
              }}>
              Resolver
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
