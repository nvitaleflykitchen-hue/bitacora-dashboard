import { useState, useEffect, useCallback } from 'react'
import { getPlanes, getProveedores, getResponsablesMnt, getTickets, updateTicket } from '../lib/queries'
import { TICKET_ESTADOS, TICKET_ESTADO_COLOR, PRIORIDAD_COLOR } from '../lib/estados'
import { toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'
import SkeletonTable from '../components/SkeletonTable'
import EmptyState from '../components/EmptyState'
import { CalendarClock, Truck, Phone, Mail, ChevronRight, Users, Star } from 'lucide-react'

// Tabs extra del hub de Mantenimiento mobile: Planes, Proveedores,
// Responsables y Tablero (kanban simplificado). Lectura + acciones mínimas
// de campo; el alta/edición completa vive en escritorio.

const hoy = () => new Date().toISOString().slice(0, 10)
const diasHasta = f => f ? Math.ceil((new Date(f) - new Date(hoy())) / 86400000) : null

function Card({ children, border }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '0.6rem',
      borderLeft: border ? `3px solid ${border}` : undefined,
    }}>
      {children}
    </div>
  )
}

function llamar(tel) { window.open(`tel:${String(tel).replace(/[^\d+]/g, '')}`, '_self') }

// ── PLANES PREVENTIVOS ────────────────────────────────────────────────────────
export function TabPlanes() {
  const [planes, setPlanes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPlanes().then(p => setPlanes((p || []).filter(x => x.activo !== false)))
      .catch(e => toast.error(mensajeError(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonTable filas={6} columnas={2} />
  if (!planes.length) return <EmptyState icono={CalendarClock} titulo="Sin planes preventivos" detalle="Los planes se crean desde la versión de escritorio." />

  return (
    <div className="mobile-scroll" style={{ padding: '0.75rem 1rem', height: '100%' }}>
      {planes.map(p => {
        const d = diasHasta(p.proxima_fecha)
        const color = d === null ? 'var(--text-dim)' : d < 0 ? '#FF2A2A' : d <= 7 ? '#F59E0B' : '#39FF14'
        return (
          <Card key={p.id} border={color}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>{p.nombre}</p>
              <span style={{ color, fontSize: '0.62rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {d === null ? 'Sin fecha' : d < 0 ? `Vencido ${-d}d` : d === 0 ? 'HOY' : `En ${d}d`}
              </span>
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem', margin: '4px 0 0' }}>
              {p.activo_nombre || p.tipo_activo || '—'} · {p.frecuencia || ''}
              {p.responsable_nombre ? ` · ${p.responsable_nombre}` : ''}
            </p>
            {p.proxima_fecha && (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.65rem', margin: '3px 0 0' }}>
                Próxima: {p.proxima_fecha}{p.ultimo_realizado ? ` · Último: ${p.ultimo_realizado}` : ''}
              </p>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ── PROVEEDORES ───────────────────────────────────────────────────────────────
export function TabProveedores({ allowedSedeIds }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    getProveedores(allowedSedeIds || null).then(setItems)
      .catch(e => toast.error(mensajeError(e)))
      .finally(() => setLoading(false))
  }, [allowedSedeIds])

  const filtrados = items.filter(p =>
    !q || `${p.nombre} ${p.categoria || ''} ${p.contacto || ''}`.toLowerCase().includes(q.toLowerCase()))

  if (loading) return <SkeletonTable filas={6} columnas={2} />

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '0.6rem 1rem 0.2rem', flexShrink: 0 }}>
        <input className="input-dark w-full" placeholder="Buscar proveedor..." value={q}
          onChange={e => setQ(e.target.value)} style={{ fontSize: '0.8rem' }} />
      </div>
      <div className="mobile-scroll" style={{ flex: 1, padding: '0.6rem 1rem' }}>
        {!filtrados.length ? (
          <EmptyState icono={Truck} titulo="Sin proveedores" detalle={q ? 'Nada coincide con la búsqueda.' : 'El alta se hace desde escritorio.'} />
        ) : filtrados.map(p => (
          <Card key={p.id} border={p.estado === 'bloqueado' ? '#FF2A2A' : p.estado === 'inactivo' ? '#6B7280' : '#39FF14'}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>{p.nombre}</p>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem', margin: '3px 0 0' }}>
                  {p.categoria || '—'}{p.contacto ? ` · ${p.contacto}` : ''}
                </p>
                {p.rating > 0 && (
                  <p style={{ color: '#F59E0B', fontSize: '0.65rem', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Star size={10} fill="#F59E0B" /> {p.rating}/5
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {p.telefono && (
                  <button onClick={() => llamar(p.telefono)} style={{ background: 'rgba(57,255,20,0.1)', border: 'none', borderRadius: 8, padding: 10, color: 'var(--phosphor)', display: 'flex' }}>
                    <Phone size={15} />
                  </button>
                )}
                {p.email && (
                  <button onClick={() => window.open(`mailto:${p.email}`, '_self')} style={{ background: 'rgba(59,130,246,0.1)', border: 'none', borderRadius: 8, padding: 10, color: '#60A5FA', display: 'flex' }}>
                    <Mail size={15} />
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── RESPONSABLES ──────────────────────────────────────────────────────────────
export function TabResponsables() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getResponsablesMnt().then(setItems)
      .catch(e => toast.error(mensajeError(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonTable filas={5} columnas={2} />
  if (!items.length) return <EmptyState icono={Users} titulo="Sin responsables" detalle="El alta se hace desde escritorio." />

  return (
    <div className="mobile-scroll" style={{ padding: '0.75rem 1rem', height: '100%' }}>
      {items.map(r => (
        <Card key={r.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>{r.nombre}</p>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem', margin: '3px 0 0' }}>
                {r.rol || '—'}{r.nivel_escalacion ? ` · Nivel ${r.nivel_escalacion}` : ''}
              </p>
            </div>
            {r.telefono && (
              <button onClick={() => llamar(r.telefono)} style={{ background: 'rgba(57,255,20,0.1)', border: 'none', borderRadius: 8, padding: 10, color: 'var(--phosphor)', display: 'flex' }}>
                <Phone size={15} />
              </button>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── TABLERO (kanban simplificado) ────────────────────────────────────────────
export function TabTablero({ allowedSedeIds, canManage }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    getTickets({ sedeIds: allowedSedeIds || undefined })
      .then(t => setTickets((t || []).filter(x =>
        !['resuelto', 'rechazado'].includes(x.estado) &&
        (allowedSedeIds === null || allowedSedeIds === undefined || allowedSedeIds.includes(x.sede_id)))))
      .catch(e => toast.error(mensajeError(e)))
      .finally(() => setLoading(false))
  }, [allowedSedeIds])

  useEffect(() => { load() }, [load])

  const avanzar = async (t) => {
    const idx = TICKET_ESTADOS.indexOf(t.estado)
    const siguiente = TICKET_ESTADOS[idx + 1]
    if (!siguiente) return
    try {
      await updateTicket(t.id, { estado: siguiente })
      setTickets(prev => siguiente === 'resuelto'
        ? prev.filter(x => x.id !== t.id)
        : prev.map(x => x.id === t.id ? { ...x, estado: siguiente } : x))
      toast.ok(`#${t.numero || t.id} → ${siguiente.replace('_', ' ')}`)
    } catch (e) { toast.error(mensajeError(e)) }
  }

  if (loading) return <SkeletonTable filas={6} columnas={2} />

  const columnas = TICKET_ESTADOS.filter(e => !['resuelto', 'rechazado'].includes(e))

  return (
    <div style={{ height: '100%', display: 'flex', overflowX: 'auto', gap: 10, padding: '0.75rem 1rem', minHeight: 0 }}>
      {columnas.map(estado => {
        const items = tickets.filter(t => t.estado === estado)
        const color = TICKET_ESTADO_COLOR[estado]
        return (
          <div key={estado} style={{ minWidth: '78vw', maxWidth: '78vw', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.4rem 0.7rem', borderRadius: 8, marginBottom: 8, flexShrink: 0,
              background: `${color}14`, border: `1px solid ${color}40`,
            }}>
              <span style={{ color, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em' }}>{estado.replace('_', ' ').toUpperCase()}</span>
              <span style={{ color, fontSize: '0.68rem', fontWeight: 800 }}>{items.length}</span>
            </div>
            <div className="mobile-scroll" style={{ flex: 1 }}>
              {items.map(t => (
                <Card key={t.id} border={PRIORIDAD_COLOR[t.prioridad]}>
                  <p style={{ color: 'var(--text)', fontSize: '0.78rem', fontWeight: 600, margin: 0, lineHeight: 1.35 }}>
                    #{t.numero || t.id} · {(t.descripcion || '').slice(0, 80)}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.62rem' }}>{t.sede || ''} · {t.prioridad}</span>
                    {canManage && TICKET_ESTADOS.indexOf(t.estado) < TICKET_ESTADOS.indexOf('resuelto') && (
                      <button onClick={() => avanzar(t)} style={{
                        display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(57,255,20,0.1)',
                        border: '1px solid rgba(57,255,20,0.25)', borderRadius: 6, color: 'var(--phosphor)',
                        fontSize: '0.6rem', fontWeight: 700, padding: '0.35rem 0.55rem', cursor: 'pointer',
                      }}>
                        {TICKET_ESTADOS[TICKET_ESTADOS.indexOf(t.estado) + 1]?.replace('_', ' ')} <ChevronRight size={11} />
                      </button>
                    )}
                  </div>
                </Card>
              ))}
              {!items.length && (
                <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem', textAlign: 'center', paddingTop: '1.5rem' }}>Vacío</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
