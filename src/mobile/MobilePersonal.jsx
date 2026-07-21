import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getSedes } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { isQualityOnlyProfile, isQualityTeamPerson, isSafetyOnlyProfile } from '../lib/access'
import { fmtFechaLarga } from '../lib/dateUtils'
import PersonaFormularios from '../components/PersonaFormularios'
import AdjuntosPanel from '../components/AdjuntosPanel'
import { Users, Search, Plus, X, ChevronRight, ChevronLeft, Phone, Mail, Star } from 'lucide-react'
import { toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'
import { useBackHandler } from '../lib/backStack'
import { downloadEvaluacionPersonalPdf, evaluacionPersonalFile, textoEvaluacionPersonal } from '../lib/evaluacionPersonalPdf'
import { Download, Share2, Copy } from 'lucide-react'

function SedePill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, padding: '0.22rem 0.6rem', borderRadius: 20, fontSize: '0.62rem',
      fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
      background: active ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.05)',
      border: active ? '1px solid rgba(57,255,20,0.4)' : '1px solid rgba(255,255,255,0.08)',
      color: active ? 'var(--phosphor)' : 'var(--text-dim)',
    }}>{label}</button>
  )
}

const RESULTADO_COLOR = { Bajo: '#FF2A2A', Aceptable: '#F59E0B', Alto: '#3B82F6', Excelente: '#39FF14' }
const TIPO_COLOR = {
  apercibimiento: '#F59E0B', suspension: '#FF2A2A', llamado_atencion: '#F97316',
  reconocimiento: '#3B82F6', logro: '#39FF14', otro: 'rgba(57,255,20,0.5)',
}
const TIPOS_HISTORIAL = [
  ['apercibimiento', 'Apercibimiento'], ['suspension', 'Suspensión'], ['llamado_atencion', 'Llamado de atención'],
  ['reconocimiento', 'Reconocimiento'], ['logro', 'Logro'], ['otro', 'Otro'],
]

function getResultado(score) {
  if (!score) return null
  if (score < 2) return 'Bajo'
  if (score < 3) return 'Aceptable'
  if (score < 4.5) return 'Alto'
  return 'Excelente'
}

function Card({ children, style }) {
  return <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '1rem', marginBottom: '0.75rem', ...style }}>{children}</div>
}

function ScoreSelect({ value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="input-dark w-full" style={{ fontSize: '0.75rem', padding: '0.4rem 0.5rem' }}>
      <option value="">— Sin calificar —</option>
      <option value="1">1 — Muy bajo</option>
      <option value="2">2 — Bajo</option>
      <option value="3">3 — Aceptable</option>
      <option value="4">4 — Alto</option>
      <option value="5">5 — Excelente</option>
    </select>
  )
}

const EVAL_FIELDS = [
  { bloque: 'Desempeño en el puesto', items: [['d1_cumple_actividades', 'Cumple actividades'], ['d2_sin_supervision', 'Sin supervisión'], ['d3_comprende_prioridades', 'Comprende prioridades']] },
  { bloque: 'Trabajo en equipo y clima', items: [['e1_cooperacion', 'Cooperación'], ['e2_comunicacion', 'Comunicación'], ['e3_maneja_desacuerdos', 'Maneja desacuerdos'], ['e4_ambiente_confianza', 'Ambiente de confianza'], ['e5_evita_conflictos', 'Evita conflictos']] },
  { bloque: 'Presentación y puntualidad', items: [['p1_cumple_horario', 'Cumple horario'], ['p2_aseo_personal', 'Aseo personal'], ['p3_uniforme', 'Uniforme']] },
]
const EVAL_INICIAL = {
  evaluador_nombre: '', evaluador_cargo: '', periodo: '', antiguedad_con_evaluado: '',
  d1_cumple_actividades: '', d2_sin_supervision: '', d3_comprende_prioridades: '',
  e1_cooperacion: '', e2_comunicacion: '', e3_maneja_desacuerdos: '', e4_ambiente_confianza: '', e5_evita_conflictos: '',
  p1_cumple_horario: '', p2_aseo_personal: '', p3_uniforme: '',
  supero_prueba: false, observaciones_rrhh: '', sugerencias_evaluador: '',
}

