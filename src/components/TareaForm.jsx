import { useState, useEffect } from 'react'
import { X, MessageCircle, Mail, UserCheck } from 'lucide-react'
import { createTarea, updateTarea, getSedes, getPerfilesConDirectorio, getContactos } from '../lib/queries'
import { uploadAdjunto } from '../lib/adjuntos'
import { isoToDisplay } from '../lib/dateUtils'
import { TASK_STATES } from '../lib/operationalDomains'
import { useAuth } from '../lib/auth'
import { isQualityOnlyProfile } from '../lib/access'
import { toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'

export const CATEGORIAS = [
  { key: 'A', label: 'Producción / Servicio del turno' },
  { key: 'B', label: 'Cadena de frío y conservación' },
  { key: 'C', label: 'Recepción / Abastecimiento' },
  { key: 'D', label: 'Stock crítico' },
  { key: 'E', label: 'Equipos / Mantenimiento' },
  { key: 'F', label: 'Higiene / BPM' },
  { key: 'G', label: 'Personal / Dotación' },
  { key: 'H', label: 'Cliente / Usuario / Incidentes' },
  { key: 'OTRA', label: 'Otras' },
]
export const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map(c => [c.key, c.label]))
export const getCategoriaLabel = (categoria) => {
  if (!categoria) return ''
  const key = String(categoria).toUpperCase()
  return CATEGORIA_LABEL[key] || categoria
}
const PRIORIDADES = ['Alta','Media','Baja']

function buildWhatsappMsg(tarea, responsable) {
  const sede = tarea.sede_nombre || ''
  const vence = tarea.fecha_limite ? ` · Vence: ${isoToDisplay(tarea.fecha_limite)}` : ''
  return encodeURIComponent(
    `Hola ${responsable.nombre} 👋\n\nSe te asignó una tarea en *Bitácora In Situ*:\n\n` +
    `📋 *${tarea.titulo}*\n` +
    (tarea.descripcion ? `${tarea.descripcion}\n\n` : '\n') +
    `🏥 Sede: ${sede || 'General'}\n` +
    `⚡ Prioridad: ${tarea.prioridad}${vence}\n\n` +
    `Fly Kitchen — Kitchen-OS`
  )
}

function buildMailMsg(tarea, responsable) {
  const sede = tarea.sede_nombre || 'General'
  const vence = tarea.fecha_limite ? ` · Vence: ${isoToDisplay(tarea.fecha_limite)}` : ''
  const subject = encodeURIComponent(`[Tarea] ${tarea.titulo}`)
  const body = encodeURIComponent(
    `Hola ${responsable.nombre},\n\n` +
    `Se te asignó una tarea en Bitácora In Situ:\n\n` +
    `Tarea: ${tarea.titulo}\n` +
    (tarea.descripcion ? `Descripción: ${tarea.descripcion}\n` : '') +
    `Sede: ${sede}\n` +
    `Prioridad: ${tarea.prioridad}${vence}\n\n` +
    `Fly Kitchen — Kitchen-OS`
  )
  return { subject, body }
}

export function ShareButtons({ tarea, responsable, compact = false }) {
  if (!responsable) return null
  const size = compact ? 11 : 13

  const openWA = () => {
    if (!responsable.telefono) return toast.warn('El usuario no tiene teléfono registrado.')
    const phone = responsable.telefono.replace(/\D/g, '')
    const msg = buildWhatsappMsg(tarea, responsable)
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
  }

  const openMail = () => {
    if (!responsable.email) return toast.warn('El usuario no tiene email registrado.')
    const { subject, body } = buildMailMsg(tarea, responsable)
    window.open(`mailto:${responsable.email}?subject=${subject}&body=${body}`, '_blank')
  }

  return (
    <div className="flex items-center gap-1">
      <button onClick={openWA} title="Compartir por WhatsApp"
        className="flex items-center gap-1 font-metric transition-all"
        style={{
          background:'rgba(37,211,102,0.12)', border:'1px solid rgba(37,211,102,0.3)',
          color:'#25D366', borderRadius:3, padding: compact ? '0.15rem 0.4rem' : '0.25rem 0.55rem',
          fontSize: compact ? '0.6rem' : '0.68rem', cursor:'pointer'
        }}>
        <MessageCircle size={size} />
        {!compact && 'WhatsApp'}
      </button>
      <button onClick={openMail} title="Compartir por Email"
        className="flex items-center gap-1 font-metric transition-all"
        style={{
          background:'rgba(99,179,237,0.1)', border:'1px solid rgba(99,179,237,0.25)',
          color:'#63B3ED', borderRadius:3, padding: compact ? '0.15rem 0.4rem' : '0.25rem 0.55rem',
          fontSize: compact ? '0.6rem' : '0.68rem', cursor:'pointer'
        }}>
        <Mail size={size} />
        {!compact && 'Email'}
      </button>
    </div>
  )
}

