import { useState, useEffect, useCallback } from 'react'
import { getEscalamientosItems, updateEscalamientoItem, getSedes, getTicketsByEscalamientoIds } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { fmtFecha } from '../lib/dateUtils'
import RegistroModal from '../components/RegistroModal'
import TicketRapidoModal from '../components/TicketRapidoModal'
import { RefreshCw, CheckCircle, LayoutGrid, List as ListIcon, Wrench } from 'lucide-react'

const TIPO_COLOR = {
  'Compras':       '#50b4ff',
  'Mantenimiento': '#F59E0B',
  'RRHH':          '#a78bfa',
  'Logística':     '#34d399',
  'Calidad':       '#fb923c',
  'Coordinación':  '#f472b6',
  'Dirección':     '#FF2A2A',
  'Otro':          '#9ca3af',
}
const ESTADO_STYLE = {
  'Pendiente':  { chip: 'chip-yellow' },
  'En gestión': { chip: 'chip-blue'   },
  'Resuelto':   { chip: 'chip-green'  },
}
const ESTADOS    = ['Pendiente', 'En gestión', 'Resuelto']
const TIPOS      = Object.keys(TIPO_COLOR)
const KANBAN_COLS = [
  { estado: 'Pendiente',  color: 'var(--warn)',    bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.25)' },
  { estado: 'En gestión', color: '#50b4ff',         bg: 'rgba(80,180,255,0.05)', border: 'rgba(80,180,255,0.2)'  },
  { estado: 'Resuelto',   color: 'var(--phosphor)', bg: 'rgba(57,255,20,0.05)',  border: 'rgba(57,255,20,0.2)'   },
]