function calcPuntaje(f) {
  const fields = EVAL_FIELDS.flatMap(b => b.items.map(([k]) => k))
  const vals = fields.map(k => Number(f[k])).filter(v => v >= 1 && v <= 5)
  if (!vals.length) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

function QuickEvalModal({ persona, onClose, onSaved }) {
  const { perfil, user } = useAuth()
  const personaId = persona?.id
  const fecha = new Date()
  const periodoActual = `Q${Math.floor(fecha.getMonth() / 3) + 1} ${fecha.getFullYear()}`
  const [form, setForm] = useState({ ...EVAL_INICIAL, evaluador_nombre: perfil?.nombre || '', periodo: periodoActual })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const puntaje = calcPuntaje(form)
  const resultado = getResultado(puntaje)

  useEffect(() => {
    if (!user?.id) return
    supabase.from('v_personas').select('nombre,apellido,puesto').eq('perfil_id', user.id).limit(1).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setForm(f => ({
          ...f,
          evaluador_nombre: [data.nombre, data.apellido].filter(Boolean).join(' ') || f.evaluador_nombre,
          evaluador_cargo: data.puesto || f.evaluador_cargo,
        }))
      })
  }, [user?.id])

  const submit = async () => {
    setSaving(true)
    const toNum = v => (v === '' || v === null ? null : Number(v))
    const { error } = await supabase.schema('equipo').from('evaluaciones').insert({
      persona_id: personaId,
      evaluador_nombre: form.evaluador_nombre || null,
      evaluador_cargo: form.evaluador_cargo || null,
      antiguedad_con_evaluado: form.antiguedad_con_evaluado || null,
      periodo: form.periodo || null,
      ...Object.fromEntries(EVAL_FIELDS.flatMap(b => b.items.map(([k]) => [k, toNum(form[k])]))),
      puntaje_calculado: puntaje,
      resultado_global: resultado,
      supero_prueba: form.supero_prueba,
      observaciones_rrhh: form.observaciones_rrhh || null,
      sugerencias_evaluador: form.sugerencias_evaluador || null,
    })
    setSaving(false)
    if (error) { toast.error('Error: ' + mensajeError(error)); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--surface)', width: '100%', borderRadius: '14px 14px 0 0', padding: '1.25rem', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem' }}>Nueva evaluación</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)' }}><X size={18} /></button>
        </div>
        <Card style={{ background: 'rgba(57,255,20,0.04)', border: '1px solid rgba(57,255,20,0.12)' }}>
          <p style={{ fontSize: '0.58rem', color: 'var(--phosphor)', textTransform: 'uppercase', marginBottom: 7 }}>Personal evaluado</p>
          {[
            ['Nombre', [persona?.nombre, persona?.apellido].filter(Boolean).join(' ')],
            ['DNI', persona?.dni], ['Legajo', persona?.legajo], ['Puesto', persona?.puesto],
            ['Sede', persona?.sede_nombre],
            ['Ingreso', persona?.fecha_ingreso ? fmtFechaLarga(persona.fecha_ingreso) : null],
          ].filter(([, value]) => value).map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)' }}>{label}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text)', textAlign: 'right' }}>{value}</span>
            </div>
          ))}
        </Card>
        <p style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: 10 }}>Escala: 1 = muy bajo, 3 = aceptable, 5 = excelente. Dejá sin calificar si no aplica.</p>

        {[['evaluador_nombre', 'Evaluador', 'Ej: María González'], ['evaluador_cargo', 'Cargo evaluador', 'Ej: Jefe de Cocina'], ['periodo', 'Período', 'Ej: Q2 2026']].map(([k, l, ph]) => (
          <div key={k} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>{l}</label>
            <input className="input-dark w-full" value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} />
          </div>
        ))}

        {EVAL_FIELDS.map(b => (
          <div key={b.bloque} style={{ marginBottom: 12 }}>
            <p style={{ fontSize: '0.68rem', color: 'var(--phosphor)', fontWeight: 700, marginBottom: 6 }}>{b.bloque.toUpperCase()}</p>
            {b.items.map(([k, l]) => (
              <div key={k} style={{ marginBottom: 8 }}>
                <label style={{ fontSize: '0.62rem', color: 'var(--text-dim)', marginBottom: 3, display: 'block' }}>{l}</label>
                <ScoreSelect value={form[k]} onChange={v => set(k, v)} />
              </div>
            ))}
          </div>
        ))}

        {puntaje && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(57,255,20,0.07)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: 8, padding: '0.6rem 0.8rem', marginBottom: 12 }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: RESULTADO_COLOR[resultado] }}>{puntaje.toFixed(1)}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text)' }}>Resultado: <strong style={{ color: RESULTADO_COLOR[resultado] }}>{resultado}</strong></span>
          </div>
        )}

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Observaciones RRHH</label>
          <textarea className="input-dark w-full" rows={2} value={form.observaciones_rrhh} onChange={e => set('observaciones_rrhh', e.target.value)} placeholder="Ej: Buen desempeño general" />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Sugerencias</label>
          <textarea className="input-dark w-full" rows={2} value={form.sugerencias_evaluador} onChange={e => set('sugerencias_evaluador', e.target.value)} placeholder="Ej: Reforzar manejo de tiempos" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <input type="checkbox" checked={form.supero_prueba} onChange={e => set('supero_prueba', e.target.checked)} />
          <span style={{ fontSize: '0.78rem', color: 'var(--text)' }}>Superó período de prueba</span>
        </label>

        <button onClick={submit} disabled={saving} className="btn-primary w-full" style={{ padding: '0.75rem' }}>
          {saving ? 'Guardando...' : 'Guardar evaluación'}
        </button>
      </div>
    </div>
  )
}

