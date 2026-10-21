import React, { useEffect, useState } from 'react'
import { getVehiculoNovedadesByRegistro } from '../lib/queries'

// Compartido por el detalle desktop/mobile, el turno anterior y la ficha de sede.
export default function RegistroVehiculos({ registroId, compact = false }) {
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setResult(null)
    getVehiculoNovedadesByRegistro(registroId).then(
      rows => { if (active) setResult({ id: registroId, rows }) },
      () => { if (active) setResult({ id: registroId, error: true }) },
    )
    return () => { active = false }
  }, [registroId, attempt])

  const current = result?.id === registroId ? result : null
  if (!current) return <p role="status">Cargando novedades de vehículos…</p>
  if (current.error) return <div role="alert">
    No se pudieron cargar las novedades de vehículos.{' '}
    <button type="button" onClick={event => { event.stopPropagation(); setAttempt(value => value + 1) }}>Reintentar</button>
  </div>
  if (!current.rows.length) return null
  return <section aria-label="Novedades de vehículos" style={{ margin: '0.6rem 0', fontSize: compact ? '0.8rem' : undefined }}>
    <h3 style={{ color: '#60a5fa', fontSize: '0.8rem', marginBottom: 8 }}>Novedades de vehículos</h3>
    {current.rows.map(row => <div key={row.id} style={{ padding: compact ? '4px 0' : 12, marginBottom: 6, background: compact ? undefined : 'rgba(59,130,246,0.08)', borderRadius: 6 }}>
      <strong>{row.activo_nombre || 'Vehículo'}</strong> · {row.tipo || 'Novedad'}
      <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '4px 0' }}>{row.descripcion || 'Sin descripción'}</p>
      <small style={{ color: 'var(--text-dim)' }}>{[row.estado, row.fecha_reporte].filter(Boolean).join(' · ')}</small>
    </div>)}
  </section>
}
