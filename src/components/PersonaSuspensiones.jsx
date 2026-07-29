import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Camera, FileUp, ShieldAlert } from 'lucide-react'
import AdjuntosPanel from './AdjuntosPanel'
import { uploadAdjunto } from '../lib/adjuntos'
import {
  createPersonalSuspension,
  listPersonalSuspensions,
  suspensionPeriod,
} from '../lib/disciplinaryWorkflow'
import { toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'

function localToday() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function displayDate(value) {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

export default function PersonaSuspensiones({ persona, canManage, compact = false, registradoPor, onRegistered }) {
  const [fecha, setFecha] = useState(localToday)
  const [dias, setDias] = useState('1')
  const [motivo, setMotivo] = useState('')
  const [file, setFile] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const cameraRef = useRef(null)
  const period = useMemo(() => suspensionPeriod(fecha, dias), [fecha, dias])

  const load = useCallback(async () => {
    if (!persona?.id) return
    setLoading(true)
    const { data, error } = await listPersonalSuspensions(persona.id)
    setLoading(false)
    if (error) {
      toast.error(`No se pudieron cargar las suspensiones: ${mensajeError(error)}`)
      return
    }
    setItems(data || [])
  }, [persona?.id])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!period) return toast.warn('Indicá una fecha válida y al menos un día de suspensión.')
    if (motivo.trim().length < 10) return toast.warn('Describí el motivo con al menos 10 caracteres.')
    if (!file) return toast.warn('Adjuntá la notificación firmada.')

    setSaving(true)
    const descripcion = [
      `Suspensión disciplinaria de ${Number(dias)} día${Number(dias) === 1 ? '' : 's'},`,
      `desde el ${displayDate(period.start)} hasta el ${displayDate(period.end)} inclusive,`,
      `con reintegro el ${displayDate(period.returnDate)}.`,
      `Motivo: ${motivo.trim()}`,
    ].join(' ')

    const { data:history, error } = await createPersonalSuspension({
      persona_id: persona.id,
      fecha: period.start,
      descripcion,
      dias_suspension: Number(dias),
      registrado_por: registradoPor,
    })

    if (error) {
      setSaving(false)
      return toast.error(`No se pudo crear la suspensión: ${mensajeError(error)}`)
    }

    try {
      await uploadAdjunto('historial_personal', history.id, file, registradoPor || 'usuario')
    } catch (uploadError) {
      setSaving(false)
      await load()
      onRegistered?.(history)
      return toast.error(`La suspensión quedó en el historial, pero el archivo no pudo subirse: ${mensajeError(uploadError)}. Podés adjuntarlo en el registro creado.`)
    }

    setSaving(false)
    setMotivo('')
    setDias('1')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
    toast.success('Suspensión registrada en el historial con el documento firmado.')
    await load()
    onRegistered?.(history)
  }

  const labelStyle = { display:'block', marginBottom:4, color:'var(--text-dim)', fontSize:'0.62rem', textTransform:'uppercase' }

  return (
    <div style={{ marginBottom:18, padding:'12px 14px', border:'1px solid rgba(239,68,68,0.2)', borderRadius:6, background:'rgba(239,68,68,0.04)' }}>
      <div style={{ marginBottom:10 }}>
        <p style={{ color:'var(--text)', fontWeight:700, fontSize:'0.78rem' }}>Suspensiones firmadas</p>
        <p style={{ color:'var(--text-dim)', fontSize:'0.65rem', marginTop:2 }}>
          La carga crea automáticamente el antecedente en Historial y vincula allí la notificación firmada.
        </p>
      </div>

      {canManage && (
        <div style={{ marginBottom:14, paddingBottom:14, borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <div className={compact ? '' : 'grid grid-cols-2 gap-3'} style={{ marginBottom:10 }}>
            <div>
              <label style={labelStyle}>Primer día de suspensión *</label>
              <input type="date" className="input-dark w-full" value={fecha} onChange={event => setFecha(event.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Cantidad de días *</label>
              <input type="number" min="1" step="1" className="input-dark w-full" value={dias} onChange={event => setDias(event.target.value)} />
            </div>
          </div>

          {period && (
            <p style={{ color:'#fca5a5', fontSize:'0.66rem', marginBottom:10, display:'flex', alignItems:'center', gap:5 }}>
              <CalendarDays size={12} />
              Suspensión: {displayDate(period.start)} al {displayDate(period.end)} · Reintegro: {displayDate(period.returnDate)}
            </p>
          )}

          <div style={{ marginBottom:10 }}>
            <label style={labelStyle}>Motivo *</label>
            <textarea className="input-dark w-full" rows={3} value={motivo} onChange={event => setMotivo(event.target.value)} placeholder="Describí la conducta que motivó la suspensión." />
          </div>

          <div style={{ marginBottom:10 }}>
            <label style={labelStyle}>Notificación firmada *</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <label className="btn-ghost" style={{ display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:'0.68rem' }}>
                <FileUp size={12} /> {file ? file.name : 'Elegir archivo'}
                <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" style={{ display:'none' }} onChange={event => setFile(event.target.files?.[0] || null)} />
              </label>
              <label className="btn-ghost" style={{ display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:'0.68rem' }}>
                <Camera size={12} /> Tomar foto
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={event => setFile(event.target.files?.[0] || null)} />
              </label>
            </div>
          </div>

          <button type="button" className="btn-primary" disabled={saving || !period || motivo.trim().length < 10 || !file} onClick={submit} style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.68rem' }}>
            <ShieldAlert size={12} /> {saving ? 'Registrando...' : 'Registrar suspensión y adjunto'}
          </button>
        </div>
      )}

      {loading && <p style={{ color:'var(--text-dim)', fontSize:'0.68rem' }}>Cargando suspensiones…</p>}
      {!loading && items.length === 0 && <p style={{ color:'var(--text-dim)', fontSize:'0.68rem' }}>No hay suspensiones registradas.</p>}
      {items.map(item => {
        const itemPeriod = suspensionPeriod(item.fecha, item.dias_suspension)
        return (
          <div key={item.id} style={{ padding:'10px 0', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ color:'var(--text)', fontSize:'0.72rem', fontWeight:700 }}>
              {displayDate(item.fecha)} · {item.dias_suspension || 0} día{Number(item.dias_suspension) === 1 ? '' : 's'}
            </p>
            {itemPeriod && <p style={{ color:'var(--text-dim)', fontSize:'0.63rem', marginTop:2 }}>Hasta {displayDate(itemPeriod.end)} · Reintegro {displayDate(itemPeriod.returnDate)}</p>}
            <p style={{ color:'var(--text)', fontSize:'0.68rem', marginTop:6, whiteSpace:'pre-wrap' }}>{item.descripcion}</p>
            <div style={{ marginTop:8 }}>
              <AdjuntosPanel
                entityType="historial_personal"
                entityId={item.id}
                compact
                readOnly={!canManage}
                label="Notificación firmada"
                camera
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