function QuickHistorialModal({ personaId, onClose, onSaved }) {
  const { rol } = useAuth()
  const tiposDisponibles = rol === 'admin' ? TIPOS_HISTORIAL : TIPOS_HISTORIAL.filter(([tipo]) => !['apercibimiento', 'suspension', 'llamado_atencion'].includes(tipo))
  const [form, setForm] = useState({ tipo: rol === 'admin' ? 'apercibimiento' : 'reconocimiento', fecha: new Date().toISOString().slice(0, 10), descripcion: '', dias_suspension: '', registrado_por: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.descripcion.trim()) { toast.warn('La descripción es obligatoria.'); return }
    if (['apercibimiento', 'suspension', 'llamado_atencion'].includes(form.tipo) && rol !== 'admin') {
      toast.warn('Las sanciones deben enviarse desde Formularios para aprobación de un administrador.')
      return
    }
    setSaving(true)
    const { error } = await supabase.schema('equipo').from('historial_personal').insert({
      persona_id: personaId,
      tipo: form.tipo,
      fecha: form.fecha,
      descripcion: form.descripcion,
      dias_suspension: form.tipo === 'suspension' && form.dias_suspension ? Number(form.dias_suspension) : null,
      registrado_por: form.registrado_por || null,
    })
    setSaving(false)
    if (error) { toast.error('Error: ' + mensajeError(error)); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--surface)', width: '100%', borderRadius: '14px 14px 0 0', padding: '1.25rem', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem' }}>Nuevo registro</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)' }}><X size={18} /></button>
        </div>
        <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Tipo *</label>
        <select className="input-dark w-full" value={form.tipo} onChange={e => set('tipo', e.target.value)} style={{ marginBottom: 12 }}>
          {tiposDisponibles.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Fecha *</label>
        <input type="date" className="input-dark w-full" value={form.fecha} onChange={e => set('fecha', e.target.value)} style={{ marginBottom: 12 }} />
        {form.tipo === 'suspension' && (
          <>
            <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Días de suspensión</label>
            <input type="number" className="input-dark w-full" value={form.dias_suspension} onChange={e => set('dias_suspension', e.target.value)} placeholder="Ej: 3" style={{ marginBottom: 12 }} />
          </>
        )}
        <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Descripción *</label>
        <textarea className="input-dark w-full" rows={3} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Ej: Llegó 40 minutos tarde sin avisar" style={{ marginBottom: 12 }} />
        <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Registrado por</label>
        <input className="input-dark w-full" value={form.registrado_por} onChange={e => set('registrado_por', e.target.value)} placeholder="Ej: Carlos Ruiz" style={{ marginBottom: 16 }} />
        <button onClick={submit} disabled={saving} className="btn-primary w-full" style={{ padding: '0.75rem' }}>
          {saving ? 'Guardando...' : 'Guardar registro'}
        </button>
      </div>
    </div>
  )
}

