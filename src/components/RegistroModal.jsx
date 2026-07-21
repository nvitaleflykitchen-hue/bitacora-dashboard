import { useState, useEffect } from 'react'
import { X, ExternalLink, AlertTriangle, Plus, Zap, MessageCircle, Mail, Users } from 'lucide-react'
import AdjuntosPanel from './AdjuntosPanel'
import ComentariosHilo from './ComentariosHilo'
import {
  getCategoriasCONNovedad,
  getPersonaNovedadesByRegistro,
  getSedeContactos,
  getVueloNovedadesByRegistro,
} from '../lib/queries'
import { fmtFechaHora, fmtFechaHoraReporte } from '../lib/dateUtils'
import { useAuth } from '../lib/auth'

const CATEGORIAS = [
  { key: 'a', label: 'Producción / Servicio del turno' },
  { key: 'b', label: 'Cadena de frío y conservación' },
  { key: 'c', label: 'Recepción / Abastecimiento' },
  { key: 'd', label: 'Stock crítico' },
  { key: 'e', label: 'Equipos / Mantenimiento' },
  { key: 'f', label: 'Higiene / BPM' },
  { key: 'g', label: 'Dotación y cobertura del turno' },
  { key: 'h', label: 'Cliente / Usuario / Incidentes' },
]

// Arma el texto a precargar en WhatsApp con el resumen de la novedad.
// Antes el botón "WA" abría el chat del contacto sin ningún mensaje (por eso
// "no salía nada" al compartir): el link a wa.me no llevaba parámetro `text`.
function buildMensajeWA(registro) {
  const lineas = [
    `📋 ${registro.sede_nombre || registro.sedes?.nombre || 'Reporte'} — ${fmtFechaHoraReporte(registro.fecha_reporte)}${registro.turno ? ` (turno ${registro.turno})` : ''}`,
  ]
  if (registro.estado_general) lineas.push(`Estado: ${registro.estado_general}`)
  const detalles = CATEGORIAS
    .filter(({ key }) => registro[`estado_${key}`] && registro[`estado_${key}`] !== 'Sin novedad' && registro[`estado_${key}`] !== 'Sin novedades')
    .map(({ key, label }) => `• ${label}: ${registro[`detalle_${key}`] || registro[`estado_${key}`]}`)
  if (detalles.length > 0) lineas.push('', 'Novedades:', ...detalles)
  if (registro.requiere_escalamiento && registro.motivo_escalamiento) {
    lineas.push('', `🚩 Escalado a ${registro.escalado_a || '—'}:`, registro.motivo_escalamiento)
  }
  return lineas.join('\n')
}

function estadoChip(estado) {
  if (!estado) return null
  if (estado === 'Sin novedades' || estado === 'Sin novedad') return <span className="chip chip-green">{estado}</span>
  if (estado === 'Hay novedades') return <span className="chip chip-yellow">{estado}</span>
  if (estado === 'Operación condicionada') return <span className="chip chip-red">{estado}</span>
  return <span className="chip chip-gray">{estado}</span>
}

function vueloChip(tipo) {
  const normalized = String(tipo || '').toLowerCase()
  if (normalized === 'ok') return <span className="chip chip-green">OK</span>
  if (normalized === 'demora') return <span className="chip chip-yellow">Demora</span>
  if (normalized === 'cancelado' || normalized === 'desvio' || normalized === 'desvío') return <span className="chip chip-red">{tipo}</span>
  return <span className="chip chip-blue">{tipo || 'Vuelo'}</span>
}

