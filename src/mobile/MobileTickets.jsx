import { useState, useEffect, useCallback } from 'react'
import { getTickets, updateTicket, getResponsablesMnt, getSedes, getActivos } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { ChevronRight, ChevronLeft, Wrench, Calendar, MessageCircle, Mail, Plus, RefreshCw, AlertTriangle, FileText } from 'lucide-react'
import { fmtFecha } from '../lib/dateUtils'
import TicketRapidoModal from '../components/TicketRapidoModal'
import ComentariosHilo from '../components/ComentariosHilo'
import MobileContactosBtn from './MobileContactosBtn'
import { toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'

import {
  TICKET_ESTADO_COLOR as ESTADO_COLOR, TICKET_ESTADOS as ESTADOS, PRIORIDAD_COLOR,
} from '../lib/estados'
import SkeletonTable from '../components/SkeletonTable'
import { generarReporteEficienciaMnt } from '../lib/mntEficienciaPdf'
import { useBackHandler } from '../lib/backStack'
import AdjuntosPanel from '../components/AdjuntosPanel'
import {
  enrichMobileTickets,
  findOwnMaintenanceResponsible,
  isClosedMaintenanceTicket,
  sortMobileMaintenanceWork,
} from '../lib/mobileMaintenance'

function SedePill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, padding: '0.25rem 0.65rem', borderRadius: 20, fontSize: '0.62rem',
      fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
      background: active ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.05)',
      border: active ? '1px solid rgba(57,255,20,0.4)' : '1px solid rgba(255,255,255,0.08)',
      color: active ? 'var(--phosphor)' : 'var(--text-dim)',
    }}>
      {label}
    </button>
  )
}

