import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Briefcase, CalendarDays, ClipboardCheck, Download,
  FileText, Link2, Loader2, MessageCircle, Plus, Save, Search, Send,
  Trash2, UserCheck, UserPlus, X
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { deleteAdjunto, getAdjuntos, uploadAdjunto } from '../../lib/adjuntos'
import AdjuntosPanel from '../../components/AdjuntosPanel'
import { generateFichaAltaPdf, generateFichaEntrevistaPdf } from '../../lib/reclutamientoPdf'
import { confirmar, toast } from '../../lib/feedback'
import { mensajeError } from '../../lib/errores'

const SOLICITUD_ESTADOS = [
  ['borrador', 'Borrador'],
  ['enviada_whatsapp', 'Enviada a WhatsApp'],
  ['recibiendo_cvs', 'Recibiendo CVs'],
  ['entrevistas', 'Entrevistas'],
  ['preocupacional', 'Preocupacional'],
  ['ingreso', 'Ingreso'],
  ['cerrada', 'Cerrada'],
  ['cancelada', 'Cancelada'],
]

const CANDIDATO_ESTADOS = [
  ['cv_recibido', 'CV recibido'],
  ['preseleccionado', 'Preseleccionado'],
  ['entrevista', 'Entrevista'],
  ['evaluacion', 'Evaluación'],
  ['psicologico_direccion', 'Psico/Dirección'],
  ['preocupacional', 'Preocupacional'],
  ['apto_ingreso', 'Apto ingreso'],
  ['incorporado', 'Incorporado'],
  ['no_apto', 'No apto'],
  ['archivado', 'Archivado / Standby'],
]

const BOARD_COLUMNS = [
  ['cv_recibido', 'CVs recibidos'],
  ['preseleccionado', 'Preselección'],
  ['entrevista', 'Entrevista'],
  ['evaluacion', 'Evaluación breve'],
  ['psicologico_direccion', 'Psico / Dirección'],
  ['preocupacional', 'Preocupacional'],
  ['apto_ingreso', 'Ingreso e inducción'],
]

const SOLICITUD_ESTADOS_POST_ENVIO = new Set([
  'enviada_whatsapp',
  'recibiendo_cvs',
  'entrevistas',
  'preocupacional',
  'ingreso',
  'cerrada',
])

const EMPTY_SOLICITUD = {
  puesto: '',
  sede_id: '',
  horario: '',
  fecha_apertura: new Date().toISOString().split('T')[0],
  urgencia: 'Media',
  periodo_necesidad: 'Permanente',
  motivo: '',
  cantidad: 1,
  modalidad: '',
  tareas: '',
  requisitos: '',
  experiencia: '',
  documentacion: '',
  responsable: '',
  contacto: '',
  observaciones: '',
  requiere_psicologico: false,
  requiere_direccion: false,
  horas_semanales: '',
  categoria: '',
  sueldo_especificaciones: '',
  estado: 'borrador',
}

const EMPTY_CANDIDATO = {
  solicitud_id: '',
  nombre_apellido: '',
  dni: '',
  cuil: '',
  celular: '',
  email: '',
  origen: '',
  recomendado_por: '',
  estado: 'cv_recibido',
  evaluacion_breve: '',
  resultado: '',
  requiere_psicologico: false,
  requiere_direccion: false,
  fecha_preocupacional: '',
  resultado_preocupacional: '',
  fecha_ingreso: '',
  induccion_at: '',
  notas: '',
}

const EMPTY_ENTREVISTA = {
  fecha_entrevista: new Date().toISOString().split('T')[0],
  hora_entrevista: '',
  entrevistador: '',
  nombre_apellido: '',
  dni: '',
  cuil: '',
  estado_civil: '',
  hijos_menores: '',
  edades_hijos: '',
  domicilio: '',
  piso: '',
  departamento: '',
  barrio: '',
  ciudad: '',
  codigo_postal: '',
  fecha_nacimiento: '',
  nacionalidad: '',
  celular: '',
  celular_alternativo: '',
  email: '',
  nivel_estudio: '',
  estudios_cursados: '',
  estudia_actualmente: '',
  movilidad: '',
  carnet_conducir: '',
  disponibilidad_horaria: '',
  enfermedades_cronicas: '',
  talle_pantalon: '',
  talle_camisa: '',
  talle_calzado: '',
  carnet_sanitario: false,
  antecedentes_penales: false,
  recomendado_por: '',
  observaciones: '',
}

function cleanSolicitudPayload(form, userId) {
  return {
    estado: form.estado || 'borrador',
    puesto: form.puesto,
    sede_id: Number(form.sede_id),
    horario: form.horario || null,
    fecha_apertura: form.fecha_apertura || null,
    urgencia: form.urgencia || 'Media',
    periodo_necesidad: form.periodo_necesidad || null,
    motivo: form.motivo || null,
    cantidad: Number(form.cantidad || 1),
    modalidad: form.modalidad || null,
    tareas: form.tareas || null,
    requisitos: form.requisitos || null,
    experiencia: form.experiencia || null,
    documentacion: form.documentacion || null,
    responsable: form.responsable || null,
    contacto: form.contacto || null,
    observaciones: form.observaciones || null,
    requiere_psicologico: !!form.requiere_psicologico,
    requiere_direccion: !!form.requiere_direccion,
    horas_semanales: form.horas_semanales || null,
    categoria: form.categoria || null,
    sueldo_especificaciones: form.sueldo_especificaciones || null,
    creado_por: form.creado_por || userId || null,
  }
}

function cleanCandidatoPayload(form) {
  return {
    solicitud_id: form.solicitud_id || null,
    estado: form.estado || 'cv_recibido',
    nombre_apellido: form.nombre_apellido,
    dni: form.dni || null,
    cuil: form.cuil || null,
    celular: form.celular || null,
    email: form.email || null,
    origen: form.origen || null,
    recomendado_por: form.recomendado_por || null,
    evaluacion_breve: form.evaluacion_breve || null,
    resultado: form.resultado || null,
    requiere_psicologico: !!form.requiere_psicologico,
    requiere_direccion: !!form.requiere_direccion,
    fecha_preocupacional: form.fecha_preocupacional || null,
    resultado_preocupacional: form.resultado_preocupacional || null,
    fecha_ingreso: form.fecha_ingreso || null,
    induccion_at: form.induccion_at || null,
    notas: form.notas || null,
    persona_id: form.persona_id || null,
  }
}

function cleanEntrevistaPayload(form, candidatoId) {
  return {
    candidato_id: candidatoId,
    fecha_entrevista: form.fecha_entrevista || null,
    hora_entrevista: form.hora_entrevista || null,
    entrevistador: form.entrevistador || null,
    nombre_apellido: form.nombre_apellido || null,
    dni: form.dni || null,
    cuil: form.cuil || null,
    estado_civil: form.estado_civil || null,
    hijos_menores: form.hijos_menores || null,
    edades_hijos: form.edades_hijos || null,
    domicilio: form.domicilio || null,
    piso: form.piso || null,
    departamento: form.departamento || null,
    barrio: form.barrio || null,
    ciudad: form.ciudad || null,
    codigo_postal: form.codigo_postal || null,
    fecha_nacimiento: form.fecha_nacimiento || null,
    nacionalidad: form.nacionalidad || null,
    celular: form.celular || null,
    celular_alternativo: form.celular_alternativo || null,
    email: form.email || null,
    nivel_estudio: form.nivel_estudio || null,
    estudios_cursados: form.estudios_cursados || null,
    estudia_actualmente: form.estudia_actualmente || null,
    movilidad: form.movilidad || null,
    carnet_conducir: form.carnet_conducir || null,
    disponibilidad_horaria: form.disponibilidad_horaria || null,
    enfermedades_cronicas: form.enfermedades_cronicas || null,
    talle_pantalon: form.talle_pantalon || null,
    talle_camisa: form.talle_camisa || null,
    talle_calzado: form.talle_calzado || null,
    carnet_sanitario: !!form.carnet_sanitario,
    antecedentes_penales: !!form.antecedentes_penales,
    recomendado_por: form.recomendado_por || null,
    observaciones: form.observaciones || null,
  }
}

