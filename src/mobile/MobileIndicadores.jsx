import { useState, useEffect, useCallback } from 'react'
import { format, addMonths, subMonths, getYear, getMonth, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../lib/auth'
import { canAccessView } from '../lib/access'
import {
  getKPIsHoy, getEstadoTendencia, getIndicadoresPorSede, getMapaCalorGestion,
  getCumplimientoCalendario, getEventosCalendario,
} from '../lib/queries'
import { fmtHora } from '../lib/dateUtils'
import { supabase } from '../lib/supabase'
import { LayoutDashboard, BarChart3, Calendar, X, RefreshCw, AlertTriangle, Wrench, ChevronLeft, ChevronRight } from 'lucide-react'

function Card({ children, onClick, style }) {
  return (
    <div onClick={onClick} style={{ background: 'var(--surface)', borderRadius: 10, padding: '0.85rem', marginBottom: '0.6rem', cursor: onClick ? 'pointer' : 'default', ...style }}>
      {children}
    </div>
  )
}
function KpiGrid({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
      {items.map(({ label, value, alert }) => (
        <div key={label} style={{ background: 'var(--surface)', borderRadius: 10, padding: '0.7rem' }}>
          <p style={{ fontSize: '1.15rem', fontWeight: 800, color: alert ? '#FF2A2A' : 'var(--phosphor)', fontFamily: 'monospace' }}>{value}</p>
          <p style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: 2 }}>{label}</p>
        </div>
      ))}
    </div>
  )
}
function ProgressBar({ value }) {
  const pct = Math.min(100, Math.max(0, value))
  const color = pct >= 75 ? 'var(--phosphor)' : pct >= 40 ? '#F59E0B' : '#FF2A2A'
  return (
    <div style={{ height: 4, background: 'rgba(57,255,20,0.08)', borderRadius: 2, marginTop: 4 }}>
      <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: color }} />
    </div>
  )
}
function estadoChip(estado) {
  const map = { 'Sin novedades': '#39FF14', 'Hay novedades': '#F59E0B', 'Operación condicionada': '#FF2A2A' }
  const color = map[estado] || '#6B7280'
  return <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: 4, background: `${color}22`, color }}>{estado || '—'}</span>
}

// ───────────────────────── DASHBOARD ─────────────────────────

