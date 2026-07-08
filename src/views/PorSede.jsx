import { useState, useEffect, useCallback } from 'react'
import { es } from 'date-fns/locale'
import { getSedes, getRegistrosBySede, getCategoriasCONNovedad } from '../lib/queries'
import RegistroModal from '../components/RegistroModal'
import PageHeader from '../components/PageHeader'
import { fmtFechaReporte, fmtHoraReporte } from '../lib/dateUtils'
import TareaForm from '../components/TareaForm'
import TicketRapidoModal from '../components/TicketRapidoModal'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useAuth } from '../lib/auth'

function estadoChip(estado) {
  if (estado === 'Sin novedades') return <span className="chip chip-green">{estado}</span>
  if (estado === 'Hay novedades') return <span className="chip chip-yellow">{estado}</span>
  if (estado === 'Operación condicionada') return <span className="chip chip-red">{estado}</span>
  return <span className="chip chip-gray">{estado || '—'}</span>
}

export default function PorSede({ focusId, focusSedeId }) {
  const { allowedSedeIds } = useAuth()
  const [sedes, setSedes]     = useState([])
  const [sedeId, setSedeId]   = useState('')
  const [dias, setDias]         = useState(30)
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(false)
  const [selRegistro, setSelRegistro] = useState(null)
  const [tareaOrigen, setTareaOrigen]   = useState(null)
  const [tareaInitial, setTareaInitial] = useState(null)
  const [ticketOrigen, setTicketOrigen]   = useState(null)

  useEffect(() => {
    getSedes().then(all => {
      // Roles territoriales (grupo/encargado/sede) solo ven sus sedes asignadas
      const s = allowedSedeIds === null
        ? all
        : all.filter(sede => allowedSedeIds.includes(sede.id))
      setSedes(s)
      if (focusSedeId && s.some(sede => String(sede.id) === String(focusSedeId))) {
        setSedeId(String(focusSedeId))
      } else if (s.length > 0) {
        setSedeId(String(s[0].id))
      }
    })
  }, [allowedSedeIds, focusSedeId])

  const load = useCallback(async () => {
    if (!sedeId) return
    setLoading(true)
    try { setRegistros(await getRegistrosBySede(sedeId, dias)) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [sedeId, dias])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!focusId || loading) return
    const target = registros.find(registro => String(registro.id) === String(focusId))
    if (target) setSelRegistro(target)
  }, [focusId, loading, registros])

  // Deep-link desde notificación de comentario en un reporte
  useEffect(() => {
    const handler = (e) => {
      const { tipo, id } = e.detail || {}
      if (tipo !== 'registro' || !id) return
      const target = registros.find(r => String(r.id) === String(id))
      if (target) {
        setSelRegistro(target)
        delete window.__pendingDeepLink
      }
    }
    window.addEventListener('bitacora:deeplink', handler)
    return () => window.removeEventListener('bitacora:deeplink', handler)
  }, [registros])

  // Consumir deep-link pendiente después de cargar registros
  useEffect(() => {
    const dl = window.__pendingDeepLink
    if (dl?.tipo === 'registro' && dl?.id && registros.length > 0) {
      const target = registros.find(r => String(r.id) === String(dl.id))
      if (target) {
        setSelRegistro(target)
        delete window.__pendingDeepLink
      }
    }
  }, [registros])

  const sedeSel   = sedes.find(s => String(s.id) === String(sedeId))
  const sinNov    = registros.filter(r => r.estado_general === 'Sin novedades').length
  const pctClean  = registros.length > 0 ? Math.round((sinNov / registros.length) * 100) : 0
  const escals    = registros.filter(r => r.requiere_escalamiento).length

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 fade-in">
      {/* Header */}
      <PageHeader title="Por Sede" subtitle={`Últimos ${dias} días${sedeId ? '' : ' — todas las sedes'}`}>
        <button onClick={load} className="btn-ghost flex items-center gap-1.5" style={{ padding:'0.35rem 0.75rem' }}>
          <RefreshCw size={11} /> Actualizar
        </button>
      </PageHeader>

      {/* Selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <select className="input-dark mr-2" style={{ maxWidth:120 }} value={dias} onChange={e => setDias(Number(e.target.value))}>
          <option value={7}>7 días</option>
          <option value={30}>30 días</option>
          <option value={90}>90 días</option>
          <option value={180}>180 días</option>
          <option value={365}>1 año</option>
        </select>
        <select className="input-dark" style={{ maxWidth:240 }} value={sedeId} onChange={e => setSedeId(e.target.value)}>
          {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        {sedeSel?.tipo && <span className="chip chip-blue">{sedeSel.tipo}</span>}
      </div>

      {/* KPIs */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label:`Registros ${dias}d`, value: registros.length },
            { label:'% sin novedades', value: `${pctClean}%` },
            { label:'Escalamientos', value: escals, alert: escals > 0 },
          ].map(({ label, value, alert }) => (
            <div key={label} className="kpi-card">
              <p className="kpi-value" style={alert ? { color:'var(--alert)' } : {}}>{value}</p>
              <p className="kpi-label">{label}</p>
              <div className="progress-bar mt-2">
                <div className="progress-fill"
                  style={{
                    width: label.includes('%') ? value : '100%',
                    background: alert ? 'var(--alert)' : 'var(--phosphor)',
                  }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabla registros */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 rounded-full border-2 animate-spin"
            style={{ borderColor:'var(--phosphor)', borderTopColor:'transparent' }} />
        </div>
      ) : (
        <div className="glass rounded overflow-hidden" style={{ borderRadius:'3px' }}>
          <div className="overflow-x-auto">
            <table className="table-dark w-full">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th className="hidden sm:table-cell">Turno</th>
                  <th className="hidden md:table-cell">Reportante</th>
                  <th>Estado</th>
                  <th className="hidden lg:table-cell">Categorías</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {registros.map(r => {
                  const cats = getCategoriasCONNovedad(r)
                  return (
                    <tr key={r.id} className="cursor-pointer" onClick={() => setSelRegistro(r)}
                      style={{ background: r.requiere_escalamiento ? 'rgba(255,42,42,0.04)' : undefined }}>
                      <td>
                        <p className="font-medium" style={{ color:'var(--text)' }}>
                          {fmtFechaReporte(r.fecha_reporte)}
                        </p>
                        <p className="font-metric" style={{ color:'var(--text-dim)', fontSize:'0.68rem' }}>
                          {fmtHoraReporte(r.fecha_reporte)}
                        </p>
                      </td>
                      <td className="hidden sm:table-cell" style={{ color:'var(--text-dim)' }}>{r.turno || '—'}</td>
                      <td className="hidden md:table-cell" style={{ color:'var(--text-dim)', fontSize:'0.75rem', maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {r.reportante || '—'}
                      </td>
                      <td>{estadoChip(r.estado_general)}</td>
                      <td className="hidden lg:table-cell">
                        <div className="flex gap-1 flex-wrap">
                          {cats.length > 0
                            ? cats.map(c => <span key={c} className="chip chip-yellow" style={{ fontSize:'0.6rem' }}>{c}</span>)
                            : <span style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>—</span>}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {r.requiere_escalamiento && <AlertTriangle size={12} style={{ color:'var(--alert)' }} />}
                          <button onClick={e => { e.stopPropagation(); setTareaOrigen(r) }}
                            className="btn-ghost" style={{ padding:'0.2rem 0.5rem', fontSize:'0.62rem' }}>
                            + Tarea
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {registros.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10" style={{ color:'var(--text-dim)' }}>
                      Sin registros en los últimos 30 días
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selRegistro && (
        <RegistroModal registro={selRegistro} onClose={() => setSelRegistro(null)}
          onCreateTarea={(r, extra) => { setTareaOrigen(r); setTareaInitial(extra || null); setSelRegistro(null) }}
          onCreateTicket={(r, extra) => { setTicketOrigen({ registro: r, ...extra }); setSelRegistro(null) }} />
      )}
      {tareaOrigen && (
        <TareaForm registroOrigen={tareaOrigen} sedePreseleccionada={sedeSel}
          initialValues={tareaInitial}
          onClose={() => { setTareaOrigen(null); setTareaInitial(null) }}
          onCreated={() => { setTareaOrigen(null); setTareaInitial(null) }} />
      )}
      {ticketOrigen && (
        <TicketRapidoModal
          origen={ticketOrigen}
          onClose={() => setTicketOrigen(null)}
          onCreated={() => setTicketOrigen(null)} />
      )}
    </div>
  )
}
