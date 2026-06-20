import { useState, useEffect } from 'react'
import { getSedes, getRegistrosHoy } from '../lib/queries'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const ESTADO_STYLE = {
  sin_novedades: { color: '#39FF14', bg: 'rgba(57,255,20,0.12)', label: 'Sin Novedades', dot: '#39FF14' },
  con_novedades: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Hay Novedades', dot: '#F59E0B' },
  critico:       { color: '#FF2A2A', bg: 'rgba(255,42,42,0.12)',  label: 'Op. Condicionada', dot: '#FF2A2A' },
  sin_reporte:   { color: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.04)', label: 'Sin Reporte', dot: 'rgba(255,255,255,0.2)' },
}
// Mapeo de valores DB → keys del mapa de estilos
const ESTADO_MAP = {
  'Sin novedades':          'sin_novedades',
  'Hay novedades':          'con_novedades',
  'Operación condicionada': 'critico',
}

export default function MobileSedes() {
  const [sedes, setSedes] = useState([])
  const [registrosHoy, setRegistrosHoy] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getSedes(), getRegistrosHoy()])
      .then(([s, r]) => { setSedes(s); setRegistrosHoy(r) })
      .finally(() => setLoading(false))
  }, [])

  // Para cada sede, encontrar el ultimo registro de hoy
  const sedeConEstado = sedes.map(sede => {
    const regs = registrosHoy.filter(r => r.sede_id === sede.id)
    const ultimo = regs[0] // ya ordenado desc
    return {
      ...sede,
      estadoHoy: ultimo ? (ESTADO_MAP[ultimo.estado_general] || 'sin_novedades') : 'sin_reporte',
      ultimaHora: ultimo?.fecha_reporte ? format(new Date(ultimo.fecha_reporte), 'HH:mm') : null,
      cantReportes: regs.length,
      tieneEscalamiento: regs.some(r => r.requiere_escalamiento),
      reportante: ultimo?.reportante_nombre || null,
    }
  })

  const sinReporte = sedeConEstado.filter(s => s.estadoHoy === 'sin_reporte').length
  const conProblemas = sedeConEstado.filter(s => s.estadoHoy === 'critico' || s.estadoHoy === 'con_novedades').length
  const ok = sedeConEstado.filter(s => s.estadoHoy === 'sin_novedades').length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header con resumen */}
      <div style={{ padding: '1rem 1rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h1 style={{ color: 'var(--text)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.6rem' }}>
          Estado de Sedes
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <StatChip value={ok} label="OK" color="#39FF14" />
          <StatChip value={conProblemas} label="Novedades" color="#F59E0B" />
          <StatChip value={sinReporte} label="Sin Reporte" color="rgba(255,255,255,0.3)" />
        </div>
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--phosphor)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : sedeConEstado.map(sede => {
          const st = ESTADO_STYLE[sede.estadoHoy]
          return (
            <div key={sede.id} style={{
              background: 'var(--surface)', borderRadius: 10, padding: '1rem',
              marginBottom: '0.6rem',
              borderLeft: `3px solid ${st.dot}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.95rem' }}>
                  {sede.nombre}
                </p>
                <span style={{
                  background: st.bg, color: st.color,
                  fontSize: '0.6rem', padding: '0.2rem 0.5rem', borderRadius: 4, fontWeight: 700
                }}>
                  {st.label}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {sede.ultimaHora ? (
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>
                    Ultimo reporte: {sede.ultimaHora} hs {sede.reportante ? `· ${sede.reportante}` : ''}
                  </p>
                ) : (
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>
                    Sin reporte hoy
                  </p>
                )}
                {sede.tieneEscalamiento && (
                  <span style={{ color: '#FF2A2A', fontSize: '0.65rem', fontWeight: 700 }}>⚠ Escalamiento</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatChip({ value, label, color }) {
  return (
    <div style={{
      flex: 1, background: 'var(--surface)', borderRadius: 8, padding: '0.5rem 0.25rem', textAlign: 'center',
    }}>
      <p style={{ color: color || 'var(--text)', fontWeight: 700, fontSize: '1rem', margin: 0 }}>{value ?? '—'}</p>
      <p style={{ color: 'var(--text-dim)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</p>
    </div>
  )
}