function QuickPersonaModal({ sedes = [], requireSede = false, onClose, onSaved }) {
  const [form, setForm] = useState({ nombre: '', apellido: '', legajo: '', dni: '', puesto: '', area: '', telefono: '', email: '', fecha_ingreso: '', sede_ids: sedes.length===1?[sedes[0].id]:[] })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.nombre.trim()) { toast.warn('El nombre es obligatorio.'); return }
    if (requireSede && !form.sede_ids.length) { toast.warn('Seleccioná la sede de la persona.'); return }
    setSaving(true)
    const { error } = await supabase.schema('equipo').from('personas').insert({
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim() || null,
      legajo: form.legajo.trim() || null,
      dni: form.dni.trim() || null,
      puesto: form.puesto.trim() || null,
      area: form.area.trim() || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      fecha_ingreso: form.fecha_ingreso || null,
      sede_ids: form.sede_ids.length ? form.sede_ids : null,
    })
    setSaving(false)
    if (error) { toast.error('Error: ' + mensajeError(error)); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--surface)', width: '100%', borderRadius: '14px 14px 0 0', padding: '1.25rem', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem' }}>Nueva persona</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)' }}><X size={18} /></button>
        </div>
        {[['nombre', 'Nombre *', 'Ej: Juan'], ['apellido', 'Apellido', 'Ej: Pérez'], ['legajo', 'N.º de legajo', 'Ej: FK-00125'], ['dni', 'DNI', 'Ej: 34567890'], ['puesto', 'Puesto', 'Ej: Cocinero'], ['area', 'Área', 'Ej: Cocina'], ['telefono', 'Teléfono', 'Ej: 1145678900'], ['email', 'Email', 'Ej: juan.perez@email.com']].map(([k, l, ph]) => (
          <div key={k} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>{l}</label>
            <input className="input-dark w-full" value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} />
          </div>
        ))}
        <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Fecha de ingreso</label>
        <input type="date" className="input-dark w-full" value={form.fecha_ingreso} onChange={e => set('fecha_ingreso', e.target.value)} style={{ marginBottom: 16 }} />
        <label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Sede {requireSede?'*':''}</label>
        <select className="input-dark w-full" value={form.sede_ids[0]||''} onChange={e=>set('sede_ids',e.target.value?[Number(e.target.value)]:[])} style={{marginBottom:16}}>
          {!requireSede&&<option value="">Sin sede asignada</option>}
          {sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <button onClick={submit} disabled={saving} className="btn-primary w-full" style={{ padding: '0.75rem' }}>
          {saving ? 'Guardando...' : 'Guardar persona'}
        </button>
      </div>
    </div>
  )
}

