import { useState, useEffect } from 'react'
import { getEscalamientosItems, updateEscalamientoItem } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const ESTADO_COLOR = {
  'Pendiente':  { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)'  },
  'En gestión': { color: '#50b4ff', bg: 'rgba(80,180,255,0.1)'  },
  'Resuelto':   { color: '#39FF14', bg: 'rgba(57,255,20,0.1)'   },
}
const TIPO_COLOR = {
  'Compras':       '#50b4ff',
  'Mantenimiento': '#F59E0B',
  'RRHH':          '#a78bfa',
  'Logística':     '#34d399',
  'Calidad':       '#fb923c',
  'Coordinación':  '#f472b6',
  'Dirección':     '#FF2A2A',
  'Otro':          '#9ca3af',
}
const ESTADOS = ['Pendiente', 'En gestión', 'Resuelto']

export default function MobileEscalamientos() {
  const { allowedSedeIds } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('Pendiente')
  const [updating, setUpdating] = useState(null)

  const load = () => {
    setLoading(true)
    getEscalamientosItems({ sedeIds: allowedSedeIds || undefined })
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [allowedSedeIds])

  const filtrados = filtro === 'todos'
    ? items
    : items.filter(e => e.estado === filtro)

  const handleEstado = async (id, nuevoEstado) => {
    setUpdating(id)
    try {
      await updateEscalamientoItem(id, { estado: nuevoEstado })
      setItems(prev => prev.map(e => e.id === id ? { ...e, estado: nuevoEstado } : e))
    } catch (err) {
      console.error(err)
    } finally {
      setUpdating(null)
    }
  }

  const pendientes = items.filter(e => e.estado === 'Pendiente').length
  const enGestion  = items.filter(e => e.estado === 'En gestión').length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1rem 0.6rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <h1 style={{ color: 'var(--text)', fontSize: '1.1rem', fontWeight: 700 }}>Escalamientos</h1>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {pendientes > 0 && (
              <span style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 4, padding: '0.1rem 0.5rem', fontSize: '0.65rem', color: '#F59E0B', fontWeight: 700 }}>
                {pendientes} pend.
              </span>
            )}
            {enGestion > 0 && (
              <span style={{ background: 'rgba(80,180,255,0.12)', border: '1px solid rgba(80,180,255,0.3)', borderRadius: 4, padding: '0.1rem 0.5rem', fontSize: '0.65rem', color: '#50b4ff', fontWeight: 700 }}>
                {enGestion} en gest.
              </span>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto' }}>
          {['todos', ...ESTADOS].map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              style={{
                padding: '0.3rem 0.75rem', borderRadius: 20, fontSize: '0.65rem', fontWeight: 600,
                border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                background: filtro === f ? 'rgba(249,115,22,0.15)' : 'var(--surface)',
                color: filtro === f ? '#F97316' : 'var(--text-dim)',
              }}>
              {f === 'todos' ? 'Todos' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--phosphor)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : filtrados.length === 0 ? (
          <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '2rem', textAlign: 'center', marginTop: '1rem' }}>
            <p style={{ color: 'var(--phosphor)', fontSize: '1.8rem', marginBottom: '0.5rem' }}>✓</p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Sin escalamientos {filtro !== 'todos' ? `"${filtro}"` : 'activos'}</p>
          </div>
        ) : filtrados.map(e => {
          const est = ESTADO_COLOR[e.estado] || ESTADO_COLOR['Pendiente']
          const tipoColor = TIPO_COLOR[e.tipo] || '#9ca3af'
          return (
            <div key={e.id} style={{
              background: 'var(--surface)', borderRadius: 10, padding: '0.9rem 1rem',
              marginBottom: '0.6rem',
              borderLeft: `3px solid ${tipoColor}`,
            }}>
              {/* Tipo + Sede + Estado */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <span style={{ background: `${tipoColor}22`, border: `1px solid ${tipoColor}66`, borderRadius: 4, padding: '0.15rem 0.5rem', fontSize: '0.62rem', color: tipoColor, fontWeight: 700 }}>
                    {e.tipo || 'General'}
                  </span>
                  <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.82rem' }}>
                    {e.sede_nombre || '—'}
                  </span>
                </div>
                <span style={{ background: est.bg, borderRadius: 4, padding: '0.15rem 0.5rem', fontSize: '0.6rem', color: est.color, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {e.estado}
                </span>
              </div>

              {/* Descripción */}
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', lineHeight: 1.4, marginBottom: '0.5rem' }}>
                {e.descripcion}
              </p>

              {/* Meta */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.6rem' }}>
                {e.reportante && (
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.62rem' }}>{e.reportante}</span>
                )}
                {e.fecha_reporte && (
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.62rem' }}>
                    {format(new Date(e.fecha_reporte + 'T12:00:00'), "d MMM", { locale: es })}
                  </span>
                )}
              </div>

              {/* Cambio de estado */}
              {e.estado !== 'Resuelto' && (
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {ESTADOS.filter(s => s !== e.estado).map(s => (
                    <button key={s} onClick={() => handleEstado(e.id, s)}
                      disabled={updating === e.id}
                      style={{
                        padding: '0.3rem 0.7rem', borderRadius: 6, fontSize: '0.65rem', fontWeight: 600,
                        cursor: updating === e.id ? 'wait' : 'pointer', border: 'none',
                        background: ESTADO_COLOR[s]?.bg || 'var(--surface)',
                        color: ESTADO_COLOR[s]?.color || 'var(--text-dim)',
                        opacity: updating === e.id ? 0.5 : 1,
                      }}>
                      → {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}
