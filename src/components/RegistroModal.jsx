import { useState, useEffect } from 'react'
import { X, ExternalLink, AlertTriangle, Plus, Zap, MessageCircle, Mail, Users } from 'lucide-react'
import AdjuntosPanel from './AdjuntosPanel'
import { getCategoriasCONNovedad, getSedeContactos } from '../lib/queries'
import { fmtFechaHora } from '../lib/dateUtils'
import { useAuth } from '../lib/auth'

const CATEGORIAS = [
  { key: 'a', label: 'Producción / Servicio del turno' },
  { key: 'b', label: 'Cadena de frío y conservación' },
  { key: 'c', label: 'Recepción / Abastecimiento' },
  { key: 'd', label: 'Stock crítico' },
  { key: 'e', label: 'Equipos / Mantenimiento' },
  { key: 'f', label: 'Higiene / BPM' },
  { key: 'g', label: 'Personal / Dotación' },
  { key: 'h', label: 'Cliente / Usuario / Incidentes' },
]

function estadoChip(estado) {
  if (!estado) return null
  if (estado === 'Sin novedades' || estado === 'Sin novedad') return <span className="chip chip-green">{estado}</span>
  if (estado === 'Hay novedades') return <span className="chip chip-yellow">{estado}</span>
  if (estado === 'Operación condicionada') return <span className="chip chip-red">{estado}</span>
  return <span className="chip chip-gray">{estado}</span>
}

export default function RegistroModal({ registro, onClose, onCreateTarea, onCreateTicket, onCreateNC }) {
  const { can } = useAuth()
  const canManage = can('tareas', 'manage')
  const canAttach = canManage || can('bitacora', 'attach')
  const [showNCHint, setShowNCHint] = useState(false)
  const [responsables, setResponsables] = useState([])

  useEffect(() => {
    if (registro?.sede_id) {
      getSedeContactos(registro.sede_id).then(setResponsables).catch(()=>setResponsables([]))
    }
  }, [registro?.sede_id])

  if (!registro) return null
  const cats = getCategoriasCONNovedad(registro)

  const handleCatClick = (cat, catLabel, detalle) => {
    if (cat === 'e') {
      // Categoría E (Equipos/Mantenimiento) → ticket de mantenimiento
      onCreateTicket?.(registro, {
        descripcionInicial: detalle || '',
        sedeNombre: registro.sede_nombre || '',
        sedeId: registro.sede_id || null,
      })
    } else {
      // Resto de categorías → tarea general
      onCreateTarea?.(registro, {
        titulo: catLabel,
        categoria: cat.toUpperCase(),
        descripcion: detalle || '',
      })
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
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
              {fmtFechaHora(registro.fecha_reporte)}
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
                { label:'FECHA Y HORA', value: registro.fecha_reporte ? fmtFechaHora(registro.fecha_reporte) : null },
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

          {/* Producción */}
          {(registro.op1_producidos != null || registro.op1_servidos != null) && (
            <div>
              <p className="font-metric text-xs mb-2 tracking-wider" style={{ color:'var(--phosphor)', opacity:0.7 }}>
                PRODUCCIÓN / RACIONES
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label:'Op.1 prod.', val: registro.op1_producidos },
                  { label:'Op.1 serv.', val: registro.op1_servidos },
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
                return (
                  <div key={cat}
                    onClick={canManage && tieneNovedad ? () => handleCatClick(cat, catLabel, detalle) : undefined}
                    className="rounded px-4 py-3"
                    style={{
                      border: tieneNovedad ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(255,255,255,0.04)',
                      background: tieneNovedad ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                      cursor: canManage && tieneNovedad ? 'pointer' : 'default',
                      transition: 'background 0.15s, border 0.15s',
                    }}
                    onMouseEnter={e => { if (canManage && tieneNovedad) e.currentTarget.style.background = 'rgba(245,158,11,0.12)' }}
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
                      {canManage && tieneNovedad && (
                        <span className="ml-auto flex items-center gap-1 font-metric text-xs"
                          style={{ color:'rgba(245,158,11,0.7)', fontSize:'0.6rem' }}>
                          <Zap size={10} /> Crear tarea
                        </span>
                      )}
                    </div>
                    {detalle && <p className="text-xs" style={{ color:'var(--text)', lineHeight:1.5 }}>{detalle}</p>}
                  </div>
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
                          <button onClick={()=>window.open(`https://wa.me/${c.telefono.replace(/\D/g,'')}`, '_blank')}
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
              {canManage && cats.length > 0 && (
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
              {canManage && <button onClick={() => { onCreateTarea?.(registro); onClose() }} className="btn-primary">
                + Tarea
              </button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
