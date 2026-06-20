import { useState } from 'react'
import { isPast, isToday } from 'date-fns'
import { updateTarea } from '../lib/queries'
import { Calendar, User, Plus, X, Check, ChevronDown } from 'lucide-react'
import { ShareButtons, getCategoriaLabel } from './TareaForm'
import { fmtFecha } from '../lib/dateUtils'

const ESTADOS = ['Pendiente','En proceso','Resuelto','Cancelado']

const prioChip = { Alta:'chip chip-red', Media:'chip chip-yellow', Baja:'chip chip-gray' }

const colHeader = {
  Pendiente:   { color:'var(--text-dim)',  bg:'rgba(107,114,128,0.1)' },
  'En proceso':{ color:'#60A5FA',          bg:'rgba(59,130,246,0.08)' },
  Resuelto:    { color:'var(--phosphor)',   bg:'rgba(57,255,20,0.08)'  },
  Cancelado:   { color:'rgba(107,114,128,0.5)', bg:'rgba(107,114,128,0.05)' },
}

function fechaChip(fechaLimite) {
  if (!fechaLimite) return null
  const d = new Date(fechaLimite)
  const label = fmtFecha(fechaLimite)
  if (isPast(d) && !isToday(d)) return <span className="chip chip-red">{label}</span>
  const diff = (d - new Date()) / 86400000
  if (diff < 7) return <span className="chip chip-yellow">{label}</span>
  return <span className="chip chip-gray">{label}</span>
}

