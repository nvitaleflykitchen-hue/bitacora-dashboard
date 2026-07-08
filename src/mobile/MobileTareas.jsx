import { useState, useEffect, useCallback } from 'react'
import { getMisTareas, getTareas, updateTarea } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { getCategoriaLabel } from '../components/TareaForm'
import { nextTaskState, TASK_STATE_LABELS, TASK_STATES } from '../lib/operationalDomains'
import { canSeeQualityTask, isQualityOnlyProfile } from '../lib/access'
import { ChevronDown, Check, X, Plus, User } from 'lucide-react'
import ComentariosHilo from '../components/ComentariosHilo'

import { URGENCIA_COLOR as PRIORIDAD_COLOR } from '../lib/estados'
import SkeletonTable from '../components/SkeletonTable'

function SubtareasMobile({ tareaId, subtareas = [], onUpdate, readOnly }) {
  const [adding, setAdding] = useState(false)
  const [nuevoTexto, setNuevoTexto] = useState('')
  const [saving, setSaving] = useState(false)

  const list = Array.isArray(subtareas) ? subtareas : []
  const completadas = list.filter(s => s.completada).length

  const save = async (newList) => {
    setSaving(true)
    try { await onUpdate(tareaId, { subtareas: newList }) }
    finally { setSaving(false) }
  }

  const toggle = (id) => save(list.map(s => s.id === id ? { ...s, completada: !s.completada } : s))
  const remove = (id) => save(list.filter(s => s.id !== id))
  const add = () => {
    const texto = nuevoTexto.trim()
    if (!texto) return
    save([...list, { id: Date.now().toString(), texto, completada: false }])
    setNuevoTexto(''); setAdding(false)
  }

  return (
    <div className="mt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.6rem' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-metric" style={{ color: 'var(--text-dim)', fontSize: '0.65rem', letterSpacing: '0.08em' }}>SUBTAREAS</span>
          {list.length > 0 && (
            <span className="font-metric font-bold" style={{ fontSize: '0.65rem', color: completadas === list.length ? 'var(--phosphor)' : 'rgba(255,255,255,0.4)', background: completadas === list.length ? 'rgba(57,255,20,0.12)' : 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 4 }}>
              {completadas}/{list.length}
            </span>
          )}
        </div>
        {!readOnly && (
          <button onClick={() => setAdding(v => !v)} style={{ color: 'var(--phosphor)', background: 'none', border: 'none', padding: '0.2rem' }}>
            <Plus size={14} />
          </button>
        )}
      </div>

      {list.map(sub => (
        <div key={sub.id} className="flex items-start gap-2 mb-2">
          <button onClick={() => toggle(sub.id)} disabled={saving || readOnly}
            style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2, border: sub.completada ? 'none' : '1px solid rgba(255,255,255,0.3)', background: sub.completada ? 'var(--phosphor)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {sub.completada && <Check size={12} style={{ color: '#000' }} />}
          </button>
          <span style={{ fontSize: '0.75rem', color: sub.completada ? 'var(--text-dim)' : 'var(--text)', textDecoration: sub.completada ? 'line-through' : 'none', flex: 1, lineHeight: 1.4 }}>
            {sub.texto}
          </span>
          {!readOnly && (
            <button onClick={() => remove(sub.id)} style={{ color: 'rgba(255,80,80,0.7)', background: 'none', border: 'none', padding: '0.1rem', flexShrink: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>
      ))}

      {!readOnly && adding && (
        <div className="flex gap-2 mt-2">
          <input autoFocus value={nuevoTexto} onChange={e => setNuevoTexto(e.target.value)} placeholder="Nueva subtarea..." className="input-dark flex-1" style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }} />
          <button onClick={add} className="btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>+</button>
        </div>
      )}
      {list.length === 0 && !adding && <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Sin subtareas</p>}
    </div>
  )
}

function IntervinientesMobile({ tareaId, intervinientes = [], onUpdate, readOnly }) {
  const [adding, setAdding] = useState(false)
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)

  const list = Array.isArray(intervinientes) ? intervinientes : []
  const save = async (newList) => {
    setSaving(true)
    try { await onUpdate(tareaId, { intervinientes: newList }) }
    finally { setSaving(false) }
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-metric" style={{ color: 'var(--text-dim)', fontSize: '0.65rem', letterSpacing: '0.08em' }}>INTERVINIENTES</span>
        {!readOnly && (
          <button onClick={() => setAdding(v => !v)} style={{ color: 'var(--phosphor)', background: 'none', border: 'none', padding: '0.2rem' }}>
            <Plus size={14} />
          </button>
        )}
      </div>
      {list.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {list.map(p => (
            <span key={p.id} className="flex items-center gap-1" style={{ fontSize: '0.7rem', color: 'var(--text)', background: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: '3px 8px' }}>
              <User size={12} style={{ color: 'var(--text-dim)' }} />{p.nombre}
              {!readOnly && <button onClick={() => save(list.filter(x => x.id !== p.id))} disabled={saving} style={{ color: 'rgba(255,80,80,0.7)', background: 'none', border: 'none', marginLeft: 4 }}><X size={10} /></button>}
            </span>
          ))}
        </div>
      )}
      {!readOnly && adding && (
        <div className="flex gap-2 mt-2">
          <input autoFocus value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre..." className="input-dark flex-1" style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }} />
          <button onClick={() => { if (nombre.trim()) save([...list, { id: Date.now().toString(), nombre: nombre.trim() }]); setNombre(''); setAdding(false) }} className="btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>+</button>
        </div>
      )}
    </div>
  )
}

