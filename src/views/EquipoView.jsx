import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import {
  Users, Search, Plus, Trophy, Star, ChevronRight, Phone, Mail,
  X, Save, Building2, Award, AlertTriangle, Loader2, Pencil, ClipboardList, MessageCircle, Copy
} from 'lucide-react'
import OrganigramaView from './OrganigramaView'
import AdjuntosPanel from '../components/AdjuntosPanel'
import ContactosTab from '../components/ContactosTab'
import DocumentacionChecklist from '../components/DocumentacionChecklist'
import PersonaFormularios from '../components/PersonaFormularios'
import { PERSONA_DOCUMENTACION_TEMPLATE } from '../lib/documentacion'
import ReclutamientoBoard from './equipo/ReclutamientoBoard'
import { isQualityOnlyProfile, isQualityTeamPerson } from '../lib/access'
import { fmtFechaLarga } from '../lib/dateUtils'
import { confirmar, toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'

// ──────────────────────────────────────────────
// PersonaFicha — vista interna de ficha individual
// ──────────────────────────────────────────────
function PersonaFicha({ personaId, sedes = [], grupos = [], onBack }) {
  const { can } = useAuth()
  const canManage = can('equipo', 'manage')
  const [persona, setPersona] = useState(null)
  const [evaluaciones, setEvaluaciones] = useState([])
  const [historial, setHistorial] = useState([])
  const [logros, setLogros] = useState([])
  const [logrosConfig, setLogrosConfig] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')
  const [showEvalForm, setShowEvalForm] = useState(false)
  const [showHistorialForm, setShowHistorialForm] = useState(false)
  const [showEditPersona, setShowEditPersona] = useState(false)
  const [saving, setSaving] = useState(false)

  const EVAL_INICIAL = {
    evaluador_nombre: '', evaluador_cargo: '', antiguedad_con_evaluado: '', periodo: '',
    d1_cumple_actividades: '', d2_sin_supervision: '', d3_comprende_prioridades: '',
    e1_cooperacion: '', e2_comunicacion: '', e3_maneja_desacuerdos: '', e4_ambiente_confianza: '', e5_evita_conflictos: '',
    p1_cumple_horario: '', p2_aseo_personal: '', p3_uniforme: '',
    supero_prueba: false, observaciones_rrhh: '', sugerencias_evaluador: ''
  }
  const [evalForm, setEvalForm] = useState(EVAL_INICIAL)
  const [histForm, setHistForm] = useState({ tipo: 'apercibimiento', fecha: new Date().toISOString().split('T')[0], descripcion: '', dias_suspension: '', registrado_por: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const [p, ev, hi, lo] = await Promise.all([
      supabase.from('v_personas').select('*').eq('id', personaId).single(),
      supabase.from('v_evaluaciones').select('*').eq('persona_id', personaId).order('fecha_evaluacion', { ascending: false }),
      supabase.from('v_historial_personal').select('*').eq('persona_id', personaId).order('fecha', { ascending: false }),
      supabase.from('v_logros_obtenidos').select('*').eq('persona_id', personaId).order('fecha', { ascending: false }),
    ])
    setPersona(p.data)
    setEvaluaciones(ev.data || [])
    setHistorial(hi.data || [])
    setLogros(lo.data || [])
    setLoading(false)
  }, [personaId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    supabase.from('v_logros_config').select('*').eq('activo', true).then(r => setLogrosConfig(r.data || []))
  }, [])

  const calcPuntaje = (f) => {
    const fields = ['d1_cumple_actividades','d2_sin_supervision','d3_comprende_prioridades',
      'e1_cooperacion','e2_comunicacion','e3_maneja_desacuerdos','e4_ambiente_confianza','e5_evita_conflictos',
      'p1_cumple_horario','p2_aseo_personal','p3_uniforme']
    const vals = fields.map(k => Number(f[k])).filter(v => v >= 1 && v <= 5)
    if (!vals.length) return null
    const avg = vals.reduce((a,b)=>a+b,0)/vals.length
    return Math.round(avg*10)/10
  }

  const getResultado = (score) => {
    if (!score) return null
    if (score < 2) return 'Bajo'
    if (score < 3) return 'Aceptable'
    if (score < 4.5) return 'Alto'
    return 'Excelente'
  }

  const RESULTADO_COLOR = { Bajo:'#ff4444', Aceptable:'#f59e0b', Alto:'#3b82f6', Excelente:'#39FF14' }

  const handleEditEval = (ev) => {
    const mapped = { ...EVAL_INICIAL, id: ev.id }
    for (const k in EVAL_INICIAL) {
      if (ev[k] !== undefined && ev[k] !== null) mapped[k] = ev[k]
    }
    setEvalForm(mapped)
    setShowEvalForm(true)
  }

  const handleEditHist = (h) => {
    setHistForm({
      id: h.id,
      tipo: h.tipo,
      fecha: h.fecha ? h.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
      descripcion: h.descripcion || '',
      dias_suspension: h.dias_suspension || '',
      registrado_por: h.registrado_por || ''
    })
    setShowHistorialForm(true)
  }

  const saveEval = async () => {
    setSaving(true)
    const puntaje = calcPuntaje(evalForm)
    const resultado = getResultado(puntaje)
    const toNum = v => v === '' || v === null ? null : Number(v)
    
    const payload = {
      persona_id: personaId,
      evaluador_nombre: evalForm.evaluador_nombre || null,
      evaluador_cargo: evalForm.evaluador_cargo || null,
      antiguedad_con_evaluado: evalForm.antiguedad_con_evaluado || null,
      periodo: evalForm.periodo || null,
      d1_cumple_actividades: toNum(evalForm.d1_cumple_actividades),
      d2_sin_supervision: toNum(evalForm.d2_sin_supervision),
      d3_comprende_prioridades: toNum(evalForm.d3_comprende_prioridades),
      e1_cooperacion: toNum(evalForm.e1_cooperacion),
      e2_comunicacion: toNum(evalForm.e2_comunicacion),
      e3_maneja_desacuerdos: toNum(evalForm.e3_maneja_desacuerdos),
      e4_ambiente_confianza: toNum(evalForm.e4_ambiente_confianza),
      e5_evita_conflictos: toNum(evalForm.e5_evita_conflictos),
      p1_cumple_horario: toNum(evalForm.p1_cumple_horario),
      p2_aseo_personal: toNum(evalForm.p2_aseo_personal),
      p3_uniforme: toNum(evalForm.p3_uniforme),
      puntaje_calculado: puntaje,
      resultado_global: resultado,
      supero_prueba: evalForm.supero_prueba,
      observaciones_rrhh: evalForm.observaciones_rrhh || null,
      sugerencias_evaluador: evalForm.sugerencias_evaluador || null,
    }

    let res
    if (evalForm.id) {
      res = await supabase.schema('equipo').from('evaluaciones').update(payload).eq('id', evalForm.id)
    } else {
      res = await supabase.schema('equipo').from('evaluaciones').insert(payload)
    }

    setSaving(false)
    if (res.error) { toast.error('Error: ' + mensajeError(res.error)); return }
    setShowEvalForm(false)
    setEvalForm(EVAL_INICIAL)
    load()
  }

  const saveHistorial = async () => {
    setSaving(true)
    const payload = {
      persona_id: personaId,
      tipo: histForm.tipo,
      fecha: histForm.fecha,
      descripcion: histForm.descripcion,
      dias_suspension: histForm.tipo === 'suspension' && histForm.dias_suspension ? Number(histForm.dias_suspension) : null,
      registrado_por: histForm.registrado_por || null,
    }

    let res
    if (histForm.id) {
      res = await supabase.schema('equipo').from('historial_personal').update(payload).eq('id', histForm.id)
    } else {
      res = await supabase.schema('equipo').from('historial_personal').insert(payload)
    }

    setSaving(false)
    if (res.error) { toast.error('Error: ' + mensajeError(res.error)); return }
    setShowHistorialForm(false)
    setHistForm({ tipo: 'apercibimiento', fecha: new Date().toISOString().split('T')[0], descripcion: '', dias_suspension: '', registrado_por: '' })
    load()
  }

  const TIPO_COLOR = {
    apercibimiento: '#f59e0b', suspension: '#ef4444', llamado_atencion: '#f97316',
    reconocimiento: '#3b82f6', logro: '#39FF14', otro: 'rgba(57,255,20,0.4)'
  }

  const ScoreSelect = ({ name, value, onChange }) => (
    <select value={value} onChange={e => onChange(name, e.target.value)}
      className="input-dark" style={{ width:'100%', fontSize:'0.7rem' }}>
      <option value="">— Sin calificar —</option>
      <option value="1">1 — Muy bajo</option>
      <option value="2">2 — Bajo</option>
      <option value="3">3 — Aceptable</option>
      <option value="4">4 — Alto</option>
      <option value="5">5 — Excelente</option>
    </select>
  )

  const setEv = (k, v) => setEvalForm(f => ({ ...f, [k]: v }))

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={20} className="animate-spin" style={{ color:'var(--phosphor)' }} />
    </div>
  )
  if (!persona) return <div style={{ color:'var(--text-dim)', padding:'2rem' }}>Persona no encontrada.</div>

  const phoneDigits = persona.telefono?.replace(/\D/g, '').replace(/^0+/, '') || ''
  const whatsappNumber = phoneDigits.startsWith('549')
    ? phoneDigits
    : phoneDigits.startsWith('54')
      ? `549${phoneDigits.slice(2).replace(/^9/, '')}`
      : phoneDigits
        ? `549${phoneDigits.replace(/^9/, '')}`
        : ''
  const waLink = whatsappNumber ? `https://wa.me/${whatsappNumber}` : null
  const mailLink = persona.email ? `mailto:${persona.email.trim()}` : null

  const puntaje = Math.min(5, persona.puntaje_promedio || 0)
  const resultadoLabel = puntaje > 0 ? getResultado(puntaje) : '—'

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {canManage && showEditPersona && <PersonaModal persona={persona} sedes={sedes} grupos={grupos} onClose={() => setShowEditPersona(false)} onSaved={() => { setShowEditPersona(false); load() }} />}

      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-start gap-4" style={{ borderBottom:'1px solid rgba(57,255,20,0.1)' }}>
        <button onClick={onBack} className="btn-ghost mt-0.5" style={{ fontSize:'0.7rem' }}>← Volver</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-title font-bold text-xl flex items-center gap-2" style={{ color:'var(--phosphor)' }}>
              {persona.nombre} {persona.apellido || ''}
              {canManage && (
                <button onClick={() => setShowEditPersona(true)} className="btn-ghost p-1" title="Editar info y puesto">
                  <Pencil size={14} />
                </button>
              )}
            </h1>
            {persona.puntos_total > 0 && (
              <span className="font-metric text-xs px-2 py-0.5 rounded" style={{ background:'rgba(57,255,20,0.1)', color:'var(--phosphor)' }}>
                ⭐ {persona.puntos_total} pts
              </span>
            )}
          </div>
          <p className="font-metric text-xs mt-0.5" style={{ color:'var(--text-dim)' }}>
            {persona.puesto || '—'} {persona.area ? `· ${persona.area}` : ''}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {persona.telefono && (
            <a href={`tel:${phoneDigits}`}
              className="btn-ghost flex items-center gap-1.5" style={{ fontSize:'0.7rem', textDecoration:'none' }}>
              <Phone size={12} /> Llamar
            </a>
          )}
          {waLink && (
            <a href={waLink} target="_blank" rel="noreferrer"
              className="btn-primary flex items-center gap-1.5" style={{ fontSize:'0.7rem', textDecoration:'none' }}>
              <Phone size={12} /> WhatsApp
            </a>
          )}
          {mailLink && (
            <a href={mailLink}
              className="btn-ghost flex items-center gap-1.5" style={{ fontSize:'0.7rem', textDecoration:'none' }}>
              <Mail size={12} /> Email
            </a>
          )}
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-4 gap-0" style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
        {[
          { label:'PUNTAJE PROM.', value: puntaje > 0 ? puntaje.toFixed(1) : '—' },
          { label:'RESULTADO', value: resultadoLabel, color: puntaje > 0 ? RESULTADO_COLOR[resultadoLabel] : 'var(--text-dim)' },
          { label:'LOGROS', value: persona.logros_count || 0 },
          { label:'INCIDENTES', value: persona.incidentes || 0, color: (persona.incidentes > 0) ? '#f59e0b' : 'var(--phosphor)' },
        ].map(k => (
          <div key={k.label} className="py-3 px-4 text-center" style={{ borderRight:'1px solid rgba(57,255,20,0.06)' }}>
            <p className="font-title font-bold text-lg" style={{ color: k.color || 'var(--phosphor)' }}>{k.value}</p>
            <p className="font-metric" style={{ fontSize:'0.6rem', color:'var(--text-dim)', letterSpacing:'0.08em' }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 px-6 pt-3" style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
        {[
          ['info','INFO & PUESTO'],
          ['documentacion','DOCUMENTACIÓN'],
          ['evaluaciones','EVALUACIONES'],
          ['historial','HISTORIAL'],
          ['logros','LOGROS'],
          ...(canManage ? [['formularios','FORMULARIOS']] : []),
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className="font-metric px-4 py-1.5 mr-1 rounded-t"
            style={{ fontSize:'0.6rem', letterSpacing:'0.08em',
              background: tab===id ? 'rgba(57,255,20,0.12)' : 'transparent',
              color: tab===id ? 'var(--phosphor)' : 'var(--text-dim)',
              borderBottom: tab===id ? '2px solid var(--phosphor)' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">

        {/* ── INFO ── */}
        {tab === 'info' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="glass p-4 space-y-3">
                <p className="font-metric text-xs" style={{ color:'var(--phosphor)', letterSpacing:'0.08em' }}>DATOS PERSONALES</p>
                {[
                  ['N.º de legajo', persona.legajo],
                  ['DNI', persona.dni],
                  ['Teléfono', persona.telefono],
                  ['Email', persona.email],
                  ['Fecha ingreso', persona.fecha_ingreso ? fmtFechaLarga(persona.fecha_ingreso) : null],
                ].map(([l, v]) => v ? (
                  <div key={l}>
                    <p style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>{l}</p>
                    <p style={{ fontSize:'0.8rem', color:'var(--text)' }}>{v}</p>
                  </div>
                ) : null)}
              </div>
              <div className="glass p-4 space-y-3">
                <p className="font-metric text-xs" style={{ color:'var(--phosphor)', letterSpacing:'0.08em' }}>CARGO Y ÁREA</p>
                {[
                  ['Puesto', persona.puesto],
                  ['Área', persona.area],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>{l}</p>
                    <p style={{ fontSize:'0.8rem', color:'var(--text)' }}>{v || '—'}</p>
                  </div>
                ))}
                <div>
                  <p style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>Escala / Unidad Productiva</p>
                  <p style={{ fontSize:'0.8rem', color:'var(--text)' }}>
                    {persona.sede_ids?.length 
                      ? (() => {
                          const g = grupos.find(gr => {
                            const groupSedes = sedes.filter(s => s.grupo_id === gr.id).map(s => s.id)
                            return groupSedes.length > 0 && groupSedes.every(id => persona.sede_ids.includes(id))
                          })
                          if (g) return `Grupo: ${g.nombre}`
                          return persona.sede_ids.map(id => sedes.find(s => s.id === id)?.nombre).filter(Boolean).join(' • ')
                        })()
                      : 'Sin escala asignada'}
                  </p>
                </div>
              </div>
            </div>
            {persona.descripcion_puesto && (
              <div className="glass p-4">
                <p className="font-metric text-xs mb-2" style={{ color:'var(--phosphor)', letterSpacing:'0.08em' }}>DESCRIPCIÓN DEL PUESTO</p>
                <p style={{ fontSize:'0.78rem', color:'var(--text)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{persona.descripcion_puesto}</p>
              </div>
            )}
            {persona.procesos && persona.procesos.length > 0 && (
              <div className="glass p-4">
                <p className="font-metric text-xs mb-2" style={{ color:'var(--phosphor)', letterSpacing:'0.08em' }}>PROCESOS QUE EJECUTA</p>
                <ul className="space-y-1.5">
                  {persona.procesos.map((p, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span style={{ color:'var(--phosphor)', fontSize:'0.7rem', marginTop:1 }}>▸</span>
                      <span style={{ fontSize:'0.78rem', color:'var(--text)' }}>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── DOCUMENTACIÓN ── */}
        {tab === 'documentacion' && (
          <DocumentacionChecklist
            entityType="persona"
            entityId={persona.id}
            template={PERSONA_DOCUMENTACION_TEMPLATE}
            canEdit={canManage}
            title="Documentación del puesto"
          />
        )}

        {/* ── FORMULARIOS ── */}
        {tab === 'formularios' && canManage && (
          <PersonaFormularios
            persona={persona}
            onRegistered={() => {
              load()
              setTab('historial')
            }}
          />
        )}

        {/* ── EVALUACIONES ── */}
        {tab === 'evaluaciones' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="font-metric text-xs" style={{ color:'var(--text-dim)' }}>{evaluaciones.length} evaluaciones registradas</p>
              {canManage && <button onClick={() => setShowEvalForm(true)} className="btn-primary flex items-center gap-1.5" style={{ fontSize:'0.7rem' }}>
                <Plus size={12} /> Nueva evaluación
              </button>}
            </div>
            {showEvalForm && (
              <div className="glass p-5 mb-4" style={{ border:'1px solid rgba(57,255,20,0.2)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="font-metric text-xs" style={{ color:'var(--phosphor)' }}>NUEVA EVALUACIÓN DE DESEMPEÑO</p>
                  <button onClick={() => setShowEvalForm(false)} className="btn-ghost"><X size={13} /></button>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    ['evaluador_nombre','Nombre del evaluador','Ej: María González'],
                    ['evaluador_cargo','Cargo evaluador','Ej: Jefe de Cocina'],
                    ['periodo','Período','Ej: Q2 2026'],
                    ['antiguedad_con_evaluado','Antigüedad con evaluado','Ej: 6 meses'],
                  ].map(([k,l,ph]) => (
                    <div key={k}>
                      <label className="font-metric block mb-1" style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>{l.toUpperCase()}</label>
                      <input className="input-dark w-full" value={evalForm[k]} onChange={e => setEv(k, e.target.value)} placeholder={ph} style={{ fontSize:'0.75rem' }} />
                    </div>
                  ))}
                </div>
                <p style={{ fontSize:'0.62rem', color:'var(--text-dim)', marginBottom:'0.5rem' }}>
                  Escala de calificación: 1 = muy bajo, 3 = aceptable, 5 = excelente. Dejá "— Sin calificar —" si no podés evaluar ese ítem.
                </p>
                <div className="grid grid-cols-1 gap-4 mb-4">
                  <div>
                    <p className="font-metric mb-2" style={{ fontSize:'0.65rem', color:'var(--phosphor)', letterSpacing:'0.08em' }}>BLOQUE 1 — DESEMPEÑO EN EL PUESTO</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[['d1_cumple_actividades','Cumple actividades'],['d2_sin_supervision','Sin supervisión'],['d3_comprende_prioridades','Comprende prioridades']].map(([k,l]) => (
                        <div key={k}>
                          <label className="font-metric block mb-1" style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>{l.toUpperCase()}</label>
                          <ScoreSelect name={k} value={evalForm[k]} onChange={setEv} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-metric mb-2" style={{ fontSize:'0.65rem', color:'var(--phosphor)', letterSpacing:'0.08em' }}>BLOQUE 2 — TRABAJO EN EQUIPO Y CLIMA</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[['e1_cooperacion','Cooperación'],['e2_comunicacion','Comunicación'],['e3_maneja_desacuerdos','Maneja desacuerdos'],['e4_ambiente_confianza','Ambiente de confianza'],['e5_evita_conflictos','Evita conflictos']].map(([k,l]) => (
                        <div key={k}>
                          <label className="font-metric block mb-1" style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>{l.toUpperCase()}</label>
                          <ScoreSelect name={k} value={evalForm[k]} onChange={setEv} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-metric mb-2" style={{ fontSize:'0.65rem', color:'var(--phosphor)', letterSpacing:'0.08em' }}>BLOQUE 3 — PRESENTACIÓN Y PUNTUALIDAD</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[['p1_cumple_horario','Cumple horario'],['p2_aseo_personal','Aseo personal'],['p3_uniforme','Uniforme']].map(([k,l]) => (
                        <div key={k}>
                          <label className="font-metric block mb-1" style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>{l.toUpperCase()}</label>
                          <ScoreSelect name={k} value={evalForm[k]} onChange={setEv} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {(() => { const s = calcPuntaje(evalForm); return s ? (
                  <div className="mb-3 p-3 rounded flex items-center gap-3" style={{ background:'rgba(57,255,20,0.07)', border:'1px solid rgba(57,255,20,0.2)' }}>
                    <span className="font-title font-bold text-2xl" style={{ color: RESULTADO_COLOR[getResultado(s)] || 'var(--phosphor)' }}>{s.toFixed(1)}</span>
                    <div>
                      <p style={{ fontSize:'0.7rem', color:'var(--text)' }}>Resultado: <strong style={{ color: RESULTADO_COLOR[getResultado(s)] }}>{getResultado(s)}</strong></p>
                      <p style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>Promedio de {Object.keys(evalForm).filter(k=>['d1','d2','d3','e1','e2','e3','e4','e5','p1','p2','p3'].some(x=>k.startsWith(x)) && evalForm[k]).length} ítems</p>
                    </div>
                  </div>
                ) : null })()}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[
                    ['observaciones_rrhh','Observaciones RRHH','Ej: Buen desempeño general, atento a indicaciones'],
                    ['sugerencias_evaluador','Sugerencias','Ej: Reforzar manejo de tiempos en hora pico'],
                  ].map(([k,l,ph]) => (
                    <div key={k}>
                      <label className="font-metric block mb-1" style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>{l.toUpperCase()}</label>
                      <textarea className="input-dark w-full" rows={2} value={evalForm[k]} onChange={e => setEv(k, e.target.value)} placeholder={ph} style={{ fontSize:'0.75rem', resize:'vertical' }} />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={evalForm.supero_prueba} onChange={e => setEv('supero_prueba', e.target.checked)} />
                    <span style={{ fontSize:'0.75rem', color:'var(--text)' }}>Superó período de prueba</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEval} disabled={saving} className="btn-primary flex items-center gap-1.5" style={{ fontSize:'0.72rem' }}>
                    <Save size={12} /> {saving ? 'Guardando...' : 'Guardar evaluación'}
                  </button>
                  <button onClick={() => setShowEvalForm(false)} className="btn-ghost" style={{ fontSize:'0.72rem' }}>Cancelar</button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {evaluaciones.length === 0 && <p style={{ fontSize:'0.78rem', color:'var(--text-dim)' }}>Sin evaluaciones aún.</p>}
              {evaluaciones.map(ev => (
                <div key={ev.id} className="glass p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-metric text-xs" style={{ color:'var(--text-dim)' }}>
                        {ev.periodo || 'Sin período'} · {fmtFechaLarga(ev.fecha_evaluacion)}
                      </p>
                      <p style={{ fontSize:'0.75rem', color:'var(--text)' }}>{ev.evaluador_nombre || 'Evaluador no especificado'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {ev.puntaje_calculado && (
                        <div className="text-right">
                          <p className="font-title font-bold text-2xl" style={{ color: RESULTADO_COLOR[ev.resultado_global] || 'var(--phosphor)' }}>{ev.puntaje_calculado}</p>
                          <p className="font-metric" style={{ fontSize:'0.6rem', color: RESULTADO_COLOR[ev.resultado_global] }}>{ev.resultado_global}</p>
                        </div>
                      )}
                      {canManage && (
                        <button onClick={() => handleEditEval(ev)} className="btn-ghost p-1.5" title="Editar evaluación">
                          <Pencil size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ['Desempeño', [ev.d1_cumple_actividades, ev.d2_sin_supervision, ev.d3_comprende_prioridades]],
                      ['Equipo/Clima', [ev.e1_cooperacion, ev.e2_comunicacion, ev.e3_maneja_desacuerdos, ev.e4_ambiente_confianza, ev.e5_evita_conflictos]],
                      ['Presentación', [ev.p1_cumple_horario, ev.p2_aseo_personal, ev.p3_uniforme]],
                    ].map(([bloque, vals]) => {
                      const vs = vals.filter(v=>v!=null)
                      const avg = vs.length ? (vs.reduce((a,b)=>a+b,0)/vs.length).toFixed(1) : '—'
                      return (
                        <div key={bloque} className="text-center p-2 rounded" style={{ background:'rgba(255,255,255,0.03)' }}>
                          <p className="font-title font-bold" style={{ color:'var(--phosphor)', fontSize:'1.1rem' }}>{avg}</p>
                          <p style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>{bloque}</p>
                        </div>
                      )
                    })}
                  </div>
                  {ev.observaciones_rrhh && <p style={{ fontSize:'0.7rem', color:'var(--text-dim)', marginTop:'0.5rem' }}>📝 {ev.observaciones_rrhh}</p>}
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(57,255,20,0.1)' }}>
                    <AdjuntosPanel entityType="evaluacion" entityId={ev.id} readOnly={!canManage} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {tab === 'historial' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="font-metric text-xs" style={{ color:'var(--text-dim)' }}>{historial.length} registros</p>
              {canManage && <button onClick={() => setShowHistorialForm(true)} className="btn-primary flex items-center gap-1.5" style={{ fontSize:'0.7rem' }}>
                <Plus size={12} /> Agregar registro
              </button>}
            </div>
            {showHistorialForm && (
              <div className="glass p-4 mb-4" style={{ border:'1px solid rgba(57,255,20,0.2)' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-metric text-xs" style={{ color:'var(--phosphor)' }}>NUEVO REGISTRO</p>
                  <button onClick={() => setShowHistorialForm(false)} className="btn-ghost"><X size={13} /></button>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="font-metric block mb-1" style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>TIPO</label>
                    <select className="input-dark w-full" value={histForm.tipo} onChange={e => setHistForm(f=>({...f, tipo:e.target.value}))} style={{ fontSize:'0.75rem' }}>
                      <option value="apercibimiento">Apercibimiento</option>
                      <option value="suspension">Suspensión</option>
                      <option value="llamado_atencion">Llamado de atención</option>
                      <option value="reconocimiento">Reconocimiento</option>
                      <option value="logro">Logro</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-metric block mb-1" style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>FECHA *</label>
                    <input type="date" required className="input-dark w-full" value={histForm.fecha} onChange={e => setHistForm(f=>({...f, fecha:e.target.value}))} style={{ fontSize:'0.75rem' }} />
                  </div>
                  {histForm.tipo === 'suspension' && (
                    <div>
                      <label className="font-metric block mb-1" style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>DÍAS DE SUSPENSIÓN</label>
                      <input type="number" className="input-dark w-full" placeholder="Ej: 3" value={histForm.dias_suspension} onChange={e => setHistForm(f=>({...f, dias_suspension:e.target.value}))} style={{ fontSize:'0.75rem' }} />
                    </div>
                  )}
                  <div>
                    <label className="font-metric block mb-1" style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>REGISTRADO POR</label>
                    <input className="input-dark w-full" placeholder="Ej: Carlos Ruiz" value={histForm.registrado_por} onChange={e => setHistForm(f=>({...f, registrado_por:e.target.value}))} style={{ fontSize:'0.75rem' }} />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="font-metric block mb-1" style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>DESCRIPCIÓN *</label>
                  <textarea className="input-dark w-full" rows={2} required placeholder="Ej: Llegó 40 minutos tarde sin avisar" value={histForm.descripcion} onChange={e => setHistForm(f=>({...f, descripcion:e.target.value}))} style={{ fontSize:'0.75rem', resize:'vertical' }} />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveHistorial} disabled={saving || !histForm.descripcion} className="btn-primary flex items-center gap-1.5" style={{ fontSize:'0.72rem' }}>
                    <Save size={12} /> {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button onClick={() => setShowHistorialForm(false)} className="btn-ghost" style={{ fontSize:'0.72rem' }}>Cancelar</button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {historial.length === 0 && <p style={{ fontSize:'0.78rem', color:'var(--text-dim)' }}>Sin registros.</p>}
              {historial.map(h => (
                <div key={h.id} className="glass p-3 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: TIPO_COLOR[h.tipo] || 'var(--phosphor)' }} />
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-metric" style={{ fontSize:'0.6rem', color: TIPO_COLOR[h.tipo], textTransform:'uppercase' }}>{h.tipo.replace('_',' ')}</span>
                        <span style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>{fmtFechaLarga(h.fecha)}</span>
                        {h.dias_suspension && <span style={{ fontSize:'0.6rem', color:'#ef4444' }}>({h.dias_suspension} días)</span>}
                      </div>
                      {canManage && (
                        <button onClick={() => handleEditHist(h)} className="btn-ghost p-1" title="Editar registro">
                          <Pencil size={12} />
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize:'0.78rem', color:'var(--text)' }}>{h.descripcion}</p>
                    {h.registrado_por && <p style={{ fontSize:'0.6rem', color:'var(--text-dim)', marginTop:2 }}>Por: {h.registrado_por}</p>}
                    <div className="mt-2">
                      <AdjuntosPanel
                        entityType="historial_personal"
                        entityId={h.id}
                        readOnly={!canManage}
                        label={h.tipo === 'apercibimiento' ? 'Apercibimiento firmado' : 'Adjuntos'}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LOGROS ── */}
        {tab === 'logros' && (
          <div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-metric text-xs mb-3" style={{ color:'var(--phosphor)', letterSpacing:'0.08em' }}>OBTENIDOS</p>
                {logros.length === 0 && <p style={{ fontSize:'0.78rem', color:'var(--text-dim)' }}>Aún sin logros.</p>}
                <div className="space-y-2">
                  {logros.map(l => (
                    <div key={l.id} className="glass p-3 flex items-center gap-3">
                      <span style={{ fontSize:'1.4rem' }}>{l.icono || '🏆'}</span>
                      <div>
                        <p style={{ fontSize:'0.78rem', color:'var(--text)' }}>{l.nombre}</p>
                        <p style={{ fontSize:'0.6rem', color:'var(--phosphor)' }}>+{l.puntos} pts · {fmtFechaLarga(l.fecha)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-metric text-xs mb-3" style={{ color:'var(--text-dim)', letterSpacing:'0.08em' }}>CATÁLOGO COMPLETO</p>
                <div className="space-y-2">
                  {logrosConfig.map(lc => {
                    const obtenido = logros.some(l => l.logro_id === lc.id || l.nombre === lc.nombre)
                    return (
                      <div key={lc.id} className="glass p-3 flex items-center gap-3" style={{ opacity: obtenido ? 1 : 0.45 }}>
                        <span style={{ fontSize:'1.1rem' }}>{lc.icono}</span>
                        <div className="flex-1">
                          <p style={{ fontSize:'0.75rem', color: obtenido ? 'var(--text)' : 'var(--text-dim)' }}>{lc.nombre}</p>
                          <p style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>{lc.descripcion}</p>
                        </div>
                        <span className="font-metric" style={{ fontSize:'0.65rem', color:'var(--phosphor)' }}>{lc.puntos}pts</span>
                        {obtenido && <span style={{ color:'var(--phosphor)', fontSize:'0.75rem' }}>✓</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Modal Nueva/Editar Persona
// ──────────────────────────────────────────────
function PersonaModal({ persona, sedes = [], grupos = [], onClose, onSaved }) {
  const [form, setForm] = useState({
    nombre: persona?.nombre || '',
    apellido: persona?.apellido || '',
    legajo: persona?.legajo || '',
    dni: persona?.dni || '',
    puesto: persona?.puesto || '',
    area: persona?.area || '',
    telefono: persona?.telefono || '',
    email: persona?.email || '',
    fecha_ingreso: persona?.fecha_ingreso || '',
    descripcion_puesto: persona?.descripcion_puesto || '',
    procesos_raw: persona?.procesos ? persona.procesos.join('\n') : '',
    sede_ids: persona?.sede_ids || []
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleDelete = async () => {
    if (!persona?.id) return
    if (!await confirmar({ titulo: 'Eliminar persona', mensaje: 'Esta acción ocultará su perfil del equipo (baja lógica).', peligro: true, confirmText: 'Eliminar' })) return
    setSaving(true)
    const res = await supabase.schema('equipo').from('personas').update({ activo: false }).eq('id', persona.id)
    setSaving(false)
    if (res.error) { toast.error('Error al eliminar: ' + mensajeError(res.error)); return }
    onSaved()
  }

  const handleSelectSede = (e) => {
    const val = e.target.value
    if (!val) {
      set('sede_ids', [])
    } else if (val.startsWith('G_')) {
      const gId = Number(val.split('_')[1])
      const sIds = sedes.filter(s => s.grupo_id === gId).map(s => s.id)
      set('sede_ids', sIds)
    } else {
      set('sede_ids', [Number(val)])
    }
  }

  const save = async () => {
    if (!form.nombre.trim()) return toast.warn('El nombre es requerido.')
    setSaving(true)
    const procesos = form.procesos_raw.split('\n').map(s=>s.trim()).filter(Boolean)
    const payload = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim() || null,
      legajo: form.legajo.trim() || null,
      dni: form.dni.trim() || null,
      puesto: form.puesto.trim() || null,
      area: form.area.trim() || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      fecha_ingreso: form.fecha_ingreso || null,
      descripcion_puesto: form.descripcion_puesto.trim() || null,
      procesos: procesos.length ? procesos : null,
      sede_ids: form.sede_ids.length ? form.sede_ids : null
    }

    let res
    if (persona) {
      res = await supabase.schema('equipo').from('personas').update(payload).eq('id', persona.id)
    } else {
      res = await supabase.schema('equipo').from('personas').insert(payload)
    }

    setSaving(false)
    if (res.error) { toast.error('Error: ' + mensajeError(res.error)); return }
    onSaved()
  }

  return (
    <div className="modal-overlay" style={{ zIndex:60 }}>
      <div className="glass fade-in w-full max-w-2xl" style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.2)', borderRadius:4, padding:'1.5rem', maxHeight:'90vh', overflow:'auto' }}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-metric text-xs" style={{ color:'var(--phosphor)', letterSpacing:'0.1em' }}>{persona ? 'EDITAR PERSONA' : 'NUEVA PERSONA'}</p>
          <button onClick={onClose} className="btn-ghost"><X size={13} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[
            ['nombre','Nombre *','Ej: Juan'],
            ['apellido','Apellido','Ej: Pérez'],
            ['legajo','N.º de legajo','Ej: FK-00125'],
            ['dni','DNI','Ej: 34567890'],
            ['puesto','Puesto','Ej: Cocinero'],
            ['area','Área','Ej: Cocina'],
            ['telefono','Teléfono','Ej: 1145678900'],
            ['email','Email','Ej: juan.perez@email.com'],
            ['fecha_ingreso','Fecha ingreso',null],
          ].map(([k,l,ph]) => (
            <div key={k}>
              <label className="font-metric block mb-1" style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>{l.toUpperCase()}</label>
              <input type={k==='fecha_ingreso'?'date':'text'} required={k==='nombre'} className="input-dark w-full"
                value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph || undefined} style={{ fontSize:'0.75rem' }} />
            </div>
          ))}
        </div>
        <div className="mb-3">
          <label className="font-metric block mb-1" style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>UNIDAD PRODUCTIVA O GRUPO</label>
          <select className="input-dark w-full" value={
            form.sede_ids?.length > 1 
              ? (() => {
                  const g = grupos.find(g => {
                    const groupSedes = sedes.filter(s => s.grupo_id === g.id).map(s => s.id)
                    return groupSedes.length > 0 && groupSedes.every(id => form.sede_ids.includes(id))
                  })
                  return g ? `G_${g.id}` : ''
                })()
              : (form.sede_ids?.[0] || '')
          } onChange={handleSelectSede} style={{ fontSize:'0.75rem', height:34 }}>
            <option value="">Sin sede/grupo asignado</option>
            {grupos.length > 0 && (
              <optgroup label="Grupos">
                {grupos.map(g => <option key={`G_${g.id}`} value={`G_${g.id}`}>Grupo: {g.nombre}</option>)}
              </optgroup>
            )}
            <optgroup label="Sedes individuales">
              {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </optgroup>
          </select>
        </div>
        <div className="mb-3">
          <label className="font-metric block mb-1" style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>DESCRIPCIÓN DEL PUESTO</label>
          <textarea className="input-dark w-full" rows={3} placeholder="Ej: Responsable de preparación de platos fríos y armado de pedidos" value={form.descripcion_puesto}
            onChange={e => set('descripcion_puesto', e.target.value)} style={{ fontSize:'0.75rem', resize:'vertical' }} />
        </div>
        <div className="mb-4">
          <label className="font-metric block mb-1" style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>PROCESOS QUE EJECUTA (uno por línea)</label>
          <textarea className="input-dark w-full" rows={4} placeholder="Proceso 1&#10;Proceso 2&#10;..."
            value={form.procesos_raw} onChange={e => set('procesos_raw', e.target.value)} style={{ fontSize:'0.75rem', resize:'vertical' }} />
        </div>
        <div className="flex gap-2 mt-4 justify-between">
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-1.5" style={{ fontSize:'0.72rem' }}>
              <Save size={12} /> {saving ? 'Guardando...' : 'Guardar persona'}
            </button>
            <button onClick={onClose} className="btn-ghost" style={{ fontSize:'0.72rem' }}>Cancelar</button>
          </div>
          {persona?.id && (
            <button onClick={handleDelete} disabled={saving} className="btn-ghost text-red-500 hover:bg-red-500/10" style={{ fontSize:'0.72rem' }}>
              Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}


// ──────────────────────────────────────────────
// EquipoView — vista principal
// ──────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label className="font-metric block mb-1" style={{ fontSize:'0.6rem', color:'var(--text-dim)', letterSpacing:'0.06em' }}>{label.toUpperCase()}</label>
      {children}
    </div>
  )
}

function SolicitudPersonalModal({ sedes = [], personas = [], onClose }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    puesto: '',
    sede_id: '',
    horario: '',
    fecha_apertura: today,
    urgencia: 'Media',
    periodo_necesidad: 'Permanente',
    motivo: '',
    cantidad: '1',
    modalidad: '',
    tareas: '',
    requisitos: '',
    experiencia: '',
    documentacion: '',
    responsable: '',
    contacto: '',
    observaciones: ''
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const selectedSede = sedes.find(s => String(s.id) === String(form.sede_id))

  const formatDate = (value) => {
    if (!value) return '[Completar]'
    const [y, m, d] = value.split('-')
    return y && m && d ? `${d}/${m}/${y}` : value
  }

  const bulletLines = (raw) => {
    const lines = raw.split('\n').map(x => x.trim()).filter(Boolean)
    return lines.length ? lines.map(x => `* ${x}`).join('\n') : '* [Completar]\n* [Completar]\n* [Completar]'
  }

  const text = `SOLICITUD DE PERSONAL

📌 Puesto:
${form.puesto || '[Completar]'}

📍 Lugar de trabajo / Sede:
${selectedSede?.nombre || '[Completar]'}

🕒 Horario de trabajo:
${form.horario || '[Completar]'}

📅 Fecha de apertura de la búsqueda:
${formatDate(form.fecha_apertura)}

⚠️ Urgencia / Prioridad:
${form.urgencia || '[Completar]'}

📆 Período de necesidad:
${form.periodo_necesidad || '[Eventual / Permanente / Cobertura de vacaciones / Reemplazo / Refuerzo operativo]'}

🎯 Motivo de la solicitud:
${form.motivo || '[Completar]'}

👤 Cantidad de personas solicitadas:
${form.cantidad || '[Completar]'}

🧾 Modalidad de contratación:
${form.modalidad || '[Completar]'}

📋 Tareas principales del puesto:
${bulletLines(form.tareas)}

✅ Requisitos del puesto:
${bulletLines(form.requisitos)}

🎓 Experiencia requerida:
${form.experiencia || '[Completar]'}

📄 Documentación / credenciales necesarias:
${form.documentacion || '[Completar]'}

🧑‍💼 Responsable solicitante:
${form.responsable || '[Completar]'}

📞 Contacto para coordinación:
${form.contacto || '[Completar]'}

📝 Observaciones:
${form.observaciones || '[Completar]'}`

  const subject = `Solicitud de personal${form.puesto ? ` - ${form.puesto}` : ''}${selectedSede?.nombre ? ` - ${selectedSede.nombre}` : ''}`
  const mailHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(text)}`

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.ok('Solicitud copiada al portapapeles.')
    } catch {
      toast.error('No se pudo copiar automáticamente. Podés seleccionar el texto de la vista previa.')
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex:65 }}>
      <div className="glass fade-in w-full max-w-5xl" style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.2)', borderRadius:4, maxHeight:'92vh', overflow:'auto' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:'1px solid rgba(57,255,20,0.1)' }}>
          <div>
            <h2 className="font-title font-bold" style={{ color:'var(--text)', fontSize:'1rem' }}>Solicitud de personal</h2>
            <p className="font-metric" style={{ color:'var(--text-dim)', fontSize:'0.62rem' }}>Formulario interno para RRHH / coordinación operativa</p>
          </div>
          <button onClick={onClose} className="btn-ghost"><X size={14} /></button>
        </div>

        <div className="grid grid-cols-2 gap-5 p-5">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Puesto *">
                <input className="input-dark w-full" value={form.puesto} onChange={e=>set('puesto', e.target.value)} placeholder="Ej: Responsable de cocina" style={{ fontSize:'0.75rem' }} />
              </Field>
              <Field label="Sede / lugar *">
                <select className="input-dark w-full" value={form.sede_id} onChange={e=>set('sede_id', e.target.value)} style={{ fontSize:'0.75rem', height:34 }}>
                  <option value="">Seleccionar sede</option>
                  {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </Field>
              <Field label="Horario de trabajo">
                <input className="input-dark w-full" value={form.horario} onChange={e=>set('horario', e.target.value)} placeholder="Ej: Lunes a viernes 06:00 a 14:00" style={{ fontSize:'0.75rem' }} />
              </Field>
              <Field label="Fecha apertura">
                <input type="date" className="input-dark w-full" value={form.fecha_apertura} onChange={e=>set('fecha_apertura', e.target.value)} style={{ fontSize:'0.75rem' }} />
              </Field>
              <Field label="Urgencia / prioridad">
                <select className="input-dark w-full" value={form.urgencia} onChange={e=>set('urgencia', e.target.value)} style={{ fontSize:'0.75rem', height:34 }}>
                  <option>Alta</option>
                  <option>Media</option>
                  <option>Baja</option>
                </select>
              </Field>
              <Field label="Período de necesidad">
                <select className="input-dark w-full" value={form.periodo_necesidad} onChange={e=>set('periodo_necesidad', e.target.value)} style={{ fontSize:'0.75rem', height:34 }}>
                  <option>Eventual</option>
                  <option>Permanente</option>
                  <option>Cobertura de vacaciones</option>
                  <option>Reemplazo</option>
                  <option>Refuerzo operativo</option>
                </select>
              </Field>
              <Field label="Cantidad">
                <input type="number" min="1" className="input-dark w-full" value={form.cantidad} onChange={e=>set('cantidad', e.target.value)} placeholder="Ej: 1" style={{ fontSize:'0.75rem' }} />
              </Field>
              <Field label="Modalidad contratación">
                <input className="input-dark w-full" value={form.modalidad} onChange={e=>set('modalidad', e.target.value)} placeholder="Ej: Relación de dependencia / eventual" style={{ fontSize:'0.75rem' }} />
              </Field>
            </div>

            <Field label="Motivo de la solicitud">
              <textarea className="input-dark w-full" rows={2} value={form.motivo} onChange={e=>set('motivo', e.target.value)} placeholder="Ej: Reemplazo por licencia / aumento de demanda / nueva operación" style={{ fontSize:'0.75rem', resize:'vertical' }} />
            </Field>
            <Field label="Tareas principales del puesto — una por línea">
              <textarea className="input-dark w-full" rows={3} value={form.tareas} onChange={e=>set('tareas', e.target.value)} placeholder="Preparación de producción diaria&#10;Control de stock&#10;Limpieza del sector" style={{ fontSize:'0.75rem', resize:'vertical' }} />
            </Field>
            <Field label="Requisitos del puesto — uno por línea">
              <textarea className="input-dark w-full" rows={3} value={form.requisitos} onChange={e=>set('requisitos', e.target.value)} placeholder="Disponibilidad horaria&#10;Carnet de manipulación vigente&#10;Experiencia en cocina industrial" style={{ fontSize:'0.75rem', resize:'vertical' }} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Experiencia requerida">
                <textarea className="input-dark w-full" rows={2} value={form.experiencia} onChange={e=>set('experiencia', e.target.value)} placeholder="Ej: 1 año en comedores o cocina industrial" style={{ fontSize:'0.75rem', resize:'vertical' }} />
              </Field>
              <Field label="Documentación / credenciales">
                <textarea className="input-dark w-full" rows={2} value={form.documentacion} onChange={e=>set('documentacion', e.target.value)} placeholder="Ej: DNI, CUIL, carnet manipulador, apto médico" style={{ fontSize:'0.75rem', resize:'vertical' }} />
              </Field>
              <Field label="Responsable solicitante">
                <input className="input-dark w-full" list="responsables-equipo" value={form.responsable} onChange={e=>set('responsable', e.target.value)} placeholder="Ej: Nicolás Vitale" style={{ fontSize:'0.75rem' }} />
                <datalist id="responsables-equipo">
                  {personas.map(p => <option key={p.id} value={`${p.nombre} ${p.apellido || ''}`.trim()} />)}
                </datalist>
              </Field>
              <Field label="Contacto coordinación">
                <input className="input-dark w-full" value={form.contacto} onChange={e=>set('contacto', e.target.value)} placeholder="Ej: +54 9 351..." style={{ fontSize:'0.75rem' }} />
              </Field>
            </div>
            <Field label="Observaciones">
              <textarea className="input-dark w-full" rows={2} value={form.observaciones} onChange={e=>set('observaciones', e.target.value)} placeholder="Notas adicionales, restricciones, fecha ideal de ingreso..." style={{ fontSize:'0.75rem', resize:'vertical' }} />
            </Field>
          </div>

          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <p className="font-metric" style={{ color:'var(--phosphor)', fontSize:'0.68rem', letterSpacing:'0.08em' }}>VISTA PREVIA</p>
              <div className="flex gap-2">
                <button onClick={copyText} className="btn-ghost flex items-center gap-1.5" style={{ fontSize:'0.68rem' }}><Copy size={11}/> Copiar</button>
                <a href={mailHref} className="btn-ghost flex items-center gap-1.5" style={{ fontSize:'0.68rem', textDecoration:'none' }}><Mail size={11}/> Mail</a>
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="btn-primary flex items-center gap-1.5" style={{ fontSize:'0.68rem', textDecoration:'none' }}><MessageCircle size={11}/> WhatsApp</a>
              </div>
            </div>
            <pre className="input-dark flex-1 whitespace-pre-wrap" style={{ minHeight:520, fontSize:'0.72rem', lineHeight:1.55, overflow:'auto', padding:'1rem' }}>{text}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function EquipoView({ onNavigate, focusId, focusType }) {
  const { can, allowedSedeIds, perfil } = useAuth()
  const isQualityOnly = isQualityOnlyProfile(perfil)
  const canManage = can('equipo', 'manage')
  const [personas, setPersonas] = useState([])
  const [sedes, setSedes] = useState([])
  const [grupos, setGrupos] = useState([])
  const [loading, setLoading] = useState(true)
  const hasLoadedOnce = useRef(false)
  const [search, setSearch] = useState('')
  const [sedeFilter, setSedeFilter] = useState('')
  const [tab, setTab] = useState('lista')
  const [selectedId, setSelectedId] = useState(
    !focusType || focusType === 'persona' ? (focusId || null) : null
  )
  const [showNew, setShowNew] = useState(false)
  const [showSolicitud, setShowSolicitud] = useState(false)

  const load = async () => {
    setLoading(true)
    const [pRes, sRes, gRes] = await Promise.all([
      supabase.from('v_personas').select('*').order('nombre'),
      supabase.schema('bitacora').from('sedes').select('id, nombre, grupo_id').eq('activa', true).order('nombre'),
      supabase.schema('bitacora').from('grupos').select('id, nombre').eq('activo', true).order('nombre')
    ])
    const todasSedes = sRes.data || []
    // Roles territoriales (grupo/encargado/sede) solo ven y gestionan su(s) sede(s) asignada(s)
    const sedesPermitidas = allowedSedeIds === null
      ? todasSedes
      : todasSedes.filter(s => allowedSedeIds.includes(s.id))
    const gruposPermitidos = allowedSedeIds === null
      ? (gRes.data || [])
      : (gRes.data || []).filter(g => {
          const sedesDelGrupo = todasSedes.filter(s => s.grupo_id === g.id).map(s => s.id)
          return sedesDelGrupo.length > 0 && sedesDelGrupo.every(id => allowedSedeIds.includes(id))
        })
    const personasTerritoriales = allowedSedeIds === null
      ? (pRes.data || [])
      : (pRes.data || []).filter(p => p.sede_ids?.some(id => allowedSedeIds.includes(id)))
    const personasPermitidas = isQualityOnly
      ? personasTerritoriales.filter(p => isQualityTeamPerson(p, perfil))
      : personasTerritoriales
    setPersonas(personasPermitidas)
    setSedes(sedesPermitidas)
    setGrupos(gruposPermitidos)
    setLoading(false)
    hasLoadedOnce.current = true
  }

  // Only re-fetch when auth-relevant fields change, not on every perfil object reference change
  const perfilRol = perfil?.rol
  const perfilGrupoId = perfil?.grupo_id
  const perfilSedeIds = JSON.stringify(perfil?.sede_ids)
  useEffect(() => { load() }, [allowedSedeIds, isQualityOnly, perfilRol, perfilGrupoId, perfilSedeIds])
  useEffect(() => {
    if (focusType === 'candidato' || focusType === 'reclutamiento') {
      setSelectedId(null)
      setTab('reclutamiento')
    } else if (focusId) {
      setSelectedId(focusId)
    }
  }, [focusId, focusType])
  useEffect(() => {
    if (isQualityOnly && selectedId && !loading && !personas.some(p => String(p.id) === String(selectedId))) {
      setSelectedId(null)
    }
  }, [isQualityOnly, selectedId, loading, personas])
  useEffect(() => {
    if (isQualityOnly && !['lista', 'ranking'].includes(tab)) setTab('lista')
  }, [isQualityOnly, tab])

  const filtered = personas.filter(p => {
    if (sedeFilter && (!p.sede_ids || !p.sede_ids.includes(Number(sedeFilter)))) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (p.nombre+' '+(p.apellido||'')+' '+(p.legajo||'')+' '+(p.puesto||'')+' '+(p.area||'')).toLowerCase().includes(q)
  })

  const ranking = [...personas].sort((a,b) => (b.puntos_total||0) - (a.puntos_total||0))

  const RESULTADO_COLOR = { Bajo:'#ff4444', Aceptable:'#f59e0b', Alto:'#3b82f6', Excelente:'#39FF14' }

  if (selectedId && (!isQualityOnly || personas.some(p => String(p.id) === String(selectedId)))) return (
    <div className="h-full flex flex-col overflow-hidden">
      <PersonaFicha personaId={selectedId} sedes={sedes} grupos={grupos} onBack={() => { setSelectedId(null); load() }} />
    </div>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {canManage && showNew && <PersonaModal sedes={sedes} grupos={grupos} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load() }} />}
      {showSolicitud && <SolicitudPersonalModal sedes={sedes} personas={personas} onClose={() => setShowSolicitud(false)} />}

      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex items-center gap-4" style={{ borderBottom:'1px solid rgba(57,255,20,0.1)' }}>
        <Users size={16} style={{ color:'var(--phosphor)', flexShrink:0 }} />
        <div className="flex-1">
          <h1 className="font-title font-bold text-lg" style={{ color:'var(--phosphor)' }}>{isQualityOnly ? 'Equipo Calidad' : 'Equipo'}</h1>
          <p className="font-metric" style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>{personas.length} personas activas</p>
        </div>
        {!isQualityOnly && <button onClick={() => setTab('reclutamiento')} className="btn-ghost flex items-center gap-1.5" style={{ fontSize:'0.72rem' }}>
          <ClipboardList size={12} /> Tablero selección
        </button>}
        {canManage && !isQualityOnly && <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-1.5" style={{ fontSize:'0.72rem' }}>
          <Plus size={12} /> Nueva persona
        </button>}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-0" style={{ borderBottom:'1px solid rgba(57,255,20,0.06)' }}>
        {[
          { label:'PERSONAS', value: personas.length },
          { label:'PUNTAJE PROM.', value: personas.length ? (personas.reduce((s,p)=>s+Math.min(5, p.puntaje_promedio||0),0)/personas.length).toFixed(1) : '—' },
          { label:'LOGROS TOTALES', value: personas.reduce((s,p)=>s+(p.logros_count||0),0) },
          { label:'CON INCIDENTES', value: personas.filter(p=>(p.incidentes||0)>0).length },
        ].map(k => (
          <div key={k.label} className="py-3 px-4 text-center" style={{ borderRight:'1px solid rgba(57,255,20,0.06)' }}>
            <p className="font-title font-bold text-xl" style={{ color:'var(--phosphor)' }}>{k.value}</p>
            <p className="font-metric" style={{ fontSize:'0.6rem', color:'var(--text-dim)', letterSpacing:'0.08em' }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="px-6 py-2 flex items-center gap-4" style={{ borderBottom:'1px solid rgba(57,255,20,0.06)' }}>
        <div className="flex gap-0">
          {[['lista','LISTA'],['ranking','RANKING'],['organigrama','ORGANIGRAMA'],['reclutamiento','SELECCIÓN'],['contactos','CONTACTOS']].map(([id,label]) => (
            <button key={id} onClick={() => { if (isQualityOnly && !['lista','ranking'].includes(id)) return; setTab(id) }}
              className="font-metric px-4 py-1.5"
              style={{ fontSize:'0.6rem', letterSpacing:'0.08em',
                background: tab===id ? 'rgba(57,255,20,0.1)' : 'transparent',
                color: tab===id ? 'var(--phosphor)' : 'var(--text-dim)',
                opacity: isQualityOnly && !['lista','ranking'].includes(id) ? 0.35 : 1,
                borderBottom: tab===id ? '2px solid var(--phosphor)' : '2px solid transparent' }}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'lista' && (
          <div className="flex-1 flex justify-end gap-3">
            <select className="input-dark px-2" value={sedeFilter} onChange={e => setSedeFilter(e.target.value)} style={{ fontSize:'0.75rem', height:30, width:180 }}>
              <option value="">Todas las escalas</option>
              {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
            <div className="relative" style={{ width: 180 }}>
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color:'var(--text-dim)' }} />
              <input className="input-dark w-full pl-7" placeholder="Buscar..." value={search}
                onChange={e => setSearch(e.target.value)} style={{ fontSize:'0.75rem', height:30 }} />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {tab === 'contactos' ? (
          <ContactosTab modulo="rrhh" />
        ) : tab === 'reclutamiento' ? (
          <ReclutamientoBoard
            sedes={sedes}
            canManage={canManage}
            allowedSedeIds={allowedSedeIds}
            focusCandidateId={focusType === 'candidato' ? focusId : null}
            onBack={() => setTab('lista')}
          />
        ) : tab === 'organigrama' ? (
          <OrganigramaView onNavigate={onNavigate} />
        ) : (loading && !hasLoadedOnce.current) ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={20} className="animate-spin" style={{ color:'var(--phosphor)' }} />
          </div>
        ) : tab === 'lista' ? (
          <div className="flex gap-4 h-full overflow-x-auto pb-4" style={{ alignItems: 'flex-start' }}>
            {/* Columnas por Sede */}
            {[{id: 'unassigned', nombre: 'Sin Escala Asignada'}, ...sedes]
              .filter(s => sedeFilter ? s.id === Number(sedeFilter) || (sedeFilter === 'unassigned' && s.id === 'unassigned') : true)
              .map(sede => {
                const isUnassigned = sede.id === 'unassigned'
                const personasSede = filtered.filter(p => isUnassigned ? (!p.sede_ids || p.sede_ids.length === 0) : p.sede_ids?.includes(sede.id))
                
                if (personasSede.length === 0 && isUnassigned) return null // Hide unassigned if empty
                if (personasSede.length === 0 && sedeFilter !== String(sede.id) && sedeFilter !== '') return null // Hide empty ones when filtered

                const avgSede = personasSede.reduce((acc, p) => acc + Math.min(5, p.puntaje_promedio||0), 0) / (personasSede.length || 1)
                const incSede = personasSede.filter(p => (p.incidentes||0) > 0).length

                return (
                  <div key={sede.id} className="flex-shrink-0 flex flex-col gap-3" style={{ width: 320, background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                    {/* Header Columna */}
                    <div className="flex items-center justify-between mb-1" style={{ borderBottom: '1px solid rgba(57,255,20,0.1)', paddingBottom: '8px' }}>
                      <h3 className="font-title font-bold text-sm" style={{ color: 'var(--phosphor)' }}>{sede.nombre}</h3>
                      <span className="font-metric" style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{personasSede.length} pers.</span>
                    </div>
                    {/* KPIs Columna */}
                    {!isUnassigned && personasSede.length > 0 && (
                      <div className="flex justify-between mb-2 px-1">
                        <div className="text-center">
                          <p className="font-title font-bold" style={{ fontSize: '0.85rem', color: 'var(--phosphor)' }}>{avgSede.toFixed(1)}</p>
                          <p className="font-metric" style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>PROM.</p>
                        </div>
                        <div className="text-center">
                          <p className="font-title font-bold" style={{ fontSize: '0.85rem', color: 'var(--phosphor)' }}>{incSede}</p>
                          <p className="font-metric" style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>CON INC.</p>
                        </div>
                      </div>
                    )}
                    {/* Tarjetas */}
                    <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                      {personasSede.map(p => {
                        const score = Math.min(5, p.puntaje_promedio || 0)
                        const evalColor = score ? RESULTADO_COLOR[p.resultado_global] || 'var(--text)' : 'var(--text-dim)'
                        return (
                          <div key={p.id} onClick={() => setSelectedId(p.id)}
                            className="glass p-4 rounded cursor-pointer transition-colors relative group hover:border-phosphor/30"
                            style={{ borderLeft: p.incidentes > 0 ? '2px solid #ff4444' : '2px solid transparent' }}>
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h3 className="font-title font-bold text-base group-hover:text-[var(--phosphor)] transition-colors" style={{ color:'var(--text)' }}>
                                  {p.nombre} {p.apellido}
                                </h3>
                                <p style={{ fontSize:'0.75rem', color:'var(--text-dim)' }}>{p.puesto || 'Sin puesto'}</p>
                              </div>
                              <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color:'var(--phosphor)' }} />
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                              {score ? (
                                <div>
                                  <span className="font-title font-bold text-lg" style={{ color: evalColor }}>{score.toFixed(1)}</span>
                                  <span className="ml-2 font-metric" style={{ fontSize:'0.65rem', color: evalColor }}>{p.resultado_global}</span>
                                </div>
                              ) : (
                                <span className="font-metric" style={{ fontSize:'0.65rem', color:'var(--text-dim)' }}>Sin evaluaciones</span>
                              )}
                              {(p.incidentes > 0) && (
                                <span className="px-2 py-0.5 rounded font-metric" style={{ fontSize:'0.6rem', background:'rgba(255,68,68,0.1)', color:'#ff4444' }}>
                                  {p.incidentes} incidentes
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {personasSede.length === 0 && (
                        <p className="text-center font-metric mt-4" style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Sin personas</p>
                      )}
                    </div>
                  </div>
                )
            })}
          </div>
        ) : (
          // Ranking tab
          <div className="max-w-2xl space-y-2">
            {ranking.map((p, i) => {
              const puntaje = Math.min(5, p.puntaje_promedio || 0)
              const res = puntaje > 0 ? (puntaje < 2 ? 'Bajo' : puntaje < 3 ? 'Aceptable' : puntaje < 4.5 ? 'Alto' : 'Excelente') : null
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`
              return (
                <button key={p.id} onClick={() => setSelectedId(p.id)}
                  className="glass w-full p-3 flex items-center gap-4 text-left"
                  style={{ border: i < 3 ? '1px solid rgba(57,255,20,0.15)' : '1px solid rgba(57,255,20,0.06)', borderRadius:4 }}>
                  <span style={{ fontSize: i<3?'1.3rem':'0.8rem', minWidth:32, textAlign:'center', color:'var(--text-dim)' }}>{medal}</span>
                  <div className="flex-1">
                    <p style={{ fontSize:'0.83rem', color:'var(--text)' }}>{p.nombre} {p.apellido||''}</p>
                    <p style={{ fontSize:'0.65rem', color:'var(--text-dim)' }}>{p.puesto||'—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-title font-bold" style={{ color:'var(--phosphor)', fontSize:'1rem' }}>{p.puntos_total||0}</p>
                    <p style={{ fontSize:'0.6rem', color:'var(--text-dim)' }}>puntos</p>
                  </div>
                  {res && <span className="font-metric" style={{ fontSize:'0.62rem', color: RESULTADO_COLOR[res], minWidth:56, textAlign:'right' }}>{res}</span>}
                  <ChevronRight size={12} style={{ color:'rgba(57,255,20,0.3)' }} />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