function PersonaFicha({ personaId, canManage, onBack }) {
  const [persona, setPersona] = useState(null)
  const [evaluaciones, setEvaluaciones] = useState([])
  const [historial, setHistorial] = useState([])
  const [logros, setLogros] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')
  const [showEval, setShowEval] = useState(false)
  const [showHist, setShowHist] = useState(false)

  const copyEvaluacion = async (ev) => {
    try {
      await navigator.clipboard.writeText(textoEvaluacionPersonal(persona, ev))
      toast.ok('Resumen de la evaluación copiado.')
    } catch { toast.error('No se pudo copiar la evaluación.') }
  }

  const shareEvaluacion = async (ev) => {
    const text = textoEvaluacionPersonal(persona, ev)
    try {
      const file = evaluacionPersonalFile(persona, ev)
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: `Evaluación de desempeño - ${persona.nombre}`, text, files: [file] })
      } else if (navigator.share) {
        await navigator.share({ title: `Evaluación de desempeño - ${persona.nombre}`, text })
      } else {
        await navigator.clipboard.writeText(text)
        toast.ok('Resumen copiado para compartir.')
      }
    } catch (error) {
      if (error?.name !== 'AbortError') toast.error('No se pudo compartir la evaluación.')
    }
  }

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      supabase.from('v_personas').select('*').eq('id', personaId).single(),
      supabase.from('v_evaluaciones').select('*').eq('persona_id', personaId).order('fecha_evaluacion', { ascending: false }),
      supabase.from('v_historial_personal').select('*').eq('persona_id', personaId).order('fecha', { ascending: false }),
      supabase.from('v_logros_obtenidos').select('*').eq('persona_id', personaId).order('fecha', { ascending: false }),
    ]).then(([p, ev, hi, lo]) => {
      setPersona(p.data)
      setEvaluaciones(ev.data || [])
      setHistorial(hi.data || [])
      setLogros(lo.data || [])
    }).finally(() => setLoading(false))
  }, [personaId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--phosphor)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
    </div>
  }
  if (!persona) return <p style={{ color: 'var(--text-dim)', padding: '1.5rem' }}>Persona no encontrada.</p>

  const phoneDigits = persona.telefono?.replace(/\D/g, '').replace(/^0+/, '') || ''
  const whatsappNumber = phoneDigits.startsWith('549') ? phoneDigits
    : phoneDigits.startsWith('54') ? `549${phoneDigits.slice(2).replace(/^9/, '')}`
    : phoneDigits ? `549${phoneDigits.replace(/^9/, '')}` : ''
  const waLink = whatsappNumber ? `https://wa.me/${whatsappNumber}` : null
  const mailLink = persona.email ? `mailto:${persona.email.trim()}` : null
  const puntaje = persona.puntaje_promedio || 0
  const resultadoLabel = puntaje > 0 ? getResultado(puntaje) : null

  return (
    <div className="mobile-scroll" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '0.75rem 1rem 0', flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--phosphor)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 10 }}>
          <ChevronLeft size={15} /> Equipo
        </button>
        <h1 style={{ color: 'var(--text)', fontSize: '1.15rem', fontWeight: 700 }}>{persona.nombre} {persona.apellido || ''}</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: 2 }}>{persona.puesto || '—'}{persona.area ? ` · ${persona.area}` : ''}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {waLink && <a href={waLink} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--phosphor)', color: '#000', padding: '0.35rem 0.7rem', borderRadius: 6, fontSize: '0.65rem', fontWeight: 700, textDecoration: 'none' }}><Phone size={11} /> WhatsApp</a>}
          {mailLink && <a href={mailLink} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--text)', padding: '0.35rem 0.7rem', borderRadius: 6, fontSize: '0.65rem', fontWeight: 700, textDecoration: 'none' }}><Mail size={11} /> Email</a>}
        </div>
      </div>

      <div style={{ display: 'flex', padding: '0.75rem 1rem 0', gap: 8, flexShrink: 0 }}>
        {[
          { label: 'Puntaje', value: puntaje > 0 ? puntaje.toFixed(1) : '—', color: puntaje > 0 ? RESULTADO_COLOR[resultadoLabel] : 'var(--text-dim)' },
          { label: 'Logros', value: persona.logros_count || 0 },
          { label: 'Incidentes', value: persona.incidentes || 0, color: persona.incidentes > 0 ? '#F59E0B' : undefined },
        ].map(k => (
          <div key={k.label} style={{ flex: 1, background: 'var(--surface)', borderRadius: 8, padding: '0.5rem', textAlign: 'center' }}>
            <p style={{ fontWeight: 800, fontSize: '1rem', color: k.color || 'var(--phosphor)' }}>{k.value}</p>
            <p style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{k.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.3rem', padding: '0.75rem 1rem 0', flexShrink: 0, overflowX: 'auto' }}>
        {[
          ['info', 'Info'],
          ['evaluaciones', 'Evaluaciones'],
          ['historial', 'Historial'],
          ['logros', 'Logros'],
          ...(canManage ? [['formularios', 'Formularios']] : []),
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '0.35rem 0.7rem', borderRadius: 14, fontSize: '0.68rem', fontWeight: 700, border: 'none', whiteSpace: 'nowrap',
            background: tab === id ? 'rgba(57,255,20,0.15)' : 'var(--surface)', color: tab === id ? 'var(--phosphor)' : 'var(--text-dim)',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem 1rem', minHeight: 0 }}>
        {tab === 'info' && (
          <Card>
            {[['N.º de legajo', persona.legajo], ['DNI', persona.dni], ['Teléfono', persona.telefono], ['Email', persona.email],
              ['Fecha de ingreso', persona.fecha_ingreso ? fmtFechaLarga(persona.fecha_ingreso) : null]]
              .filter(([, v]) => v).map(([l, v]) => (
                <div key={l} style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>{l}</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{v}</p>
                </div>
              ))}
            {persona.descripcion_puesto && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: '0.6rem', color: 'var(--phosphor)', textTransform: 'uppercase', marginBottom: 4 }}>Descripción del puesto</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.5 }}>{persona.descripcion_puesto}</p>
              </div>
            )}
            {persona.procesos?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: '0.6rem', color: 'var(--phosphor)', textTransform: 'uppercase', marginBottom: 4 }}>Procesos que ejecuta</p>
                {persona.procesos.map((p, i) => <p key={i} style={{ fontSize: '0.78rem', color: 'var(--text)', marginBottom: 3 }}>▸ {p}</p>)}
              </div>
            )}
          </Card>
        )}

        {tab === 'evaluaciones' && (
          <>
            {canManage && (
              <button onClick={() => setShowEval(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', padding: '0.5rem 0.8rem', marginBottom: 12 }}>
                <Plus size={12} /> Nueva evaluación
              </button>
            )}
            {evaluaciones.length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Sin evaluaciones aún.</p>}
            {evaluaciones.map(ev => (
              <Card key={ev.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{ev.periodo || 'Sin período'} · {fmtFechaLarga(ev.fecha_evaluacion)}</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text)' }}>{ev.evaluador_nombre || 'Evaluador no especificado'}</p>
                  </div>
                  {ev.puntaje_calculado && (
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: 800, fontSize: '1.2rem', color: RESULTADO_COLOR[ev.resultado_global] }}>{ev.puntaje_calculado}</p>
                      <p style={{ fontSize: '0.6rem', color: RESULTADO_COLOR[ev.resultado_global] }}>{ev.resultado_global}</p>
                    </div>
                  )}
                </div>
                {ev.observaciones_rrhh && <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>📝 {ev.observaciones_rrhh}</p>}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  <button onClick={() => downloadEvaluacionPersonalPdf(persona, ev)} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.65rem' }}><Download size={12} /> PDF</button>
                  <button onClick={() => shareEvaluacion(ev)} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.65rem' }}><Share2 size={12} /> Compartir</button>
                  <button onClick={() => copyEvaluacion(ev)} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.65rem' }}><Copy size={12} /> Copiar</button>
                </div>
              </Card>
            ))}
          </>
        )}

        {tab === 'historial' && (
          <>
            {canManage && (
              <button onClick={() => setShowHist(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', padding: '0.5rem 0.8rem', marginBottom: 12 }}>
                <Plus size={12} /> Agregar registro
              </button>
            )}
            {historial.length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Sin registros.</p>}
            {historial.map(h => (
              <Card key={h.id} style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: TIPO_COLOR[h.tipo] || 'var(--phosphor)', marginTop: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: '0.6rem', color: TIPO_COLOR[h.tipo], textTransform: 'uppercase', fontWeight: 700 }}>{h.tipo.replace('_', ' ')}</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>{fmtFechaLarga(h.fecha)}</span>
                    {h.dias_suspension && <span style={{ fontSize: '0.6rem', color: '#FF2A2A' }}>({h.dias_suspension} días)</span>}
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text)' }}>{h.descripcion}</p>
                  {h.registrado_por && <p style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: 2 }}>Por: {h.registrado_por}</p>}
                  <AdjuntosPanel
                    entityType="historial_personal"
                    entityId={h.id}
                    compact
                    readOnly={!canManage}
                    label={h.tipo === 'apercibimiento' ? 'Apercibimiento firmado' : 'Adjuntos'}
                  />
                </div>
              </Card>
            ))}
          </>
        )}

        {tab === 'logros' && (
          <>
            {logros.length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Aún sin logros.</p>}
            {logros.map(l => (
              <Card key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.3rem' }}>{l.icono || '🏆'}</span>
                <div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text)' }}>{l.nombre}</p>
                  <p style={{ fontSize: '0.6rem', color: 'var(--phosphor)' }}>+{l.puntos} pts · {fmtFechaLarga(l.fecha)}</p>
                </div>
              </Card>
            ))}
          </>
        )}

        {tab === 'formularios' && canManage && (
          <PersonaFormularios
            persona={persona}
            compact
            onRegistered={() => {
              load()
              setTab('historial')
            }}
          />
        )}
      </div>

      {showEval && <QuickEvalModal persona={persona} onClose={() => setShowEval(false)} onSaved={() => { setShowEval(false); load() }} />}
      {showHist && <QuickHistorialModal personaId={personaId} onClose={() => setShowHist(false)} onSaved={() => { setShowHist(false); load() }} />}
    </div>
  )
}