function MobileTareaCard({ t, canManage, onAvanzar, onUpdate, updating }) {
  const [expanded, setExpanded] = useState(false)
  const [notas, setNotas] = useState(t.notas_resolucion || '')
  const [savingNotas, setSavingNotas] = useState(false)

  const handleSaveNotas = async () => {
    setSavingNotas(true)
    try { await onUpdate(t.id, { notas_resolucion: notas }) }
    finally { setSavingNotas(false) }
  }

  const subtareas = Array.isArray(t.subtareas) ? t.subtareas : []
  const completadas = subtareas.filter(s => s.completada).length

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 10, padding: '1rem',
      marginBottom: '0.75rem',
      borderLeft: `3px solid ${PRIORIDAD_COLOR[String(t.prioridad).toLowerCase()] || '#555'}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.95rem', flex: 1, marginRight: '0.5rem', lineHeight: 1.3 }}>
          {t.titulo}
        </p>
        <div className="flex flex-col items-end gap-1">
          <span style={{
            fontSize: '0.65rem', padding: '0.2rem 0.45rem', borderRadius: 4,
            background: `${PRIORIDAD_COLOR[String(t.prioridad).toLowerCase()] || '#777'}22`,
            color: PRIORIDAD_COLOR[String(t.prioridad).toLowerCase()] || '#999', fontWeight: 700, whiteSpace: 'nowrap'
          }}>
            {t.prioridad?.toUpperCase()}
          </span>
          {subtareas.length > 0 && (
            <span style={{
              fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: 4, fontWeight: 700,
              color: completadas === subtareas.length ? 'var(--phosphor)' : 'rgba(255,255,255,0.4)',
              background: completadas === subtareas.length ? 'rgba(57,255,20,0.12)' : 'rgba(255,255,255,0.06)',
            }}>
              ✓ {completadas}/{subtareas.length}
            </span>
          )}
        </div>
      </div>

      <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
        {t.sedes?.nombre || '—'} {t.categoria ? '· ' + getCategoriaLabel(t.categoria) : ''}
      </p>

      {/* Acciones principales rápidas */}
      {canManage && !['Resuelto','Cancelado'].includes(t.estado) && <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button onClick={() => onAvanzar(t)}
          disabled={updating === t.id}
          style={{
            flex: 1, padding: '0.5rem', borderRadius: 6, fontSize: '0.75rem',
            fontWeight: 700, cursor: 'pointer',
            background: 'rgba(57,255,20,0.08)',
            color: 'var(--phosphor)',
            border: '1px solid rgba(57,255,20,0.2)',
          }}>
          {updating === t.id ? 'Actualizando…' : t.estado === 'Pendiente' ? 'Iniciar tarea' : 'Marcar resuelta'}
        </button>
      </div>}
      
      <div className="flex items-center justify-between">
        <p style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>Estado: {TASK_STATE_LABELS[t.estado] || t.estado}</p>
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 font-metric" style={{ color: 'var(--phosphor)', fontSize: '0.7rem', background: 'none', border: 'none' }}>
          {expanded ? 'Menos info' : 'Ver detalle'} <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
          {t.descripcion && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: '0.5rem' }}>
              {t.descripcion}
            </p>
          )}

          <select
            value={t.estado}
            onChange={e => onUpdate(t.id, { estado: e.target.value })}
            disabled={!canManage}
            className="input-dark w-full mb-2"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}>
            {TASK_STATES.map(e => <option key={e} value={e}>{TASK_STATE_LABELS[e] || e}</option>)}
          </select>

          <SubtareasMobile tareaId={t.id} subtareas={t.subtareas} onUpdate={onUpdate} readOnly={!canManage} />
          
          <IntervinientesMobile tareaId={t.id} intervinientes={t.intervinientes} onUpdate={onUpdate} readOnly={!canManage} />

          <div className="mt-3">
            <span className="font-metric block mb-1" style={{ color: 'var(--text-dim)', fontSize: '0.65rem', letterSpacing: '0.08em' }}>NOTAS DE RESOLUCIÓN</span>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} disabled={!canManage} className="input-dark w-full" rows={3} style={{ fontSize: '0.8rem', padding: '0.5rem' }} placeholder="Agregar notas..." />
            {canManage && (
              <button onClick={handleSaveNotas} disabled={savingNotas} className="btn-primary mt-2 w-full" style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
                {savingNotas ? 'Guardando...' : 'Guardar notas'}
              </button>
            )}
          </div>

          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <ComentariosHilo entidadTipo="tarea" entidadId={t.id} compact />
          </div>
        </div>
      )}
    </div>
  )
}

export default function MobileTareas() {
  const { perfil, can } = useAuth()
  const isQualityOnly = isQualityOnlyProfile(perfil)
  const canManage = can('tareas', 'manage')
  const [tareas, setTareas] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    if (!perfil) return
    setLoading(true)
    const query = isQualityOnly
      ? getTareas({ incluirResueltas: false }).then(items => items.filter(t => canSeeQualityTask(t, perfil)))
      : getMisTareas(perfil.id)
    query
      .then(setTareas)
      .finally(() => setLoading(false))
  }, [perfil, isQualityOnly])

  useEffect(() => { load() }, [load])

  const avanzarEstado = async (tarea) => {
    const next = nextTaskState(tarea.estado)
    if (next === tarea.estado) return
    setError('')
    setUpdating(tarea.id)
    try {
      await updateTarea(tarea.id, { estado: next })
      load()
    } catch (e) {
      setError(e.message || 'No se pudo actualizar la tarea.')
    } finally {
      setUpdating(null)
    }
  }

  const handleUpdate = async (id, payload) => {
    await updateTarea(id, payload)
    // Actualización local rápida
    setTareas(prev => prev.map(t => t.id === id ? { ...t, ...payload } : t))
  }

  return (
    <div className="mobile-scroll" style={{ padding: '1.25rem 1rem 1rem', height: '100%' }}>
      <h1 style={{ color: 'var(--text)', fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.25rem' }}>
        Mis Tareas
      </h1>

      {error && <div role="alert" style={{ background:'rgba(255,42,42,.08)', border:'1px solid rgba(255,42,42,.25)', color:'#FF5050', borderRadius:8, padding:'.7rem .8rem', marginBottom:'.75rem', fontSize:'.75rem' }}>{error}</div>}

      {loading ? (
          <SkeletonTable filas={6} columnas={2} />
      ) : tareas.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--phosphor)', fontSize: '2rem', marginBottom: '0.5rem' }}>OK</p>
          <p style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Sin tareas pendientes</p>
        </div>
      ) : tareas.map(t => (
        <MobileTareaCard key={t.id} t={t} canManage={canManage} onAvanzar={avanzarEstado} onUpdate={handleUpdate} updating={updating} />
      ))}
    </div>
  )
}
