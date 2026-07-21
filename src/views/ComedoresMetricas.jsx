import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '../lib/auth'
import PageHeader from '../components/PageHeader'
import { getComedoresMetricas } from '../lib/queries'

const PERIODOS = [
  { label:'7 días', value:7 },
  { label:'30 días', value:30 },
  { label:'90 días', value:90 },
]

const pctColor = pct => {
  if (pct >= 12) return 'var(--alert)'
  if (pct >= 6) return 'var(--warn)'
  return 'var(--phosphor)'
}

const fmt = value => Number(value || 0).toLocaleString('es-AR')
const fmtDate = value => value ? new Date(value).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'

function ProgressBar({ value, color }) {
  const pct = Math.min(100, Math.max(0, Number(value || 0)))
  return (
    <div className="progress-bar mt-1">
      <div className="progress-fill" style={{ width:`${pct}%`, background:color, boxShadow:`0 0 6px ${color}55` }} />
    </div>
  )
}

function Kpi({ label, value, sub, color }) {
  return (
    <div className="kpi-card">
      <p className="kpi-value" style={{ color:color || 'var(--phosphor)' }}>{value}</p>
      <p className="kpi-label">{label}</p>
      {sub && <p className="text-xs mt-2" style={{ color:'var(--text-dim)' }}>{sub}</p>}
    </div>
  )
}

function CategoriaCard({ categoria }) {
  const color = pctColor(categoria.pctSobrante)
  return (
    <div className="glass rounded p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-title font-bold text-sm" style={{ color:'var(--text)' }}>{categoria.label}</p>
          <p className="text-xs mt-1" style={{ color:'var(--text-dim)' }}>
            {fmt(categoria.servido)} servidas · {fmt(categoria.reutilizable)} reutilizables · {fmt(categoria.descarte)} descarte
          </p>
          {categoria.sinDiscriminar > 0 && <p className="text-xs mt-1" style={{ color:'var(--warn)' }}>{fmt(categoria.sinDiscriminar)} sobrantes históricos sin discriminar</p>}
        </div>
        <span className="font-metric font-bold text-lg" style={{ color }}>{categoria.pctSobrante}%</span>
      </div>
      <ProgressBar value={categoria.pctSobrante} color={color} />
    </div>
  )
}