function TabDashboard() {
  const { allowedSedeIds } = useAuth()
  const [data, setData] = useState(null)
  const [mntStats, setMntStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [kpis, tickRes, planesRes, matRes] = await Promise.all([
        getKPIsHoy(allowedSedeIds),
        supabase.from('mnt_tickets').select('id,estado,prioridad,responsable_id,fecha_limite').in('estado', ['abierto', 'en_progreso']),
        supabase.from('mnt_planes').select('id,proxima_fecha').eq('activo', true).not('proxima_fecha', 'is', null).lte('proxima_fecha', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]),
        supabase.from('mnt_matafuegos').select('id,vencimiento').not('vencimiento', 'is', null).lte('vencimiento', new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]),
      ])
      setData(kpis)
      const tickets = tickRes.data || []
      setMntStats({
        abiertos: tickets.length,
        criticos: tickets.filter(t => t.prioridad === 'critica').length,
        sinAsignar: tickets.filter(t => !t.responsable_id).length,
        slaVencidos: tickets.filter(t => t.fecha_limite && new Date(t.fecha_limite) < new Date()).length,
        planesProximos: (planesRes.data || []).length,
        matVencer: (matRes.data || []).length,
      })
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [allowedSedeIds])

  useEffect(() => { load() }, [load])

  if (loading || !data) return <p style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: '2rem' }}>Cargando...</p>

  const sedeRows = (data.sedes || []).map(sede => {
    const ultimo = (data.registrosHoy || []).filter(r => r.sede_id === sede.id)[0] || null
    return { sede, ultimo }
  })

  return (
    <div className="mobile-scroll" style={{ height: '100%', overflowY: 'auto', padding: '0.75rem 1rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'capitalize' }}>{format(new Date(), "EEEE d 'de' MMMM", { locale: es })}</p>
        <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--phosphor)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.65rem' }}>
          <RefreshCw size={11} /> Actualizar
        </button>
      </div>

      <KpiGrid items={[
        { label: 'Reportes hoy', value: data.totalRegistrosHoy },
        { label: 'Sedes activas', value: `${data.sedesReportaronHoy}/${data.totalSedesActivas}` },
        { label: 'Escalamientos activos', value: data.escalamientosActivos, alert: data.escalamientosActivos > 0 },
        { label: 'Tareas pendientes', value: data.tareasPendientes, alert: data.tareasPendientes > 5 },
      ]} />

      <p style={{ fontSize: '0.65rem', color: 'var(--phosphor)', textTransform: 'uppercase', fontWeight: 700, margin: '0.5rem 0' }}>Estado por sede — hoy</p>
      {sedeRows.length === 0 ? <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>Sin sedes activas.</p>
        : sedeRows.map(({ sede, ultimo }) => (
          <Card key={sede.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.82rem' }}>{sede.nombre}</p>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.62rem', marginTop: 2 }}>{ultimo?.reportante || 'Sin reporte'}{ultimo ? ` · ${fmtHora(ultimo.fecha_reporte)}` : ''}</p>
              </div>
              {ultimo ? estadoChip(ultimo.estado_general) : <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.05)', padding: '0.15rem 0.45rem', borderRadius: 4 }}>Sin reporte</span>}
            </div>
            {ultimo?.requiere_escalamiento && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 6, fontSize: '0.58rem', fontWeight: 700, color: '#FF2A2A', background: 'rgba(255,42,42,0.1)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>
                <AlertTriangle size={9} /> Escalamiento
              </span>
            )}
          </Card>
        ))}

      {data.escalamientosRecientes?.length > 0 && (
        <>
          <p style={{ fontSize: '0.65rem', color: '#FF2A2A', textTransform: 'uppercase', fontWeight: 700, margin: '0.75rem 0 0.5rem' }}>Últimos escalamientos activos</p>
          {data.escalamientosRecientes.map(e => (
            <Card key={e.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text)', fontWeight: 600 }}>{e.sede_nombre}</p>
                  <p style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: 2 }}>{e.tipo ? `[${e.tipo}] · ` : ''}{e.fecha_reporte}</p>
                </div>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#FF2A2A', background: 'rgba(255,42,42,0.1)', padding: '0.15rem 0.45rem', borderRadius: 4 }}>{e.estado}</span>
              </div>
            </Card>
          ))}
        </>
      )}

      {mntStats && (
        <>
          <p style={{ fontSize: '0.65rem', color: 'var(--phosphor)', textTransform: 'uppercase', fontWeight: 700, margin: '0.75rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Wrench size={11} /> Mantenimiento
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {[
              ['Abiertos', mntStats.abiertos, mntStats.abiertos > 0 ? '#F97316' : null],
              ['Críticos', mntStats.criticos, mntStats.criticos > 0 ? '#FF2A2A' : null],
              ['Sin asignar', mntStats.sinAsignar, mntStats.sinAsignar > 0 ? '#F59E0B' : null],
              ['SLA vencidos', mntStats.slaVencidos, mntStats.slaVencidos > 0 ? '#FF2A2A' : null],
              ['Planes 7d', mntStats.planesProximos, mntStats.planesProximos > 0 ? '#50B4FF' : null],
              ['Matafuegos 30d', mntStats.matVencer, mntStats.matVencer > 0 ? '#FF2A2A' : null],
            ].map(([label, value, color]) => (
              <div key={label} style={{ background: 'var(--surface)', borderRadius: 8, padding: '0.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.95rem', fontWeight: 800, color: color || 'var(--phosphor)', fontFamily: 'monospace' }}>{value}</p>
                <p style={{ fontSize: '0.52rem', color: 'var(--text-dim)', marginTop: 2 }}>{label}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ───────────────────────── INDICADORES ─────────────────────────

const PERIODOS = [7, 30, 90]

function TabIndicadores() {
  const { allowedSedeIds } = useAuth()
  const [periodo, setPeriodo] = useState(30)
  const [datos, setDatos] = useState([])
  const [mapaCalor, setMapaCalor] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getIndicadoresPorSede(periodo, allowedSedeIds), getMapaCalorGestion(periodo, allowedSedeIds)])
      .then(([ind, heat]) => { setDatos(ind); setMapaCalor(heat) })
      .catch(console.error).finally(() => setLoading(false))
  }, [periodo, allowedSedeIds])
  useEffect(() => { load() }, [load])

  const totalRegs = datos.reduce((a, d) => a + d.totalRegs, 0)
  const totalEscals = datos.reduce((a, d) => a + d.escalamientos, 0)
  const avgCumpl = datos.length ? Math.round(datos.reduce((a, d) => a + d.pctCumplimiento, 0) / datos.length) : 0
  const avgLimpias = datos.length ? Math.round(datos.reduce((a, d) => a + d.pctLimpias, 0) / datos.length) : 0
  const sedesConProblemas = mapaCalor.filter(r => r.total > 0)

  return (
    <div className="mobile-scroll" style={{ height: '100%', overflowY: 'auto', padding: '0.75rem 1rem 1.5rem' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {PERIODOS.map(p => (
          <button key={p} onClick={() => setPeriodo(p)} style={{
            flex: 1, padding: '0.4rem', borderRadius: 8, fontSize: '0.68rem', fontWeight: 700, border: 'none',
            background: periodo === p ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.05)', color: periodo === p ? 'var(--phosphor)' : 'var(--text-dim)',
          }}>{p} días</button>
        ))}
      </div>

      {loading ? <p style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: '2rem' }}>Cargando...</p> : (
        <>
          <KpiGrid items={[
            { label: 'Registros totales', value: totalRegs },
            { label: 'Escalamientos', value: totalEscals, alert: totalEscals > 0 },
            { label: 'Cumpl. promedio', value: `${avgCumpl}%` },
            { label: 'Ops. limpias promedio', value: `${avgLimpias}%` },
          ]} />

          {sedesConProblemas.length > 0 && (
            <>
              <p style={{ fontSize: '0.65rem', color: '#FF2A2A', textTransform: 'uppercase', fontWeight: 700, margin: '0.5rem 0' }}>Sedes con alertas</p>
              {sedesConProblemas.map(row => (
                <Card key={row.sede.id}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text)', fontWeight: 600 }}>{row.sede.nombre}</p>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
                    {Object.entries(row.metricas).filter(([, v]) => v > 0).map(([k, v]) => (
                      <span key={k} style={{ fontSize: '0.58rem', fontWeight: 700, color: '#FF2A2A', background: 'rgba(255,42,42,0.1)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>{k}: {v}</span>
                    ))}
                  </div>
                </Card>
              ))}
            </>
          )}

          <p style={{ fontSize: '0.65rem', color: 'var(--phosphor)', textTransform: 'uppercase', fontWeight: 700, margin: '0.75rem 0 0.5rem' }}>Por sede</p>
          {datos.length === 0 ? <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>Sin sedes activas.</p>
            : datos.map(ind => {
              const { sede, pctCumplimiento, pctLimpias, escalamientos, totalRegs: regs, tareasTotal, tareasResueltas } = ind
              return (
                <Card key={sede.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 700 }}>{sede.nombre}</p>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--phosphor)', fontFamily: 'monospace' }}>{pctCumplimiento}%</span>
                  </div>
                  <p style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>Cumplimiento carga</p>
                  <ProgressBar value={pctCumplimiento} />
                  <p style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: 8 }}>Ops. limpias — {pctLimpias}%</p>
                  <ProgressBar value={pctLimpias} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    {[['Registros', regs], ['Escalam.', escalamientos], ['Tareas', `${tareasResueltas}/${tareasTotal}`]].map(([l, v]) => (
                      <div key={l} style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '0.78rem', fontWeight: 700, color: l === 'Escalam.' && escalamientos > 0 ? '#FF2A2A' : 'var(--text)' }}>{v}</p>
                        <p style={{ fontSize: '0.55rem', color: 'var(--text-dim)' }}>{l}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })}
        </>
      )}
    </div>
  )
}

// ───────────────────────── CALENDARIO ─────────────────────────

const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function colorEstado(estado) {
  if (estado === 'todas') return '#39FF14'
  if (estado === 'algunas') return '#F59E0B'
  if (estado === 'ninguna') return '#FF2A2A'
  return 'rgba(255,255,255,0.15)'
}

function TabCalendario() {
  const [fecha, setFecha] = useState(new Date())
  const [dias, setDias] = useState([])
  const [eventosMnt, setEventosMnt] = useState({})
  const [loading, setLoading] = useState(true)
  const [diaSel, setDiaSel] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      getCumplimientoCalendario(getYear(fecha), getMonth(fecha) + 1),
      getEventosCalendario(getYear(fecha), getMonth(fecha) + 1),
    ]).then(([d, e]) => { setDias(d); setEventosMnt(e || {}) }).catch(console.error).finally(() => setLoading(false))
  }, [fecha])
  useEffect(() => { load() }, [load])

  const offset = (startOfMonth(fecha).getDay() + 6) % 7
  const diaActual = diaSel ? dias.find(d => d.diaStr === format(diaSel, 'yyyy-MM-dd')) : null

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '0.75rem 1rem 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button onClick={() => setFecha(f => subMonths(f, 1))} style={{ background: 'none', border: 'none', color: 'var(--text-dim)' }}><ChevronLeft size={18} /></button>
          <span style={{ color: 'var(--phosphor)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'capitalize' }}>{format(fecha, 'MMMM yyyy', { locale: es })}</span>
          <button onClick={() => setFecha(f => addMonths(f, 1))} style={{ background: 'none', border: 'none', color: 'var(--text-dim)' }}><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="mobile-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 1rem 1.5rem', minHeight: 0 }}>
        {loading ? <p style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: '2rem' }}>Cargando...</p> : (
          <>
            <div style={{ background: 'var(--surface)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(57,255,20,0.08)' }}>
                {DIAS_SEMANA.map((d, i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '0.4rem 0', fontSize: '0.58rem', color: 'rgba(57,255,20,0.4)', fontWeight: 700 }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} style={{ minHeight: 44 }} />)}
                {dias.map(({ dia, diaStr, estado, sedesQueReportaron, totalSedes, tieneEscalamiento, tieneTareaVencida }) => {
                  const isHoy = diaStr === format(new Date(), 'yyyy-MM-dd')
                  const isSel = diaSel && format(diaSel, 'yyyy-MM-dd') === diaStr
                  const eventos = eventosMnt[diaStr] || []
                  return (
                    <div key={diaStr} onClick={() => setDiaSel(dia)} style={{
                      minHeight: 44, padding: '0.3rem 0.1rem', textAlign: 'center', cursor: 'pointer',
                      background: isSel ? 'rgba(57,255,20,0.12)' : isHoy ? 'rgba(57,255,20,0.05)' : undefined,
                      borderRadius: isSel ? 6 : 0,
                    }}>
                      <p style={{ fontSize: '0.68rem', fontWeight: isHoy ? 800 : 500, color: isHoy ? 'var(--phosphor)' : 'var(--text)' }}>{format(dia, 'd')}</p>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 2, flexWrap: 'wrap' }}>
                        {estado !== 'futuro' && <span style={{ width: 5, height: 5, borderRadius: '50%', background: colorEstado(estado), display: 'inline-block' }} />}
                        {tieneEscalamiento && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />}
                        {tieneTareaVencida && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#FF2A2A', display: 'inline-block' }} />}
                        {eventos.slice(0, 2).map((ev, idx) => <span key={idx} style={{ width: 4, height: 4, borderRadius: '50%', background: ev.color, display: 'inline-block' }} />)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
              {[['#39FF14', 'Todas reportaron'], ['#F59E0B', 'Algunas'], ['#FF2A2A', 'Ninguna']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, display: 'inline-block' }} />
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>{l}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {diaActual && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }} onClick={e => e.target === e.currentTarget && setDiaSel(null)}>
          <div style={{ background: 'var(--surface)', width: '100%', borderRadius: '14px 14px 0 0', padding: '1.25rem', maxHeight: '75vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <p style={{ color: 'var(--phosphor)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'capitalize' }}>{format(diaSel, "EEEE d 'de' MMMM", { locale: es })}</p>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.65rem', marginTop: 2 }}>{diaActual.sedesQueReportaron} de {diaActual.totalSedes} sedes reportaron</p>
              </div>
              <button onClick={() => setDiaSel(null)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)' }}><X size={18} /></button>
            </div>

            {(eventosMnt[diaActual.diaStr] || []).length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: '0.58rem', color: 'rgba(57,255,20,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Compromisos / vencimientos / hitos</p>
                {(eventosMnt[diaActual.diaStr] || []).map((ev, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.4rem 0.6rem', borderRadius: 6, background: 'rgba(255,255,255,0.03)', marginBottom: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text)' }}>{ev.label}</p>
                      {ev.sub && <p style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>{ev.sub}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {diaActual.registros?.length > 0 ? diaActual.registros.map(r => (
              <Card key={r.id || r.sede_id}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text)', fontWeight: 600 }}>{r.sede_nombre}</p>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  {r.turno && <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>{r.turno}</span>}
                  {r.reportante && <span style={{ fontSize: '0.6rem', color: 'rgba(57,255,20,0.6)' }}>· {r.reportante}</span>}
                </div>
                {r.estado_general && r.estado_general !== 'Sin novedades' && (
                  <p style={{ fontSize: '0.6rem', color: '#F59E0B', marginTop: 4 }}>{r.estado_general}</p>
                )}
                {r.requiere_escalamiento && (
                  <span style={{ display: 'inline-block', marginTop: 4, fontSize: '0.58rem', fontWeight: 700, color: '#FF2A2A', background: 'rgba(255,42,42,0.1)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>Escalamiento</span>
                )}
              </Card>
            )) : <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', padding: '1rem 0' }}>Sin registros este día.</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// ───────────────────────── ROOT ─────────────────────────

export default function MobileIndicadores() {
  const { rol, perfil } = useAuth()
  const SUBTABS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, view: 'dashboard' },
    { id: 'indicadores', label: 'Indicadores', icon: BarChart3, view: 'indicadores' },
    { id: 'calendario', label: 'Calendario', icon: Calendar, view: 'calendario' },
  ].filter(t => canAccessView(rol, t.view, perfil))

  const [tab, setTab] = useState(SUBTABS[0]?.id)

  if (SUBTABS.length === 0) {
    return <p style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: '2rem', fontSize: '0.85rem' }}>Sin acceso a este módulo.</p>
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '0.75rem 1rem 0', flexShrink: 0 }}>
        <h1 style={{ color: 'var(--text)', fontSize: '1.2rem', fontWeight: 700, marginBottom: 10 }}>Indicadores</h1>
        <div style={{ display: 'flex', gap: 6, background: 'var(--surface)', padding: '0.2rem', borderRadius: 20 }}>
          {SUBTABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '0.4rem 0.3rem', borderRadius: 16, fontSize: '0.62rem', fontWeight: 700, border: 'none',
                background: tab === t.id ? 'rgba(57,255,20,0.15)' : 'transparent', color: tab === t.id ? 'var(--phosphor)' : 'var(--text-dim)',
              }}>
                <Icon size={12} /> {t.label}
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === 'dashboard' && <TabDashboard />}
        {tab === 'indicadores' && <TabIndicadores />}
        {tab === 'calendario' && <TabCalendario />}
      </div>
    </div>
  )
}
