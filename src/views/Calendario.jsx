import { useState, useEffect, useCallback } from 'react'
import { format, addMonths, subMonths, getYear, getMonth, getDaysInMonth, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { getCumplimientoCalendario, getEventosCalendario } from '../lib/queries'
import RegistroModal from '../components/RegistroModal'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const DIAS_SEMANA = ['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM']

function DotIndicator({ color, title }) {
  return (
    <span title={title}
      style={{
        display:'inline-block', width:6, height:6, borderRadius:'50%',
        background:color, flexShrink:0,
      }} />
  )
}

export default function Calendario() {
  const [fecha, setFecha]   = useState(new Date())
  const [dias, setDias]     = useState([])
  const [loading, setLoading] = useState(true)
  const [diaSeleccionado, setDiaSeleccionado] = useState(null)
  const [eventosMnt, setEventosMnt]   = useState({})
  const [selRegistro, setSelRegistro] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, mntEvt] = await Promise.all([
        getCumplimientoCalendario(getYear(fecha), getMonth(fecha) + 1),
        getEventosCalendario(getYear(fecha), getMonth(fecha) + 1),
      ])
      setDias(data)
      setEventosMnt(mntEvt || {})
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [fecha])

  useEffect(() => { load() }, [load])

  // Calcular offset del primer día del mes (lunes = 0)
  const primerDia = startOfMonth(fecha)
  const offset = (primerDia.getDay() + 6) % 7 // Lunes=0

  const diaActual = diaSeleccionado
    ? dias.find(d => d.diaStr === format(diaSeleccionado, 'yyyy-MM-dd'))
    : null

  const colorEstado = (estado) => {
    if (estado === 'todas')   return 'var(--phosphor)'
    if (estado === 'algunas') return 'var(--warn)'
    if (estado === 'ninguna') return 'var(--alert)'
    return 'var(--surface2)'
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 fade-in">
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Calendario */}
        <div className="flex-1">
          {/* Header nav */}
          <div className="flex items-center justify-between mb-5">
            <h1 className="font-title font-bold text-lg" style={{ color:'var(--text)' }}>
              Calendario operativo unificado
            </h1>
            <div className="flex items-center gap-3">
              <button onClick={() => setFecha(f => subMonths(f, 1))} className="btn-ghost" style={{ padding:'0.3rem 0.5rem' }}>
                <ChevronLeft size={14} />
              </button>
              <span className="font-metric text-sm capitalize" style={{ color:'var(--phosphor)', minWidth:120, textAlign:'center' }}>
                {format(fecha, 'MMMM yyyy', { locale:es })}
              </span>
              <button onClick={() => setFecha(f => addMonths(f, 1))} className="btn-ghost" style={{ padding:'0.3rem 0.5rem' }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor:'var(--phosphor)', borderTopColor:'transparent' }} />
            </div>
          ) : (
            <div className="glass rounded" style={{ borderRadius:'3px', overflow:'hidden' }}>
              {/* Cabecera días */}
              <div className="grid grid-cols-7" style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
                {DIAS_SEMANA.map(d => (
                  <div key={d} className="text-center py-2 font-metric text-xs"
                    style={{ color:'rgba(57,255,20,0.4)', fontSize:'0.62rem', letterSpacing:'0.08em' }}>
                    {d}
                  </div>
                ))}
              </div>
              {/* Grid días */}
              <div className="grid grid-cols-7">
                {/* Offsets vacíos */}
                {Array.from({ length: offset }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ borderRight:'1px solid rgba(255,255,255,0.03)', borderBottom:'1px solid rgba(255,255,255,0.03)', minHeight:70 }} />
                ))}
                {dias.map(({ dia, diaStr, estado, sedesQueReportaron, totalSedes, tieneEscalamiento, tieneTareaVencida }) => {
                  const isHoy   = diaStr === format(new Date(), 'yyyy-MM-dd')
                  const isSel   = diaSeleccionado && format(diaSeleccionado, 'yyyy-MM-dd') === diaStr
                  const color   = colorEstado(estado)
                  return (
                    <div
                      key={diaStr}
                      onClick={() => setDiaSeleccionado(dia)}
                      className="cursor-pointer relative"
                      style={{
                        borderRight:'1px solid rgba(255,255,255,0.03)',
                        borderBottom:'1px solid rgba(255,255,255,0.03)',
                        minHeight:70,
                        background: isSel ? 'rgba(57,255,20,0.08)' : isHoy ? 'rgba(57,255,20,0.04)' : undefined,
                        transition:'background 0.15s',
                      }}>
                      <div className="p-2">
                        <span className="font-metric text-xs font-bold"
                          style={{
                            color: isHoy ? 'var(--phosphor)' : 'var(--text)',
                            display:'block', marginBottom:4,
                          }}>
                          {format(dia, 'd')}
                        </span>
                        {/* Dot principal — solo días pasados/hoy */}
                        {estado !== 'futuro' && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span
                              style={{
                                display:'inline-block', width:8, height:8, borderRadius:'50%',
                                background: color,
                                boxShadow: estado !== 'ninguna' ? `0 0 4px ${color}` : undefined,
                              }}
                              title={`${sedesQueReportaron}/${totalSedes} sedes`}
                            />
                            {tieneEscalamiento && (
                              <DotIndicator color="var(--warn)" title="Escalamiento" />
                            )}
                            {tieneTareaVencida && (
                              <DotIndicator color="var(--alert)" title="Tarea vencida" />
                            )}
                          </div>
                        )}
                        {/* Eventos de mantenimiento (siempre visibles) */}
                        {(eventosMnt[diaStr] || []).length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            {(eventosMnt[diaStr] || []).slice(0,3).map((ev, idx) => (
                              <DotIndicator key={idx} color={ev.color} title={ev.label} />
                            ))}
                          </div>
                        )}
                        {/* mini conteo */}
                        {estado !== 'futuro' && sedesQueReportaron > 0 && (
                          <p className="font-metric mt-0.5" style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>
                            {sedesQueReportaron}/{totalSedes}
                          </p>
                        )}
                      </div>
                      {isSel && (
                        <div style={{
                          position:'absolute', inset:0, border:'1px solid var(--phosphor)',
                          borderRadius:2, pointerEvents:'none', opacity:0.6,
                        }} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Leyenda */}
          <div className="flex flex-wrap items-center gap-4 mt-4 px-1">
            {[
              { color:'var(--phosphor)', label:'Todas las sedes reportaron' },
              { color:'var(--warn)',     label:'Algunas sedes' },
              { color:'var(--alert)',    label:'Ninguna sede' },
              { color:'var(--warn)',     label:'Escalamiento', dot:true },
              { color:'var(--alert)',    label:'Tarea vencida', dot:true },
              { color:'#38bdf8',        label:'Mantenimiento / preventivos', dot:true },
              { color:'#34d399',        label:'Tareas', dot:true },
              { color:'#a78bfa',        label:'Calidad / CAPA', dot:true },
              { color:'#fb7185',        label:'Compras / compromisos', dot:true },
              { color:'#e879f9',        label:'RRHH / entrevistas e hitos', dot:true },
              { color:'#ff2a2a',        label:'Vencimientos', dot:true },
            ].map(({ color, label, dot }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span style={{
                  display:'inline-block',
                  width: dot ? 6 : 8, height: dot ? 6 : 8,
                  borderRadius:'50%', background:color,
                }} />
                <span className="font-metric" style={{ fontSize:'0.62rem', color:'var(--text-dim)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Panel lateral del día */}
        {diaActual && (
          <div className="lg:w-72 glass rounded fade-in" style={{ borderRadius:'3px', alignSelf:'flex-start' }}>
            <div className="px-4 py-3" style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
              <p className="font-metric font-bold text-xs tracking-wider uppercase" style={{ color:'var(--phosphor)' }}>
                {format(diaSeleccionado, "EEEE d 'de' MMMM", { locale:es })}
              </p>
              <p className="font-metric text-xs mt-0.5" style={{ color:'var(--text-dim)' }}>
                {diaActual.sedesQueReportaron} de {diaActual.totalSedes} sedes reportaron
              </p>
            </div>
            <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
              {/* Eventos de mantenimiento del día */}
              {(eventosMnt[diaActual?.diaStr] || []).length > 0 && (
                <div className="px-3 pb-2">
                  <p className="font-metric text-xs mb-2" style={{ color:'rgba(57,255,20,0.4)', fontSize:'0.6rem', letterSpacing:'0.1em' }}>COMPROMISOS / VENCIMIENTOS / HITOS</p>
                  {(eventosMnt[diaActual.diaStr] || []).map((ev, i) => (
                    <div key={i} className="rounded px-2 py-1.5 mb-1 flex items-center gap-2"
                      style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${ev.color}22` }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:ev.color, flexShrink:0, display:'inline-block' }} />
                      <div>
                        <p className="text-xs" style={{ color:'var(--text)', fontWeight:500 }}>{ev.label}</p>
                        {ev.sub && <p style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>{ev.sub}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {diaActual.registros?.length > 0 ? diaActual.registros.map(r => (
                <div key={r.id || r.sede_id}
                  className="rounded p-3 cursor-pointer"
                  style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)', transition:'background 0.15s' }}
                  onClick={() => setSelRegistro(r)}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(57,255,20,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
                  <p className="text-xs font-medium" style={{ color:'var(--text)' }}>
                    {r.sede_nombre}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {r.turno && (
                      <span className="font-metric" style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>{r.turno}</span>
                    )}
                    {r.reportante && (
                      <span className="font-metric" style={{ fontSize:'0.6rem', color:'rgba(57,255,20,0.5)' }}>· {r.reportante}</span>
                    )}
                  </div>
                  {r.estado_general && r.estado_general !== 'Sin novedades' && r.estado_general !== 'Sin novedad' && (
                    <p className="font-metric mt-1" style={{ fontSize:'0.6rem', color:'var(--warn)' }}>{r.estado_general}</p>
                  )}
                  {r.requiere_escalamiento && (
                    <span className="chip chip-red mt-1" style={{ fontSize:'0.6rem' }}>Escalamiento</span>
                  )}
                </div>
              )) : (
                <p className="text-xs text-center py-4" style={{ color:'var(--text-dim)' }}>
                  Sin registros este día
                </p>
              )}
            </div>
            <div className="px-4 py-2" style={{ borderTop:'1px solid rgba(57,255,20,0.05)' }}>
              <button onClick={() => setDiaSeleccionado(null)} className="btn-ghost w-full"
                style={{ padding:'0.3rem', fontSize:'0.65rem' }}>
                Cerrar panel
              </button>
            </div>
          </div>
        )}
      </div>

      {selRegistro && (
        <RegistroModal registro={selRegistro} onClose={() => setSelRegistro(null)} />
      )}
    </div>
  )
}