export default function ComedoresMetricas() {
  const { allowedSedeIds } = useAuth()
  const [periodo, setPeriodo] = useState(30)
  const [datos, setDatos] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sedeFilter, setSedeFilter] = useState('todas')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDatos(await getComedoresMetricas(periodo, allowedSedeIds))
    } catch (err) {
      console.error(err)
      setError('No se pudieron cargar las métricas de comedores.')
    } finally {
      setLoading(false)
    }
  }, [periodo, allowedSedeIds])

  useEffect(() => { load() }, [load])

  const sedes = datos?.porSede || []
  const movimientos = useMemo(() => {
    if (!datos?.movimientos) return []
    return datos.movimientos
      .filter(item => sedeFilter === 'todas' || String(item.sedeId) === sedeFilter)
      .slice(0, 25)
  }, [datos, sedeFilter])

  const global = datos?.global || { producido:0, servido:0, sobrante:0, reutilizable:0, descarte:0, sinDiscriminar:0, pctSobrante:0, pctServido:0, pctDescarte:0, pctReutilizado:0, registros:0, comedores:0 }
  const sobranteColor = pctColor(global.pctSobrante)

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 fade-in">
      <PageHeader title="Métricas de comedores" subtitle="Producido vs servido/vendido vs sobrante, tomado de los reportes mobile.">
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex rounded overflow-hidden" style={{ border:'1px solid rgba(57,255,20,0.15)' }}>
            {PERIODOS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriodo(p.value)}
                className="font-metric px-3 py-1.5 text-xs transition-all"
                style={{
                  background: periodo === p.value ? 'rgba(57,255,20,0.15)' : 'transparent',
                  color: periodo === p.value ? 'var(--phosphor)' : 'var(--text-dim)',
                  borderRight: p.value !== 90 ? '1px solid rgba(57,255,20,0.08)' : undefined,
                  fontSize:'0.68rem',
                  letterSpacing:'0.04em',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={load} className="btn-ghost flex items-center gap-1.5" style={{ padding:'0.35rem 0.75rem' }} disabled={loading}>
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </PageHeader>

      {error && <div className="rounded p-3" role="alert" style={{ color:'var(--alert)', border:'1px solid rgba(255,42,42,0.25)' }}>{error}</div>}

      {!loading && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <Kpi label="Producido" value={fmt(global.producido)} />
          <Kpi label="Servido / vendido" value={fmt(global.servido)} sub={`${global.pctServido}% sobre producido`} />
          <Kpi label="Sobrante" value={fmt(global.sobrante)} color={sobranteColor} sub={`${global.pctSobrante}% sobre producido`} />
          <Kpi label="Reutilizable" value={fmt(global.reutilizable)} sub={`${global.pctReutilizado}% del sobrante total`} />
          <Kpi label="Descarte" value={fmt(global.descarte)} color="var(--alert)" sub={`${global.pctDescarte}% sobre producido`} />
          <Kpi label="Sin discriminar" value={fmt(global.sinDiscriminar)} color="var(--warn)" sub="Reportes anteriores" />
          <Kpi label="Comedores" value={fmt(global.comedores)} />
          <Kpi label="Reportes con raciones" value={fmt(global.registros)} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor:'var(--phosphor)', borderTopColor:'transparent' }} />
        </div>
      ) : global.registros === 0 ? (
        <div className="glass rounded p-8 text-center">
          <p style={{ color:'var(--text)', fontWeight:700 }}>Sin datos de raciones para el período.</p>
          <p className="text-sm mt-2" style={{ color:'var(--text-dim)' }}>
            Solo se contabilizan reportes mobile donde se cargó producido, servido o sobrante.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {(datos?.porCategoria || []).map(categoria => <CategoriaCard key={categoria.key} categoria={categoria} />)}
          </div>

          <div className="glass rounded overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
              <div>
                <h2 className="font-metric font-bold text-xs tracking-widest uppercase" style={{ color:'var(--phosphor)' }}>
                  Ranking por comedor
                </h2>
                <p style={{ color:'var(--text-dim)', fontSize:'0.62rem', marginTop:3 }}>
                  Ordenado por mayor porcentaje de sobrante.
                </p>
              </div>
              <select className="input-dark" style={{ width:260 }} value={sedeFilter} onChange={event => setSedeFilter(event.target.value)}>
                <option value="todas">Todos los comedores</option>
                {sedes.map(sede => <option key={sede.sedeId} value={String(sede.sedeId)}>{sede.sedeNombre}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="table-dark w-full">
                <thead>
                  <tr>
                    <th>Comedor</th>
                    <th>Producido</th>
                    <th>Servido / vendido</th>
                    <th>Reutilizable</th>
                    <th>Descarte</th>
                    <th>Sin discriminar</th>
                    <th>Sobrante total</th>
                    <th>% Sobrante</th>
                    <th>Reportes</th>
                    <th>Último reporte</th>
                  </tr>
                </thead>
                <tbody>
                  {sedes.map(sede => {
                    const color = pctColor(sede.pctSobrante)
                    return (
                      <tr key={sede.sedeId}>
                        <td style={{ color:'var(--text)', fontWeight:600 }}>{sede.sedeNombre}</td>
                        <td className="font-metric" style={{ color:'var(--text-dim)' }}>{fmt(sede.producido)}</td>
                        <td className="font-metric" style={{ color:'var(--text-dim)' }}>{fmt(sede.servido)}</td>
                        <td className="font-metric" style={{ color:'var(--phosphor)' }}>{fmt(sede.reutilizable)}</td>
                        <td className="font-metric" style={{ color:'var(--alert)' }}>{fmt(sede.descarte)}</td>
                        <td className="font-metric" style={{ color:'var(--warn)' }}>{fmt(sede.sinDiscriminar)}</td>
                        <td className="font-metric" style={{ color }}>{fmt(sede.sobrante)}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-metric text-xs" style={{ color, minWidth:42 }}>{sede.pctSobrante}%</span>
                            <div style={{ flex:1, minWidth:80 }}><ProgressBar value={sede.pctSobrante} color={color} /></div>
                          </div>
                        </td>
                        <td className="font-metric" style={{ color:'var(--text-dim)' }}>{sede.registros}</td>
                        <td className="font-metric" style={{ color:'var(--text-dim)' }}>{fmtDate(sede.ultimoReporte)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass rounded overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
              <h2 className="font-metric font-bold text-xs tracking-widest uppercase" style={{ color:'var(--phosphor)' }}>
                Últimos reportes con raciones
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="table-dark w-full">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Comedor</th>
                    <th>Turno</th>
                    <th>Producido</th>
                    <th>Servido</th>
                    <th>Reutilizable</th>
                    <th>Descarte</th>
                    <th>Sin discriminar</th>
                    <th>Sobrante total</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map(item => {
                    const color = pctColor(item.pctSobrante)
                    return (
                      <tr key={item.id}>
                        <td className="font-metric" style={{ color:'var(--text-dim)' }}>{fmtDate(item.fecha)}</td>
                        <td style={{ color:'var(--text)' }}>{item.sedeNombre}</td>
                        <td style={{ color:'var(--text-dim)' }}>{item.turno}</td>
                        <td className="font-metric" style={{ color:'var(--text-dim)' }}>{fmt(item.producido)}</td>
                        <td className="font-metric" style={{ color:'var(--text-dim)' }}>{fmt(item.servido)}</td>
                        <td className="font-metric" style={{ color:'var(--phosphor)' }}>{fmt(item.reutilizable)}</td>
                        <td className="font-metric" style={{ color:'var(--alert)' }}>{fmt(item.descarte)}</td>
                        <td className="font-metric" style={{ color:'var(--warn)' }}>{fmt(item.sinDiscriminar)}</td>
                        <td className="font-metric" style={{ color }}>{fmt(item.sobrante)}</td>
                        <td className="font-metric" style={{ color }}>{item.pctSobrante}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {movimientos.length === 0 && (
                <p className="text-center py-6" style={{ color:'var(--text-dim)' }}>Sin reportes para el comedor seleccionado.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
