import { useState, useEffect, useCallback } from 'react'
import { getRegistrosHoy, getRegistrosBySede, getEscalamientosItems, getTareas, getSedes } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { fmtFecha, fmtFechaReporte, fmtHoraReporte } from '../lib/dateUtils'
import RegistroModal from '../components/RegistroModal'
import { RefreshCw, FileText, AlertTriangle, CheckSquare, TrendingUp } from 'lucide-react'

const ESTADO_CHIP = {
  'Sin novedades':          { cls: 'chip-green',  short: 'OK' },
  'Hay novedades':          { cls: 'chip-yellow', short: 'Nov.' },
  'Operación condicionada': { cls: 'chip-red',    short: 'Cond.' },
}

const MOD_KEYS = ['a','b','c','d','e','f','g','h']
const MOD_LABELS = {
  a:'Producción', b:'Cadena frío', c:'Recepción', d:'Stock',
  e:'Equipos', f:'Higiene', g:'Personal', h:'Cliente',
}

function KpiCard({ value, label, color, borderColor }) {
  return (
    <div className="kpi-card" style={{ borderColor: borderColor || 'rgba(57,255,20,0.12)' }}>
      <p className="kpi-value" style={{ color: color || 'var(--phosphor)', fontSize: '1.6rem' }}>{value}</p>
      <p className="kpi-label">{label}</p>
    </div>
  )
}

