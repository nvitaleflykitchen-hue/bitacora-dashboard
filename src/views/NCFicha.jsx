import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { X, AlertTriangle, FileText } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { fmtFechaLarga } from '../lib/dateUtils'
import { createCapa, createEscalamientoItem, getUsuarioNombre } from '../lib/queries'
import { sendQualityEscalationEmail } from '../lib/qualityEmail'
import { generarInformeNoConformidadPDF } from '../lib/noConformidadPdf'
import { generarInformeNoConformidadDOCX } from '../lib/noConformidadDocx'
import AdjuntosPanel from '../components/AdjuntosPanel'
import ComentariosHilo from '../components/ComentariosHilo'
import { confirmar, toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'

const ESTADOS_NC = ['Abierta','En proceso','Cerrada','Verificada']

export default function NCFicha({ nc, onClose, onUpdate, onDerivar, ncOrigen, ncsDerivadas = [], onSelect }) {
  const { user, perfil } = useAuth()
  const [editEstado, setEditEstado] = useState(false)
  const [nuevoEstado, setNuevoEstado] = useState(nc.estado)
  const [nuevaCategoria, setNuevaCategoria] = useState(nc.categoria)
  const [saving, setSaving] = useState(false)
  const [generandoCAPA, setGCAPA] = useState(false)
  const [capaOk, setCapaOk] = useState(false)
  const [escalando, setEscalando] = useState(false)
  const [escaladoMsg, setEscaladoMsg] = useState('')
  const [creadorNombre, setCreadorNombre] = useState(nc.created_by || '—')
  const [generandoPDF, setGPDF] = useState(false)
  const [generandoDOCX, setGDOCX] = useState(false)

  // Cargar nombre real si created_by es un UUID
  useEffect(() => {
    if (nc.created_by && nc.created_by.includes('-')) {
      getUsuarioNombre(nc.created_by).then(nombre => {
        if (nombre) setCreadorNombre(nombre)
      }).catch(console.error)
    }
  }, [nc.created_by])

  const generarCAPA = async (e) => {
    e.stopPropagation()
    setGCAPA(true)
    try {
      await createCapa({
        no_conformidad_id: nc.id,
        tipo: 'Correctiva',
        descripcion: `[Auto] Acción correctiva para NC ${nc.codigo}: ${nc.descripcion?.slice(0,120) || ''}`,
        responsable: nc.responsable || '',
        sede_id: nc.sede_id || null,
        sede_nombre: nc.sede_nombre || '',
        estado: 'Pendiente',
        fecha_limite: new Date(Date.now() + 7*86400000).toISOString().split('T')[0],
      })
      setCapaOk(true)
      setTimeout(() => setCapaOk(false), 3000)
      onUpdate(nc.id, {})
    } catch(err) {
      toast.error('Error al crear CAPA: ' + mensajeError(err))
    } finally {
      setGCAPA(false)
    }
  }

  const generarPDF = async (e) => {
    e.stopPropagation()
    setGPDF(true)
    try {
      await generarInformeNoConformidadPDF(nc, { creadorNombre })
    } catch (err) {
      toast.error('Error al generar el informe PDF: ' + mensajeError(err))
    } finally {
      setGPDF(false)
    }
  }

  const generarDOCX = async (e) => {
    e.stopPropagation()
    setGDOCX(true)
    try {
      await generarInformeNoConformidadDOCX(nc, { creadorNombre })
    } catch (err) {
      toast.error('Error al generar el Word: ' + mensajeError(err))
    } finally {
      setGDOCX(false)
    }
  }

  const saveEstado = async () => {
    setSaving(true)
    try {
      await onUpdate(nc.id, {
        estado: nuevoEstado,
        categoria: nuevaCategoria,
        fecha_cierre: nuevoEstado === 'Cerrada' || nuevoEstado === 'Verificada' ? format(new Date(), 'yyyy-MM-dd') : null
      })
      setEditEstado(false)
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setSaving(false)
    }
  }

  const handleEscalarCalidad = async () => {
    if (!await confirmar({ titulo: 'Escalar a Calidad', mensaje: 'Se enviará un correo de notificación a Calidad.', confirmText: 'Escalar' })) return
    
    setEscalando(true)
    setEscaladoMsg('')
    try {
      // 1. Crear el escalamiento
      const escalamiento = await createEscalamientoItem({
        tipo: 'Calidad',
        estado: 'Pendiente',
        reportante: perfil?.nombre || user?.email || 'Sistema',
        destino: 'Calidad',
        descripcion: `No Conformidad ${nc.codigo}`,
        sede_id: nc.sede_id || null,
        sede_nombre: nc.sede_nombre || null
      })

      // 2. Enviar el correo usando la nueva configuración de Google
      await sendQualityEscalationEmail({ ncId: nc.id, escalamientoId: escalamiento.id })
      setEscaladoMsg('Notificación enviada con éxito')
    } catch (err) {
      toast.error('Error al escalar: ' + mensajeError(err))
    } finally {
      setEscalando(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="glass hud-corner fade-in w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded flex flex-col" style={{ borderRadius:'3px', background:'var(--surface)' }}>
        {/* CABECERA */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h2 className="font-title font-bold text-lg" style={{ color:'var(--text)' }}>{nc.codigo}</h2>
              <span className={`chip ${nc.estado === 'Verificada' ? 'chip-green' : nc.estado === 'Abierta' ? 'chip-red' : 'chip-gray'}`}>{nc.estado}</span>
              <span className="chip chip-blue">{nc.categoria}</span>
              {ncOrigen && (
                <button
                  type="button"
                  onClick={() => onSelect && onSelect(ncOrigen.id)}
                  className="chip"
                  style={{ background:'rgba(139,92,246,0.15)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.35)', fontSize:'0.65rem', cursor: onSelect ? 'pointer' : 'default' }}
                >
                  ↳ Derivada de {ncOrigen.codigo}
                </button>
              )}
            </div>
            <p className="font-metric text-xs" style={{ color:'var(--text-dim)' }}>
              {nc.sede_nombre || 'Sede no asignada'} · {nc.fecha_apertura ? fmtFechaLarga(nc.fecha_apertura) : 'Sin fecha'}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5" style={{ padding:'0.3rem' }}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* COLUMNA IZQUIERDA: Detalles */}
          <div className="space-y-6">
            <div>
              <p className="font-metric text-xs mb-1.5 tracking-wider" style={{ color:'var(--text-dim)' }}>DESCRIPCIÓN DE LA DESVIACIÓN</p>
              <p className="text-sm leading-relaxed" style={{ color:'var(--text)' }}>{nc.descripcion}</p>
            </div>
            
            {nc.causa_raiz && (
              <div className="p-3 rounded" style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                <p className="font-metric text-xs mb-1.5 tracking-wider" style={{ color:'var(--text-dim)' }}>CAUSA RAÍZ</p>
                <p className="text-sm" style={{ color:'var(--text)' }}>{nc.causa_raiz}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-metric text-xs mb-1 tracking-wider" style={{ color:'var(--text-dim)' }}>RESPONSABLE</p>
                <p className="text-sm" style={{ color:'var(--text)' }}>{nc.responsable || '—'}</p>
              </div>
              <div>
                <p className="font-metric text-xs mb-1 tracking-wider" style={{ color:'var(--text-dim)' }}>CREADO POR</p>
                <p className="text-sm" style={{ color:'var(--text)' }}>{creadorNombre}</p>
              </div>
            </div>

            {/* DATOS DE PRODUCTO / PROVEEDOR (solo si hay al menos uno cargado) */}
            {[nc.producto, nc.marca, nc.lote, nc.presentacion, nc.proveedor, nc.fecha_recepcion, nc.vencimiento].some(Boolean) && (
              <div className="p-3 rounded" style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                <p className="font-metric text-xs mb-2 tracking-wider" style={{ color:'var(--text-dim)' }}>DATOS DE PRODUCTO / PROVEEDOR</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {[
                    ['Producto', nc.producto],
                    ['Marca', nc.marca],
                    ['Lote', nc.lote],
                    ['Presentación', nc.presentacion],
                    ['Proveedor', nc.proveedor],
                    ['Recepción', nc.fecha_recepcion ? fmtFechaLarga(nc.fecha_recepcion) : null],
                    ['Vencimiento', nc.vencimiento ? fmtFechaLarga(nc.vencimiento) : null],
                  ].filter(([, v]) => v).map(([label, v]) => (
                    <div key={label}>
                      <p className="font-metric" style={{ color:'var(--text-dim)', fontSize:'0.62rem', letterSpacing:'0.06em' }}>{label.toUpperCase()}</p>
                      <p className="text-sm" style={{ color:'var(--text)' }}>{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ACCIONES */}
            <div className="pt-4 space-y-3" style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <p className="font-metric text-xs tracking-wider" style={{ color:'var(--phosphor)', opacity:0.7 }}>ACCIONES RAPIDAS</p>
              
              {editEstado ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select className="input-dark" style={{ maxWidth:160 }} value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)}>
                    {ESTADOS_NC.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <select className="input-dark" style={{ maxWidth:160 }} value={nuevaCategoria} onChange={e => setNuevaCategoria(e.target.value)}>
                    {['Higiene','Producción','Servicio','Infraestructura','Proceso','Proveedor','Otro'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={saveEstado} disabled={saving} className="btn-primary" style={{ padding:'0.3rem 0.6rem', fontSize:'0.75rem' }}>
                    {saving ? '...' : 'Guardar'}
                  </button>
                  <button onClick={() => setEditEstado(false)} className="btn-ghost" style={{ padding:'0.3rem 0.6rem', fontSize:'0.75rem' }}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => setEditEstado(true)} className="btn-ghost" style={{ padding:'0.35rem 0.75rem', fontSize:'0.75rem' }}>
                    Cambiar estado
                  </button>
                  <button
                    onClick={generarPDF}
                    disabled={generandoPDF}
                    className="btn-ghost"
                    style={{ padding:'0.35rem 0.75rem', fontSize:'0.75rem' }}>
                    <div className="flex items-center gap-1.5">
                      <FileText size={13} />
                      {generandoPDF ? 'Generando...' : 'Generar informe PDF'}
                    </div>
                  </button>
                  <button
                    onClick={generarDOCX}
                    disabled={generandoDOCX}
                    className="btn-ghost"
                    style={{ padding:'0.35rem 0.75rem', fontSize:'0.75rem' }}>
                    <div className="flex items-center gap-1.5">
                      <FileText size={13} />
                      {generandoDOCX ? 'Generando...' : 'Generar Word (.docx)'}
                    </div>
                  </button>
                  {(!nc.capa || nc.capa.length === 0) && nc.estado !== 'Verificada' && (
                    <button
                      onClick={generarCAPA}
                      disabled={generandoCAPA}
                      className="btn-primary"
                      style={{ padding:'0.35rem 0.75rem', fontSize:'0.75rem' }}>
                      {capaOk ? '✓ CAPA creada' : generandoCAPA ? 'Generando...' : '+ Generar CAPA'}
                    </button>
                  )}
                  <button
                    onClick={handleEscalarCalidad}
                    disabled={escalando}
                    className="btn-primary"
                    style={{ padding:'0.35rem 0.75rem', fontSize:'0.75rem', background:'rgba(245,158,11,0.15)', color:'#F59E0B', borderColor:'rgba(245,158,11,0.4)' }}>
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle size={13} />
                      {escalando ? 'Notificando...' : 'Escalar a Calidad'}
                    </div>
                  </button>
                  {onDerivar && (
                    <button
                      onClick={() => onDerivar(nc)}
                      className="btn-primary"
                      style={{ padding:'0.35rem 0.75rem', fontSize:'0.75rem', background:'rgba(139,92,246,0.15)', color:'#a78bfa', borderColor:'rgba(139,92,246,0.4)' }}>
                      <div className="flex items-center gap-1.5">
                        ↳ Derivar NC
                      </div>
                    </button>
                  )}
                </div>
              )}
              {escaladoMsg && <p className="text-xs text-green-400">{escaladoMsg}</p>}
            </div>

            {/* CAPAS ASOCIADAS */}
            {nc.capa?.length > 0 && (
              <div className="pt-4" style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                <p className="font-metric text-xs mb-2 tracking-wider" style={{ color:'var(--phosphor)', opacity:0.7 }}>
                  PLAN CAPA ({nc.capa.length})
                </p>
                <div className="space-y-2">
                  {nc.capa.map(c => (
                    <div key={c.id} className="rounded px-3 py-2 flex items-center gap-3"
                      style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                      <span className="font-metric text-xs" style={{ color:'var(--phosphor)', fontSize:'0.7rem' }}>{c.codigo}</span>
                      <span className={`chip ${c.tipo === 'Preventiva' ? 'chip-blue' : 'chip-yellow'}`} style={{ fontSize:'0.65rem' }}>{c.tipo}</span>
                      <span className="text-xs flex-1 truncate" style={{ color:'var(--text-dim)' }}>{c.descripcion}</span>
                      <span className="chip chip-gray" style={{ fontSize:'0.65rem' }}>{c.estado}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

            {/* NCs DERIVADAS */}
            {ncsDerivadas.length > 0 && (
              <div className="pt-4" style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                <p className="font-metric text-xs mb-2 tracking-wider" style={{ color:'#a78bfa', opacity:0.85 }}>
                  NCs DERIVADAS ({ncsDerivadas.length})
                </p>
                <div className="space-y-1.5">
                  {ncsDerivadas.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onSelect && onSelect(d.id)}
                      className="w-full text-left rounded px-3 py-2 flex items-center gap-3 transition-colors"
                      style={{ background:'rgba(139,92,246,0.07)', border:'1px solid rgba(139,92,246,0.2)', cursor: onSelect ? 'pointer' : 'default' }}
                    >
                      <span className="font-metric text-xs" style={{ color:'#a78bfa', flexShrink:0 }}>{d.codigo}</span>
                      <span className="chip chip-blue" style={{ fontSize:'0.6rem', flexShrink:0 }}>{d.categoria}</span>
                      <span className="text-xs flex-1 truncate" style={{ color:'var(--text-dim)' }}>{d.descripcion}</span>
                      <span className={`chip ${d.estado === 'Verificada' ? 'chip-green' : d.estado === 'Abierta' ? 'chip-red' : 'chip-gray'}`} style={{ fontSize:'0.6rem', flexShrink:0 }}>{d.estado}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          {/* COLUMNA DERECHA: Evidencia y Comentarios */}
          <div className="space-y-6 flex flex-col" style={{ minHeight: 400 }}>
            <div>
              <p className="font-metric text-xs mb-2 tracking-wider flex items-center gap-2" style={{ color:'var(--text-dim)' }}>EVIDENCIA FOTOGRÁFICA</p>
              <AdjuntosPanel entityType="no_conformidad" entityId={nc.id} />
            </div>
            
            <div className="flex-1 flex flex-col min-h-0 pt-4" style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <p className="font-metric text-xs mb-2 tracking-wider" style={{ color:'var(--text-dim)' }}>COMENTARIOS</p>
              <div className="flex-1 overflow-hidden p-2 rounded" style={{ background:'rgba(0,0,0,0.2)' }}>
                <ComentariosHilo entidadTipo="no_conformidad" entidadId={nc.id} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
