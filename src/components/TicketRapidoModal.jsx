/**
 * TicketRapidoModal — crea un ticket de mantenimiento desde un registro de bitácora.
 * Se dispara cuando la categoría E (Equipos / Mantenimiento) tiene novedad.
 */
import { useState, useEffect } from 'react'
import { X, Wrench } from 'lucide-react'
import { createTicket, getResponsablesMnt, getSedes, TICKET_TIPOS_VALIDOS } from '../lib/queries'
import { toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'

const PRIORIDADES = ['baja','media','alta','critica']

export default function TicketRapidoModal({ origen, onClose, onCreated }) {
  // origen = { registro, descripcionInicial, sedeNombre, sedeId }
  const [responsables, setResponsables] = useState([])
  const [sedes, setSedes] = useState([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    descripcion: origen?.descripcionInicial || '',
    tipo: 'correctivo',
    prioridad: 'media',
    sede: origen?.sedeNombre || '',
    sede_id: origen?.sedeId || '',
    responsable_id: '',
    responsable: '',
  })

  useEffect(() => {
    getResponsablesMnt()
      .then(r => setResponsables(r))
      .catch(() => setResponsables([]))
    getSedes()
      .then(s => setSedes(s))
      .catch(() => setSedes([]))
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleResp = (id) => {
    const r = responsables.find(x => x.id === id)
    set('responsable_id', id)
    set('responsable', r?.nombre || '')
  }

  const handleSede = (id) => {
    const s = sedes.find(x => String(x.id) === String(id))
    set('sede_id', s ? s.id : null)
    set('sede', s ? s.nombre : '')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.descripcion.trim()) return
    setSaving(true)
    try {
      const ticket = await createTicket({
        tipo:          form.tipo,
        descripcion:   form.descripcion.trim(),
        prioridad:     form.prioridad,
        sede:          form.sede || null,
        sede_id:       form.sede_id || null,
        estado:        'abierto',
        responsable_id: form.responsable_id || null,
        responsable:    form.responsable || null,
        escalamiento_id: origen?.escalamientoId || null,
      })
      onCreated?.(ticket)
      onClose()
    } catch (err) {
      toast.error('Error al crear ticket: ' + mensajeError(err))
    } finally {
      setSaving(false)
    }
  }

  const S = {
    label: { color: 'var(--text-dim)', fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'monospace', display: 'block', marginBottom: 4 },
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass hud-corner fade-in w-full max-w-md rounded" style={{ borderRadius: 3 }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 1.5rem', borderBottom:'1px solid rgba(57,255,20,0.1)' }}>
          <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
            <Wrench size={14} style={{ color:'var(--phosphor)' }} />
            <div>
              <h2 className="font-title font-bold" style={{ color:'var(--text)', fontSize:'0.95rem' }}>
                Nuevo Ticket de Mantenimiento
              </h2>
              {origen?.sedeNombre && (
                <p style={{ color:'rgba(57,255,20,0.5)', fontSize:'0.6rem', fontFamily:'monospace' }}>
                  {origen.sedeNombre} · Categoría E
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding:'0.3rem' }}>
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding:'1.25rem 1.5rem', display:'flex', flexDirection:'column', gap:14 }}>
          {/* Descripción */}
          <div>
            <label style={S.label}>Descripción *</label>
            <textarea
              required
              rows={3}
              className="input-dark"
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              placeholder="Detalle del problema o falla..."
              style={{ resize:'vertical', fontSize:'0.8rem' }}
            />
          </div>

          {/* Tipo + Prioridad */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={S.label}>Tipo</label>
              <select className="input-dark" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                {TICKET_TIPOS_VALIDOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Prioridad</label>
              <select className="input-dark" value={form.prioridad} onChange={e => set('prioridad', e.target.value)}>
                {PRIORIDADES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Sede */}
          <div>
            <label style={S.label}>Sede</label>
            <select
              className="input-dark"
              value={form.sede_id || ''}
              onChange={e => handleSede(e.target.value)}
            >
              <option value="">— Sin sede —</option>
              {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

          {/* Responsable */}
          {responsables.length > 0 && (
            <div>
              <label style={S.label}>Responsable</label>
              <select className="input-dark" value={form.responsable_id} onChange={e => handleResp(e.target.value)}>
                <option value="">— Sin asignar —</option>
                {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
          )}

          {/* Registro / escalamiento origen */}
          {origen?.registro && (
            <div style={{ background:'rgba(57,255,20,0.04)', border:'1px solid rgba(57,255,20,0.12)', borderRadius:4, padding:'0.5rem 0.75rem', fontSize:'0.68rem', color:'var(--text-dim)' }}>
              Originado en registro de <span style={{ color:'var(--phosphor)' }}>{origen.sedeNombre}</span>
            </div>
          )}
          {origen?.escalamientoId && (
            <div style={{ background:'rgba(57,255,20,0.04)', border:'1px solid rgba(57,255,20,0.12)', borderRadius:4, padding:'0.5rem 0.75rem', fontSize:'0.68rem', color:'var(--text-dim)' }}>
              Este ticket queda vinculado al escalamiento de <span style={{ color:'var(--phosphor)' }}>{origen.sedeNombre}</span>. Al crearlo, el escalamiento pasa a "En gestión".
            </div>
          )}

          <div style={{ display:'flex', justifyContent:'flex-end', gap:8, paddingTop:4, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Wrench size={11} />
              {saving ? 'Creando...' : 'Crear ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