function shareTicket(ticket, responsable, channel) {
  const numero = ticket.numero || ticket.id || 'nuevo'
  const cuerpo = [
    `Hola ${responsable.nombre || ''},`,
    '',
    `Se te asignó el Ticket de Mantenimiento #${numero}:`,
    '',
    `Descripción: ${ticket.descripcion || '—'}`,
    ticket.activo_nombre ? `Activo: ${ticket.activo_nombre}` : null,
    `Sede: ${ticket.sede || 'Sin sede'}`,
    `Prioridad: ${(ticket.prioridad || '—').toUpperCase()}`,
    ticket.fecha_limite ? `Fecha límite: ${fmtFecha(ticket.fecha_limite)}` : null,
    '',
    'Fly Kitchen — Kitchen-OS',
  ].filter(Boolean).join('\n')

  if (channel === 'whatsapp') {
    if (!responsable.telefono) { toast.warn('El responsable no tiene teléfono registrado.'); return }
    const phone = responsable.telefono.replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(cuerpo)}`, '_blank', 'noopener,noreferrer')
    return
  }
  if (!responsable.email) { toast.warn('El responsable no tiene email registrado.'); return }
  const subject = encodeURIComponent(`[Ticket #${numero}] ${(ticket.descripcion || '').substring(0, 50)}`)
  window.open(`mailto:${responsable.email}?subject=${subject}&body=${encodeURIComponent(cuerpo)}`, '_blank')
}

// ── FICHA COMPLETA DE TICKET ──────────────────────────────────────────────────
function TicketDetalle({ ticket: initialTicket, canManage, isMaintenanceEditor, responsables, onBack, onUpdate, updating }) {
  const [ticket, setTicket] = useState(initialTicket)
  const [diagnostico, setDiagnostico] = useState(initialTicket.diagnostico || '')
  const [saving, setSaving] = useState(false)

  const handleUpdate = async (payload) => {
    try {
      await onUpdate(ticket.id, payload)
      setTicket(prev => ({ ...prev, ...payload }))
    } catch (_) {}
  }

  const handleSaveDiagnostico = async () => {
    setSaving(true)
    try {
      await onUpdate(ticket.id, { diagnostico })
      setTicket(prev => ({ ...prev, diagnostico }))
    } finally { setSaving(false) }
  }

  const handleStartWork = async () => {
    await handleUpdate({ estado: 'en_progreso' })
  }

  const handleFinishWork = async () => {
    if (!diagnostico.trim()) {
      toast.warn('Antes de finalizar, describí el trabajo realizado.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        diagnostico: diagnostico.trim(),
        estado: 'resuelto',
        fecha_cierre: new Date().toISOString(),
      }
      await onUpdate(ticket.id, payload)
      setTicket(prev => ({ ...prev, ...payload }))
      toast.ok('Trabajo finalizado y registrado.')
    } finally { setSaving(false) }
  }

  const pColor = PRIORIDAD_COLOR[String(ticket.prioridad).toLowerCase()] || '#555'
  const eColor = ESTADO_COLOR[ticket.estado] || '#777'
  const tipoColor = ticket.tipo === 'preventivo' ? '#50b4ff' : '#F59E0B'
  const responsableActual = (responsables || []).find(r => r.id === ticket.responsable_id) || null

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '0.85rem 1rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', color: 'var(--phosphor)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.6rem', padding: 0 }}>
          <ChevronLeft size={16} /> Tickets
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, marginRight: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ color: 'var(--phosphor)', fontSize: '0.7rem', fontWeight: 800 }}>#{ticket.numero}</span>
              <span style={{ background: `${tipoColor}18`, border: `1px solid ${tipoColor}55`, borderRadius: 3, padding: '0.1rem 0.35rem', fontSize: '0.6rem', color: tipoColor, fontWeight: 700, textTransform: 'uppercase' }}>
                {ticket.tipo}
              </span>
            </div>
            <h1 style={{ color: 'var(--text)', fontSize: '1rem', fontWeight: 700, lineHeight: 1.3, margin: 0 }}>
              {ticket.activo_nombre || 'Mantenimiento General'}
            </h1>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span style={{ background: `${pColor}22`, color: pColor, fontSize: '0.6rem', padding: '0.2rem 0.45rem', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase' }}>
              {ticket.prioridad}
            </span>
            <span style={{ background: `${eColor}22`, color: eColor, fontSize: '0.6rem', padding: '0.2rem 0.45rem', borderRadius: 12, fontWeight: 700, textTransform: 'uppercase' }}>
              {ticket.estado?.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="mobile-scroll" style={{ flex: 1, padding: '0.85rem 1rem 1.5rem' }}>

        {/* Descripción */}
        <Section label="Descripción">
          <p style={{ color: 'var(--text)', fontSize: '0.82rem', lineHeight: 1.5 }}>{ticket.descripcion || 'Sin descripción'}</p>
        </Section>

        {/* Meta */}
        <Section label="Detalles">
          <Row label="Sede" value={ticket.sede || '—'} />
          {ticket.activo_nombre && <Row label="Activo" value={ticket.activo_nombre} />}
          {ticket.fecha_limite && <Row label="Fecha límite" value={fmtFecha(ticket.fecha_limite)} />}
          {ticket.created_at && <Row label="Creado" value={fmtFecha(ticket.created_at)} />}
        </Section>

        {/* Estado */}
        {canManage && !isMaintenanceEditor && (
          <Section label="Estado">
            <select
              value={ticket.estado}
              onChange={e => handleUpdate({ estado: e.target.value })}
              disabled={updating === ticket.id}
              className="input-dark w-full"
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem' }}
            >
              {ESTADOS.map(e => (
                <option key={e} value={e}>{e.replace('_', ' ').charAt(0).toUpperCase() + e.replace('_', ' ').slice(1)}</option>
              ))}
            </select>
          </Section>
        )}

        {/* Responsable */}
        <Section label="Responsable">
          {canManage && !isMaintenanceEditor ? (
            <>
              <select
                value={ticket.responsable_id || ''}
                onChange={e => handleUpdate({ responsable_id: e.target.value || null })}
                disabled={updating === ticket.id}
                className="input-dark w-full"
                style={{ fontSize: '0.82rem', padding: '0.45rem 0.6rem', marginBottom: 8 }}
              >
                <option value="">Sin asignar</option>
                {(responsables || []).map(r => (
                  <option key={r.id} value={r.id}>{r.nombre}{r.rol ? ` — ${r.rol}` : ''}</option>
                ))}
              </select>
              {responsableActual && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => shareTicket(ticket, responsableActual, 'whatsapp')}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366', borderRadius: 6, padding: '0.4rem', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <MessageCircle size={13} /> WhatsApp
                  </button>
                  <button type="button" onClick={() => shareTicket(ticket, responsableActual, 'email')}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'rgba(99,179,237,0.1)', border: '1px solid rgba(99,179,237,0.25)', color: '#63B3ED', borderRadius: 6, padding: '0.4rem', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Mail size={13} /> Email
                  </button>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--text)', fontSize: '0.82rem' }}>
              {isMaintenanceEditor ? 'Asignado a vos' : (responsableActual?.nombre || 'Sin asignar')}
            </p>
          )}
        </Section>

        {/* Diagnóstico */}
        <Section label="Diagnóstico / Trabajo realizado">
          {canManage ? (
            <>
              <textarea
                value={diagnostico}
                onChange={e => setDiagnostico(e.target.value)}
                className="input-dark w-full"
                rows={3}
                style={{ fontSize: '0.82rem', padding: '0.5rem', resize: 'none', marginBottom: 6 }}
                placeholder="Detallar el trabajo realizado..."
              />
              <button
                onClick={handleSaveDiagnostico}
                disabled={saving || diagnostico === ticket.diagnostico}
                className="btn-primary w-full"
                style={{ padding: '0.5rem', fontSize: '0.78rem' }}
              >
                {saving ? 'Guardando...' : 'Guardar diagnóstico'}
              </button>
            </>
          ) : (
            <p style={{ color: 'var(--text)', fontSize: '0.82rem', lineHeight: 1.5 }}>{ticket.diagnostico || 'Sin diagnóstico aún.'}</p>
          )}
        </Section>

        <Section label="Evidencias">
          <AdjuntosPanel
            entityType="ticket"
            entityId={ticket.id}
            compact
            camera
            readOnly={!canManage || isClosedMaintenanceTicket(ticket)}
            label="Fotos y archivos"
          />
        </Section>

        {canManage && isMaintenanceEditor && (
          <Section label="Avance del trabajo">
            {isClosedMaintenanceTicket(ticket) ? (
              <p style={{ color: 'var(--phosphor)', fontSize: '0.82rem', fontWeight: 700 }}>
                ✓ Trabajo finalizado
              </p>
            ) : ticket.estado === 'en_progreso' ? (
              <button
                type="button"
                onClick={handleFinishWork}
                disabled={saving || updating === ticket.id}
                className="btn-primary w-full"
                style={{ padding: '0.65rem', fontSize: '0.8rem' }}>
                {saving ? 'Finalizando...' : 'Finalizar trabajo'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartWork}
                disabled={updating === ticket.id}
                className="btn-primary w-full"
                style={{ padding: '0.65rem', fontSize: '0.8rem' }}>
                {updating === ticket.id ? 'Actualizando...' : 'Iniciar trabajo'}
              </button>
            )}
          </Section>
        )}

        {/* Comentarios */}
        <Section label="Comentarios">
          <ComentariosHilo entidadTipo="ticket" entidadId={ticket.id} compact />
        </Section>
      </div>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: '1.1rem' }}>
      <p style={{ color: 'var(--phosphor)', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', opacity: 0.8 }}>{label}</p>
      <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '0.75rem 0.85rem' }}>{children}</div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
      <span style={{ color: 'var(--text-dim)', fontSize: '0.68rem' }}>{label}</span>
      <span style={{ color: 'var(--text)', fontSize: '0.75rem', fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}

// ── CARD COMPACTA ─────────────────────────────────────────────────────────────
function TicketCard({ t, onClick }) {
  const pColor = PRIORIDAD_COLOR[String(t.prioridad).toLowerCase()] || '#555'
  const eColor = ESTADO_COLOR[t.estado] || '#777'
  const tipoColor = t.tipo === 'preventivo' ? '#50b4ff' : '#F59E0B'

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        background: 'var(--surface)', borderRadius: 10, padding: '0.9rem 1rem',
        marginBottom: '0.6rem', cursor: 'pointer',
        border: '1px solid rgba(255,255,255,0.05)',
        borderLeft: `3px solid ${pColor}`,
        display: 'flex', alignItems: 'center', gap: '0.75rem',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ color: 'var(--phosphor)', fontSize: '0.65rem', fontWeight: 800 }}>#{t.numero}</span>
          <span style={{ background: `${tipoColor}18`, border: `1px solid ${tipoColor}44`, borderRadius: 3, padding: '0.1rem 0.3rem', fontSize: '0.6rem', color: tipoColor, fontWeight: 700, textTransform: 'uppercase' }}>
            {t.tipo}
          </span>
        </div>
        <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.88rem', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.activo_nombre || 'Mantenimiento General'}
        </p>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.descripcion || 'Sin descripción'}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ background: `${eColor}22`, color: eColor, fontSize: '0.6rem', padding: '0.15rem 0.4rem', borderRadius: 12, fontWeight: 700, textTransform: 'uppercase' }}>
            {t.estado?.replace('_', ' ')}
          </span>
          {t.sede && <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>{t.sede}</span>}
          {t.fecha_limite && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-dim)', fontSize: '0.65rem' }}>
              <Calendar size={9} /> {fmtFecha(t.fecha_limite)}
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={15} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
    </button>
  )
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function MobileTickets() {
  const { allowedSedeIds, can, perfil } = useAuth()
  const isMaintenanceEditor = perfil?.rol === 'mnt_editor'
  const canManage = can('mantenimiento', 'manage') || can('mantenimiento', 'edit')
  const [tickets, setTickets] = useState([])
  const [responsables, setResponsables] = useState([])
  const [sedes, setSedes] = useState([])
  const [activos, setActivos] = useState([])
  const [catalogsReady, setCatalogsReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [filtro, setFiltro] = useState(isMaintenanceEditor ? 'mios' : 'activos')
  const [selectedSede, setSelectedSede] = useState(null)
  const [selectedTicket, setSelectedTicket] = useState(null)
  useBackHandler(() => setSelectedTicket(null), !!selectedTicket)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    let active = true
    setCatalogsReady(false)
    Promise.all([
      getResponsablesMnt(),
      getSedes(allowedSedeIds || undefined),
      getActivos({ sedeIds: allowedSedeIds || undefined }),
    ]).then(([nextResponsables, nextSedes, nextActivos]) => {
      if (!active) return
      setResponsables(nextResponsables)
      setSedes(nextSedes)
      setActivos(nextActivos)
      setCatalogsReady(true)
    }).catch(error => {
      console.error(error)
      if (active) setCatalogsReady(true)
    })
    return () => { active = false }
  }, [allowedSedeIds])

  const load = useCallback(() => {
    if (!catalogsReady) return
    setLoading(true)
    const ownResponsible = isMaintenanceEditor
      ? findOwnMaintenanceResponsible(perfil, responsables)
      : null

    if (isMaintenanceEditor && !ownResponsible) {
      setTickets([])
      setLoading(false)
      return
    }

    getTickets({
      sedeIds: allowedSedeIds || undefined,
      responsable_id: ownResponsible?.id,
    })
      .then(data => {
        const enriched = enrichMobileTickets(data, sedes, activos)
        setTickets(sortMobileMaintenanceWork(enriched))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [activos, allowedSedeIds, catalogsReady, isMaintenanceEditor, perfil, responsables, sedes])

  useEffect(() => { load() }, [load])

  const handleUpdate = async (id, payload) => {
    setUpdating(id)
    try {
      await updateTicket(id, payload)
      setTickets(prev => prev.map(t => t.id === id ? { ...t, ...payload } : t))
      // Actualizar también el ticket seleccionado si está abierto
      if (selectedTicket?.id === id) setSelectedTicket(prev => ({ ...prev, ...payload }))
    } catch (e) {
      toast.error('Error: ' + mensajeError(e))
    } finally {
      setUpdating(null)
    }
  }

  const filtrados = tickets.filter(t => {
    if (isMaintenanceEditor && filtro === 'mios' && isClosedMaintenanceTicket(t)) return false
    if (!isMaintenanceEditor && filtro === 'activos' && isClosedMaintenanceTicket(t)) return false
    if (!isMaintenanceEditor && filtro === 'mios') {
      if (isClosedMaintenanceTicket(t)) return false
      const ownResponsible = findOwnMaintenanceResponsible(perfil, responsables)
      if (!ownResponsible || String(t.responsable_id) !== String(ownResponsible.id)) return false
    }
    if (selectedSede && String(t.sede_id) !== String(selectedSede.id)) return false
    return true
  })

  // Vista ficha
  if (selectedTicket) {
    return (
      <TicketDetalle
        ticket={selectedTicket}
        canManage={canManage}
        isMaintenanceEditor={isMaintenanceEditor}
        responsables={responsables}
        onBack={() => setSelectedTicket(null)}
        onUpdate={handleUpdate}
        updating={updating}
      />
    )
  }

  return (
    <div style={{ padding: '1.25rem 1rem 1rem', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: '1.3rem', fontWeight: 700 }}>
              {isMaintenanceEditor ? 'Mi trabajo' : 'Tickets'}
            </h1>
            {isMaintenanceEditor && !loading && (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.65rem', marginTop: 2 }}>
                {tickets.filter(t => !isClosedMaintenanceTicket(t)).length} pendientes asignados
              </p>
            )}
          </div>
          <MobileContactosBtn modulo="mantenimiento" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isMaintenanceEditor && <button
            title="Reporte de eficiencia PDF"
            onClick={async () => {
              try {
                toast('Generando reporte...')
                await generarReporteEficienciaMnt({
                  sedeId: selectedSede?.id || null,
                  sedeNombre: selectedSede?.nombre || null,
                })
                toast.ok('Reporte PDF descargado.')
              } catch (e) { toast.error('No se pudo generar el reporte: ' + mensajeError(e)) }
            }}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', padding: 2, cursor: 'pointer' }}>
            <FileText size={14} />
          </button>}
          <button title="Actualizar" onClick={load} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', padding: 6, cursor: 'pointer' }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.3rem', width: 'fit-content', background: 'var(--surface)', padding: '0.2rem', borderRadius: 20, marginBottom: '0.65rem', flexShrink: 0 }}>
        {isMaintenanceEditor ? (
          <>
            <button onClick={() => setFiltro('mios')} style={{ padding: '0.35rem 0.75rem', borderRadius: 16, fontSize: '0.68rem', fontWeight: 700, border: 'none', background: filtro === 'mios' ? 'rgba(57,255,20,0.15)' : 'transparent', color: filtro === 'mios' ? 'var(--phosphor)' : 'var(--text-dim)' }}>Pendientes</button>
            <button onClick={() => setFiltro('historial')} style={{ padding: '0.35rem 0.75rem', borderRadius: 16, fontSize: '0.68rem', fontWeight: 700, border: 'none', background: filtro === 'historial' ? 'rgba(57,255,20,0.15)' : 'transparent', color: filtro === 'historial' ? 'var(--phosphor)' : 'var(--text-dim)' }}>Historial</button>
          </>
        ) : (
          <>
            <button onClick={() => setFiltro('mios')} style={{ padding: '0.3rem 0.6rem', borderRadius: 16, fontSize: '0.65rem', fontWeight: 700, border: 'none', background: filtro === 'mios' ? 'rgba(57,255,20,0.15)' : 'transparent', color: filtro === 'mios' ? 'var(--phosphor)' : 'var(--text-dim)' }}>Mi trabajo</button>
            <button onClick={() => setFiltro('activos')} style={{ padding: '0.3rem 0.6rem', borderRadius: 16, fontSize: '0.65rem', fontWeight: 700, border: 'none', background: filtro === 'activos' ? 'rgba(57,255,20,0.15)' : 'transparent', color: filtro === 'activos' ? 'var(--phosphor)' : 'var(--text-dim)' }}>Activos</button>
            <button onClick={() => setFiltro('todos')} style={{ padding: '0.3rem 0.6rem', borderRadius: 16, fontSize: '0.65rem', fontWeight: 700, border: 'none', background: filtro === 'todos' ? 'rgba(57,255,20,0.15)' : 'transparent', color: filtro === 'todos' ? 'var(--phosphor)' : 'var(--text-dim)' }}>Todos</button>
          </>
        )}
      </div>

      {/* Pills de sede */}
      {sedes.length > 1 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: '0.65rem', flexShrink: 0 }} className="hide-scrollbar">
          <SedePill label="Todas" active={!selectedSede} onClick={() => setSelectedSede(null)} />
          {sedes.map(s => <SedePill key={s.id} label={s.nombre} active={selectedSede?.id === s.id} onClick={() => setSelectedSede(s)} />)}
        </div>
      )}

      {/* Lista */}
      <div className="mobile-scroll" style={{ flex: 1 }}>
        {loading ? (
          <SkeletonTable filas={6} columnas={2} />
        ) : filtrados.length === 0 ? (
          <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '2rem', textAlign: 'center', marginTop: '1rem' }}>
            <Wrench size={32} style={{ color: 'var(--phosphor)', margin: '0 auto 0.5rem', opacity: 0.8 }} />
            <p style={{ color: 'var(--text)', fontSize: '0.9rem' }}>
              {isMaintenanceEditor && filtro === 'mios' ? 'No tenés trabajos pendientes' : `Sin tickets${filtro === 'activos' ? ' activos' : ''}`}{selectedSede ? ` en ${selectedSede.nombre}` : ''}
            </p>
          </div>
        ) : filtrados.map(t => (
          <TicketCard key={t.id} t={t} onClick={() => setSelectedTicket(t)} />
        ))}
      </div>

      {canManage && (
        <button
          onClick={() => setShowModal(true)}
          aria-label="Crear nuevo ticket"
          title="Crear nuevo ticket"
          style={{
            position: 'absolute', bottom: '1.5rem', right: '1.5rem',
            width: 50, height: 50, borderRadius: 25,
            background: 'var(--phosphor)', color: '#000',
            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(57,255,20,0.3)', zIndex: 10
          }}
        >
          <Plus size={24} />
        </button>
      )}

      {showModal && (
        <TicketRapidoModal
          origen={{}}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
