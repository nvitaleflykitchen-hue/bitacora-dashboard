import { useState, useEffect, useCallback } from 'react'
import { getIndicadoresPorSede, getMapaCalorGestion } from '../lib/queries'
import { useAuth } from '../lib/auth'
import PageHeader from '../components/PageHeader'
import { RefreshCw } from 'lucide-react'

const PERIODOS = [
  { label: '7 días',  value: 7  },
  { label: '30 días', value: 30 },
  { label: '90 días', value: 90 },
]

const HEAT_METRICS = [
  { key:'novedades', label:'Novedades críticas', short:'Novedades', view:'escalamientos', warn:1, critical:2 },
  { key:'tareas', label:'Tareas vencidas', short:'Tareas', view:'tareas', warn:1, critical:3 },
  { key:'tickets', label:'Tickets fuera de SLA', short:'Tickets SLA', view:'mntTickets', warn:1, critical:3 },
  { key:'compras', label:'Compras fuera de SLA', short:'Compras SLA', view:'requerimientos', warn:1, critical:2 },
  { key:'capas', label:'CAPA vencidas', short:'CAPA', view:'capa', warn:1, critical:3 },
  { key:'documentacion', label:'Documentación o matafuegos vencidos', short:'Documentación', view:'flotaGestion', warn:1, critical:2 },
]

function heatStyle(value, metric) {
  if (!value) return { bg:'rgba(57,255,20,0.07)', border:'rgba(57,255,20,0.18)', color:'#39FF14', level:'Normal' }
  if (value < metric.critical) return { bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.35)', color:'#F59E0B', level:'Atención' }
  return { bg:'rgba(255,42,42,0.14)', border:'rgba(255,42,42,0.42)', color:'#FF5050', level:'Crítico' }
}