export default function RegistroModal({ registro, onClose, onCreateTarea, onCreateTicket, onCreateNC }) {
  const { can } = useAuth()
  const canManage = can('tareas', 'manage')
  const canAttach = canManage || can('bitacora', 'attach')
  const [showNCHint, setShowNCHint] = useState(false)
  const [responsables, setResponsables] = useState([])
  const [vuelosReporte, setVuelosReporte] = useState([])
  const [vuelosLoading, setVuelosLoading] = useState(false)
  const [vuelosError, setVuelosError] = useState('')
  const [personalReporte, setPersonalReporte] = useState([])
  const [personalLoading, setPersonalLoading] = useState(false)
  const [personalError, setPersonalError] = useState('')

  useEffect(() => {
    if (registro?.sede_id) {
      getSedeContactos(registro.sede_id).then(setResponsables).catch(()=>setResponsables([]))
    }
  }, [registro?.sede_id])

  useEffect(() => {
    if (!registro?.id) {
      setVuelosReporte([])
      setVuelosError('')
      return
    }

    setVuelosLoading(true)
    setVuelosError('')
    getVueloNovedadesByRegistro(registro.id)
      .then(setVuelosReporte)
      .catch(error => {
        console.error('No se pudieron cargar vuelos del registro:', error)
        setVuelosReporte([])
        setVuelosError(error?.message || 'No se pudieron cargar los vuelos del registro.')
      })
      .finally(() => setVuelosLoading(false))
  }, [registro?.id])

  useEffect(() => {
    if (!registro?.id) {
      setPersonalReporte([])
      setPersonalError('')
      return
    }

    setPersonalLoading(true)
    setPersonalError('')
    getPersonaNovedadesByRegistro(registro.id)
      .then(setPersonalReporte)
      .catch(error => {
        console.error('No se pudieron cargar novedades de personal del registro:', error)
        setPersonalReporte([])
        setPersonalError(error?.message || 'No se pudieron cargar las novedades de personal.')
      })
      .finally(() => setPersonalLoading(false))
  }, [registro?.id])

  if (!registro) return null
  const cats = getCategoriasCONNovedad(registro)

  const handleCatClick = (cat, catLabel, detalle) => {
    if (cat === 'e') {
      // Categoría E (Equipos/Mantenimiento) → ticket de mantenimiento
      if (!onCreateTicket) return
      onCreateTicket?.(registro, {
        descripcionInicial: detalle || '',
        sedeNombre: registro.sede_nombre || '',
        sedeId: registro.sede_id || null,
      })
    } else {
      // Resto de categorías → tarea general
      if (!onCreateTarea) return
      onCreateTarea?.(registro, {
        titulo: catLabel,
        categoria: cat.toUpperCase(),
        descripcion: detalle || '',
      })
    }
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="glass hud-corner fade-in w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded"
        style={{ borderRadius:'3px' }}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 sticky top-0"
          style={{ background:'var(--surface)', borderBottom:'1px solid rgba(57,255,20,0.08)', zIndex:1 }}>
          <div>
            <h2 className="font-title font-bold text-base" style={{ color:'var(--text)' }}>
              {registro.sede_nombre || registro.sedes?.nombre || `Registro #${registro.id}`}
            </h2>
            <p className="font-metric text-xs mt-0.5" style={{ color:'var(--text-dim)' }}>
              {fmtFechaHoraReporte(registro.fecha_reporte)}
              {registro.turno && ` · ${registro.turno}`}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5" style={{ padding:'0.3rem' }}>
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Estado general + escalamiento */}
          <div className="flex flex-wrap items-center gap-2">
            {estadoChip(registro.estado_general)}
            {registro.requiere_escalamiento && (
              <span className="chip chip-red flex items-center gap-1">
                <AlertTriangle size={10} /> Escalamiento
              </span>
            )}
            {registro.nivel_actividad && (
              <span className="chip chip-blue">{registro.nivel_actividad}</span>
            )}
          </div>

          {/* Contexto del reporte */}
          <div className="rounded p-4"
            style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.07)' }}>
            <p className="font-metric text-xs mb-3 tracking-wider" style={{ color:'var(--phosphor)', opacity:0.7 }}>
              DATOS DEL REPORTE
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {[
                { label:'SEDE', value: registro.sede_nombre || registro.sedes?.nombre },
                { label:'REPORTANTE', value: registro.reportante },
                { label:'EMAIL', value: registro.email_reportante },
                { label:'TURNO', value: registro.turno },
                { label:'FECHA Y HORA', value: registro.fecha_reporte ? fmtFechaHoraReporte(registro.fecha_reporte) : null },
                { label:'ORIGEN', value: registro.origen_form === 'app' ? 'Aplicación' : registro.origen_form },
                { label:'TIPO', value: registro.tipo },
                { label:'REGISTRO', value: registro.id ? `#${registro.id}` : null },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="font-metric text-xs mb-1 tracking-wider" style={{ color:'var(--text-dim)', fontSize:'0.6rem' }}>{label}</p>
                  <p className="text-sm break-words" style={{ color: value ? 'var(--text)' : 'var(--text-dim)' }}>{value || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Vuelos reportados */}
          {(vuelosLoading || vuelosError || vuelosReporte.length > 0 || registro.origen_form === 'Aeropuertos' || registro.tipo === 'Aeropuerto') && (
            <div>
              <p className="font-metric text-xs mb-2 tracking-wider" style={{ color:'#60a5fa', opacity:0.9 }}>
                VUELOS REPORTADOS
              </p>
              {vuelosLoading && (
                <div className="rounded px-4 py-3" style={{ background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.12)' }}>
                  <p className="text-xs" style={{ color:'var(--text-dim)' }}>Cargando vuelos...</p>
                </div>
              )}
              {!vuelosLoading && vuelosError && (
                <div className="rounded px-4 py-3" style={{ background:'rgba(255,42,42,0.06)', border:'1px solid rgba(255,42,42,0.18)' }}>
                  <p className="text-xs" style={{ color:'var(--alert)' }}>{vuelosError}</p>
                </div>
              )}
              {!vuelosLoading && !vuelosError && vuelosReporte.length === 0 && (
                <div className="rounded px-4 py-3" style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-xs" style={{ color:'var(--text-dim)' }}>Sin vuelos cargados para este reporte.</p>
                </div>
              )}
              {!vuelosLoading && !vuelosError && vuelosReporte.length > 0 && (
                <div className="space-y-2">
                  {vuelosReporte.map(vuelo => (
                    <div key={vuelo.id} className="rounded px-4 py-3"
                      style={{ background:'rgba(96,165,250,0.055)', border:'1px solid rgba(96,165,250,0.18)' }}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-title font-bold text-sm" style={{ color:'var(--text)' }}>
                            {vuelo.vuelo_codigo || 'Vuelo sin codigo'}
                            {vuelo.destino ? <span style={{ color:'var(--text-dim)', fontWeight:500 }}>{' -> '}{vuelo.destino}</span> : null}
                          </p>
                          <p className="font-metric text-xs mt-1" style={{ color:'var(--text-dim)' }}>
                            {[vuelo.aerolinea, vuelo.estado].filter(Boolean).join(' · ') || 'Sin aerolinea/estado'}
                          </p>
                        </div>
                        {vueloChip(vuelo.tipo)}
                      </div>
                      {vuelo.descripcion && (
                        <p className="text-xs mt-2" style={{ color:'var(--text)', lineHeight:1.5 }}>{vuelo.descripcion}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Novedades de personal vinculadas al reporte */}
          {(personalLoading || personalError || personalReporte.length > 0) && (
            <div>
              <p className="font-metric text-xs mb-2 tracking-wider flex items-center gap-1.5"
                style={{ color:'#a78bfa', opacity:0.95 }}>
                <Users size={12} /> NOVEDADES DE PERSONAL
              </p>
              {personalLoading && (
                <div className="rounded px-4 py-3"
                  style={{ background:'rgba(167,139,250,0.04)', border:'1px solid rgba(167,139,250,0.14)' }}>
                  <p className="text-xs" style={{ color:'var(--text-dim)' }}>Cargando novedades de personal...</p>
                </div>
              )}
              {!personalLoading && personalError && (
                <div className="rounded px-4 py-3"
                  style={{ background:'rgba(255,42,42,0.06)', border:'1px solid rgba(255,42,42,0.18)' }}>
                  <p className="text-xs" style={{ color:'var(--alert)' }}>{personalError}</p>
                </div>
              )}
              {!personalLoading && !personalError && personalReporte.length > 0 && (
                <div className="space-y-2">
                  {personalReporte.map(novedad => (
                    <div key={novedad.id} className="rounded px-4 py-3"
                      style={{ background:'rgba(167,139,250,0.055)', border:'1px solid rgba(167,139,250,0.2)' }}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-title font-bold text-sm" style={{ color:'var(--text)' }}>
                            {novedad.persona_nombre || 'Persona sin nombre'}
                          </p>
                          <p className="font-metric text-xs mt-1" style={{ color:'var(--text-dim)' }}>
                            {[novedad.categoria || 'Otro', novedad.estado].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <span className="chip chip-blue">{novedad.categoria || 'Otro'}</span>
                      </div>
                      <p className="text-xs mt-2" style={{ color:'var(--text)', lineHeight:1.5 }}>
                        {novedad.descripcion}
                      </p>
                      {(novedad.reportante || novedad.fecha_reporte) && (
                        <p className="font-metric mt-2" style={{ color:'var(--text-dim)', fontSize:'0.6rem' }}>
                          {[novedad.reportante, (novedad.created_at || novedad.fecha_reporte)
                            && fmtFechaHora(novedad.created_at || novedad.fecha_reporte)]
                            .filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Producción */}
          {(registro.op1_producidos != null || registro.op1_servidos != null
            || registro.op1_sobrante != null || registro.op2_producidos != null
            || registro.op2_servidos != null || registro.op2_sobrante != null
            || registro.vegetariano_sobrante != null
            || registro.ensalada_sobrante != null || registro.postre_sobrante != null
            || registro.op1_sobrante_reutilizable != null || registro.op1_sobrante_descarte != null
            || registro.op2_sobrante_reutilizable != null || registro.op2_sobrante_descarte != null
            || registro.vegetariano_sobrante_reutilizable != null || registro.vegetariano_sobrante_descarte != null
            || registro.ensalada_sobrante_reutilizable != null || registro.ensalada_sobrante_descarte != null
            || registro.postre_sobrante_reutilizable != null || registro.postre_sobrante_descarte != null) && (
            <div>
              <p className="font-metric text-xs mb-2 tracking-wider" style={{ color:'var(--phosphor)', opacity:0.7 }}>
                PRODUCCIÓN / RACIONES
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label:'Op.1 prod.', val: registro.op1_producidos },
                  { label:'Op.1 serv.', val: registro.op1_servidos },
                  { label:'Op.2 prod.', val: registro.op2_producidos },
                  { label:'Op.2 serv.', val: registro.op2_servidos },
                  { label:'Veg. prod.', val: registro.vegetariano_producidos },
                  { label:'Veg. serv.', val: registro.vegetariano_servidos },
                  { label:'Ensalada',   val: registro.ensalada_producidos },
                  { label:'Postre',     val: registro.postre_producidos },
                ].filter(x => x.val != null).map(x => (
                  <div key={x.label} className="rounded p-2.5"
                    style={{ background:'rgba(57,255,20,0.04)', border:'1px solid rgba(57,255,20,0.08)' }}>
                    <p className="font-metric text-xs" style={{ color:'var(--text-dim)', fontSize:'0.6rem' }}>{x.label}</p>
                    <p className="font-metric font-bold text-lg" style={{ color:'var(--phosphor)' }}>{x.val}</p>
                  </div>
                ))}
                {[
                  { label:'Op.1 reutilizable', val: registro.op1_sobrante_reutilizable, tipo:'reutilizable' },
                  { label:'Op.1 descarte', val: registro.op1_sobrante_descarte, tipo:'descarte' },
                  { label:'Op.2 reutilizable', val: registro.op2_sobrante_reutilizable, tipo:'reutilizable' },
                  { label:'Op.2 descarte', val: registro.op2_sobrante_descarte, tipo:'descarte' },
                  { label:'Veg. reutilizable', val: registro.vegetariano_sobrante_reutilizable, tipo:'reutilizable' },
                  { label:'Veg. descarte', val: registro.vegetariano_sobrante_descarte, tipo:'descarte' },
                  { label:'Ensalada reutilizable', val: registro.ensalada_sobrante_reutilizable, tipo:'reutilizable' },
                  { label:'Ensalada descarte', val: registro.ensalada_sobrante_descarte, tipo:'descarte' },
                  { label:'Postre reutilizable', val: registro.postre_sobrante_reutilizable, tipo:'reutilizable' },
                  { label:'Postre descarte', val: registro.postre_sobrante_descarte, tipo:'descarte' },
                  { label: registro.op1_sobrante_reutilizable == null && registro.op1_sobrante_descarte == null ? 'Op.1 sobr. sin discriminar' : 'Op.1 sobr. total', val: registro.op1_sobrante, tipo:'total' },
                  { label: registro.op2_sobrante_reutilizable == null && registro.op2_sobrante_descarte == null ? 'Op.2 sobr. sin discriminar' : 'Op.2 sobr. total', val: registro.op2_sobrante, tipo:'total' },
                  { label: registro.vegetariano_sobrante_reutilizable == null && registro.vegetariano_sobrante_descarte == null ? 'Veg. sobr. sin discriminar' : 'Veg. sobr. total', val: registro.vegetariano_sobrante, tipo:'total' },
                  { label: registro.ensalada_sobrante_reutilizable == null && registro.ensalada_sobrante_descarte == null ? 'Ensalada sobr. sin discriminar' : 'Ensalada sobr. total', val: registro.ensalada_sobrante, tipo:'total' },
                  { label: registro.postre_sobrante_reutilizable == null && registro.postre_sobrante_descarte == null ? 'Postre sobr. sin discriminar' : 'Postre sobr. total', val: registro.postre_sobrante, tipo:'total' },
                ].filter(x => x.val != null).map(x => (
                  <div key={x.label} className="rounded p-2.5"
                    style={{
                      background: x.tipo === 'reutilizable' ? 'rgba(57,255,20,0.04)' : 'rgba(245,158,11,0.06)',
                      border: x.tipo === 'descarte' ? '1px solid rgba(255,42,42,0.2)' : x.tipo === 'reutilizable' ? '1px solid rgba(57,255,20,0.12)' : '1px solid rgba(245,158,11,0.15)',
                    }}>
                    <p className="font-metric text-xs" style={{ color:'var(--text-dim)', fontSize:'0.6rem' }}>{x.label}</p>
                    <p className="font-metric font-bold text-lg" style={{ color:x.tipo === 'reutilizable' ? 'var(--phosphor)' : x.tipo === 'descarte' ? 'var(--alert)' : '#F59E0B' }}>{x.val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Categorías A–H */}
          <div>
            <p className="font-metric text-xs mb-2 tracking-wider" style={{ color:'var(--phosphor)', opacity:0.7 }}>
              DETALLE POR CATEGORÍA
            </p>
            {canManage && cats.length > 0 && (
              <p className="font-metric text-xs mb-3" style={{ color:'rgba(255,180,0,0.6)' }}>
                Hacé click en una categoría con novedad para crear una tarea (cat. A–D, F–H) o un ticket de mantenimiento (cat. E).
              </p>
            )}
            <div className="space-y-2">
              {CATEGORIAS.map(({ key: cat, label: catLabel }) => {
                const estado = registro[`estado_${cat}`]
                const detalle = registro[`detalle_${cat}`]
                if (!estado && !detalle) return null
                const tieneNovedad = estado && estado !== 'Sin novedad' && estado !== 'Sin novedades'
                const canCreate = canManage && tieneNovedad && (cat === 'e' ? Boolean(onCreateTicket) : Boolean(onCreateTarea))
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={canCreate ? () => handleCatClick(cat, catLabel, detalle) : undefined}
                    disabled={!canCreate}
                    className="rounded px-4 py-3 w-full text-left"
                    style={{
                      border: tieneNovedad ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(255,255,255,0.04)',
                      background: tieneNovedad ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                      cursor: canCreate ? 'pointer' : 'default',
                      transition: 'background 0.15s, border 0.15s',
                    }}
                    onMouseEnter={e => { if (canCreate) e.currentTarget.style.background = 'rgba(245,158,11,0.12)' }}
                    onMouseLeave={e => { if (tieneNovedad) e.currentTarget.style.background = 'rgba(245,158,11,0.06)' }}
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-metric font-bold text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: tieneNovedad ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
                          color: tieneNovedad ? 'var(--warn)' : 'var(--text-dim)',
                        }}>
                        {cat.toUpperCase()}
                      </span>
                      <span className="text-xs font-metric" style={{ color: tieneNovedad ? 'var(--warn)' : 'var(--text-dim)', fontWeight: 600 }}>
                        {catLabel}
                      </span>
                      {estado && (
                        <span className="text-xs" style={{ color: tieneNovedad ? 'var(--warn)' : 'var(--text-dim)', opacity: 0.7 }}>
                          — {estado}
                        </span>
                      )}
                      {canCreate && (
                        <span className="ml-auto flex items-center gap-1 font-metric text-xs"
                          style={{ color:'rgba(245,158,11,0.7)', fontSize:'0.6rem' }}>
                          <Zap size={10} /> {cat === 'e' ? 'Crear ticket' : 'Crear tarea'}
                        </span>
                      )}
                    </div>
                    {detalle && <p className="text-xs" style={{ color:'var(--text)', lineHeight:1.5 }}>{detalle}</p>}
                  </button>
                )
              })}
              {CATEGORIAS.every(({ key: cat }) => !registro[`estado_${cat}`] && !registro[`detalle_${cat}`]) && (
                <p className="text-xs" style={{ color:'var(--text-dim)' }}>Sin detalle por categoría</p>
              )}
            </div>
          </div>

          {/* Escalamiento */}
          {registro.requiere_escalamiento && (
            <div className="rounded px-4 py-3"
              style={{ background:'rgba(255,42,42,0.06)', border:'1px solid rgba(255,42,42,0.2)' }}>
              <p className="font-metric font-bold text-xs mb-2" style={{ color:'var(--alert)' }}>
                ESCALAMIENTO
              </p>
              {registro.escalado_a && (
                <p className="text-xs mb-1" style={{ color:'var(--text)' }}>
                  <span style={{ color:'var(--text-dim)' }}>Escalado a: </span>{registro.escalado_a}
                </p>
              )}
              {registro.motivo_escalamiento && (
                <p className="text-xs" style={{ color:'var(--text)', lineHeight:1.5 }}>
                  {registro.motivo_escalamiento}
                </p>
              )}
            </div>
          )}

          {/* Link evidencia */}
          {registro.link_evidencia && (
            <a href={registro.link_evidencia} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-metric"
              style={{ color:'var(--phosphor)' }}>
              <ExternalLink size={12} /> Ver evidencia
            </a>
          )}

          {/* Adjuntos */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:10, marginTop:4 }}>
            <AdjuntosPanel entityType="registro" entityId={registro.id} readOnly={!canAttach} />
          </div>

          {/* Comentarios — canal de comunicación con el encargado/sede */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:12 }}>
            <p className="font-metric text-xs mb-3 tracking-wider" style={{ color:'var(--phosphor)', opacity:0.7 }}>
              COMENTARIOS
            </p>
            <ComentariosHilo entidadTipo="registro" entidadId={registro.id} />
          </div>


          {/* Responsables de la sede */}
          {responsables.length > 0 && (
            <div>
              <p className="font-metric text-xs mb-2 tracking-wider" style={{ color:'var(--phosphor)', opacity:0.7 }}>
                RESPONSABLES DE LA SEDE
              </p>
              <div className="space-y-2">
                {responsables.map(item => {
                  const c = item.contactos
                  if (!c) return null
                  return (
                    <div key={item.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'0.55rem 0.75rem', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:5 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ color:'var(--text)', fontSize:'0.78rem', fontWeight:600 }}>{c.nombre}</p>
                        <p style={{ color:'var(--text-dim)', fontSize:'0.62rem' }}>{item.rol}{c.cargo ? ` · ${c.cargo}` : ''}</p>
                      </div>
                      <div style={{ display:'flex', gap:5 }}>
                        {c.telefono && (
                          <button onClick={()=>window.open(`https://wa.me/${c.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(buildMensajeWA(registro))}`, '_blank')}
                            style={{ background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.25)', color:'#25D366', borderRadius:4, padding:'0.2rem 0.45rem', cursor:'pointer', display:'flex', alignItems:'center', gap:3, fontSize:'0.6rem' }}>
                            <MessageCircle size={10}/> WA
                          </button>
                        )}
                        {c.email && (
                          <button onClick={()=>window.open(`mailto:${c.email}`, '_blank')}
                            style={{ background:'rgba(99,179,237,0.1)', border:'1px solid rgba(99,179,237,0.25)', color:'#63B3ED', borderRadius:4, padding:'0.2rem 0.45rem', cursor:'pointer', display:'flex', alignItems:'center', gap:3, fontSize:'0.6rem' }}>
                            <Mail size={10}/> Email
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* NC hint */}
          {cats.length > 0 && showNCHint && (
            <div className="rounded px-4 py-3"
              style={{ background:'rgba(57,255,20,0.04)', border:'1px solid rgba(57,255,20,0.15)' }}>
              <p className="text-xs mb-2" style={{ color:'var(--text-dim)' }}>
                Categorías con novedad: <span style={{ color:'var(--warn)' }}>{cats.join(', ')}</span>
              </p>
              <button
                onClick={() => { onCreateNC?.(registro); onClose() }}
                className="btn-primary text-xs">
                Abrir formulario NC
              </button>
            </div>
          )}

          {/* Acciones */}
          <div className="flex flex-wrap justify-between gap-3 pt-3"
            style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex gap-2">
              {canManage && onCreateNC && cats.length > 0 && (
                <button
                  onClick={() => setShowNCHint(v => !v)}
                  className="btn-ghost text-xs"
                  style={{ fontSize:'0.65rem' }}>
                  <Plus size={11} style={{ display:'inline', marginRight:3 }} />
                  Crear NC
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-ghost">Cerrar</button>
              {canManage && onCreateTarea && <button onClick={() => { onCreateTarea(registro); onClose() }} className="btn-primary">
                + Tarea
              </button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