export default function TareaForm({ onClose, onCreated, onUpdated, registroOrigen, sedePreseleccionada, initialValues, tareaEditar }) {
  const { allowedSedeIds, perfil } = useAuth()
  const isQualityOnly = isQualityOnlyProfile(perfil)
  const [sedes, setSedes]       = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [contactos, setContactos] = useState([])
  const [loading, setLoading]   = useState(false)
  const [shared, setShared]     = useState(false)
  const [archivos, setArchivos] = useState([])
  const [form, setForm] = useState({
    titulo:       tareaEditar?.titulo       ?? initialValues?.titulo      ?? '',
    descripcion:  tareaEditar?.descripcion  ?? initialValues?.descripcion ?? '',
    sede_id:      tareaEditar?.sede_id      ?? sedePreseleccionada?.id    ?? registroOrigen?.sede_id ?? '',
    registro_id:  tareaEditar?.registro_id  ?? registroOrigen?.id         ?? '',
    categoria:    tareaEditar?.categoria    ?? initialValues?.categoria   ?? (isQualityOnly ? 'F' : ''),
    responsable:  tareaEditar?.responsable  ?? '',
    responsable_id: tareaEditar?.responsable_id ?? '',
    contacto_id:  tareaEditar?.contacto_id  ?? '',
    prioridad:    tareaEditar?.prioridad    ?? 'Media',
    fecha_limite: tareaEditar?.fecha_limite ? String(tareaEditar.fecha_limite).slice(0, 10) : '',
    estado:       tareaEditar?.estado       ?? TASK_STATES[0],
    intervinientes: Array.isArray(tareaEditar?.intervinientes) ? tareaEditar.intervinientes : [],
  })
  const [nuevoInterviniente, setNuevoInterviniente] = useState('')

  useEffect(() => {
    Promise.all([getSedes(), getPerfilesConDirectorio(), getContactos()])
      .then(([s, p, c]) => { setSedes(s); setPerfiles(p.filter(x => x.activo !== false)); setContactos(c) })
      .catch(console.error)
  }, [])

  // Si no vino una sede preasignada y el usuario tiene una sola sede (ej: encargado), se preselecciona
  useEffect(() => {
    if (!tareaEditar && !sedePreseleccionada && !registroOrigen?.sede_id && allowedSedeIds?.length === 1) {
      setForm(f => f.sede_id ? f : { ...f, sede_id: allowedSedeIds[0] })
    }
  }, [allowedSedeIds, tareaEditar, sedePreseleccionada, registroOrigen?.sede_id])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const selectedPerfil    = perfiles.find(p => p.id === form.responsable_id) || null
  const selectedContacto  = contactos.find(c => c.id === form.contacto_id)   || null
  const selectedResponsable = selectedPerfil || selectedContacto

  const handleResponsable = (source, id) => {
    if (source === 'perfil') {
      const p = perfiles.find(x => x.id === id)
      set('responsable_id', id); set('contacto_id', '')
      set('responsable', p?.nombre || '')
    } else {
      const c = contactos.find(x => x.id === id)
      set('contacto_id', id); set('responsable_id', '')
      set('responsable', c?.nombre || '')
    }
    setShared(false)
  }

  const addInterviniente = () => {
    const n = nuevoInterviniente.trim()
    if (!n) return
    set('intervinientes', [...form.intervinientes, { id: Date.now().toString(), nombre: n }])
    setNuevoInterviniente('')
  }
  const removeInterviniente = (id) => set('intervinientes', form.intervinientes.filter(i => i.id !== id))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        titulo:        form.titulo,
        descripcion:   form.descripcion,
        sede_id:       form.sede_id    || null,
        registro_id:   form.registro_id || null,
        fecha_limite:  form.fecha_limite || null,
        categoria:     isQualityOnly && !tareaEditar ? 'F' : (form.categoria || null),
        responsable:   form.responsable || null,
        responsable_id: form.responsable_id || null,
        contacto_id:   form.contacto_id || null,
        prioridad:     form.prioridad,
        intervinientes: form.intervinientes,
      }
      if (tareaEditar) {
        const tarea = await updateTarea(tareaEditar.id, payload)
        onUpdated?.(tarea)
      } else {
        const tarea = await createTarea({ ...payload, estado: form.estado })
        if (archivos.length > 0) {
          await Promise.all(archivos.map(f => uploadAdjunto('tarea', tarea.id, f)))
        }
        onCreated?.(tarea)
      }
    } catch (err) {
      toast.error(`Error al ${tareaEditar ? 'guardar' : 'crear'} tarea: ` + mensajeError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass hud-corner fade-in w-full max-w-lg rounded" style={{ borderRadius:'3px' }}>
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
          <h2 className="font-title font-bold" style={{ color:'var(--text)' }}>{tareaEditar ? 'Editar tarea' : 'Nueva Tarea'}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5" style={{ padding:'0.3rem' }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>
              Título *
            </label>
            <input required className="input-dark" value={form.titulo}
              onChange={e => set('titulo', e.target.value)} placeholder="Ej: Revisar cámara de frío 2" />
          </div>

          <div>
            <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>
              Descripción
            </label>
            <textarea className="input-dark" rows={2} value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)} placeholder="Ej: Verificar temperatura y limpieza de la cámara 2"
              style={{ resize:'vertical' }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Sede</label>
              <select className="input-dark" value={form.sede_id} onChange={e => set('sede_id', e.target.value)}>
                <option value="">Todas</option>
                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Categoría</label>
              <select className="input-dark" value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                <option value="">—</option>
                {(isQualityOnly && !tareaEditar ? CATEGORIAS.filter(c => c.key === 'F') : CATEGORIAS).map(c => (
                  <option key={c.key} value={c.key}>{c.key} — {c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Responsable con share */}
          <div>
            <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>
              Responsable
            </label>
            <select className="input-dark" value={form.responsable_id || form.contacto_id}
              onChange={e => {
                const [source, id] = e.target.value.split('::')
                handleResponsable(source, id)
              }}>
              <option value="">— Sin asignar —</option>
              {perfiles.length > 0 && (
                <optgroup label="── Usuarios del sistema ──">
                  {perfiles.map(p => (
                    <option key={p.id} value={`perfil::${p.id}`}>{p.nombre} · {p.rol}</option>
                  ))}
                </optgroup>
              )}
              {contactos.length > 0 && (
                <optgroup label="── Contactos Fly Kitchen ──">
                  {contactos.map(c => (
                    <option key={c.id} value={`contacto::${c.id}`}>{c.nombre}{c.cargo ? ` · ${c.cargo}` : ''}</option>
                  ))}
                </optgroup>
              )}
            </select>

            {selectedResponsable && (
              <div className="mt-2 rounded px-3 py-2 flex items-center justify-between gap-2"
                style={{ background:'rgba(57,255,20,0.04)', border:'1px solid rgba(57,255,20,0.12)' }}>
                <div className="flex items-center gap-2">
                  <UserCheck size={12} style={{ color:'var(--phosphor)' }} />
                  <div>
                    <p style={{ color:'var(--text)', fontSize:'0.72rem', fontWeight:500 }}>{selectedResponsable.nombre}</p>
                    <p style={{ color:'var(--text-dim)', fontSize:'0.62rem' }}>
                      {selectedResponsable.cargo || selectedResponsable.rol || ''}{(selectedResponsable.cargo || selectedResponsable.rol) && (selectedResponsable.telefono || selectedResponsable.email) ? ' · ' : ''}
                      {selectedResponsable.telefono || selectedResponsable.email || 'Sin contacto'}
                    </p>
                  </div>
                </div>
                <ShareButtons tarea={{ ...form, sede_nombre: sedes.find(s=>String(s.id)===String(form.sede_id))?.nombre }} responsable={selectedResponsable} />
              </div>
            )}
          </div>

          {/* Intervinientes adicionales */}
          <div>
            <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>
              Intervinientes adicionales
            </label>
            <div className="flex gap-2 mb-2">
              <input className="input-dark flex-1" value={nuevoInterviniente}
                onChange={e => setNuevoInterviniente(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInterviniente() } }}
                placeholder="Ej: Juan Pérez (Enter para agregar)" />
              <button type="button" onClick={addInterviniente} className="btn-ghost" style={{ padding:'0.35rem 0.7rem' }}>+</button>
            </div>
            {form.intervinientes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.intervinientes.map(i => (
                  <span key={i.id} className="flex items-center gap-1" style={{ fontSize:'0.7rem', color:'var(--text)', background:'rgba(255,255,255,0.05)', borderRadius:3, padding:'2px 8px' }}>
                    {i.nombre}
                    <button type="button" onClick={() => removeInterviniente(i.id)}
                      style={{ color:'rgba(255,80,80,0.6)', background:'none', border:'none', cursor:'pointer', padding:0, marginLeft:2, display:'flex' }}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Prioridad</label>
              <select className="input-dark" value={form.prioridad} onChange={e => set('prioridad', e.target.value)}>
                {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Fecha límite</label>
              <input type="date" className="input-dark" value={form.fecha_limite}
                onChange={e => set('fecha_limite', e.target.value)} />
            </div>
          </div>

          {registroOrigen && (
            <div className="rounded px-3 py-2 text-xs"
              style={{ background:'rgba(57,255,20,0.05)', border:'1px solid rgba(57,255,20,0.15)', color:'var(--text-dim)' }}>
              Asociada al registro de <span style={{ color:'var(--phosphor)' }}>{registroOrigen.sede_nombre}</span>
            </div>
          )}

          {!tareaEditar && (
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Evidencias (Fotos/Archivos)</label>
              <input type="file" multiple className="input-dark" style={{ padding:'0.4rem' }} onChange={e => setArchivos(Array.from(e.target.files || []))} />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2" style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : (tareaEditar ? 'Guardar cambios' : 'Crear tarea')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