function estadoLabel(list, value) {
  return list.find(([id]) => id === value)?.[1] || value || '—'
}

function solicitudEstadoOperativo(estado) {
  const label = estadoLabel(SOLICITUD_ESTADOS, estado)
  return SOLICITUD_ESTADOS_POST_ENVIO.has(estado)
    ? `Enviada a WhatsApp · ${label}`
    : label
}

function formatDate(value) {
  if (!value) return '—'
  const [datePart] = String(value).split('T')
  const parts = datePart.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return value
}

function formatTime(value) {
  if (!value) return ''
  return String(value).slice(0, 5)
}

function splitNombreApellido(nombreCompleto = '') {
  const parts = String(nombreCompleto || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean)
  if (parts.length <= 1) return { nombre: parts[0] || '', apellido: '' }
  return { nombre: parts.slice(0, -1).join(' '), apellido: parts.at(-1) }
}

function candidatoToPersonaPayload(candidate, solicitud, entrevista) {
  const { nombre, apellido } = splitNombreApellido(candidate.nombre_apellido)
  const procesos = String(solicitud?.tareas || '')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
  return {
    nombre,
    apellido: apellido || null,
    dni: candidate.dni || entrevista?.dni || null,
    puesto: solicitud?.puesto || null,
    area: solicitud?.categoria || null,
    telefono: candidate.celular || entrevista?.celular || null,
    email: candidate.email || entrevista?.email || null,
    fecha_ingreso: candidate.fecha_ingreso || null,
    descripcion_puesto: solicitud?.tareas || solicitud?.requisitos || null,
    procesos: procesos.length ? procesos : null,
    sede_ids: solicitud?.sede_id ? [Number(solicitud.sede_id)] : null,
    activo: true,
  }
}

function Field({ label, children }) {
  return (
    <div>
      <label className="font-metric block mb-1" style={{ fontSize:'0.6rem', color:'var(--text-dim)', letterSpacing:'0.06em' }}>{label.toUpperCase()}</label>
      {children}
    </div>
  )
}

