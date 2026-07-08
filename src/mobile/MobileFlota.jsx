import { useState, useEffect } from 'react'
import { getActivos, getPoes } from '../lib/queries'
import { ACTIVO_ESTADO_COLOR, DOC_ESTADO_COLOR } from '../lib/estados'
import { toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'
import SkeletonTable from '../components/SkeletonTable'
import EmptyState from '../components/EmptyState'
import { Car, FileText, ChevronLeft, AlertTriangle } from 'lucide-react'

// Flota mobile: vehículos con estado y vencimientos, y documentos/POEs.
// Lectura + alerta de vencimientos; la gestión completa vive en escritorio.

const hoy = () => new Date().toISOString().slice(0, 10)
const diasHasta = f => f ? Math.ceil((new Date(f) - new Date(hoy())) / 86400000) : null

const VENCIMIENTOS = [
  ['vencimiento_seguro', 'Seguro'],
  ['vencimiento_vtv', 'VTV'],
  ['vencimiento_senasa', 'SENASA'],
  ['vencimiento_rmtsa', 'RMTSA'],
]

function estadoVencimientos(v) {
  let peor = null
  VENCIMIENTOS.forEach(([campo]) => {
    const d = diasHasta(v[campo])
    if (d === null) return
    if (peor === null || d < peor) peor = d
  })
  return peor
}

export default function MobileFlota() {
  const [tab, setTab] = useState('vehiculos')
  const [vehiculos, setVehiculos] = useState([])
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState(null)

  useEffect(() => {
    Promise.all([getActivos({ tipo: 'VEHICULO' }), getPoes()])
      .then(([v, d]) => {
        setVehiculos((v || []).filter(a => a.tipo === 'VEHICULO'))
        setDocs(d || [])
      })
      .catch(e => toast.error(mensajeError(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonTable filas={6} columnas={2} />

  if (sel) {
    const docsVehiculo = docs.filter(d => d.activo_id === sel.id)
    return (
      <div className="mobile-scroll" style={{ padding: '0.75rem 1rem', height: '100%' }}>
        <button onClick={() => setSel(null)} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', color: 'var(--phosphor)', fontSize: '0.75rem', fontWeight: 700, padding: 0, marginBottom: 12 }}>
          <ChevronLeft size={15} /> Flota
        </button>
        <h2 style={{ color: 'var(--text)', fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{sel.nombre}</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem', margin: '4px 0 14px' }}>
          {sel.marca || ''} {sel.modelo || ''}{sel.km_actual ? ` · ${sel.km_actual} km` : ''} · {sel.sede_nombre || sel.sede || '—'}
        </p>
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '0.75rem' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', margin: '0 0 8px' }}>VENCIMIENTOS</p>
          {VENCIMIENTOS.map(([campo, label]) => {
            const d = diasHasta(sel[campo])
            if (sel[campo] === null || sel[campo] === undefined) return null
            const color = d === null ? 'var(--text-dim)' : d < 0 ? '#FF2A2A' : d <= 30 ? '#F59E0B' : '#39FF14'
            return (
              <div key={campo} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0' }}>
                <span style={{ color: 'var(--text)', fontSize: '0.75rem' }}>{label}</span>
                <span style={{ color, fontSize: '0.72rem', fontWeight: 700 }}>
                  {sel[campo]} {d !== null && (d < 0 ? `(vencido ${-d}d)` : `(${d}d)`)}
                </span>
              </div>
            )
          })}
          {!VENCIMIENTOS.some(([c]) => sel[c]) && (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem', margin: 0 }}>Sin vencimientos cargados.</p>
          )}
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '0.85rem 1rem' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', margin: '0 0 8px' }}>DOCUMENTOS / POEs ({docsVehiculo.length})</p>
          {docsVehiculo.length ? docsVehiculo.map(d => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', gap: 8 }}>
              <span style={{ color: 'var(--text)', fontSize: '0.75rem', flex: 1 }}>{d.titulo}</span>
              <span style={{ color: DOC_ESTADO_COLOR[d.estado] || 'var(--text-dim)', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {d.estado}{d.vencimiento ? ` · ${d.vencimiento}` : ''}
              </span>
            </div>
          )) : <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem', margin: 0 }}>Sin documentos asociados.</p>}
        </div>
      </div>
    )
  }

  const lista = tab === 'vehiculos' ? vehiculos : docs

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '0.75rem 1rem 0', flexShrink: 0 }}>
        <h1 style={{ color: 'var(--text)', fontSize: '1.2rem', fontWeight: 700, marginBottom: 10 }}>Flota</h1>
        <div style={{ display: 'flex', gap: 6, background: 'var(--surface)', padding: '0.2rem', borderRadius: 20 }}>
          {[['vehiculos', 'Vehículos', Car], ['docs', 'Documentos', FileText]].map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '0.4rem', borderRadius: 16, fontSize: '0.65rem', fontWeight: 700, border: 'none',
              background: tab === id ? 'rgba(57,255,20,0.15)' : 'transparent', color: tab === id ? 'var(--phosphor)' : 'var(--text-dim)',
            }}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mobile-scroll" style={{ flex: 1, padding: '0.75rem 1rem' }}>
        {tab === 'vehiculos' ? (
          !vehiculos.length ? <EmptyState icono={Car} titulo="Sin vehículos" detalle="El alta se hace desde escritorio." /> :
          vehiculos.map(v => {
            const peor = estadoVencimientos(v)
            return (
              <button key={v.id} onClick={() => setSel(v)} style={{
                width: '100%', textAlign: 'left', background: 'var(--surface)', borderRadius: 10,
                padding: '0.85rem 1rem', marginBottom: '0.6rem', border: 'none', cursor: 'pointer',
                borderLeft: `3px solid ${ACTIVO_ESTADO_COLOR[v.estado] || '#6B7280'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>{v.nombre}</p>
                  {peor !== null && peor <= 30 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: peor < 0 ? '#FF2A2A' : '#F59E0B', fontSize: '0.62rem', fontWeight: 700 }}>
                      <AlertTriangle size={11} /> {peor < 0 ? 'Doc. vencida' : `Vence en ${peor}d`}
                    </span>
                  )}
                </div>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem', margin: '3px 0 0' }}>
                  {v.marca || ''} {v.modelo || ''} · {v.estado?.replace('_', ' ') || '—'} · {v.sede_nombre || v.sede || ''}
                </p>
              </button>
            )
          })
        ) : (
          !docs.length ? <EmptyState icono={FileText} titulo="Sin documentos" detalle="Los POEs y documentos se cargan desde escritorio." /> :
          docs.map(d => (
            <div key={d.id} style={{ background: 'var(--surface)', borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '0.6rem', borderLeft: `3px solid ${DOC_ESTADO_COLOR[d.estado] || '#6B7280'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.8rem', margin: 0, flex: 1 }}>{d.titulo}</p>
                <span style={{ color: DOC_ESTADO_COLOR[d.estado] || 'var(--text-dim)', fontSize: '0.62rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{d.estado}</span>
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.66rem', margin: '3px 0 0' }}>
                {d.activo_patente || d.tipo || ''}{d.vencimiento ? ` · vence ${d.vencimiento}` : ''}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
