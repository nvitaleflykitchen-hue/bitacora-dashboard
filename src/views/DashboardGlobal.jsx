import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getKPIsHoy, getEstadoTendencia } from '../lib/queries'
import { useAuth } from '../lib/auth'
import RegistroModal from '../components/RegistroModal'
import PageHeader from '../components/PageHeader'
import TareaForm from '../components/TareaForm'
import TicketRapidoModal from '../components/TicketRapidoModal'
import { RefreshCw, ClipboardList, Building2, AlertTriangle, CheckSquare, Wrench, Flame } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { supabase } from '../lib/supabase'
import { fmtFecha, fmtHora } from '../lib/dateUtils'

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="font-metric" style={{ color:'var(--phosphor)', fontSize:'0.85rem' }}>
      {format(now, 'HH:mm:ss')}
    </span>
  )
}

function estadoChip(estado) {
  if (!estado) return <span className="chip chip-gray">—</span>
  if (estado === 'Sin novedades') return <span className="chip chip-green">{estado}</span>
  if (estado === 'Hay novedades') return <span className="chip chip-yellow">{estado}</span>
  if (estado === 'Operación condicionada') return <span className="chip chip-red">{estado}</span>
  return <span className="chip chip-gray">{estado}</span>
}

export default function DashboardGlobal({ onNavigate }) {
  const { allowedSedeIds } = useAuth()
  const [data, setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]  = useState(null)
  const [selRegistro, setSelRegistro] = useState(null)
  const [tareaOrigen, setTareaOrigen] = useState(null)
  const [tareaInitial, setTareaInitial] = useState(null)
  const [ticketOrigen, setTicketOrigen] = useState(null)
  const [mntStats, setMntStats]       = useState(null)
  const [tendencia, setTendencia]     = useState([])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [kpis, tickRes, planesRes, matRes, tend] = await Promise.all([
        getKPIsHoy(allowedSedeIds),
        supabase.from('mnt_tickets').select('id,estado,prioridad,responsable_id,fecha_limite').in('estado',['abierto','en_progreso']),
        supabase.from('mnt_planes').select('id,proxima_fecha').eq('activo',true).not('proxima_fecha','is',null).lte('proxima_fecha', new Date(Date.now()+7*86400000).toISOString().split('T')[0]),
        supabase.from('mnt_matafuegos').select('id,vencimiento').not('vencimiento','is',null).lte('vencimiento', new Date(Date.now()+30*86400000).toISOString().split('T')[0]),
        getEstadoTendencia(allowedSedeIds),
      ])
      setData(kpis)
      setTendencia(tend || [])
      const tickets = tickRes.data || []
      setMntStats({
        abiertos: tickets.length,
        criticos: tickets.filter(t => t.prioridad === 'critica').length,
        sinAsignar: tickets.filter(t => !t.responsable_id).length,
        slaVencidos: tickets.filter(t => t.fecha_limite && new Date(t.fecha_limite) < new Date()).length,
        planesProximos: (planesRes.data || []).length,
        matVencer: (matRes.data || []).length,
      })
    }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [allowedSedeIds])

  useEffect(() => { load() }, [load])

  const hoy = format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })

  if (loading) return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 mx-auto animate-spin"
          style={{ borderColor:'var(--phosphor)', borderTopColor:'transparent' }} />
        <p className="font-metric text-xs" style={{ color:'var(--text-dim)' }}>CARGANDO...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <p className="font-metric text-xs" style={{ color:'var(--alert)' }}>ERROR: {error}</p>
        <button onClick={load} className="btn-primary">Reintentar</button>
      </div>
    </div>
  )

  // Build sede status rows from registrosHoy + sedes list
  const sedeRows = (data.sedes || []).map(sede => {
    const regs = (data.registrosHoy || []).filter(r => r.sede_id === sede.id)
    const ultimo = regs[0] || null
    return { sede, ultimo }
  })

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 fade-in">
      {/* Header */}
      <PageHeader title="Dashboard Global" subtitle={hoy}>
        <div className="flex items-center gap-3">
          <Clock />
          <button onClick={load} className="btn-ghost flex items-center gap-1.5" style={{ padding:'0.35rem 0.75rem' }}>
            <RefreshCw size={11} /> Actualizar
          </button>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label:'Reportes hoy',          value: data.totalRegistrosHoy,    icon: ClipboardList, extra: null },
          { label:'Sedes activas',          value: `${data.sedesReportaronHoy}/${data.totalSedesActivas}`, icon: Building2, extra: 'reportaron hoy' },
          { label:'Escalamientos activos',  value: data.escalamientosActivos, icon: AlertTriangle, alert: data.escalamientosActivos > 0 },
          { label:'Tareas pendientes',      value: data.tareasPendientes,     icon: CheckSquare,  alert: data.tareasPendientes > 5 },
        ].map(({ label, value, icon: Icon, extra, alert }) => (
          <div key={label} className="kpi-card hud-corner">
            <div className="flex items-start justify-between">
              <div>
                <p className="kpi-value" style={alert ? { color:'var(--alert)', textShadow:'0 0 12px rgba(255,42,42,0.4)' } : {}}>{value}</p>
                <p className="kpi-label">{label}</p>
                {extra && <p className="font-metric mt-1" style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>{extra}</p>}
              </div>
              <Icon size={18} style={{ color: alert ? 'var(--alert)' : 'rgba(57,255,20,0.3)', marginTop:2 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Sede status table */}
      <div className="glass rounded" style={{ borderRadius:'3px' }}>
        <div className="px-4 py-3" style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
          <h2 className="font-metric font-bold text-xs tracking-widest uppercase" style={{ color:'var(--phosphor)' }}>
            Estado por sede — hoy
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table-dark w-full">
            <thead>
              <tr>
                <th>Sede</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Reportante</th>
                <th>Hora</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sedeRows.map(({ sede, ultimo }) => (
                <tr key={sede.id}
                  className={ultimo ? 'cursor-pointer' : ''}
                  onClick={() => ultimo && setSelRegistro(ultimo)}>
                  <td style={{ color:'var(--text)', fontWeight:500 }}>{sede.nombre}</td>
                  <td><span className="chip chip-gray" style={{ fontSize:'0.6rem' }}>{sede.tipo}</span></td>
                  <td>
                    {ultimo ? estadoChip(ultimo.estado_general)
                      : <span className="chip chip-gray">Sin reporte</span>}
                  </td>
                  <td style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>{ultimo?.reportante || '—'}</td>
                  <td className="font-metric" style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>
                    {ultimo ? fmtHora(ultimo.fecha_reporte) : '—'}
                  </td>
                  <td>
                    {ultimo?.requiere_escalamiento && (
                      <span className="chip chip-red flex items-center gap-1">
                        <AlertTriangle size={9} /> Escal.
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {sedeRows.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8" style={{ color:'var(--text-dim)' }}>Sin sedes activas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Últimos escalamientos */}
      {data.escalamientosRecientes?.length > 0 && (
        <div className="glass rounded" style={{ borderRadius:'3px' }}>
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
            <h2 className="font-metric font-bold text-xs tracking-widest uppercase" style={{ color:'var(--alert)' }}>
              Últimos escalamientos activos
            </h2>
            <button onClick={() => onNavigate?.('escalamientos')} className="btn-ghost" style={{ padding:'0.2rem 0.5rem', fontSize:'0.62rem' }}>
              Ver todos →
            </button>
          </div>
          <div className="divide-y" style={{ '--tw-divide-opacity':1 }}>
            {data.escalamientosRecientes.map(e => (
              <div key={e.id} className="px-4 py-3 flex items-center justify-between cursor-pointer hover:opacity-80"
                onClick={() => setSelRegistro({ id: e.registro_id })}>
                <div>
                  <p className="text-xs font-medium" style={{ color:'var(--text)' }}>{e.sede_nombre}</p>
                  <p className="font-metric text-xs mt-0.5" style={{ color:'var(--text-dim)', fontSize:'0.65rem' }}>
                    {e.tipo && `[${e.tipo}] · `}
                    {fmtFecha(e.fecha_reporte)}
                  </p>
                </div>
                <span className="chip chip-red">{e.estado}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Tendencia 14 días ────────────────────────── */}
      {tendencia.length > 0 && (
        <div className="glass rounded" style={{ borderRadius:'3px', padding:'1rem' }}>
          <p className="font-metric text-xs tracking-widest uppercase mb-3" style={{ color:'var(--text-dim)' }}>
            Estado general · últimos 14 días
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={tendencia} margin={{ top:4, right:8, left:-20, bottom:0 }}>
              <XAxis dataKey="fecha"
                tick={{ fill:'rgba(255,255,255,0.3)', fontSize:9 }}
                tickFormatter={d => d?.slice(5)}   /* MM-DD */
                axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false}
                tick={{ fill:'rgba(255,255,255,0.3)', fontSize:9 }}
                axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background:'var(--surface)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, fontSize:'0.72rem' }}
                labelStyle={{ color:'var(--text-dim)', marginBottom:4 }}
                labelFormatter={d => d}
              />
              <Legend wrapperStyle={{ fontSize:'0.65rem', paddingTop:8 }}
                formatter={(v) => ({ sin_novedades:'Sin novedades', hay_novedades:'Hay novedades', condicionada:'Op. Condicionada' }[v] || v)} />
              <Line type="monotone" dataKey="sin_novedades" stroke="#39FF14" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="hay_novedades" stroke="#F59E0B" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="condicionada"  stroke="#FF2A2A" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── Bloque Mantenimiento ──────────────────────── */}
      {mntStats && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wrench size={13} style={{ color:'var(--phosphor)' }} />
              <h2 className="font-metric text-xs tracking-widest uppercase" style={{ color:'var(--phosphor)', opacity:0.7 }}>Mantenimiento</h2>
            </div>
            <button onClick={() => onNavigate?.('mntDashboard')} className="btn-ghost" style={{ padding:'0.2rem 0.6rem', fontSize:'0.6rem' }}>
              Ver dashboard →
            </button>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <div className="kpi-card" style={{ borderColor: mntStats.abiertos>0?'rgba(249,115,22,0.2)':'rgba(57,255,20,0.08)' }}>
              <p className="kpi-value" style={{ fontSize:'1.4rem', color: mntStats.abiertos>0?'#f97316':'var(--phosphor)' }}>{mntStats.abiertos}</p>
              <p className="kpi-label">Tickets abiertos</p>
            </div>
            <div className="kpi-card" style={{ borderColor: mntStats.criticos>0?'rgba(255,42,42,0.3)':'rgba(57,255,20,0.08)' }}>
              <p className="kpi-value" style={{ fontSize:'1.4rem', color: mntStats.criticos>0?'var(--alert)':'var(--phosphor)' }}>{mntStats.criticos}</p>
              <p className="kpi-label">Críticos</p>
            </div>
            <div className="kpi-card" style={{ borderColor: mntStats.sinAsignar>0?'rgba(245,158,11,0.25)':'rgba(57,255,20,0.08)' }}>
              <p className="kpi-value" style={{ fontSize:'1.4rem', color: mntStats.sinAsignar>0?'var(--warn)':'var(--phosphor)' }}>{mntStats.sinAsignar}</p>
              <p className="kpi-label">Sin asignar</p>
            </div>
            <div className="kpi-card" style={{ borderColor: mntStats.slaVencidos>0?'rgba(255,42,42,0.2)':'rgba(57,255,20,0.08)' }}>
              <p className="kpi-value" style={{ fontSize:'1.4rem', color: mntStats.slaVencidos>0?'#ff5050':'var(--phosphor)' }}>{mntStats.slaVencidos}</p>
              <p className="kpi-label">SLA vencidos</p>
            </div>
            <div className="kpi-card cursor-pointer" onClick={() => onNavigate?.('mntPlanes')} style={{ borderColor: mntStats.planesProximos>0?'rgba(80,180,255,0.2)':'rgba(57,255,20,0.08)' }}>
              <p className="kpi-value" style={{ fontSize:'1.4rem', color:'#50b4ff' }}>{mntStats.planesProximos}</p>
              <p className="kpi-label">Planes próx. 7d</p>
            </div>
            <div className="kpi-card cursor-pointer" onClick={() => onNavigate?.('mntMatafuegos')} style={{ borderColor: mntStats.matVencer>0?'rgba(255,42,42,0.2)':'rgba(57,255,20,0.08)' }}>
              <p className="kpi-value" style={{ fontSize:'1.4rem', color: mntStats.matVencer>0?'#ff5050':'var(--phosphor)' }}>{mntStats.matVencer}</p>
              <p className="kpi-label" style={{ display:'flex', alignItems:'center', gap:3 }}><Flame size={9} />Mat. próx. 30d</p>
            </div>
          </div>
        </div>
      )}

      {selRegistro && (
        <RegistroModal registro={selRegistro} onClose={() => setSelRegistro(null)}
          onCreateTarea={(r, extra) => {
            setTareaOrigen(r)
            setTareaInitial(extra || null)
            setSelRegistro(null)
          }}
          onCreateTicket={(r, extra) => {
            setTicketOrigen({ registro:r, ...extra })
            setSelRegistro(null)
          }}
        />
      )}
      {tareaOrigen && (
        <TareaForm
          registroOrigen={tareaOrigen}
          initialValues={tareaInitial}
          onClose={() => { setTareaOrigen(null); setTareaInitial(null) }}
          onCreated={() => { setTareaOrigen(null); setTareaInitial(null); load() }}
        />
      )}
      {ticketOrigen && (
        <TicketRapidoModal
          origen={ticketOrigen}
          onClose={() => setTicketOrigen(null)}
          onCreated={() => { setTicketOrigen(null); load() }}
        />
      )}
    </div>
  )
}
