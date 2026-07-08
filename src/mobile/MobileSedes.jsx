import { useState, useEffect } from 'react'
import { getSedes, getRegistrosHoy, getRegistroById, getRegistrosBySede } from '../lib/queries'
import RegistroModal from '../components/RegistroModal'
import { format } from 'date-fns'
import { ChevronRight, ChevronLeft, AlertTriangle, RefreshCw } from 'lucide-react'

const ESTADO_STYLE = {
  sin_novedades: { color: '#39FF14', bg: 'rgba(57,255,20,0.12)', label: 'Sin Novedades', dot: '#39FF14' },
  con_novedades: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Hay Novedades', dot: '#F59E0B' },
  critico:       { color: '#FF2A2A', bg: 'rgba(255,42,42,0.12)',  label: 'Op. Condicionada', dot: '#FF2A2A' },
  sin_reporte:   { color: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.04)', label: 'Sin Reporte', dot: 'rgba(255,255,255,0.2)' },
}
const ESTADO_MAP = {
  'Sin novedades':          'sin_novedades',
  'Hay novedades':          'con_novedades',
  'Operación condicionada': 'critico',
}

const ESTADO_CHIP = {
  'Sin novedades':          { bg: 'rgba(57,255,20,0.12)',  color: '#39FF14' },
  'Hay novedades':          { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
  'Operación condicionada': { bg: 'rgba(255,42,42,0.12)',  color: '#FF2A2A' },
}

export default function MobileSedes() {
  const [sedes, setSedes] = useState([])
  const [registrosHoy, setRegistrosHoy] = useState([])
  const [loading, setLoading] = useState(true)

  // Vista detalle de sede
  const [selectedSede, setSelectedSede] = useState(null)
  const [sedeRegistros, setSedeRegistros] = useState([])
  const [loadingRegistros, setLoadingRegistros] = useState(false)
  const [diasFiltro, setDiasFiltro] = useState(30)

  // Modal de registro
  const [selRegistro, setSelRegistro] = useState(null)

  // Deep-link desde notificación
  const [deepLinkRegistro, setDeepLinkRegistro] = useState(null)

  useEffect(() => {
    Promise.all([getSedes(), getRegistrosHoy()])
      .then(([s, r]) => { setSedes(s); setRegistrosHoy(r) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handleDeepLink = async (e) => {
      const { tipo, id } = e.detail || {}
      if (tipo !== 'registro' || !id) return
      try {
        const registro = await getRegistroById(id)
        if (registro) setDeepLinkRegistro(registro)
      } catch (_) {}
      delete window.__pendingDeepLink
    }
    window.addEventListener('bitacora:deeplink', handleDeepLink)
    const dl = window.__pendingDeepLink
    if (dl?.tipo === 'registro' && dl?.id) handleDeepLink({ detail: dl })
    return () => window.removeEventListener('bitacora:deeplink', handleDeepLink)
  }, [])

  // Abrir detalle de sede y cargar sus registros
  const openSede = async (sede, dias = diasFiltro) => {
    setSelectedSede(sede)
    setSedeRegistros([])
    setLoadingRegistros(true)
    try {
      const regs = await getRegistrosBySede(sede.id, dias)
      setSedeRegistros(regs || [])
    } catch (_) {}
    setLoadingRegistros(false)
  }

  const cambiarDias = (d) => {
    setDiasFiltro(d)
    if (selectedSede) openSede(selectedSede, d)
  }

  const sedeConEstado = sedes.map(sede => {
    const regs = registrosHoy.filter(r => r.sede_id === sede.id)
    const ultimo = regs[0]
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

  // ── VISTA DETALLE DE SEDE ──────────────────────────────────────────
  if (selectedSede) {
    const stSede = ESTADO_STYLE[sedeConEstado.find(s => s.id === selectedSede.id)?.estadoHoy || 'sin_reporte']
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header detalle */}
        <div style={{ padding: '0.85rem 1rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
            <button
              onClick={() => { setSelectedSede(null); setSedeRegistros([]) }}
              style={{ background: 'none', border: 'none', color: 'var(--phosphor)', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.75rem', fontWeight: 700 }}
            >
              <ChevronLeft size={16} /> Sedes
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ color: 'var(--text)', fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{selectedSede.nombre}</h1>
              {selectedSede.tipo && <p style={{ color: 'var(--text-dim)', fontSize: '0.65rem', marginTop: 2 }}>{selectedSede.tipo}</p>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: stSede.bg, color: stSede.color, fontSize: '0.58rem', padding: '0.2rem 0.5rem', borderRadius: 4, fontWeight: 700 }}>
                {stSede.label}
              </span>
              <button
                onClick={() => openSede(selectedSede)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', padding: 2, cursor: 'pointer' }}
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>
          {/* Filtro de días */}
          <div style={{ display: 'flex', gap: 6, marginTop: '0.65rem' }}>
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => cambiarDias(d)}
                style={{
                  padding: '0.2rem 0.55rem', fontSize: '0.6rem', fontWeight: 700,
                  borderRadius: 5, cursor: 'pointer',
                  background: diasFiltro === d ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.05)',
                  border: diasFiltro === d ? '1px solid rgba(57,255,20,0.35)' : '1px solid rgba(255,255,255,0.08)',
                  color: diasFiltro === d ? 'var(--phosphor)' : 'var(--text-dim)',
                }}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Lista de registros */}
        <div className="mobile-scroll" style={{ flex: 1, padding: '0.75rem 1rem' }}>
          {loadingRegistros ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--phosphor)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : sedeRegistros.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center', paddingTop: '3rem' }}>
              Sin registros en los últimos {diasFiltro} días.
            </p>
          ) : sedeRegistros.map(r => {
            const chip = ESTADO_CHIP[r.estado_general] || { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-dim)' }
            return (
              <button
                key={r.id}
                onClick={() => setSelRegistro(r)}
                style={{
                  width: '100%', textAlign: 'left',
                  background: r.requiere_escalamiento ? 'rgba(255,42,42,0.06)' : 'var(--surface)',
                  border: r.requiere_escalamiento ? '1px solid rgba(255,42,42,0.25)' : '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 10, padding: '0.85rem 1rem',
                  marginBottom: '0.5rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                }}
              >
                {/* Fecha */}
                <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 40 }}>
                  <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem', lineHeight: 1, margin: 0 }}>
                    {format(new Date(r.fecha_reporte), 'dd')}
                  </p>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.6rem', textTransform: 'uppercase', margin: 0 }}>
                    {format(new Date(r.fecha_reporte), 'MMM')}
                  </p>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.58rem', margin: 0 }}>
                    {format(new Date(r.fecha_reporte), 'HH:mm')}
                  </p>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                    <span style={{ background: chip.bg, color: chip.color, fontSize: '0.58rem', padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 700 }}>
                      {r.estado_general || '—'}
                    </span>
                    {r.turno && (
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.62rem' }}>Turno {r.turno}</span>
                    )}
                    {r.requiere_escalamiento && (
                      <AlertTriangle size={11} style={{ color: '#FF2A2A', flexShrink: 0 }} />
                    )}
                  </div>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.reportante_nombre || r.reportante || 'Sin reportante'}
                  </p>
                </div>

                <ChevronRight size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              </button>
            )
          })}
        </div>

        {/* Modal de registro */}
        {selRegistro && (
          <RegistroModal
            registro={selRegistro}
            onClose={() => setSelRegistro(null)}
          />
        )}

        {/* Deep-link modal */}
        {deepLinkRegistro && (
          <RegistroModal
            registro={deepLinkRegistro}
            onClose={() => setDeepLinkRegistro(null)}
          />
        )}
      </div>
    )
  }

  // ── VISTA PRINCIPAL: LISTA DE SEDES ───────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
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

      {/* Lista de sedes */}
      <div className="mobile-scroll" style={{ flex: 1, padding: '0.75rem 1rem' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--phosphor)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : sedeConEstado.map(sede => {
          const st = ESTADO_STYLE[sede.estadoHoy]
          return (
            <button
              key={sede.id}
              onClick={() => openSede(sede)}
              style={{
                width: '100%', textAlign: 'left',
                background: 'var(--surface)', borderRadius: 10, padding: '1rem',
                marginBottom: '0.6rem', cursor: 'pointer',
                border: `1px solid rgba(255,255,255,0.05)`,
                borderLeft: `3px solid ${st.dot}`,
                display: 'flex', alignItems: 'center', gap: '0.75rem',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>
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
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem', margin: 0 }}>
                      Último: {sede.ultimaHora} hs{sede.reportante ? ` · ${sede.reportante}` : ''}
                    </p>
                  ) : (
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem', margin: 0 }}>
                      Sin reporte hoy
                    </p>
                  )}
                  {sede.tieneEscalamiento && (
                    <span style={{ color: '#FF2A2A', fontSize: '0.65rem', fontWeight: 700 }}>⚠ Escalamiento</span>
                  )}
                </div>
              </div>
              <ChevronRight size={15} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            </button>
          )
        })}
      </div>

      {/* Deep-link modal */}
      {deepLinkRegistro && (
        <RegistroModal
          registro={deepLinkRegistro}
          onClose={() => setDeepLinkRegistro(null)}
        />
      )}
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
