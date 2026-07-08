import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import {
  apercibimientoFilename,
  createApercibimientoPdf,
} from '../lib/apercibimientoPdf'
import { toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'

function localToday() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export default function PersonaFormularios({ persona, compact = false, onRegistered }) {
  const { perfil } = useAuth()
  const [fecha, setFecha] = useState(localToday)
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  const generate = async () => {
    if (!motivo.trim()) {
      toast.warn('Ingresá el motivo del apercibimiento.')
      return
    }

    const form = { fecha, motivo: motivo.trim() }
    const pdf = createApercibimientoPdf(persona, form)

    setSaving(true)
    const { data, error } = await supabase
      .schema('equipo')
      .from('historial_personal')
      .insert({
        persona_id: persona.id,
        tipo: 'apercibimiento',
        fecha,
        descripcion: form.motivo,
        registrado_por: perfil?.nombre || perfil?.email || null,
      })
      .select('id')
      .single()
    setSaving(false)

    if (error) {
      toast.error(`No se pudo registrar el apercibimiento: ${mensajeError(error)}`)
      return
    }

    pdf.save(apercibimientoFilename(persona, fecha))
    setMotivo('')
    onRegistered?.(data)
  }

  const fieldStyle = compact ? { marginBottom: 10 } : {}
  const labelStyle = {
    display: 'block',
    marginBottom: 4,
    color: 'var(--text-dim)',
    fontSize: '0.62rem',
    textTransform: 'uppercase',
  }

  return (
    <div className={compact ? '' : 'glass p-5'} style={compact ? undefined : { maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <FileText size={18} style={{ color: 'var(--phosphor)' }} />
        <div>
          <p style={{ color: 'var(--text)', fontSize: '0.86rem', fontWeight: 700 }}>Formulario de apercibimiento</p>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem' }}>
            Completa los datos, descarga el PDF y lo registra en el historial.
          </p>
        </div>
      </div>

      <div
        className={compact ? '' : 'grid grid-cols-3 gap-3'}
        style={compact ? undefined : { marginBottom: 12 }}
      >
        <div style={fieldStyle}>
          <label style={labelStyle}>Empleado</label>
          <input
            className="input-dark w-full"
            value={`${persona.nombre} ${persona.apellido || ''}`.trim()}
            readOnly
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>N.º de legajo</label>
          <input className="input-dark w-full" value={persona.legajo || 'Sin cargar'} readOnly />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>DNI</label>
          <input className="input-dark w-full" value={persona.dni || 'Sin cargar'} readOnly />
        </div>
      </div>

      <div
        className={compact ? '' : 'grid grid-cols-3 gap-3'}
        style={compact ? undefined : { marginBottom: 12 }}
      >
        <div style={fieldStyle}>
          <label htmlFor={`apercibimiento-fecha-${persona.id}`} style={labelStyle}>Fecha *</label>
          <input
            id={`apercibimiento-fecha-${persona.id}`}
            type="date"
            className="input-dark w-full"
            value={fecha}
            onChange={event => setFecha(event.target.value)}
          />
        </div>
        <div className={compact ? '' : 'col-span-2'} style={fieldStyle}>
          <label htmlFor={`apercibimiento-motivo-${persona.id}`} style={labelStyle}>Motivo *</label>
          <textarea
            id={`apercibimiento-motivo-${persona.id}`}
            className="input-dark w-full"
            rows={compact ? 5 : 4}
            value={motivo}
            onChange={event => setMotivo(event.target.value)}
            placeholder="Describí el hecho que motiva el apercibimiento."
            style={{ resize: 'vertical' }}
          />
        </div>
      </div>

      {(!persona.legajo || !persona.dni) && (
        <p style={{ color: '#f59e0b', fontSize: '0.68rem', marginBottom: 12 }}>
          {!persona.legajo && !persona.dni
            ? 'Faltan el legajo y el DNI. Podés generar el PDF, pero esos campos quedarán vacíos.'
            : `Falta ${!persona.legajo ? 'el legajo' : 'el DNI'}. Ese campo quedará vacío en el PDF.`}
        </p>
      )}

      <button
        type="button"
        onClick={generate}
        disabled={saving || !fecha || !motivo.trim()}
        className="btn-primary"
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem' }}
      >
        <Download size={13} /> {saving ? 'Registrando...' : 'Generar PDF y registrar'}
      </button>
    </div>
  )
}