export default function SedeEncargadoView({ onNavigate }) {
  const { allowedSedeIds, perfil } = useAuth()
  const [sede,         setSede]         = useState(null)
  const [registrosHoy, setRegistrosHoy] = useState([])
  const [historial,    setHistorial]    = useState([])
  const [escalas,      setEscalas]      = useState([])
  const [tareas,       setTareas]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [selRegistro,  setSelRegistro]  = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sedes = await getSedes(allowedSedeIds)
      const s = sedes[0]
      setSede(s)
      if (!s) return

      const [hoy, hist, esc, tar] = await Promise.all([
        getRegistrosHoy(allowedSedeIds),
        getRegistrosBySede(s.id, 30),
        getEscalamientosItems({ sedeIds: allowedSedeIds }),
        getTareas({ sedeIds: allowedSedeIds }),
      ])
      setRegistrosHoy(hoy)
      setHistorial(hist)
      setEscalas(esc.filter(e => e.estado !== 'Resuelto'))
      setTareas(tar.filter(t => t.estado !== 'Resuelto' && t.estado !== 'Cancelado'))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [allowedSedeIds])

  useEffect(() => { load() }, [load])

  const ultimoHoy   = registrosHoy[0]
  const estadoActual = ultimoHoy?.estado_general
  const chipActual   = ESTADO_CHIP[estadoActual] || { cls: 'chip-gray', short: '—' }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="w-8 h-8 rounded-full border-2 mx-auto animate-spin"
        style={{ borderColor:'var(--phosphor)', borderTopColor:'transparent' }} />
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 fade-in">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-title font-bold text-xl" style={{ color:'var(--text)' }}>
            {sede?.nombre || 'Mi Sede'}
          </h1>
          <p className="font-metric text-xs mt-0.5" style={{ color:'var(--text-dim)' }}>
            Panel de encargado · {new Date().toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {estadoActual && (
            <span className={`chip ${chipActual.cls}`} style={{ fontSize:'0.7rem' }}>{estadoActual}</span>
          )}
          <button onClick={load} className="btn-ghost flex items-center gap-1.5" style={{ padding:'0.35rem 0.75rem' }}>
            <RefreshCw size={11} /> Actualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard value={registrosHoy.length} label="Reportes hoy"
          color={registrosHoy.length > 0 ? 'var(--phosphor)' : 'var(--text-dim)'}
          borderColor={registrosHoy.length > 0 ? 'rgba(57,255,20,0.2)' : undefined} />
        <KpiCard value={escalas.length} label="Escalamientos activos"
          color={escalas.length > 0 ? 'var(--alert)' : 'var(--phosphor)'}
          borderColor={escalas.length > 0 ? 'rgba(255,42,42,0.25)' : undefined} />
        <KpiCard value={tareas.length} label="Tareas pendientes"
          color={tareas.length > 0 ? 'var(--warn)' : 'var(--phosphor)'}
          borderColor={tareas.length > 0 ? 'rgba(245,158,11,0.25)' : undefined} />
        <KpiCard value={historial.length} label="Reportes 30d"
          color="var(--phosphor)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Reportes de hoy */}
        <div className="glass rounded space-y-0" style={{ borderRadius:'3px' }}>
          <div className="px-4 py-3 flex items-center gap-2"
            style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
            <FileText size={13} style={{ color:'var(--phosphor)' }} />
            <h2 className="font-metric font-bold text-xs tracking-widest uppercase" style={{ color:'var(--phosphor)' }}>
              Reportes de hoy ({registrosHoy.length})
            </h2>
          </div>
          {registrosHoy.length === 0 ? (
            <p className="px-4 py-6 text-center font-metric text-xs" style={{ color:'var(--text-dim)' }}>
              Sin reportes aún
            </p>
          ) : registrosHoy.map(r => {
            const chip = ESTADO_CHIP[r.estado_general] || { cls:'chip-gray', short:'?' }
            const novedades = MOD_KEYS.filter(k => r[`estado_${k}`] && r[`estado_${k}`] !== 'Sin novedad')
            return (
              <div key={r.id}
                className="px-4 py-3 cursor-pointer hover:opacity-80 transition-opacity"
                style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}
                onClick={() => setSelRegistro(r)}>
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{ color:'var(--text)', fontWeight:600, fontSize:'0.85rem' }}>
                      Turno {r.turno}
                    </p>
                    <p style={{ color:'var(--text-dim)', fontSize:'0.72rem', marginTop:2 }}>
                      {r.reportante} · {fmtHoraReporte(r.fecha_reporte)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`chip ${chip.cls}`} style={{ fontSize:'0.6rem' }}>{r.estado_general}</span>
                    {r.requiere_escalamiento && (
                      <span style={{ color:'#FF2A2A', fontSize:'0.6rem', fontWeight:700 }}>⚠ Esc.</span>
                    )}
                  </div>
                </div>
                {novedades.length > 0 && (
                  <p style={{ color:'var(--text-dim)', fontSize:'0.65rem', marginTop:4 }}>
                    Módulos: {novedades.map(k => MOD_LABELS[k]).join(', ')}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Escalamientos activos */}
        <div className="glass rounded" style={{ borderRadius:'3px' }}>
          <div className="px-4 py-3 flex items-center gap-2"
            style={{ borderBottom:'1px solid rgba(255,42,42,0.1)' }}>
            <AlertTriangle size={13} style={{ color:'var(--alert)' }} />
            <h2 className="font-metric font-bold text-xs tracking-widest uppercase" style={{ color:'var(--alert)' }}>
              Escalamientos activos ({escalas.length})
            </h2>
          </div>
          {escalas.length === 0 ? (
            <p className="px-4 py-6 text-center font-metric text-xs" style={{ color:'var(--phosphor)' }}>
              ✓ Sin escalamientos activos
            </p>
          ) : escalas.map(e => (
            <div key={e.id} className="px-4 py-3 cursor-pointer hover:opacity-80"
              style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}
              onClick={() => e.registro_id && setSelRegistro({ id: e.registro_id })}>
              <div className="flex items-start justify-between gap-2">
                <div style={{ flex: 1 }}>
                  <p style={{ color:'var(--text)', fontWeight:600, fontSize:'0.82rem' }}>
                    [{e.tipo || 'General'}]
                  </p>
                  <p style={{ color:'var(--text-dim)', fontSize:'0.72rem', marginTop:2, lineHeight:1.4 }}>
                    {e.descripcion}
                  </p>
                  <p style={{ color:'var(--text-dim)', fontSize:'0.65rem', marginTop:3 }}>
                    {fmtFecha(e.fecha_reporte + 'T12:00:00')} · {e.reportante}
                  </p>
                </div>
                <span className={`chip ${e.estado === 'Pendiente' ? 'chip-yellow' : 'chip-blue'}`}
                  style={{ fontSize:'0.6rem', flexShrink:0 }}>
                  {e.estado}
                </span>
              </div>
            </div>
          ))}
          {escalas.length > 0 && (
            <div className="px-4 py-3">
              <button onClick={() => onNavigate?.('escalamientos')}
                className="btn-ghost w-full text-center" style={{ padding:'0.35rem', fontSize:'0.7rem' }}>
                Ver todos los escalamientos →
              </button>
            </div>
          )}
        </div>

        {/* Tareas pendientes */}
        <div className="glass rounded" style={{ borderRadius:'3px' }}>
          <div className="px-4 py-3 flex items-center gap-2"
            style={{ borderBottom:'1px solid rgba(245,158,11,0.12)' }}>
            <CheckSquare size={13} style={{ color:'var(--warn)' }} />
            <h2 className="font-metric font-bold text-xs tracking-widest uppercase" style={{ color:'var(--warn)' }}>
              Tareas pendientes ({tareas.length})
            </h2>
          </div>
          {tareas.length === 0 ? (
            <p className="px-4 py-6 text-center font-metric text-xs" style={{ color:'var(--phosphor)' }}>
              ✓ Sin tareas pendientes
            </p>
          ) : tareas.slice(0, 8).map(t => (
            <div key={t.id} className="px-4 py-3"
              style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-start justify-between gap-2">
                <div style={{ flex:1 }}>
                  <p style={{ color:'var(--text)', fontWeight:500, fontSize:'0.82rem' }}>{t.titulo}</p>
                  {t.fecha_limite && (
                    <p style={{ color: new Date(t.fecha_limite) < new Date() ? '#FF2A2A' : 'var(--text-dim)', fontSize:'0.65rem', marginTop:2 }}>
                      Vence: {fmtFecha(t.fecha_limite)}
                    </p>
                  )}
                </div>
                <span className={`chip ${t.estado === 'En proceso' ? 'chip-blue' : 'chip-yellow'}`}
                  style={{ fontSize:'0.6rem', flexShrink:0 }}>
                  {t.estado}
                </span>
              </div>
            </div>
          ))}
          {tareas.length > 0 && (
            <div className="px-4 py-3">
              <button onClick={() => onNavigate?.('tareas')}
                className="btn-ghost w-full text-center" style={{ padding:'0.35rem', fontSize:'0.7rem' }}>
                Ver todas las tareas →
              </button>
            </div>
          )}
        </div>

        {/* Historial 30d */}
        <div className="glass rounded" style={{ borderRadius:'3px' }}>
          <div className="px-4 py-3 flex items-center gap-2"
            style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
            <TrendingUp size={13} style={{ color:'var(--phosphor)' }} />
            <h2 className="font-metric font-bold text-xs tracking-widest uppercase" style={{ color:'var(--text-dim)' }}>
              Historial · últimos 30 días ({historial.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table-dark w-full">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Turno</th>
                  <th>Estado</th>
                  <th>Reportante</th>
                </tr>
              </thead>
              <tbody>
                {historial.slice(0, 20).map(r => {
                  const chip = ESTADO_CHIP[r.estado_general] || { cls:'chip-gray' }
                  return (
                    <tr key={r.id} className="cursor-pointer hover:opacity-80" onClick={() => setSelRegistro(r)}>
                      <td style={{ color:'var(--text)', fontSize:'0.75rem' }}>{fmtFechaReporte(r.fecha_reporte)}</td>
                      <td style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>{r.turno}</td>
                      <td><span className={`chip ${chip.cls}`} style={{ fontSize:'0.6rem' }}>{r.estado_general}</span></td>
                      <td style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>{r.reportante}</td>
                    </tr>
                  )
                })}
                {historial.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-6" style={{ color:'var(--text-dim)', fontSize:'0.8rem' }}>Sin registros</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {selRegistro && (
        <RegistroModal
          registro={selRegistro}
          onClose={() => setSelRegistro(null)}
          onCreateTarea={() => setSelRegistro(null)}
        />
      )}
    </div>
  )
}