export default function MobilePersonal() {
  const { can, perfil, allowedSedeIds } = useAuth()
  const isQualityOnly = isQualityOnlyProfile(perfil)
  const isSafetyOnly = isSafetyOnlyProfile(perfil)
  const canManage = can('equipo', 'manage') && !isQualityOnly && !isSafetyOnly
  const [personas, setPersonas] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [view, setView] = useState('lista') // 'lista' | 'ranking'
  const [selectedId, setSelectedId] = useState(null)
  useBackHandler(() => setSelectedId(null), !!selectedId)
  const [showNew, setShowNew] = useState(false)
  const [sedes, setSedes] = useState([])
  const [selectedSede, setSelectedSede] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    supabase.from('v_personas').select('*').order('nombre')
      .then(r => {
        const data = r.data || []
        setPersonas(isQualityOnly ? data.filter(p => isQualityTeamPerson(p, perfil)) : data)
      })
      .finally(() => setLoading(false))
  }, [isQualityOnly, perfil])

  useEffect(() => { load() }, [load])
  useEffect(() => { getSedes(allowedSedeIds || undefined).then(setSedes).catch(() => {}) }, [allowedSedeIds])

  if (selectedId) {
    return <PersonaFicha personaId={selectedId} canManage={canManage} onBack={() => { setSelectedId(null); load() }} />
  }

  const filtered = personas.filter(p => {
    if (selectedSede && p.sede_id !== selectedSede.id) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (p.nombre + ' ' + (p.apellido || '') + ' ' + (p.legajo || '') + ' ' + (p.puesto || '') + ' ' + (p.area || '')).toLowerCase().includes(q)
  })
  const ranking = [...personas].sort((a, b) => (b.puntos_total || 0) - (a.puntos_total || 0))

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
      <div style={{ padding: '1.25rem 1rem 0.75rem', flexShrink: 0 }}>
        <h1 style={{ color: 'var(--text)', fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.75rem' }}>{isQualityOnly ? 'Equipo Calidad' : isSafetyOnly ? 'Personal · Seguridad e Higiene' : 'Equipo'}</h1>
        <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--surface)', padding: '0.2rem', borderRadius: 20, marginBottom: '0.75rem' }}>
          <button onClick={() => setView('lista')} style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: 16, fontSize: '0.7rem', fontWeight: 700, border: 'none', background: view === 'lista' ? 'rgba(57,255,20,0.15)' : 'transparent', color: view === 'lista' ? 'var(--phosphor)' : 'var(--text-dim)' }}>
            <Users size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Lista
          </button>
          <button onClick={() => setView('ranking')} style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: 16, fontSize: '0.7rem', fontWeight: 700, border: 'none', background: view === 'ranking' ? 'rgba(57,255,20,0.15)' : 'transparent', color: view === 'ranking' ? 'var(--phosphor)' : 'var(--text-dim)' }}>
            <Star size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Ranking
          </button>
        </div>
        {view === 'lista' && (
          <>
            <div style={{ position: 'relative', marginBottom: sedes.length > 1 ? '0.5rem' : 0 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input className="input-dark w-full" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 30 }} />
            </div>
            {sedes.length > 1 && (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }} className="hide-scrollbar">
                <SedePill label="Todas" active={!selectedSede} onClick={() => setSelectedSede(null)} />
                {sedes.map(s => <SedePill key={s.id} label={s.nombre} active={selectedSede?.id === s.id} onClick={() => setSelectedSede(s)} />)}
              </div>
            )}
          </>
        )}
      </div>

      <div className="mobile-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 1rem 1rem', minHeight: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--phosphor)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : view === 'lista' ? (
          filtered.length === 0 ? <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>Sin resultados.</p> :
          filtered.map(p => {
            const puntaje = p.puntaje_promedio || 0
            const res = puntaje > 0 ? getResultado(puntaje) : null
            return (
              <button key={p.id} onClick={() => setSelectedId(p.id)} style={{ width: '100%', textAlign: 'left', background: 'var(--surface)', border: 'none', borderRadius: 10, padding: '0.85rem', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.85rem' }}>{p.nombre} {p.apellido || ''}</p>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem', marginTop: 2 }}>{p.puesto || '—'}</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    {p.puntos_total > 0 && <span style={{ fontSize: '0.62rem', color: 'var(--phosphor)' }}>⭐ {p.puntos_total}pts</span>}
                    {res && <span style={{ fontSize: '0.62rem', color: RESULTADO_COLOR[res] }}>{res}</span>}
                    {(p.incidentes || 0) > 0 && <span style={{ fontSize: '0.62rem', color: '#F59E0B' }}>⚠ {p.incidentes}</span>}
                  </div>
                </div>
                <ChevronRight size={15} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              </button>
            )
          })
        ) : (
          ranking.map((p, i) => {
            const puntaje = p.puntaje_promedio || 0
            const res = puntaje > 0 ? getResultado(puntaje) : null
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`
            return (
              <button key={p.id} onClick={() => setSelectedId(p.id)} style={{ width: '100%', textAlign: 'left', background: 'var(--surface)', border: 'none', borderRadius: 10, padding: '0.75rem', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: i < 3 ? '1.2rem' : '0.8rem', minWidth: 28, textAlign: 'center', color: 'var(--text-dim)' }}>{medal}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text)' }}>{p.nombre} {p.apellido || ''}</p>
                  <p style={{ fontSize: '0.62rem', color: 'var(--text-dim)' }}>{p.puesto || '—'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--phosphor)' }}>{p.puntos_total || 0}</p>
                  <p style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>puntos</p>
                </div>
              </button>
            )
          })
        )}
      </div>

      {canManage && (
        <button onClick={() => setShowNew(true)} style={{
          position: 'absolute', bottom: '1.5rem', right: '1.5rem', width: 50, height: 50, borderRadius: 25,
          background: 'var(--phosphor)', color: '#000', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(57,255,20,0.3)', zIndex: 10,
        }}>
          <Plus size={24} />
        </button>
      )}

      {showNew && <QuickPersonaModal sedes={sedes} requireSede={allowedSedeIds!==null} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load() }} />}
    </div>
  )
}