function Subtareas({ tareaId, subtareas = [], onUpdate }) {
  const [adding, setAdding] = useState(false)
  const [nuevoTexto, setNuevoTexto] = useState('')
  const [saving, setSaving] = useState(false)

  const list = Array.isArray(subtareas) ? subtareas : []
  const completadas = list.filter(s => s.completada).length

  const save = async (newList) => {
    setSaving(true)
    try {
      await onUpdate(tareaId, { subtareas: newList })
    } finally {
      setSaving(false)
    }
  }

  const toggle = (id) => {
    const newList = list.map(s => s.id === id ? { ...s, completada: !s.completada } : s)
    save(newList)
  }

  const remove = (id) => {
    save(list.filter(s => s.id !== id))
  }

  const add = () => {
    const texto = nuevoTexto.trim()
    if (!texto) return
    const newItem = { id: Date.now().toString(), texto, completada: false }
    save([...list, newItem])
    setNuevoTexto('')
    setAdding(false)
  }

  return (
    <div className="mt-2" style={{ borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:'0.5rem' }}>
      {/* Header con progreso */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-metric" style={{ color:'var(--text-dim)', fontSize:'0.6rem', letterSpacing:'0.08em' }}>
            SUBTAREAS
          </span>
          {list.length > 0 && (
            <span className="font-metric font-bold"
              style={{
                fontSize:'0.6rem',
                color: completadas === list.length ? 'var(--phosphor)' : 'rgba(255,255,255,0.4)',
                background: completadas === list.length ? 'rgba(57,255,20,0.12)' : 'rgba(255,255,255,0.05)',
                padding:'0px 5px', borderRadius:3,
              }}>
              {completadas}/{list.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setAdding(v => !v)}
          style={{ color:'rgba(57,255,20,0.5)', cursor:'pointer', background:'none', border:'none', padding:0, lineHeight:1 }}
          title="Agregar subtarea">
          <Plus size={11} />
        </button>
      </div>

      {/* Lista */}
      {list.map(sub => (
        <div key={sub.id} className="flex items-start gap-1.5 mb-1 group">
          <button
            onClick={() => toggle(sub.id)}
            disabled={saving}
            style={{
              width:14, height:14, borderRadius:3, flexShrink:0, marginTop:1, cursor:'pointer',
              border: sub.completada ? 'none' : '1px solid rgba(255,255,255,0.2)',
              background: sub.completada ? 'var(--phosphor)' : 'transparent',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
            {sub.completada && <Check size={9} style={{ color:'#000' }} />}
          </button>
          <span style={{
            fontSize:'0.68rem',
            color: sub.completada ? 'var(--text-dim)' : 'var(--text)',
            textDecoration: sub.completada ? 'line-through' : 'none',
            flex:1, lineHeight:1.4,
          }}>
            {sub.texto}
          </span>
          <button
            onClick={() => remove(sub.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color:'rgba(255,80,80,0.5)', cursor:'pointer', background:'none', border:'none', padding:0, flexShrink:0 }}>
            <X size={10} />
          </button>
        </div>
      ))}

      {/* Add form */}
      {adding && (
        <div className="flex gap-1 mt-1.5">
          <input
            autoFocus
            value={nuevoTexto}
            onChange={e => setNuevoTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') { setAdding(false); setNuevoTexto('') } }}
            placeholder="Nueva subtarea..."
            className="input-dark flex-1"
            style={{ fontSize:'0.68rem', padding:'0.2rem 0.4rem' }}
          />
          <button onClick={add} className="btn-primary" style={{ fontSize:'0.62rem', padding:'0.2rem 0.5rem' }}>+</button>
          <button onClick={() => { setAdding(false); setNuevoTexto('') }} className="btn-ghost" style={{ fontSize:'0.62rem', padding:'0.2rem 0.4rem' }}>✕</button>
        </div>
      )}

      {/* Empty state hint */}
      {list.length === 0 && !adding && (
        <p style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.2)', fontStyle:'italic' }}>
          Sin subtareas — click + para agregar
        </p>
      )}
    </div>
  )
}

function Intervinientes({ tareaId, intervinientes = [], onUpdate }) {
  const [adding, setAdding] = useState(false)
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)

  const list = Array.isArray(intervinientes) ? intervinientes : []

  const save = async (newList) => {
    setSaving(true)
    try {
      await onUpdate(tareaId, { intervinientes: newList })
    } finally {
      setSaving(false)
    }
  }

  const remove = (id) => save(list.filter(p => p.id !== id))

  const add = () => {
    const n = nombre.trim()
    if (!n) return
    save([...list, { id: Date.now().toString(), nombre: n }])
    setNombre('')
    setAdding(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-metric" style={{ color:'var(--text-dim)', fontSize:'0.6rem', letterSpacing:'0.08em' }}>
          INTERVINIENTES
        </span>
        <button
          onClick={() => setAdding(v => !v)}
          style={{ color:'rgba(57,255,20,0.5)', cursor:'pointer', background:'none', border:'none', padding:0, lineHeight:1 }}
          title="Agregar interviniente">
          <Plus size={11} />
        </button>
      </div>

      {list.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {list.map(p => (
            <span key={p.id} className="flex items-center gap-1" style={{
              fontSize:'0.65rem', color:'var(--text)', background:'rgba(255,255,255,0.05)',
              borderRadius:3, padding:'2px 6px',
            }}>
              <User size={9} style={{ color:'var(--text-dim)' }} />{p.nombre}
              <button onClick={() => remove(p.id)} disabled={saving}
                style={{ color:'rgba(255,80,80,0.5)', cursor:'pointer', background:'none', border:'none', padding:0, marginLeft:2, display:'flex' }}>
                <X size={9} />
              </button>
            </span>
          ))}
        </div>
      )}

      {adding && (
        <div className="flex gap-1 mt-1">
          <input
            autoFocus
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') { setAdding(false); setNombre('') } }}
            placeholder="Nombre..."
            className="input-dark flex-1"
            style={{ fontSize:'0.68rem', padding:'0.2rem 0.4rem' }}
          />
          <button onClick={add} className="btn-primary" style={{ fontSize:'0.62rem', padding:'0.2rem 0.5rem' }}>+</button>
          <button onClick={() => { setAdding(false); setNombre('') }} className="btn-ghost" style={{ fontSize:'0.62rem', padding:'0.2rem 0.4rem' }}>✕</button>
        </div>
      )}

      {list.length === 0 && !adding && (
        <p style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.2)', fontStyle:'italic' }}>
          Sin otros intervinientes — click + para agregar
        </p>
      )}
    </div>
  )
}

function TareaCard({ tarea, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [notas, setNotas]       = useState(tarea.notas_resolucion || '')
  const [saving, setSaving]     = useState(false)

  const changeEstado = async (v) => {
    try { await onUpdate(tarea.id, { estado: v }) }
    catch (e) { alert(e.message) }
  }

  const saveNotas = async () => {
    setSaving(true)
    try { await onUpdate(tarea.id, { notas_resolucion: notas }) }
    finally { setSaving(false) }
  }

  const subtareas = Array.isArray(tarea.subtareas) ? tarea.subtareas : []
  const completadas = subtareas.filter(s => s.completada).length

  return (
    <div className="rounded p-3 fade-in"
      style={{
        background:'var(--surface)',
        border:'1px solid rgba(255,255,255,0.05)',
        opacity: tarea.estado === 'Cancelado' ? 0.45 : 1,
      }}>
      {tarea.registros?.requiere_escalamiento && (
        <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4,
          background:'rgba(255,180,0,0.1)', border:'1px solid rgba(255,180,0,0.25)',
          borderRadius:4, padding:'2px 6px', fontSize:'0.58rem', color:'#FBBF24', fontWeight:700 }}>
          ⚡ ESCALAMIENTO
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs font-medium leading-snug" style={{ color:'var(--text)' }}>{tarea.titulo}</p>
        <div className="flex flex-col items-end gap-1">
          {tarea.prioridad && <span className={prioChip[tarea.prioridad] || 'chip chip-gray'} style={{ flexShrink:0 }}>{tarea.prioridad}</span>}
          {subtareas.length > 0 && (
            <span style={{
              fontSize:'0.55rem', padding:'1px 5px', borderRadius:3, fontWeight:700, flexShrink:0,
              color: completadas === subtareas.length ? 'var(--phosphor)' : 'rgba(255,255,255,0.4)',
              background: completadas === subtareas.length ? 'rgba(57,255,20,0.12)' : 'rgba(255,255,255,0.06)',
            }}>
              ✓ {completadas}/{subtareas.length}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1 mb-2">
        {tarea.sedes?.nombre && (
          <p className="text-xs truncate" style={{ color:'var(--text-dim)', fontSize:'0.68rem' }}>{tarea.sedes.nombre}</p>
        )}
        {tarea.categoria && (
          <span className="chip chip-blue" style={{ fontSize:'0.6rem' }}>
            {getCategoriaLabel(tarea.categoria)}
          </span>
        )}
        {tarea.responsable && (
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1" style={{ color:'var(--text-dim)', fontSize:'0.68rem' }}>
              <User size={10} />{tarea.responsable}
            </div>
            {(tarea.perfiles || tarea.contactos) && (
              <ShareButtons tarea={tarea} responsable={tarea.perfiles || tarea.contactos} compact />
            )}
          </div>
        )}
        {tarea.fecha_limite && (
          <div className="flex items-center gap-1.5">
            <Calendar size={10} style={{ color:'var(--text-dim)' }} />
            {fechaChip(tarea.fecha_limite)}
          </div>
        )}
      </div>

      <select
        value={tarea.estado}
        onChange={e => changeEstado(e.target.value)}
        className="input-dark w-full"
        style={{ fontSize:'0.7rem', padding:'0.3rem 0.5rem' }}>
        {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
      </select>

      {/* Subtareas — siempre visible */}
      <Subtareas
        tareaId={tarea.id}
        subtareas={tarea.subtareas}
        onUpdate={onUpdate}
      />

      {/* Detalle expandible */}
      <button onClick={() => setExpanded(v => !v)}
        className="mt-2 flex items-center gap-1 font-metric text-xs"
        style={{ color:'rgba(57,255,20,0.6)', fontSize:'0.65rem' }}>
        <ChevronDown size={11} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }} />
        {expanded ? 'Ocultar detalle' : 'Ver más detalle'}
      </button>
      {expanded && (
        <div className="mt-2 space-y-2.5 fade-in" style={{ borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:'0.6rem' }}>
          {tarea.descripcion && (
            <p style={{ fontSize:'0.7rem', color:'var(--text-dim)', lineHeight:1.4, whiteSpace:'pre-wrap' }}>
              {tarea.descripcion}
            </p>
          )}
          <Intervinientes tareaId={tarea.id} intervinientes={tarea.intervinientes} onUpdate={onUpdate} />
          <div>
            <span className="font-metric" style={{ color:'var(--text-dim)', fontSize:'0.6rem', letterSpacing:'0.08em' }}>
              NOTAS DE RESOLUCIÓN
            </span>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
              className="input-dark w-full mt-1" style={{ fontSize:'0.75rem', resize:'vertical' }}
              placeholder="Notas de resolución..." />
            <button onClick={saveNotas} disabled={saving} className="btn-primary mt-1.5" style={{ fontSize:'0.65rem', padding:'0.25rem 0.6rem' }}>
              {saving ? 'Guardando...' : 'Guardar notas'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function KanbanBoard({ tareas, onRefresh }) {
  const byEstado = ESTADOS.reduce((acc, e) => {
    acc[e] = tareas.filter(t => t.estado === e)
    return acc
  }, {})

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {ESTADOS.map(estado => {
        const { color, bg } = colHeader[estado]
        return (
          <div key={estado} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-3 py-2 rounded"
              style={{ background:bg, border:`1px solid ${bg.replace('0.', '0.3')}` }}>
              <span className="font-metric font-bold text-xs tracking-wider uppercase" style={{ color }}>{estado}</span>
              <span className="font-metric font-bold text-xs" style={{ color }}>{byEstado[estado].length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {byEstado[estado].map(t => (
                <TareaCard key={t.id} tarea={t} onUpdate={async (id, payload) => {
                  await updateTarea(id, payload)
                  onRefresh?.()
                }} />
              ))}
              {byEstado[estado].length === 0 && (
                <div className="text-center py-6 font-metric text-xs rounded"
                  style={{ border:'1px dashed rgba(107,114,128,0.2)', color:'rgba(107,114,128,0.35)' }}>
                  Sin tareas
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