export default function Escalamientos() {
  const { allowedSedeIds, can } = useAuth()
  const canManage = can('escalamientos', 'manage')
  const [items,      setItems]      = useState([])
  const [sedes,      setSedes]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [updating,   setUpdating]   = useState(null)
  const [selRegId,   setSelRegId]   = useState(null)
  const [tickets,     setTickets]     = useState({}) // escalamiento_id -> ticket
  const [ticketOrigen, setTicketOrigen] = useState(null) // escalamiento para el cual se está generando ticket
  const [filtroSede,   setFiltroSede]   = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroTipo,   setFiltroTipo]   = useState('')
  const [filtroDesde,  setFiltroDesde]  = useState('')
  const [filtroHasta,  setFiltroHasta]  = useState('')
  const [vista,        setVista]        = useState('tabla')
  const [dragId,       setDragId]       = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, s] = await Promise.all([
        getEscalamientosItems({
          sedeIds: allowedSedeIds || undefined,
          sedeId:  filtroSede   || undefined,
          estado:  filtroEstado || undefined,
          tipo:    filtroTipo   || undefined,
          desde:   filtroDesde  || undefined,
          hasta:   filtroHasta  || undefined,
        }),
        getSedes(allowedSedeIds),
      ])
      setItems(data); setSedes(s)
      try {
        const tk = await getTicketsByEscalamientoIds(data.map(e => e.id))
        setTickets(Object.fromEntries(tk.map(t => [t.escalamiento_id, t])))
      } catch (e) { console.error('Error al cargar tickets vinculados:', e) }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [allowedSedeIds, filtroSede, filtroEstado, filtroTipo, filtroDesde, filtroHasta])

  useEffect(() => { load() }, [load])

  const handleEstado = async (id, nuevoEstado) => {
    if (!canManage) return
    setUpdating(id)
    try {
      await updateEscalamientoItem(id, { estado: nuevoEstado })
      setItems(prev => prev.map(e => e.id === id ? { ...e, estado: nuevoEstado } : e))
    } catch (err) { console.error(err) }
    finally { setUpdating(null) }
  }

  const abrirGenerarTicket = (e) => {
    setTicketOrigen({
      escalamientoId: e.id,
      sedeNombre: e.sede_nombre,
      sedeId: e.sede_id,
      descripcionInicial: e.descripcion,
      estadoActual: e.estado,
    })
  }

  const handleTicketCreado = (ticket) => {
    setTickets(prev => ({ ...prev, [ticket.escalamiento_id]: ticket }))
    if (ticketOrigen?.estadoActual === 'Pendiente') {
      handleEstado(ticketOrigen.escalamientoId, 'En gestión')
    }
  }

  const pendientes = items.filter(e => e.estado === 'Pendiente').length
  const enGestion  = items.filter(e => e.estado === 'En gestión').length
  const resueltos  = items.filter(e => e.estado === 'Resuelto').length

  // Para el modal de registro necesitamos el registro completo — lo buscamos del join
  const selEscalamiento = selRegId
    ? items.find(e => String(e.registro_id) === String(selRegId))
    : null
  const selRegistro = selEscalamiento
    ? {
        id: selRegId,
        ...selEscalamiento.registros,
        // Los escalamientos conservan estos datos aunque el registro histórico
        // asociado haya quedado incompleto.
        sede_id: selEscalamiento.registros?.sede_id ?? selEscalamiento.sede_id,
        sede_nombre: selEscalamiento.registros?.sede_nombre || selEscalamiento.sede_nombre,
        reportante: selEscalamiento.registros?.reportante || selEscalamiento.reportante,
      }
    : null

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-title font-bold text-lg" style={{ color:'var(--text)' }}>Escalamientos</h1>
          <p className="font-metric text-xs mt-0.5" style={{ color:'var(--text-dim)' }}>
            Items individuales — gestioná el estado de cada uno
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center" style={{ border:'1px solid rgba(255,255,255,0.1)', borderRadius:3, overflow:'hidden' }}>
            <button onClick={() => setVista('tabla')} className="flex items-center gap-1.5"
              style={{ padding:'0.35rem 0.6rem', fontSize:'0.68rem', background: vista==='tabla' ? 'rgba(57,255,20,0.12)' : 'transparent', color: vista==='tabla' ? 'var(--phosphor)' : 'var(--text-dim)' }}>
              <ListIcon size={11} /> Tabla
            </button>
            <button onClick={() => setVista('kanban')} className="flex items-center gap-1.5"
              style={{ padding:'0.35rem 0.6rem', fontSize:'0.68rem', background: vista==='kanban' ? 'rgba(57,255,20,0.12)' : 'transparent', color: vista==='kanban' ? 'var(--phosphor)' : 'var(--text-dim)' }}>
              <LayoutGrid size={11} /> Kanban
            </button>
          </div>
          <button onClick={load} className="btn-ghost flex items-center gap-1.5" style={{ padding:'0.35rem 0.75rem' }}>
            <RefreshCw size={11} /> Actualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      {!loading && (
        <div className="grid grid-cols-4 gap-3">
          <div className="kpi-card" style={{ borderColor:'rgba(255,255,255,0.1)' }}>
            <p className="kpi-value">{items.length}</p>
            <p className="kpi-label">Total</p>
          </div>
          <div className="kpi-card" style={{ borderColor:'rgba(245,158,11,0.25)' }}>
            <p className="kpi-value" style={{ color:'var(--warn)' }}>{pendientes}</p>
            <p className="kpi-label">Pendientes</p>
          </div>
          <div className="kpi-card" style={{ borderColor:'rgba(80,180,255,0.2)' }}>
            <p className="kpi-value" style={{ color:'#50b4ff' }}>{enGestion}</p>
            <p className="kpi-label">En gestión</p>
          </div>
          <div className="kpi-card" style={{ borderColor:'rgba(57,255,20,0.2)' }}>
            <p className="kpi-value" style={{ color:'var(--phosphor)' }}>{resueltos}</p>
            <p className="kpi-label">Resueltos</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="glass rounded p-3 flex flex-wrap gap-3 items-end" style={{ borderRadius:'3px' }}>
        <div>
          <label className="font-metric text-xs tracking-wider uppercase mb-1 block" style={{ color:'var(--text-dim)' }}>Sede</label>
          <select className="input-dark" style={{ minWidth:150 }} value={filtroSede} onChange={e => setFiltroSede(e.target.value)}>
            <option value="">Todas</option>
            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="font-metric text-xs tracking-wider uppercase mb-1 block" style={{ color:'var(--text-dim)' }}>Estado</label>
          <select className="input-dark" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="font-metric text-xs tracking-wider uppercase mb-1 block" style={{ color:'var(--text-dim)' }}>Tipo</label>
          <select className="input-dark" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos</option>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="font-metric text-xs tracking-wider uppercase mb-1 block" style={{ color:'var(--text-dim)' }}>Desde</label>
          <input type="date" className="input-dark" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} />
        </div>
        <div>
          <label className="font-metric text-xs tracking-wider uppercase mb-1 block" style={{ color:'var(--text-dim)' }}>Hasta</label>
          <input type="date" className="input-dark" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} />
        </div>
        <button onClick={() => { setFiltroSede(''); setFiltroEstado(''); setFiltroTipo(''); setFiltroDesde(''); setFiltroHasta('') }}
          className="btn-ghost" style={{ padding:'0.35rem 0.75rem' }}>
          Limpiar
        </button>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 rounded-full border-2 animate-spin"
            style={{ borderColor:'var(--phosphor)', borderTopColor:'transparent' }} />
        </div>
      ) : vista === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {KANBAN_COLS.map(col => {
            const colItems = items.filter(e => e.estado === col.estado)
            return (
              <div key={col.estado}
                onDragOver={(ev) => { if (canManage) ev.preventDefault() }}
                onDrop={(ev) => {
                  ev.preventDefault()
                  if (!canManage) return
                  const it = items.find(x => x.id === dragId)
                  if (it && it.estado !== col.estado) handleEstado(dragId, col.estado)
                }}
                className="rounded p-2.5" style={{ borderRadius:'3px', border:`1px solid ${col.border}`, background: col.bg, minHeight: 220 }}>
                <div className="flex items-center justify-between mb-2.5 px-0.5">
                  <span style={{ color: col.color, fontWeight:700, fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                    {col.estado}
                  </span>
                  <span style={{ color: col.color, fontSize:'0.7rem', fontWeight:700 }}>{colItems.length}</span>
                </div>
                <div className="space-y-2" style={{ maxHeight:'calc(100vh - 360px)', overflowY:'auto' }}>
                  {colItems.map(e => {
                    const tipoColor = TIPO_COLOR[e.tipo] || '#9ca3af'
                    return (
                      <div key={e.id} draggable={canManage}
                        onDragStart={() => setDragId(e.id)}
                        onDragEnd={() => setDragId(null)}
                        className="glass rounded p-2.5"
                        style={{ borderRadius:'3px', borderLeft:`3px solid ${tipoColor}`, cursor:canManage?'grab':'default', opacity: dragId === e.id ? 0.4 : 1 }}>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span style={{ background:`${tipoColor}18`, border:`1px solid ${tipoColor}55`, borderRadius:3, padding:'0.12rem 0.4rem', fontSize:'0.6rem', color: tipoColor, fontWeight:700 }}>
                            {e.tipo || 'General'}
                          </span>
                          <span style={{ color:'var(--text-dim)', fontSize:'0.62rem' }}>
                            {e.fecha_reporte ? fmtFecha(e.fecha_reporte + 'T12:00:00') : '—'}
                          </span>
                        </div>
                        <p style={{ color:'var(--text)', fontWeight:600, fontSize:'0.75rem', marginBottom:'0.2rem' }}>
                          {e.sede_nombre || '—'}
                        </p>
                        <p style={{ color:'var(--text-dim)', fontSize:'0.7rem', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', marginBottom:'0.35rem' }}>
                          {e.descripcion || '—'}
                        </p>
                        <div className="flex items-center justify-between gap-1.5">
                          <span style={{ color:'var(--text-dim)', fontSize:'0.65rem' }}>{e.reportante || '—'}</span>
                          <div className="flex items-center gap-1.5">
                            {e.registro_id && (
                              <button onClick={() => setSelRegId(e.registro_id)}
                                className="btn-ghost" style={{ padding:'0.15rem 0.4rem', fontSize:'0.58rem' }}>
                                Ver
                              </button>
                            )}
                            {canManage && e.tipo === 'Mantenimiento' && (
                              tickets[e.id] ? (
                                <span title="Ticket de mantenimiento ya generado"
                                  style={{ color:'var(--phosphor)', fontSize:'0.58rem', fontWeight:700, whiteSpace:'nowrap' }}>
                                  Ticket #{tickets[e.id].numero}
                                </span>
                              ) : (
                                <button onClick={() => abrirGenerarTicket(e)}
                                  className="btn-ghost flex items-center gap-1" style={{ padding:'0.15rem 0.4rem', fontSize:'0.58rem', color:'#F59E0B' }}>
                                  <Wrench size={9} /> Generar ticket
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {colItems.length === 0 && (
                    <p style={{ color:'var(--text-dim)', fontSize:'0.68rem', textAlign:'center', padding:'1.5rem 0' }}>
                      Sin items
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="glass rounded overflow-hidden" style={{ borderRadius:'3px' }}>
          <div className="overflow-x-auto">
            <table className="table-dark w-full">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Sede</th>
                  <th>Tipo</th>
                  <th className="hidden lg:table-cell">Descripción</th>
                  <th>Reportante</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {items.map(e => {
                  const tipoColor = TIPO_COLOR[e.tipo] || '#9ca3af'
                  const estChip   = ESTADO_STYLE[e.estado]?.chip || 'chip-gray'
                  return (
                    <tr key={e.id}>
                      <td>
                        <p style={{ color:'var(--text)', fontWeight:500, fontSize:'0.78rem' }}>
                          {e.fecha_reporte ? fmtFecha(e.fecha_reporte + 'T12:00:00') : '—'}
                        </p>
                      </td>
                      <td style={{ color:'var(--text)', fontWeight:500, fontSize:'0.78rem' }}>
                        {e.sede_nombre || '—'}
                      </td>
                      <td>
                        <span style={{
                          background: `${tipoColor}18`,
                          border: `1px solid ${tipoColor}55`,
                          borderRadius: 3, padding: '0.15rem 0.45rem',
                          fontSize: '0.62rem', color: tipoColor, fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}>
                          {e.tipo || 'General'}
                        </span>
                      </td>
                      <td className="hidden lg:table-cell">
                        <p style={{ color:'var(--text-dim)', fontSize:'0.73rem', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                          title={e.descripcion}>
                          {e.descripcion || '—'}
                        </p>
                      </td>
                      <td style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>
                        {e.reportante || '—'}
                      </td>
                      <td>
                        <span className={`chip ${estChip}`} style={{ fontSize:'0.6rem' }}>{e.estado}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {e.registro_id && (
                            <button onClick={() => setSelRegId(e.registro_id)}
                              className="btn-ghost" style={{ padding:'0.2rem 0.5rem', fontSize:'0.62rem' }}>
                              Ver reporte
                            </button>
                          )}
                          {canManage && e.tipo === 'Mantenimiento' && (
                            tickets[e.id] ? (
                              <span title="Ticket de mantenimiento ya generado"
                                style={{ color:'var(--phosphor)', fontSize:'0.62rem', fontWeight:700, whiteSpace:'nowrap' }}>
                                Ticket #{tickets[e.id].numero}
                              </span>
                            ) : (
                              <button onClick={() => abrirGenerarTicket(e)}
                                className="btn-ghost flex items-center gap-1" style={{ padding:'0.2rem 0.5rem', fontSize:'0.62rem', color:'#F59E0B' }}>
                                <Wrench size={10} /> Generar ticket
                              </button>
                            )
                          )}
                          {canManage && e.estado === 'Pendiente' && (
                            <button
                              onClick={() => handleEstado(e.id, 'En gestión')}
                              disabled={updating === e.id}
                              className="btn-ghost" style={{ padding:'0.2rem 0.5rem', fontSize:'0.62rem', color:'#50b4ff' }}>
                              {updating === e.id ? '...' : '→ En gestión'}
                            </button>
                          )}
                          {canManage && e.estado === 'En gestión' && (
                            <button
                              onClick={() => handleEstado(e.id, 'Resuelto')}
                              disabled={updating === e.id}
                              className="btn-ghost" style={{ padding:'0.2rem 0.5rem', fontSize:'0.62rem', color:'var(--phosphor)' }}>
                              {updating === e.id ? '...' : '→ Resuelto'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <CheckCircle size={28} style={{ color:'var(--phosphor)', margin:'0 auto 8px' }} />
                      <p style={{ color:'var(--text-dim)', fontSize:'0.8rem' }}>Sin escalamientos con los filtros actuales</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selRegId && (
        <RegistroModal
          registro={selRegistro}
          onClose={() => setSelRegId(null)}
          onCreateTarea={() => setSelRegId(null)}
        />
      )}

      {ticketOrigen && (
        <TicketRapidoModal
          origen={ticketOrigen}
          onClose={() => setTicketOrigen(null)}
          onCreated={handleTicketCreado}
        />
      )}
    </div>
  )
}