function ModalShell({ title, subtitle, children, onClose }) {
  return (
    <div className="modal-overlay" style={{ zIndex:70 }}>
      <div className="glass fade-in w-full max-w-6xl" style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.2)', borderRadius:4, maxHeight:'92vh', overflow:'auto' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:'1px solid rgba(57,255,20,0.1)' }}>
          <div>
            <h2 className="font-title font-bold" style={{ color:'var(--text)', fontSize:'1rem' }}>{title}</h2>
            {subtitle && <p className="font-metric" style={{ color:'var(--text-dim)', fontSize:'0.62rem' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn-ghost"><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function buildWhatsappText(solicitud, sedes) {
  const sede = sedes.find(s => String(s.id) === String(solicitud.sede_id))
  const bullets = raw => {
    const lines = String(raw || '').split('\n').map(x => x.trim()).filter(Boolean)
    return lines.length ? lines.map(x => `* ${x}`).join('\n') : '* [Completar]'
  }
  const urgency = solicitud.urgencia === 'Alta' ? 'URGENTE' : (solicitud.urgencia || '[Completar]')
  const cantidad = Number(solicitud.cantidad || 0) === 1 ? '1 persona' : `${solicitud.cantidad || '[Completar]'} personas`
  return `SOLICITUD DE PERSONAL

📌 Puesto:
${solicitud.puesto || '[Completar]'}

📍 Lugar de trabajo / Sede:
${sede?.nombre || '[Completar]'}

🕒 Horario de trabajo:
${solicitud.horario || '[Completar]'}

📅 Fecha de apertura de la búsqueda:
${formatDate(solicitud.fecha_apertura)}

⚠️ Urgencia / Prioridad:
${urgency}

📆 Período de necesidad:
${solicitud.periodo_necesidad || '[Completar]'}

🎯 Motivo de la solicitud:
${solicitud.motivo || '[Completar]'}

👤 Cantidad de personas solicitadas:
${cantidad}

🧾 Modalidad de contratación:
${solicitud.modalidad || '[Completar]'}

📋 Tareas principales del puesto:
${bullets(solicitud.tareas)}

✅ Requisitos del puesto:
${bullets(solicitud.requisitos)}

🎓 Experiencia requerida:
${solicitud.experiencia || '[Completar]'}

📄 Documentación / credenciales necesarias:
${solicitud.documentacion || '[Completar]'}

🧑‍💼 Responsable solicitante:
${solicitud.responsable || '[Completar]'}

📞 Contacto para coordinación:
${solicitud.contacto || '[Completar]'}

📝 Observaciones:
${solicitud.observaciones || '[Completar]'}`
}

function SolicitudModal({ initial, sedes, onClose, onSaved }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ ...EMPTY_SOLICITUD, ...(initial || {}) })
  const [saving, setSaving] = useState(false)
  const text = buildWhatsappText(form, sedes)
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(text)}`

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async (nextState) => {
    if (!form.puesto.trim() || !form.sede_id) {
      toast.warn('Completá puesto y sede antes de guardar.')
      return
    }
    setSaving(true)
    const payload = cleanSolicitudPayload({ ...form, estado: nextState || form.estado }, user?.id)
    const query = initial?.id
      ? supabase.schema('equipo').from('reclutamiento_solicitudes').update(payload).eq('id', initial.id).select().single()
      : supabase.schema('equipo').from('reclutamiento_solicitudes').insert(payload).select().single()
    const { data, error } = await query
    setSaving(false)
    if (error) {
      toast.error('Error guardando solicitud: ' + mensajeError(error))
      return
    }
    onSaved(data)
  }

  return (
    <ModalShell title="Solicitud de personal" subtitle="Guarda la búsqueda y genera el texto para WhatsApp" onClose={onClose}>
      <div className="grid grid-cols-2 gap-5 p-5">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Puesto *"><input className="input-dark w-full" value={form.puesto} onChange={e=>set('puesto', e.target.value)} placeholder="Ej: Cocinero" /></Field>
            <Field label="Sede *">
              <select className="input-dark w-full" value={form.sede_id || ''} onChange={e=>set('sede_id', e.target.value)}>
                <option value="">Seleccionar sede</option>
                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </Field>
            <Field label="Horario"><input className="input-dark w-full" value={form.horario || ''} onChange={e=>set('horario', e.target.value)} placeholder="Ej: 06:00 a 14:00" /></Field>
            <Field label="Fecha apertura"><input type="date" className="input-dark w-full" value={form.fecha_apertura || ''} onChange={e=>set('fecha_apertura', e.target.value)} /></Field>
            <Field label="Urgencia">
              <select className="input-dark w-full" value={form.urgencia || 'Media'} onChange={e=>set('urgencia', e.target.value)}>
                <option>Alta</option><option>Media</option><option>Baja</option>
              </select>
            </Field>
            <Field label="Estado">
              <select className="input-dark w-full" value={form.estado || 'borrador'} onChange={e=>set('estado', e.target.value)}>
                {SOLICITUD_ESTADOS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </Field>
            <Field label="Período"><input className="input-dark w-full" value={form.periodo_necesidad || ''} onChange={e=>set('periodo_necesidad', e.target.value)} placeholder="Ej: Permanente / Reemplazo" /></Field>
            <Field label="Cantidad"><input type="number" min="1" className="input-dark w-full" value={form.cantidad || 1} onChange={e=>set('cantidad', e.target.value)} /></Field>
            <Field label="Modalidad"><input className="input-dark w-full" value={form.modalidad || ''} onChange={e=>set('modalidad', e.target.value)} placeholder="Ej: Relación de dependencia" /></Field>
            <Field label="Horas semanales"><input className="input-dark w-full" value={form.horas_semanales || ''} onChange={e=>set('horas_semanales', e.target.value)} placeholder="Ej: 48" /></Field>
            <Field label="Categoría"><input className="input-dark w-full" value={form.categoria || ''} onChange={e=>set('categoria', e.target.value)} placeholder="Ej: Convenio / categoría" /></Field>
            <Field label="Responsable"><input className="input-dark w-full" value={form.responsable || ''} onChange={e=>set('responsable', e.target.value)} placeholder="Ej: Nicolás Vitale" /></Field>
            <Field label="Contacto"><input className="input-dark w-full" value={form.contacto || ''} onChange={e=>set('contacto', e.target.value)} placeholder="Ej: +54 9..." /></Field>
          </div>
          <Field label="Motivo"><textarea className="input-dark w-full" rows={2} value={form.motivo || ''} onChange={e=>set('motivo', e.target.value)} placeholder="Ej: Reemplazo por licencia" /></Field>
          <Field label="Tareas principales"><textarea className="input-dark w-full" rows={3} value={form.tareas || ''} onChange={e=>set('tareas', e.target.value)} placeholder="Una tarea por línea" /></Field>
          <Field label="Requisitos"><textarea className="input-dark w-full" rows={3} value={form.requisitos || ''} onChange={e=>set('requisitos', e.target.value)} placeholder="Un requisito por línea" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Experiencia"><textarea className="input-dark w-full" rows={2} value={form.experiencia || ''} onChange={e=>set('experiencia', e.target.value)} /></Field>
            <Field label="Documentación"><textarea className="input-dark w-full" rows={2} value={form.documentacion || ''} onChange={e=>set('documentacion', e.target.value)} /></Field>
          </div>
          <Field label="Especificaciones sueldo"><textarea className="input-dark w-full" rows={2} value={form.sueldo_especificaciones || ''} onChange={e=>set('sueldo_especificaciones', e.target.value)} /></Field>
          <Field label="Observaciones"><textarea className="input-dark w-full" rows={2} value={form.observaciones || ''} onChange={e=>set('observaciones', e.target.value)} /></Field>
          <div className="flex gap-4">
            <label className="flex items-center gap-2" style={{ fontSize:'0.72rem', color:'var(--text-dim)' }}>
              <input type="checkbox" checked={!!form.requiere_psicologico} onChange={e=>set('requiere_psicologico', e.target.checked)} /> Requiere psicológico
            </label>
            <label className="flex items-center gap-2" style={{ fontSize:'0.72rem', color:'var(--text-dim)' }}>
              <input type="checkbox" checked={!!form.requiere_direccion} onChange={e=>set('requiere_direccion', e.target.checked)} /> Requiere dirección
            </label>
          </div>
        </div>
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <p className="font-metric" style={{ color:'var(--phosphor)', fontSize:'0.68rem', letterSpacing:'0.08em' }}>TEXTO PARA WHATSAPP</p>
            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(text)} className="btn-ghost" style={{ fontSize:'0.68rem' }}>Copiar</button>
              <a href={whatsappHref} target="_blank" rel="noreferrer" className="btn-primary flex items-center gap-1.5" style={{ fontSize:'0.68rem', textDecoration:'none' }}><MessageCircle size={11}/> WhatsApp</a>
            </div>
          </div>
          <pre className="input-dark whitespace-pre-wrap flex-1" style={{ minHeight:520, fontSize:'0.72rem', lineHeight:1.55, padding:'1rem' }}>{text}</pre>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={onClose} className="btn-ghost">Cancelar</button>
            <button onClick={() => save()} disabled={saving} className="btn-ghost flex items-center gap-1.5"><Save size={12}/> Guardar</button>
            <button onClick={() => save('enviada_whatsapp')} disabled={saving} className="btn-primary flex items-center gap-1.5"><Send size={12}/> Guardar como enviada</button>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

function CandidatoModal({ initial, solicitudes, onClose, onSaved }) {
  const { perfil } = useAuth()
  const [form, setForm] = useState({ ...EMPTY_CANDIDATO, ...(initial || {}) })
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.nombre_apellido.trim()) {
      toast.warn('Completá nombre y apellido.')
      return
    }
    setSaving(true)
    const payload = cleanCandidatoPayload(form)
    const query = initial?.id
      ? supabase.schema('equipo').from('reclutamiento_candidatos').update(payload).eq('id', initial.id).select().single()
      : supabase.schema('equipo').from('reclutamiento_candidatos').insert(payload).select().single()
    const { data, error } = await query
    if (error) {
      setSaving(false)
      toast.error('Error guardando candidato: ' + mensajeError(error))
      return
    }
    for (const file of files) {
      await uploadAdjunto('reclutamiento_candidato_cv', data.id, file, perfil?.nombre || 'usuario')
    }
    setSaving(false)
    onSaved(data)
  }

  return (
    <ModalShell title="Candidato" subtitle="Carga de datos, CV y avance del proceso" onClose={onClose}>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <Field label="Solicitud">
            <select className="input-dark w-full" value={form.solicitud_id || ''} onChange={e=>set('solicitud_id', e.target.value)}>
              <option value="">Sin solicitud vinculada</option>
              {solicitudes.map(s => <option key={s.id} value={s.id}>{s.puesto} · {s.sede_nombre || s.sede_id}</option>)}
            </select>
          </Field>
          <Field label="Estado">
            <select className="input-dark w-full" value={form.estado || 'cv_recibido'} onChange={e=>set('estado', e.target.value)}>
              {CANDIDATO_ESTADOS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </Field>
          <Field label="Nombre y apellido *"><input className="input-dark w-full" value={form.nombre_apellido || ''} onChange={e=>set('nombre_apellido', e.target.value)} placeholder="Ej: Juan Pérez" /></Field>
          <Field label="Resultado">
            <select className="input-dark w-full" value={form.resultado || ''} onChange={e=>set('resultado', e.target.value)}>
              <option value="">Sin definir</option><option value="apto">Apto para el puesto</option><option value="no_apto">No apto para el puesto</option><option value="reserva">Reserva</option>
            </select>
          </Field>
          <Field label="DNI"><input className="input-dark w-full" value={form.dni || ''} onChange={e=>set('dni', e.target.value)} /></Field>
          <Field label="CUIL"><input className="input-dark w-full" value={form.cuil || ''} onChange={e=>set('cuil', e.target.value)} /></Field>
          <Field label="Celular"><input className="input-dark w-full" value={form.celular || ''} onChange={e=>set('celular', e.target.value)} /></Field>
          <Field label="Email"><input className="input-dark w-full" value={form.email || ''} onChange={e=>set('email', e.target.value)} /></Field>
          <Field label="Origen"><input className="input-dark w-full" value={form.origen || ''} onChange={e=>set('origen', e.target.value)} placeholder="Ej: WhatsApp / referido" /></Field>
          <Field label="Recomendado por"><input className="input-dark w-full" value={form.recomendado_por || ''} onChange={e=>set('recomendado_por', e.target.value)} /></Field>
          <Field label="Fecha preocupacional"><input type="date" className="input-dark w-full" value={form.fecha_preocupacional || ''} onChange={e=>set('fecha_preocupacional', e.target.value)} /></Field>
          <Field label="Fecha ingreso"><input type="date" className="input-dark w-full" value={form.fecha_ingreso || ''} onChange={e=>set('fecha_ingreso', e.target.value)} /></Field>
          <Field label="Inducción"><input type="datetime-local" className="input-dark w-full" value={form.induccion_at || ''} onChange={e=>set('induccion_at', e.target.value)} /></Field>
          <Field label="CV / archivos">
            <input type="file" multiple accept=".pdf,.doc,.docx,image/*" className="input-dark w-full" onChange={e=>setFiles(Array.from(e.target.files || []))} />
            <p style={{ color:'var(--text-dim)', fontSize:'0.62rem', marginTop:4 }}>
              Se guarda en el candidato y queda vinculado a la solicitud seleccionada.
            </p>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Evaluación breve"><textarea className="input-dark w-full" rows={3} value={form.evaluacion_breve || ''} onChange={e=>set('evaluacion_breve', e.target.value)} placeholder="Ej: Apto para el puesto. Buena experiencia en cocina." /></Field>
          <Field label="Notas"><textarea className="input-dark w-full" rows={3} value={form.notas || ''} onChange={e=>set('notas', e.target.value)} /></Field>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2" style={{ fontSize:'0.72rem', color:'var(--text-dim)' }}><input type="checkbox" checked={!!form.requiere_psicologico} onChange={e=>set('requiere_psicologico', e.target.checked)} /> Coordinar psicológico</label>
          <label className="flex items-center gap-2" style={{ fontSize:'0.72rem', color:'var(--text-dim)' }}><input type="checkbox" checked={!!form.requiere_direccion} onChange={e=>set('requiere_direccion', e.target.checked)} /> Coordinar dirección</label>
        </div>
        {initial?.id && <AdjuntosPanel entityType="reclutamiento_candidato_cv" entityId={initial.id} />}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-1.5"><Save size={12}/> {saving ? 'Guardando...' : 'Guardar candidato'}</button>
        </div>
      </div>
    </ModalShell>
  )
}

function EntrevistaModal({ candidate, solicitud, initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    ...EMPTY_ENTREVISTA,
    ...(initial || {}),
    nombre_apellido: initial?.nombre_apellido || candidate?.nombre_apellido || '',
    dni: initial?.dni || candidate?.dni || '',
    cuil: initial?.cuil || candidate?.cuil || '',
    celular: initial?.celular || candidate?.celular || '',
    email: initial?.email || candidate?.email || '',
    recomendado_por: initial?.recomendado_por || candidate?.recomendado_por || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    const payload = cleanEntrevistaPayload(form, candidate.id)
    const query = initial?.id
      ? supabase.schema('equipo').from('reclutamiento_entrevistas').update(payload).eq('id', initial.id).select().single()
      : supabase.schema('equipo').from('reclutamiento_entrevistas').insert(payload).select().single()
    const { data, error } = await query
    setSaving(false)
    if (error) {
      toast.error('Error guardando entrevista: ' + mensajeError(error))
      return
    }
    await supabase.schema('equipo').from('reclutamiento_candidatos').update({ estado: 'entrevista' }).eq('id', candidate.id)
    onSaved(data)
  }

  const pdfPayload = { candidate, solicitud, entrevista: form }

  return (
    <ModalShell title="Ficha de entrevista" subtitle={candidate?.nombre_apellido} onClose={onClose}>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <Field label="Fecha entrevista"><input type="date" className="input-dark w-full" value={form.fecha_entrevista || ''} onChange={e=>set('fecha_entrevista', e.target.value)} /></Field>
          <Field label="Hora entrevista"><input type="time" className="input-dark w-full" value={formatTime(form.hora_entrevista)} onChange={e=>set('hora_entrevista', e.target.value)} /></Field>
          <Field label="Entrevistador"><input className="input-dark w-full" value={form.entrevistador || ''} onChange={e=>set('entrevistador', e.target.value)} /></Field>
          <Field label="Nombre y apellido"><input className="input-dark w-full" value={form.nombre_apellido || ''} onChange={e=>set('nombre_apellido', e.target.value)} /></Field>
          <Field label="Estado civil"><input className="input-dark w-full" value={form.estado_civil || ''} onChange={e=>set('estado_civil', e.target.value)} /></Field>
          <Field label="DNI"><input className="input-dark w-full" value={form.dni || ''} onChange={e=>set('dni', e.target.value)} /></Field>
          <Field label="CUIL"><input className="input-dark w-full" value={form.cuil || ''} onChange={e=>set('cuil', e.target.value)} /></Field>
          <Field label="Hijos menores"><input className="input-dark w-full" value={form.hijos_menores || ''} onChange={e=>set('hijos_menores', e.target.value)} /></Field>
          <Field label="Edades"><input className="input-dark w-full" value={form.edades_hijos || ''} onChange={e=>set('edades_hijos', e.target.value)} /></Field>
          <Field label="Domicilio"><input className="input-dark w-full" value={form.domicilio || ''} onChange={e=>set('domicilio', e.target.value)} /></Field>
          <Field label="Piso"><input className="input-dark w-full" value={form.piso || ''} onChange={e=>set('piso', e.target.value)} /></Field>
          <Field label="Dpto"><input className="input-dark w-full" value={form.departamento || ''} onChange={e=>set('departamento', e.target.value)} /></Field>
          <Field label="Barrio"><input className="input-dark w-full" value={form.barrio || ''} onChange={e=>set('barrio', e.target.value)} /></Field>
          <Field label="Ciudad"><input className="input-dark w-full" value={form.ciudad || ''} onChange={e=>set('ciudad', e.target.value)} /></Field>
          <Field label="CP"><input className="input-dark w-full" value={form.codigo_postal || ''} onChange={e=>set('codigo_postal', e.target.value)} /></Field>
          <Field label="Fecha nacimiento"><input type="date" className="input-dark w-full" value={form.fecha_nacimiento || ''} onChange={e=>set('fecha_nacimiento', e.target.value)} /></Field>
          <Field label="Nacionalidad"><input className="input-dark w-full" value={form.nacionalidad || ''} onChange={e=>set('nacionalidad', e.target.value)} /></Field>
          <Field label="Celular"><input className="input-dark w-full" value={form.celular || ''} onChange={e=>set('celular', e.target.value)} /></Field>
          <Field label="Celular alternativo"><input className="input-dark w-full" value={form.celular_alternativo || ''} onChange={e=>set('celular_alternativo', e.target.value)} /></Field>
          <Field label="Mail"><input className="input-dark w-full" value={form.email || ''} onChange={e=>set('email', e.target.value)} /></Field>
          <Field label="Nivel estudio">
            <select className="input-dark w-full" value={form.nivel_estudio || ''} onChange={e=>set('nivel_estudio', e.target.value)}>
              <option value="">Sin indicar</option><option>Primario</option><option>Secundario</option><option>Terciario</option><option>Universitario</option>
            </select>
          </Field>
          <Field label="Estudios cursados"><input className="input-dark w-full" value={form.estudios_cursados || ''} onChange={e=>set('estudios_cursados', e.target.value)} /></Field>
          <Field label="Estudia actualmente"><input className="input-dark w-full" value={form.estudia_actualmente || ''} onChange={e=>set('estudia_actualmente', e.target.value)} /></Field>
          <Field label="Movilidad"><input className="input-dark w-full" value={form.movilidad || ''} onChange={e=>set('movilidad', e.target.value)} placeholder="transporte público, auto, moto" /></Field>
          <Field label="Carnet conducir"><input className="input-dark w-full" value={form.carnet_conducir || ''} onChange={e=>set('carnet_conducir', e.target.value)} /></Field>
          <Field label="Disponibilidad horaria"><input className="input-dark w-full" value={form.disponibilidad_horaria || ''} onChange={e=>set('disponibilidad_horaria', e.target.value)} /></Field>
          <Field label="Enfermedades crónicas"><input className="input-dark w-full" value={form.enfermedades_cronicas || ''} onChange={e=>set('enfermedades_cronicas', e.target.value)} /></Field>
          <Field label="Talle pantalón"><input className="input-dark w-full" value={form.talle_pantalon || ''} onChange={e=>set('talle_pantalon', e.target.value)} /></Field>
          <Field label="Talle camisa/chomba"><input className="input-dark w-full" value={form.talle_camisa || ''} onChange={e=>set('talle_camisa', e.target.value)} /></Field>
          <Field label="Calzado"><input className="input-dark w-full" value={form.talle_calzado || ''} onChange={e=>set('talle_calzado', e.target.value)} /></Field>
          <Field label="Recomendado por"><input className="input-dark w-full" value={form.recomendado_por || ''} onChange={e=>set('recomendado_por', e.target.value)} /></Field>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2" style={{ fontSize:'0.72rem', color:'var(--text-dim)' }}><input type="checkbox" checked={!!form.carnet_sanitario} onChange={e=>set('carnet_sanitario', e.target.checked)} /> Carnet sanitario</label>
          <label className="flex items-center gap-2" style={{ fontSize:'0.72rem', color:'var(--text-dim)' }}><input type="checkbox" checked={!!form.antecedentes_penales} onChange={e=>set('antecedentes_penales', e.target.checked)} /> Antecedentes penales</label>
        </div>
        <Field label="Observaciones"><textarea className="input-dark w-full" rows={4} value={form.observaciones || ''} onChange={e=>set('observaciones', e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={() => generateFichaEntrevistaPdf(pdfPayload)} className="btn-ghost flex items-center gap-1.5"><Download size={12}/> PDF entrevista</button>
          <button onClick={() => generateFichaAltaPdf(pdfPayload)} className="btn-ghost flex items-center gap-1.5"><Download size={12}/> PDF alta</button>
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-1.5"><Save size={12}/> {saving ? 'Guardando...' : 'Guardar entrevista'}</button>
        </div>
      </div>
    </ModalShell>
  )
}

export default function ReclutamientoBoard({
  sedes = [],
  canManage = false,
  allowedSedeIds = null,
  focusCandidateId = null,
  onBack,
}) {
  const { perfil, user } = useAuth()
  const [solicitudes, setSolicitudes] = useState([])
  const [candidatos, setCandidatos] = useState([])
  const [entrevistas, setEntrevistas] = useState([])
  const [candidateLinks, setCandidateLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [schemaError, setSchemaError] = useState(null)
  const [search, setSearch] = useState('')
  const [activeSolicitud, setActiveSolicitud] = useState(null)
  const [activeCandidato, setActiveCandidato] = useState(null)
  const [activeEntrevista, setActiveEntrevista] = useState(null)
  const [candidateActionId, setCandidateActionId] = useState(null)
  const [showFinalizados, setShowFinalizados] = useState(false)
  const [showHistorialSolicitudes, setShowHistorialSolicitudes] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setSchemaError(null)
    const [solRes, candRes, entRes, linkRes] = await Promise.all([
      supabase.schema('equipo').from('reclutamiento_solicitudes').select('*').order('created_at', { ascending: false }),
      supabase.schema('equipo').from('reclutamiento_candidatos').select('*').order('updated_at', { ascending: false }),
      supabase.schema('equipo').from('reclutamiento_entrevistas').select('*'),
      supabase.schema('equipo').from('reclutamiento_candidato_solicitudes').select('*'),
    ])
    if (solRes.error || candRes.error || entRes.error || linkRes.error) {
      setSchemaError(solRes.error || candRes.error || entRes.error || linkRes.error)
      setSolicitudes([])
      setCandidatos([])
      setEntrevistas([])
      setCandidateLinks([])
    } else {
      const sedeById = new Map(sedes.map(s => [String(s.id), s.nombre]))
      const allowedSet = allowedSedeIds === null ? null : new Set(allowedSedeIds.map(id => String(id)))
      const scopedSolicitudes = (solRes.data || [])
        .filter(s => !allowedSet || allowedSet.has(String(s.sede_id)))
        .map(s => ({ ...s, sede_nombre: sedeById.get(String(s.sede_id)) || s.sede_nombre }))
      const scopedSolicitudIds = new Set(scopedSolicitudes.map(s => s.id))
      const scopedLinks = (linkRes.data || [])
        .filter(link => !allowedSet || scopedSolicitudIds.has(link.solicitud_id))
      const linkedCandidateIds = new Set(scopedLinks.map(link => link.candidato_id))
      const scopedCandidatos = (candRes.data || [])
        .filter(c => !allowedSet || (c.solicitud_id && scopedSolicitudIds.has(c.solicitud_id)) || linkedCandidateIds.has(c.id))
      const scopedCandidateIds = new Set(scopedCandidatos.map(c => c.id))
      setSolicitudes(scopedSolicitudes)
      setCandidatos(scopedCandidatos)
      setEntrevistas(entRes.data || [])
      setCandidateLinks(scopedLinks.filter(link => scopedCandidateIds.has(link.candidato_id)))
    }
    setLoading(false)
  }, [sedes, allowedSedeIds])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!loading && focusCandidateId) {
      const candidate = candidatos.find(item => String(item.id) === String(focusCandidateId))
      if (candidate) setSearch(candidate.nombre_apellido)
    }
  }, [loading, focusCandidateId, candidatos])

  const solicitudesById = useMemo(() => new Map(solicitudes.map(s => [s.id, s])), [solicitudes])
  const linksByCandidate = useMemo(() => {
    const result = new Map()
    candidateLinks.forEach(link => {
      if (!result.has(link.candidato_id)) result.set(link.candidato_id, new Set())
      result.get(link.candidato_id).add(link.solicitud_id)
    })
    return result
  }, [candidateLinks])
  const solicitudesAbiertas = useMemo(
    () => solicitudes.filter(s => !['cerrada', 'cancelada'].includes(s.estado)),
    [solicitudes],
  )
  const solicitudesCerradas = useMemo(
    () => solicitudes.filter(s => ['cerrada', 'cancelada'].includes(s.estado)),
    [solicitudes],
  )
  const canManageMultipleLinks = canManage && ['admin', 'editor'].includes(perfil?.rol)
  const entrevistasByCandidato = useMemo(() => new Map(entrevistas.map(e => [e.candidato_id, e])), [entrevistas])
  const normalizeString = str => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : ""
  const filtered = candidatos.filter(c => {
    const q = normalizeString(search.trim())
    if (!q) return true
    const solicitudIds = new Set(linksByCandidate.get(c.id) || [])
    if (c.solicitud_id) solicitudIds.add(c.solicitud_id)
    const solicitudesText = [...solicitudIds]
      .map(id => {
        const solicitud = solicitudesById.get(id)
        return `${solicitud?.puesto || ''} ${solicitud?.sede_nombre || ''}`
      })
      .join(' ')
    const target = `${c.nombre_apellido || ''} ${c.dni || ''} ${c.cuil || ''} ${solicitudesText}`
    return normalizeString(target).includes(q)
  })

  const updateCandidate = async (id, payload) => {
    setCandidateActionId(id)
    const { error } = await supabase.schema('equipo').from('reclutamiento_candidatos').update(payload).eq('id', id)
    if (error) {
      toast.error('Error actualizando candidato: ' + mensajeError(error))
    } else {
      await load()
    }
    setCandidateActionId(null)
  }

  const incorporarCandidato = async (candidate) => {
    if (!canManage || candidate.persona_id) return
    const solicitud = solicitudesById.get(candidate.solicitud_id)
    const entrevista = entrevistasByCandidato.get(candidate.id)
    if (!candidate.fecha_ingreso) {
      toast.warn('Cargá la fecha de ingreso antes de dar de alta en Equipo.')
      setActiveCandidato(candidate)
      return
    }
    if (!solicitud?.sede_id) {
      toast.warn('El candidato necesita una búsqueda principal con sede para crear la persona.')
      return
    }

    const confirmed = await confirmar({
      titulo: 'Dar de alta en Equipo',
      mensaje: `Se creará una persona activa para ${candidate.nombre_apellido} y el candidato pasará a Incorporado.`,
      confirmText: 'Dar de alta',
    })
    if (!confirmed) return

    setCandidateActionId(candidate.id)
    try {
      const duplicateChecks = []
      if (candidate.dni) {
        duplicateChecks.push(
          supabase.schema('equipo').from('personas').select('id,nombre,apellido,dni,email').eq('dni', candidate.dni).limit(1).maybeSingle(),
        )
      }
      if (candidate.email) {
        duplicateChecks.push(
          supabase.schema('equipo').from('personas').select('id,nombre,apellido,dni,email').ilike('email', candidate.email).limit(1).maybeSingle(),
        )
      }
      const duplicateResults = await Promise.all(duplicateChecks)
      const duplicateError = duplicateResults.find(result => result.error)?.error
      if (duplicateError) throw duplicateError
      const existing = duplicateResults.find(result => result.data)?.data
      if (existing?.id) {
        const { error: linkError } = await supabase
          .schema('equipo')
          .from('reclutamiento_candidatos')
          .update({ persona_id: existing.id, estado: 'incorporado' })
          .eq('id', candidate.id)
        if (linkError) throw linkError
        toast.warn('Ya existía una persona con ese DNI/email. Vinculé el candidato al legajo existente.')
        await load()
        return
      }

      const payload = candidatoToPersonaPayload(candidate, solicitud, entrevista)
      const { data: persona, error: personaError } = await supabase
        .schema('equipo')
        .from('personas')
        .insert(payload)
        .select('id')
        .single()
      if (personaError) throw personaError

      const { error: candidateError } = await supabase
        .schema('equipo')
        .from('reclutamiento_candidatos')
        .update({ persona_id: persona.id, estado: 'incorporado' })
        .eq('id', candidate.id)
      if (candidateError) throw candidateError

      toast.ok('Persona dada de alta en Equipo.')
      await load()
    } catch (error) {
      toast.error('Error dando de alta en Equipo: ' + mensajeError(error))
    } finally {
      setCandidateActionId(null)
    }
  }

  const setPrimarySolicitud = async (candidate, solicitudId) => {
    setCandidateActionId(candidate.id)
    try {
      const existingLinks = new Set(linksByCandidate.get(candidate.id) || [])
      const missingLinks = [candidate.solicitud_id, solicitudId]
        .filter(Boolean)
        .filter(id => !existingLinks.has(id))
        .map(id => ({
          candidato_id: candidate.id,
          solicitud_id: id,
          created_by: user?.id || null,
        }))
      if (canManageMultipleLinks && missingLinks.length > 0) {
        const { error: linkError } = await supabase
          .schema('equipo')
          .from('reclutamiento_candidato_solicitudes')
          .insert(missingLinks)
        if (linkError) throw linkError
      }

      const { error } = await supabase
        .schema('equipo')
        .from('reclutamiento_candidatos')
        .update({ solicitud_id: solicitudId })
        .eq('id', candidate.id)
      if (error) throw error
      await load()
    } catch (error) {
      toast.error('Error cambiando la búsqueda principal: ' + mensajeError(error))
    } finally {
      setCandidateActionId(null)
    }
  }

  const toggleCandidateLink = async (candidate, solicitudId, checked) => {
    if (!canManageMultipleLinks || solicitudId === candidate.solicitud_id) return
    setCandidateActionId(candidate.id)
    try {
      const query = supabase
        .schema('equipo')
        .from('reclutamiento_candidato_solicitudes')
      const { error } = checked
        ? await query.insert({
            candidato_id: candidate.id,
            solicitud_id: solicitudId,
            created_by: user?.id || null,
          })
        : await query
            .delete()
            .eq('candidato_id', candidate.id)
            .eq('solicitud_id', solicitudId)
      if (error) throw error
      await load()
    } catch (error) {
      toast.error('Error actualizando búsquedas vinculadas: ' + mensajeError(error))
    } finally {
      setCandidateActionId(null)
    }
  }

  const deleteCandidate = async (candidate) => {
    const interviewWarning = entrevistasByCandidato.has(candidate.id)
      ? '\nTambién se eliminará la entrevista vinculada.'
      : ''
    const personWarning = candidate.persona_id
      ? '\nLa persona ya incorporada al equipo NO será eliminada.'
      : ''
    const confirmed = await confirmar({
      titulo: `Eliminar a ${candidate.nombre_apellido}`,
      mensaje: `Se lo quitará del tablero de selección.${interviewWarning}${personWarning}\n\nEsta acción no se puede deshacer.`,
      peligro: true, confirmText: 'Eliminar',
    })
    if (!confirmed) return

    setCandidateActionId(candidate.id)
    try {
      const adjuntos = await getAdjuntos('reclutamiento_candidato_cv', candidate.id)
      const { error } = await supabase
        .schema('equipo')
        .from('reclutamiento_candidatos')
        .delete()
        .eq('id', candidate.id)
      if (error) throw error

      const cleanup = await Promise.allSettled(adjuntos.map(deleteAdjunto))
      const failedAttachments = cleanup.filter(result => result.status === 'rejected').length
      if (failedAttachments > 0) {
        toast.warn(`Postulante eliminado, pero no se pudieron limpiar ${failedAttachments} archivo(s) adjunto(s).`)
      }
      await load()
    } catch (error) {
      toast.error('Error eliminando candidato: ' + mensajeError(error))
    } finally {
      setCandidateActionId(null)
    }
  }

  const openInterview = (candidate) => {
    setActiveEntrevista({ candidate, entrevista: entrevistasByCandidato.get(candidate.id) || null })
  }

  if (schemaError) return (
    <div className="glass p-5" style={{ border:'1px solid rgba(245,158,11,0.35)' }}>
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} style={{ color:'#f59e0b', flexShrink:0 }} />
        <div>
          <h3 className="font-title font-bold" style={{ color:'var(--text)' }}>Falta aplicar el esquema de reclutamiento</h3>
          <p style={{ color:'var(--text-dim)', fontSize:'0.78rem', marginTop:4 }}>
            La interfaz ya está cargada, pero Supabase todavía no tiene las tablas nuevas. Revisá y aplicá el SQL en <code>supabase/migrations/20260629_reclutamiento_rrhh_REVIEW.sql</code>.
          </p>
          <p style={{ color:'var(--text-dim)', fontSize:'0.7rem', marginTop:8 }}>Detalle técnico: {schemaError.message}</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {activeSolicitud && <SolicitudModal initial={activeSolicitud.id ? activeSolicitud : null} sedes={sedes} onClose={() => setActiveSolicitud(null)} onSaved={() => { setActiveSolicitud(null); load() }} />}
      {activeCandidato && <CandidatoModal initial={activeCandidato.id ? activeCandidato : null} solicitudes={solicitudes} onClose={() => setActiveCandidato(null)} onSaved={() => { setActiveCandidato(null); load() }} />}
      {activeEntrevista && (
        <EntrevistaModal
          candidate={activeEntrevista.candidate}
          solicitud={solicitudesById.get(activeEntrevista.candidate.solicitud_id) || {}}
          initial={activeEntrevista.entrevista}
          onClose={() => setActiveEntrevista(null)}
          onSaved={() => { setActiveEntrevista(null); load() }}
        />
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          {onBack && (
            <button onClick={onBack} className="btn-ghost" style={{ fontSize:'0.68rem', marginTop:1 }}>
              ← Volver a lista
            </button>
          )}
          <div>
            <h2 className="font-title font-bold flex items-center gap-2" style={{ color:'var(--phosphor)', fontSize:'1rem' }}>
              <Briefcase size={16}/> Selección de personal
            </h2>
            <p className="font-metric" style={{ fontSize:'0.62rem', color:'var(--text-dim)' }}>
              Solicitud → WhatsApp → CVs → entrevista → evaluación → preocupacional → ingreso
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize:'0.72rem', color:'var(--text-dim)' }}>
            <input type="checkbox" checked={showFinalizados} onChange={e=>setShowFinalizados(e.target.checked)} />
            Ver archivados/finalizados
          </label>
          <div className="relative" style={{ width: 220 }}>
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color:'var(--text-dim)' }} />
            <input className="input-dark w-full pl-7" placeholder="Buscar candidato..." value={search} onChange={e=>setSearch(e.target.value)} style={{ fontSize:'0.75rem', height:30 }} />
          </div>
          {canManage && <button onClick={() => setActiveSolicitud({})} className="btn-ghost flex items-center gap-1.5" style={{ fontSize:'0.72rem' }}><ClipboardCheck size={12}/> Nueva solicitud</button>}
          {canManage && <button onClick={() => setActiveCandidato({})} className="btn-primary flex items-center gap-1.5" style={{ fontSize:'0.72rem' }}><Plus size={12}/> Nuevo candidato</button>}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-0 glass" style={{ border:'1px solid rgba(57,255,20,0.08)' }}>
        {[
          ['Solicitudes abiertas', solicitudesAbiertas.length],
          ['CVs en proceso', candidatos.filter(c => !['incorporado','no_apto','archivado'].includes(c.estado)).length],
          ['Entrevistas', candidatos.filter(c => c.estado === 'entrevista').length],
          ['Listos ingreso', candidatos.filter(c => c.estado === 'apto_ingreso').length],
        ].map(([label, value]) => (
          <div key={label} className="py-3 px-4 text-center" style={{ borderRight:'1px solid rgba(57,255,20,0.06)' }}>
            <p className="font-title font-bold text-xl" style={{ color:'var(--phosphor)' }}>{value}</p>
            <p className="font-metric" style={{ fontSize:'0.6rem', color:'var(--text-dim)', letterSpacing:'0.08em' }}>{label.toUpperCase()}</p>
          </div>
        ))}
      </div>

      <div className="glass p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="font-metric" style={{ fontSize:'0.68rem', color:'var(--phosphor)', letterSpacing:'0.08em' }}>SOLICITUDES ACTIVAS</p>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {solicitudesAbiertas.map(s => (
            <div key={s.id} className="glass p-3 text-left flex-shrink-0" style={{ width:285, border:'1px solid rgba(255,255,255,0.08)' }}>
              <p className="font-title font-bold" style={{ color:'var(--text)', fontSize:'0.86rem' }}>{s.puesto}</p>
              <p style={{ color:'var(--text-dim)', fontSize:'0.7rem', marginTop:2 }}>{s.sede_nombre || 'Sin sede'} · {solicitudEstadoOperativo(s.estado)}</p>
              <p style={{ color:'var(--text-dim)', fontSize:'0.66rem', marginTop:6 }}><CalendarDays size={11} style={{ display:'inline', marginRight:4 }} /> {formatDate(s.fecha_apertura)} · {s.urgencia}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setActiveCandidato({ solicitud_id: s.id, estado: 'cv_recibido' })} className="btn-primary flex-1" style={{ fontSize:'0.66rem', padding:'0.35rem 0.5rem' }}>
                  + Candidato / CV
                </button>
                <button onClick={() => setActiveSolicitud(s)} className="btn-ghost" style={{ fontSize:'0.66rem', padding:'0.35rem 0.5rem' }}>
                  Editar
                </button>
              </div>
            </div>
          ))}
          {solicitudesAbiertas.length === 0 && <p style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>No hay solicitudes abiertas.</p>}
        </div>
      </div>

      <div className="glass p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="font-metric" style={{ fontSize:'0.68rem', color:'var(--text-dim)', letterSpacing:'0.08em' }}>HISTORIAL DE BÚSQUEDAS</p>
          <button onClick={() => setShowHistorialSolicitudes(!showHistorialSolicitudes)} className="btn-ghost" style={{ fontSize:'0.68rem', padding:'0.2rem 0.5rem' }}>
            {showHistorialSolicitudes ? 'Ocultar' : 'Ver historial'}
          </button>
        </div>
        {showHistorialSolicitudes && (
          <div className="flex gap-3 overflow-x-auto pb-1 mt-3">
            {solicitudesCerradas.map(s => (
              <div key={s.id} className="glass p-3 text-left flex-shrink-0" style={{ width:285, border:'1px solid rgba(255,255,255,0.08)', opacity: 0.75 }}>
                <p className="font-title font-bold" style={{ color:'var(--text)', fontSize:'0.86rem' }}>{s.puesto}</p>
                <p style={{ color:'var(--text-dim)', fontSize:'0.7rem', marginTop:2 }}>{s.sede_nombre || 'Sin sede'} · {solicitudEstadoOperativo(s.estado)}</p>
                <p style={{ color:'var(--text-dim)', fontSize:'0.66rem', marginTop:6 }}><CalendarDays size={11} style={{ display:'inline', marginRight:4 }} /> {formatDate(s.fecha_apertura)}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setActiveSolicitud(s)} className="btn-ghost w-full" style={{ fontSize:'0.66rem', padding:'0.35rem 0.5rem' }}>
                    Ver solicitud
                  </button>
                </div>
              </div>
            ))}
            {solicitudesCerradas.length === 0 && <p style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>No hay solicitudes en el historial.</p>}
          </div>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {(() => {
          const isSearching = search.trim().length > 0
          const displayColumns = (showFinalizados || isSearching) 
            ? [...BOARD_COLUMNS, ['incorporado', 'Incorporado'], ['no_apto', 'No apto'], ['archivado', 'Archivado']] 
            : BOARD_COLUMNS
          
          return displayColumns.map(([status, title]) => {
            const items = filtered.filter(c => c.estado === status)
            // Si estamos buscando y la columna de archivados está vacía, no la mostramos para no hacer ruido
            if (isSearching && !showFinalizados && ['incorporado', 'no_apto', 'archivado'].includes(status) && items.length === 0) return null
            
            return (
              <div key={status} className="flex-shrink-0 glass p-3" style={{ width:320, border:'1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-3" style={{ borderBottom:'1px solid rgba(57,255,20,0.1)', paddingBottom:8 }}>
                <h3 className="font-title font-bold" style={{ color:'var(--phosphor)', fontSize:'0.9rem' }}>{title}</h3>
                <span className="font-metric" style={{ color:'var(--text-dim)', fontSize:'0.65rem' }}>{items.length}</span>
              </div>
              <div className="space-y-3">
                {items.map(c => {
                  const solicitud = solicitudesById.get(c.solicitud_id)
                  const solicitudCerrada = solicitud && ['cerrada', 'cancelada'].includes(solicitud.estado)
                  const entrevista = entrevistasByCandidato.get(c.id)
                  const candidateBusy = candidateActionId === c.id
                  const linkedSolicitudIds = new Set(linksByCandidate.get(c.id) || [])
                  if (c.solicitud_id) linkedSolicitudIds.add(c.solicitud_id)
                  return (
                    <div key={c.id} className="glass p-3" style={{ borderLeft: c.resultado === 'no_apto' ? '2px solid #ef4444' : c.resultado === 'apto' ? '2px solid var(--phosphor)' : '2px solid transparent' }}>
                      <div className="flex justify-between gap-2">
                        <div>
                          <p className="font-title font-bold" style={{ color:'var(--text)', fontSize:'0.88rem' }}>{c.nombre_apellido}</p>
                          <p style={{ color:'var(--text-dim)', fontSize:'0.7rem' }}>{solicitud?.puesto || 'Sin solicitud'} · {solicitud?.sede_nombre || '—'}</p>
                        </div>
                        <UserCheck size={14} style={{ color:'var(--phosphor)', flexShrink:0 }} />
                      </div>
                      {(entrevista?.fecha_entrevista || c.estado === 'entrevista') && (
                        <button
                          type="button"
                          onClick={() => openInterview(c)}
                          className="mt-2 w-full flex items-center gap-2 rounded px-2 py-1.5 text-left"
                          style={{
                            color: entrevista?.fecha_entrevista ? 'var(--phosphor)' : 'var(--warn)',
                            background: entrevista?.fecha_entrevista ? 'rgba(57,255,20,0.06)' : 'rgba(245,158,11,0.08)',
                            border: `1px solid ${entrevista?.fecha_entrevista ? 'rgba(57,255,20,0.18)' : 'rgba(245,158,11,0.22)'}`,
                            fontSize:'0.66rem',
                          }}
                        >
                          <CalendarDays size={12} />
                          <span>
                            {entrevista?.fecha_entrevista
                              ? `Entrevista: ${formatDate(entrevista.fecha_entrevista)}${entrevista.hora_entrevista ? ` · ${formatTime(entrevista.hora_entrevista)} hs` : ''}`
                              : 'Entrevista sin fecha programada'}
                          </span>
                        </button>
                      )}
                      {c.evaluacion_breve && <p style={{ color:'var(--text-dim)', fontSize:'0.68rem', marginTop:8, lineHeight:1.45 }}>{c.evaluacion_breve}</p>}
                      <label className="block mt-3">
                        <span className="font-metric flex items-center gap-1.5 mb-1" style={{ color:'var(--text-dim)', fontSize:'0.6rem', letterSpacing:'0.06em' }}>
                          <Link2 size={10}/> BÚSQUEDA PRINCIPAL
                        </span>
                        <select
                          className="input-dark w-full"
                          value={c.solicitud_id || ''}
                          onChange={e => setPrimarySolicitud(c, e.target.value)}
                          disabled={!canManage || candidateBusy || solicitudesAbiertas.length === 0}
                          style={{ fontSize:'0.68rem', height:30 }}
                        >
                          {!c.solicitud_id && <option value="" disabled>Seleccionar búsqueda abierta</option>}
                          {solicitudCerrada && <option value={solicitud.id}>{solicitud.puesto} · {solicitud.sede_nombre} (cerrada)</option>}
                          {solicitudesAbiertas.map(s => (
                            <option key={s.id} value={s.id}>{s.puesto} · {s.sede_nombre || 'Sin sede'}</option>
                          ))}
                        </select>
                      </label>
                      <div className="mt-2 rounded" style={{ border:'1px solid rgba(255,255,255,0.08)', padding:'0.45rem 0.55rem' }}>
                        <p className="font-metric mb-1.5" style={{ color:'var(--text-dim)', fontSize:'0.6rem', letterSpacing:'0.06em' }}>
                          BÚSQUEDAS VINCULADAS ({linkedSolicitudIds.size})
                        </p>
                        <div className="space-y-1.5">
                          {solicitudesAbiertas.map(s => {
                            const isPrimary = s.id === c.solicitud_id
                            const isLinked = linkedSolicitudIds.has(s.id)
                            return (
                              <label key={s.id} className="flex items-start gap-2" style={{ cursor: canManageMultipleLinks && !isPrimary ? 'pointer' : 'default' }}>
                                <input
                                  type="checkbox"
                                  checked={isLinked}
                                  disabled={!canManageMultipleLinks || isPrimary || candidateBusy}
                                  onChange={e => toggleCandidateLink(c, s.id, e.target.checked)}
                                  style={{ marginTop:2, accentColor:'var(--phosphor)' }}
                                />
                                <span style={{ color: isLinked ? 'var(--text)' : 'var(--text-dim)', fontSize:'0.64rem', lineHeight:1.25 }}>
                                  {s.puesto} · {s.sede_nombre || 'Sin sede'}
                                  {isPrimary && <span style={{ color:'var(--phosphor)' }}> · principal</span>}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                        {!canManageMultipleLinks && (
                          <p style={{ color:'var(--text-dim)', fontSize:'0.6rem', marginTop:6 }}>
                            Solo administración puede modificar asociaciones múltiples.
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <select className="input-dark w-full" value={c.estado} onChange={e=>updateCandidate(c.id, { estado: e.target.value })} disabled={!canManage || candidateBusy} style={{ fontSize:'0.68rem', height:28 }}>
                          {CANDIDATO_ESTADOS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                        </select>
                        <button onClick={() => setActiveCandidato(c)} disabled={!canManage || candidateBusy} className="btn-ghost" style={{ fontSize:'0.68rem' }}>Editar</button>
                      </div>
                      {c.persona_id ? (
                        <div className="mt-2 rounded px-2 py-1.5" style={{ color:'var(--phosphor)', background:'rgba(57,255,20,0.06)', border:'1px solid rgba(57,255,20,0.18)', fontSize:'0.66rem' }}>
                          Ya incorporado al Equipo
                        </div>
                      ) : c.estado === 'apto_ingreso' && canManage ? (
                        <button
                          onClick={() => incorporarCandidato(c)}
                          disabled={candidateBusy}
                          className="btn-primary flex items-center justify-center gap-1.5 mt-2 w-full"
                          style={{ fontSize:'0.68rem' }}
                        >
                          {candidateBusy ? <Loader2 size={11} className="animate-spin"/> : <UserPlus size={11}/>}
                          Dar de alta en Equipo
                        </button>
                      ) : null}
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => openInterview(c)} className="btn-ghost flex items-center gap-1.5" style={{ fontSize:'0.66rem' }}><FileText size={11}/> Entrevista/PDF</button>
                        {canManage && (
                          <button
                            onClick={() => deleteCandidate(c)}
                            disabled={candidateBusy}
                            className="btn-ghost flex items-center gap-1.5 ml-auto"
                            style={{ fontSize:'0.66rem', color:'#ef4444', borderColor:'rgba(239,68,68,0.35)' }}
                            title="Eliminar postulante"
                          >
                            {candidateBusy ? <Loader2 size={11} className="animate-spin"/> : <Trash2 size={11}/>}
                            Eliminar
                          </button>
                        )}
                      </div>
                      <AdjuntosPanel entityType="reclutamiento_candidato_cv" entityId={c.id} compact />
                    </div>
                  )
                })}
                {items.length === 0 && <p style={{ color:'var(--text-dim)', fontSize:'0.72rem', textAlign:'center', padding:'1rem 0' }}>Sin candidatos</p>}
              </div>
            </div>
            )
          })
        })()}
      </div>
    </div>
  )
}