function HeatMap({ rows, periodo, onNavigate }) {
  return (
    <div className="glass rounded overflow-hidden" style={{ borderRadius:3 }}>
      <div style={{ padding:'11px 14px', borderBottom:'1px solid rgba(57,255,20,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div>
          <h2 className="font-metric font-bold text-xs tracking-widest uppercase" style={{ color:'var(--phosphor)' }}>Mapa de calor de gestión por sede</h2>
          <p style={{ color:'var(--text-dim)', fontSize:'0.62rem', marginTop:3 }}>Novedades de los últimos {periodo} días · vencimientos al día de hoy</p>
        </div>
        <div style={{ display:'flex', gap:10, fontSize:'0.6rem', color:'var(--text-dim)' }}>
          {[['#39FF14','Normal'],['#F59E0B','Atención'],['#FF5050','Crítico']].map(([color,label])=><span key={label} style={{ display:'flex', alignItems:'center', gap:4 }}><i style={{ width:7,height:7,borderRadius:2,background:color }}/>{label}</span>)}
        </div>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', minWidth:850, borderCollapse:'separate', borderSpacing:5, padding:5 }}>
          <thead>
            <tr>
              <th style={{ textAlign:'left', padding:'7px 9px', color:'var(--text-dim)', fontSize:'0.6rem', letterSpacing:'0.06em' }}>SEDE / ÁREA</th>
              {HEAT_METRICS.map(metric=><th key={metric.key} title={metric.label} style={{ padding:'7px 6px', color:'var(--text-dim)', fontSize:'0.6rem', letterSpacing:'0.04em', whiteSpace:'nowrap' }}>{metric.short.toUpperCase()}</th>)}
              <th style={{ padding:'7px 6px', color:'var(--text-dim)', fontSize:'0.6rem' }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row=><tr key={row.sede.id}>
              <td style={{ padding:'9px', color:'var(--text)', fontSize:'0.7rem', fontWeight:700, whiteSpace:'nowrap' }}>
                {row.sede.nombre}<span style={{ color:'var(--text-dim)', fontSize:'0.6rem', display:'block', marginTop:2 }}>{row.sede.tipo}</span>
              </td>
              {HEAT_METRICS.map(metric=>{
                const value=row.metricas[metric.key] || 0
                const style=heatStyle(value,metric)
                return <td key={metric.key} style={{ padding:0 }}>
                  <button onClick={()=>onNavigate?.(metric.view)} title={`${row.sede.nombre} · ${metric.label}: ${value} · ${style.level}`}
                    style={{ width:'100%', minHeight:46, borderRadius:3, border:`1px solid ${style.border}`, background:style.bg, color:style.color, cursor:'pointer', fontFamily:'monospace', fontSize:'0.82rem', fontWeight:800 }}>
                    {value}
                  </button>
                </td>
              })}
              <td style={{ textAlign:'center', color:row.total?'#FF5050':'#39FF14', fontFamily:'monospace', fontWeight:800 }}>{row.total}</td>
            </tr>)}
          </tbody>
        </table>
        {rows.length===0 && <p style={{ padding:'2rem', textAlign:'center', color:'var(--text-dim)' }}>Sin datos para mostrar.</p>}
      </div>
    </div>
  )
}

function ProgressBar({ value, max = 100, color }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const barColor = color
    || (pct >= 75 ? 'var(--phosphor)' : pct >= 40 ? 'var(--warn)' : 'var(--alert)')
  return (
    <div className="progress-bar mt-1">
      <div className="progress-fill"
        style={{ width: `${pct}%`, background: barColor,
          boxShadow: `0 0 6px ${barColor}44` }} />
    </div>
  )
}

function SedeCard({ ind }) {
  const { sede, pctCumplimiento, pctLimpias, escalamientos, totalRegs, tareasTotal, tareasResueltas } = ind
  const pctTareas = tareasTotal > 0 ? Math.round((tareasResueltas / tareasTotal) * 100) : 100

  return (
    <div className="glass hud-corner rounded p-4 fade-in" style={{ borderRadius:'3px' }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-title font-bold text-sm" style={{ color:'var(--text)' }}>{sede.nombre}</p>
          <span className="chip chip-gray" style={{ fontSize:'0.6rem', marginTop:2 }}>{sede.tipo}</span>
        </div>
        <span className="kpi-value" style={{ fontSize:'1.4rem' }}>{pctCumplimiento}%</span>
      </div>

      {/* Cumplimiento de carga */}
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <span className="font-metric text-xs" style={{ color:'var(--text-dim)', fontSize:'0.62rem' }}>
            CUMPLIMIENTO CARGA
          </span>
          <span className="font-metric text-xs" style={{ color:'var(--phosphor)', fontSize:'0.68rem' }}>
            {pctCumplimiento}%
          </span>
        </div>
        <ProgressBar value={pctCumplimiento} />
      </div>

      {/* Operaciones limpias */}
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <span className="font-metric text-xs" style={{ color:'var(--text-dim)', fontSize:'0.62rem' }}>
            OPS. LIMPIAS
          </span>
          <span className="font-metric text-xs" style={{ color: pctLimpias >= 70 ? 'var(--phosphor)' : pctLimpias >= 40 ? 'var(--warn)' : 'var(--alert)', fontSize:'0.68rem' }}>
            {pctLimpias}%
          </span>
        </div>
        <ProgressBar value={pctLimpias} />
      </div>

      {/* Resolución de tareas */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <span className="font-metric text-xs" style={{ color:'var(--text-dim)', fontSize:'0.62rem' }}>
            TAREAS RESUELTAS
          </span>
          <span className="font-metric text-xs" style={{ color:'var(--text-dim)', fontSize:'0.68rem' }}>
            {tareasResueltas}/{tareasTotal}
          </span>
        </div>
        <ProgressBar value={pctTareas} />
      </div>

      {/* Stats pequeños */}
      <div className="grid grid-cols-3 gap-2 pt-3"
        style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
        {[
          { label:'Registros', value: totalRegs },
          { label:'Escalamientos', value: escalamientos, alert: escalamientos > 0 },
          { label:'Tareas', value: tareasTotal },
        ].map(({ label, value, alert }) => (
          <div key={label} className="text-center">
            <p className="font-metric font-bold text-base"
              style={{ color: alert ? 'var(--alert)' : 'var(--text)', lineHeight:1 }}>{value}</p>
            <p className="font-metric" style={{ fontSize:'0.6rem', color:'var(--text-dim)', marginTop:2, letterSpacing:'0.06em' }}>
              {label.toUpperCase()}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Indicadores({ onNavigate }) {
  const { allowedSedeIds } = useAuth()
  const [datos, setDatos]   = useState([])
  const [periodo, setPeriodo] = useState(30)
  const [loading, setLoading] = useState(true)
  const [mapaCalor, setMapaCalor] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [indicadores, heatmap] = await Promise.all([
        getIndicadoresPorSede(periodo, allowedSedeIds),
        getMapaCalorGestion(periodo, allowedSedeIds),
      ])
      setDatos(indicadores)
      setMapaCalor(heatmap)
    }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [periodo, allowedSedeIds])

  useEffect(() => { load() }, [load])

  // Globales
  const totalRegs    = datos.reduce((a, d) => a + d.totalRegs, 0)
  const totalEscals  = datos.reduce((a, d) => a + d.escalamientos, 0)
  const avgCumpl     = datos.length > 0 ? Math.round(datos.reduce((a, d) => a + d.pctCumplimiento, 0) / datos.length) : 0
  const avgLimpias   = datos.length > 0 ? Math.round(datos.reduce((a, d) => a + d.pctLimpias, 0) / datos.length) : 0

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 fade-in">
      {/* Header */}
      <PageHeader title="Indicadores" subtitle="KPIs operativos por sede · ISO 9001">
        <div className="flex items-center gap-2">
          {/* Selector de periodo */}
          <div className="flex rounded overflow-hidden" style={{ border:'1px solid rgba(57,255,20,0.15)' }}>
            {PERIODOS.map(p => (
              <button key={p.value} onClick={() => setPeriodo(p.value)}
                className="font-metric px-3 py-1.5 text-xs transition-all"
                style={{
                  background: periodo === p.value ? 'rgba(57,255,20,0.15)' : 'transparent',
                  color: periodo === p.value ? 'var(--phosphor)' : 'var(--text-dim)',
                  borderRight: p.value !== 90 ? '1px solid rgba(57,255,20,0.08)' : undefined,
                  fontSize:'0.68rem', letterSpacing:'0.04em',
                }}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={load} className="btn-ghost flex items-center gap-1.5" style={{ padding:'0.35rem 0.75rem' }}>
            <RefreshCw size={11} /> Actualizar
          </button>
        </div>
      </PageHeader>

      {/* KPIs globales */}
      {!loading && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label:'Registros totales', value: totalRegs },
            { label:'Escalamientos', value: totalEscals, alert: totalEscals > 0 },
            { label:'Cumpl. promedio', value: `${avgCumpl}%` },
            { label:'Ops. limpias promedio', value: `${avgLimpias}%` },
          ].map(({ label, value, alert }) => (
            <div key={label} className="kpi-card">
              <p className="kpi-value" style={alert ? { color:'var(--alert)' } : {}}>{value}</p>
              <p className="kpi-label">{label}</p>
            </div>
          ))}
        </div>
      )}

      {!loading && <HeatMap rows={mapaCalor} periodo={periodo} onNavigate={onNavigate}/>} 

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor:'var(--phosphor)', borderTopColor:'transparent' }} />
        </div>
      ) : (
        <>
          {/* Cards por sede */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {datos.map(ind => <SedeCard key={ind.sede.id} ind={ind} />)}
            {datos.length === 0 && (
              <p className="col-span-3 text-center py-10" style={{ color:'var(--text-dim)' }}>
                Sin sedes activas
              </p>
            )}
          </div>

          {/* Tabla resumen global */}
          {datos.length > 0 && (
            <div className="glass rounded overflow-hidden" style={{ borderRadius:'3px' }}>
              <div className="px-4 py-3" style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
                <h2 className="font-metric font-bold text-xs tracking-widest uppercase" style={{ color:'var(--phosphor)' }}>
                  Tabla resumen global
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="table-dark w-full">
                  <thead>
                    <tr>
                      <th>Sede</th>
                      <th>Registros</th>
                      <th>% Cumplimiento</th>
                      <th>% Limpias</th>
                      <th>Escalamientos</th>
                      <th>Tareas</th>
                      <th className="hidden lg:table-cell">T. Resol. (días)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.map(({ sede, totalRegs, pctCumplimiento, pctLimpias, escalamientos, tareasTotal, tareasResueltas, tiempoMedioResolucion }) => (
                      <tr key={sede.id}>
                        <td style={{ color:'var(--text)', fontWeight:500 }}>{sede.nombre}</td>
                        <td className="font-metric" style={{ color:'var(--text-dim)' }}>{totalRegs}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-metric text-xs" style={{ color: pctCumplimiento >= 75 ? 'var(--phosphor)' : pctCumplimiento >= 40 ? 'var(--warn)' : 'var(--alert)', minWidth:36 }}>
                              {pctCumplimiento}%
                            </span>
                            <div style={{ flex:1, minWidth:60 }}>
                              <ProgressBar value={pctCumplimiento} />
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-metric text-xs" style={{ color: pctLimpias >= 75 ? 'var(--phosphor)' : pctLimpias >= 40 ? 'var(--warn)' : 'var(--alert)', minWidth:36 }}>
                              {pctLimpias}%
                            </span>
                            <div style={{ flex:1, minWidth:60 }}>
                              <ProgressBar value={pctLimpias} />
                            </div>
                          </div>
                        </td>
                        <td>
                          {escalamientos > 0
                            ? <span className="chip chip-red">{escalamientos}</span>
                            : <span className="chip chip-green">0</span>}
                        </td>
                        <td className="font-metric" style={{ color:'var(--text-dim)' }}>
                          {tareasResueltas}/{tareasTotal}
                        </td>
                        <td className="hidden lg:table-cell font-metric" style={{ color:'var(--text-dim)' }}>
                          {tiempoMedioResolucion != null ? `${tiempoMedioResolucion}d` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
