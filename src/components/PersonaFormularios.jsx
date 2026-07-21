import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Check, Download, FileText, ShieldAlert, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { DISCIPLINARY_NOTEBOOK_URL } from '../lib/access'
import { apercibimientoFilename, createApercibimientoPdf } from '../lib/apercibimientoPdf'
import {
  canCreateDisciplinaryRequest,
  canReviewDisciplinaryRequest,
  createDisciplinaryRequest,
  disciplinaryStatusMeta,
  listDisciplinaryRequests,
  notifyDisciplinaryRequest,
  reviewDisciplinaryRequest,
} from '../lib/disciplinaryWorkflow'
import { confirmar, toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'

function localToday() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function StatusChip({ estado }) {
  const meta = disciplinaryStatusMeta(estado)
  return (
    <span style={{ color:meta.color, border:`1px solid ${meta.color}55`, background:`${meta.color}12`, borderRadius:999, padding:'0.2rem 0.5rem', fontSize:'0.6rem', fontWeight:700 }}>
      {meta.label}
    </span>
  )
}

export default function PersonaFormularios({ persona, compact = false, onRegistered }) {
  const { user, rol } = useAuth()
  const [fecha, setFecha] = useState(localToday)
  const [hechos, setHechos] = useState('')
  const [descargo, setDescargo] = useState('')
  const [evidencia, setEvidencia] = useState('')
  const [fundamento, setFundamento] = useState('')
  const [textoPropuesto, setTextoPropuesto] = useState('')
  const [urgente, setUrgente] = useState(false)
  const [medidaPreventiva, setMedidaPreventiva] = useState('')
  const [requests, setRequests] = useState([])
  const [reviewNotes, setReviewNotes] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const canCreate = canCreateDisciplinaryRequest(rol)
  const canReview = canReviewDisciplinaryRequest(rol)

  const load = useCallback(async () => {
    if (!persona?.id || !canCreate) return
    setLoading(true)
    const { data, error } = await listDisciplinaryRequests(persona.id)
    setLoading(false)
    if (error) {
      toast.error(`No se pudieron cargar las solicitudes disciplinarias: ${mensajeError(error)}`)
      return
    }
    setRequests(data || [])
  }, [persona?.id, canCreate])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (hechos.trim().length < 10) return toast.warn('Describí los hechos con al menos 10 caracteres.')
    if (urgente && medidaPreventiva.trim().length < 10) return toast.warn('Detallá la medida preventiva inmediata adoptada.')
    setSaving(true)
    const { data:created, error } = await createDisciplinaryRequest({
      persona_id: persona.id,
      fecha_hecho: fecha,
      hechos: hechos.trim(),
      descargo_trabajador: descargo.trim() || null,
      testigos_evidencia: evidencia.trim() || null,
      fundamento_legal: fundamento.trim() || null,
      texto_propuesto: textoPropuesto.trim() || null,
      urgente,
      medida_preventiva: urgente ? medidaPreventiva.trim() : null,
    })
    if (error) { setSaving(false); return toast.error(`No se pudo registrar el apercibimiento: ${mensajeError(error)}`) }
    if (rol === 'admin') {
      const { error:approvalError } = await reviewDisciplinaryRequest(created.id, true, user.id, 'Aprobación automática por administrador creador.')
      if (approvalError) { setSaving(false); await load(); return toast.error(`El apercibimiento se guardó, pero no pudo aprobarse automáticamente: ${mensajeError(approvalError)}`) }
    }
    setSaving(false)
    setHechos(''); setDescargo(''); setEvidencia(''); setFundamento(''); setTextoPropuesto(''); setUrgente(false); setMedidaPreventiva('')
    toast.success(rol === 'admin' ? 'Apercibimiento creado y aprobado.' : (urgente ? 'Medida preventiva registrada y enviada a revisión.' : 'Apercibimiento enviado a aprobación.'))
    await load()
  }

  const review = async (request, approved) => {
    const action = approved ? 'aprobar' : 'rechazar'
    const ok = await confirmar({
      titulo: approved ? 'Aprobar apercibimiento' : 'Rechazar solicitud',
      mensaje: `¿Confirmás que querés ${action} esta solicitud?`,
      confirmText: approved ? 'Aprobar' : 'Rechazar',
      cancelText: 'Volver',
      danger: !approved,
    })
    if (!ok) return
    setSaving(true)
    const { error } = await reviewDisciplinaryRequest(request.id, approved, user.id, reviewNotes[request.id])
    setSaving(false)
    if (error) return toast.error(`No se pudo ${action}: ${mensajeError(error)}`)
    toast.success(approved ? 'Apercibimiento aprobado.' : 'Solicitud rechazada.')
    await load()
  }

  const download = request => {
    const pdf = createApercibimientoPdf(persona, { fecha:request.fecha_hecho, motivo:request.hechos })
    pdf.save(apercibimientoFilename(persona, request.fecha_hecho))
  }

  const markNotified = async request => {
    const ok = await confirmar({
      titulo: 'Confirmar notificación',
      mensaje: 'Confirmá únicamente después de entregar el apercibimiento al trabajador. Esta acción crea el antecedente formal en su historial.',
      confirmText: 'Fue notificado',
      cancelText: 'Todavía no',
    })
    if (!ok) return
    setSaving(true)
    const { data, error } = await notifyDisciplinaryRequest(request.id)
    setSaving(false)
    if (error) return toast.error(`No se pudo registrar la notificación: ${mensajeError(error)}`)
    toast.success('Apercibimiento notificado y registrado en el historial.')
    onRegistered?.({ id:data })
    await load()
  }

  if (!canCreate) {
    return <p style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>El control disciplinario está disponible únicamente para administradores y encargados.</p>
  }

  const labelStyle = { display:'block', marginBottom:4, color:'var(--text-dim)', fontSize:'0.62rem', textTransform:'uppercase' }
  const inputBlock = { marginBottom:compact ? 10 : 12 }

  return (
    <div className={compact ? '' : 'glass p-5'} style={compact ? undefined : { maxWidth:900 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <FileText size={18} style={{ color:'var(--phosphor)' }} />
        <div>
          <p style={{ color:'var(--text)', fontSize:'0.86rem', fontWeight:700 }}>Solicitud de apercibimiento</p>
          <p style={{ color:'var(--text-dim)', fontSize:'0.68rem' }}>{rol === 'admin' ? 'Como administrador, el apercibimiento queda aprobado al crearlo.' : 'El encargado documenta el hecho. Un administrador debe aprobarlo antes de la notificación.'}</p>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:16, padding:'12px 14px', border:'1px solid rgba(57,255,20,0.18)', borderRadius:6, background:'rgba(57,255,20,0.04)' }}>
        <div>
          <p style={{ color:'var(--text)', fontSize:'0.74rem', fontWeight:700 }}>Consulta del Reglamento Interno</p>
          <p style={{ color:'var(--text-dim)', fontSize:'0.65rem', marginTop:2 }}>Abrí el cuaderno para analizar el caso antes de proponer el apercibimiento.</p>
        </div>
        <a href={DISCIPLINARY_NOTEBOOK_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.68rem', whiteSpace:'nowrap' }}>
          <BookOpen size={13} /> Consultar cuaderno
        </a>
      </div>

      <div className={compact ? '' : 'grid grid-cols-3 gap-3'} style={inputBlock}>
        <div><label style={labelStyle}>Empleado</label><input className="input-dark w-full" value={`${persona.nombre} ${persona.apellido || ''}`.trim()} readOnly /></div>
        <div><label style={labelStyle}>Legajo</label><input className="input-dark w-full" value={persona.legajo || 'Sin cargar'} readOnly /></div>
        <div><label style={labelStyle}>Fecha del hecho *</label><input type="date" className="input-dark w-full" value={fecha} onChange={event => setFecha(event.target.value)} /></div>
      </div>

      <div style={inputBlock}><label style={labelStyle}>Descripción objetiva de los hechos *</label><textarea className="input-dark w-full" rows={4} value={hechos} onChange={event => setHechos(event.target.value)} placeholder="Qué ocurrió, cuándo, dónde y qué instrucción se incumplió." /></div>
      <div className={compact ? '' : 'grid grid-cols-2 gap-3'} style={inputBlock}>
        <div><label style={labelStyle}>Descargo del trabajador</label><textarea className="input-dark w-full" rows={3} value={descargo} onChange={event => setDescargo(event.target.value)} placeholder="Versión o explicación brindada por el trabajador." /></div>
        <div><label style={labelStyle}>Testigos y evidencia</label><textarea className="input-dark w-full" rows={3} value={evidencia} onChange={event => setEvidencia(event.target.value)} placeholder="Personas presentes, fotos, registros o documentos." /></div>
      </div>
      <div className={compact ? '' : 'grid grid-cols-2 gap-3'} style={inputBlock}>
        <div><label style={labelStyle}>Fundamento legal sugerido</label><textarea className="input-dark w-full" rows={3} value={fundamento} onChange={event => setFundamento(event.target.value)} placeholder="Podés pegar aquí el análisis de NotebookLM." /></div>
        <div><label style={labelStyle}>Texto propuesto</label><textarea className="input-dark w-full" rows={3} value={textoPropuesto} onChange={event => setTextoPropuesto(event.target.value)} placeholder="Borrador sugerido por NotebookLM (opcional)." /></div>
      </div>

      <label style={{ display:'flex', alignItems:'flex-start', gap:8, color:'var(--text)', fontSize:'0.72rem', marginBottom:urgente ? 10 : 16 }}>
        <input type="checkbox" checked={urgente} onChange={event => setUrgente(event.target.checked)} />
        <span><strong>Hubo una medida preventiva urgente</strong><br /><span style={{ color:'var(--text-dim)', fontSize:'0.65rem' }}>Registra la acción inmediata para controlar el riesgo; no constituye una sanción.</span></span>
      </label>
      {urgente && <div style={inputBlock}><label style={labelStyle}>Medida preventiva adoptada *</label><textarea className="input-dark w-full" rows={3} value={medidaPreventiva} onChange={event => setMedidaPreventiva(event.target.value)} placeholder="Ej.: se retiró al trabajador de la tarea y se le indicó colocarse el uniforme reglamentario." /></div>}

      <button type="button" onClick={submit} disabled={saving || !fecha || hechos.trim().length < 10} className="btn-primary" style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.72rem' }}>
        <ShieldAlert size={13} /> {saving ? 'Guardando...' : (rol === 'admin' ? 'Crear y aprobar' : 'Enviar a aprobación')}
      </button>

      <div style={{ marginTop:24, borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:16 }}>
        <p style={{ color:'var(--text)', fontWeight:700, fontSize:'0.78rem', marginBottom:10 }}>Solicitudes de esta persona</p>
        {loading && <p style={{ color:'var(--text-dim)', fontSize:'0.7rem' }}>Cargando…</p>}
        {!loading && requests.length === 0 && <p style={{ color:'var(--text-dim)', fontSize:'0.7rem' }}>No hay solicitudes disciplinarias.</p>}
        {requests.map(request => (
          <div key={request.id} style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, padding:12, marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center', marginBottom:8 }}>
              <span style={{ color:'var(--text)', fontSize:'0.7rem', fontWeight:700 }}>{request.fecha_hecho}</span>
              <StatusChip estado={request.estado} />
            </div>
            <p style={{ color:'var(--text)', fontSize:'0.72rem', whiteSpace:'pre-wrap' }}>{request.hechos}</p>
            {request.urgente && <p style={{ color:'#f59e0b', fontSize:'0.66rem', marginTop:8 }}><strong>Medida preventiva:</strong> {request.medida_preventiva}</p>}
            {request.revision_observaciones && <p style={{ color:'var(--text-dim)', fontSize:'0.65rem', marginTop:8 }}><strong>Revisión:</strong> {request.revision_observaciones}</p>}

            {canReview && request.estado === 'pendiente_aprobacion' && (
              <div style={{ marginTop:10 }}>
                <textarea className="input-dark w-full" rows={2} value={reviewNotes[request.id] || ''} onChange={event => setReviewNotes(notes => ({ ...notes, [request.id]:event.target.value }))} placeholder="Observaciones de revisión (opcional)." />
                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <button className="btn-primary" disabled={saving} onClick={() => review(request, true)} style={{ display:'flex', gap:5, alignItems:'center', fontSize:'0.68rem' }}><Check size={12} /> Aprobar</button>
                  <button className="btn-ghost" disabled={saving} onClick={() => review(request, false)} style={{ display:'flex', gap:5, alignItems:'center', fontSize:'0.68rem', color:'#ff5050' }}><X size={12} /> Rechazar</button>
                </div>
              </div>
            )}

            {canReview && request.estado === 'aprobado' && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:10 }}>
                <button className="btn-ghost" onClick={() => download(request)} style={{ display:'flex', gap:5, alignItems:'center', fontSize:'0.68rem' }}><Download size={12} /> Descargar PDF</button>
                <button className="btn-primary" disabled={saving} onClick={() => markNotified(request)} style={{ fontSize:'0.68rem' }}>Confirmar notificación</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
