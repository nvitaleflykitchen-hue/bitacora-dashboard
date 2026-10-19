import { useState } from 'react'

const STATES = {
  borrador: ['Borrador', '#94a3b8', 'Completar y difundir la búsqueda'],
  enviada_whatsapp: ['Enviada a WhatsApp', '#38bdf8', 'Revisar los CV recibidos'],
  recibiendo_cvs: ['Recibiendo CVs', '#60a5fa', 'Preseleccionar candidatos'],
  entrevistas: ['Entrevistas', '#c084fc', 'Coordinar y registrar entrevistas'],
  preocupacional: ['Preocupacional', '#fbbf24', 'Confirmar turno y resultado'],
  ingreso: ['Ingreso', '#4ade80', 'Confirmar ingreso e inducción'],
}
const PRIORITIES = { Alta: ['#fb923c', 0], Media: ['#facc15', 1], Baja: ['#94a3b8', 2] }

// Calendar days in the business timezone, unaffected by the viewer's timezone or DST.
export function openDays(value, now = new Date()) {
  if (!value) return null
  const date = String(value).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const start = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== date) return null
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = type => parts.find(p => p.type === type).value
  const today = Date.parse(`${get('year')}-${get('month')}-${get('day')}T00:00:00Z`)
  return Math.floor((today - start) / 86400000)
}

export function candidatesForRequest(id, candidates, links) {
  return candidates.filter(c => c.solicitud_id === id || links.get(c.id)?.has(id))
}

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const badge = color => ({ color, border: `1px solid ${color}80`, background: `${color}15`, borderRadius: 6, padding: '3px 8px', fontSize: 12 })

export default function SolicitudesActivas({ solicitudes, candidatos, linksByCandidate, canManage, onEdit, onAdd, onFollow, selectedId, loading }) {
  const [query, setQuery] = useState('')
  const [sede, setSede] = useState('')
  const [estado, setEstado] = useState('')
  const [urgencia, setUrgencia] = useState('')
  const [order, setOrder] = useState('priority')
  const sedes = [...new Map(solicitudes.map(s => [String(s.sede_id), s.sede_nombre || 'Sin sede'])).entries()]
  const rows = solicitudes.filter(s => (!sede || String(s.sede_id) === sede) && (!estado || s.estado === estado) && (!urgencia || s.urgencia === urgencia) && normalize(`${s.puesto} ${s.sede_nombre} ${s.responsable}`).includes(normalize(query.trim())))
    .sort((a, b) => {
      const priority = (PRIORITIES[a.urgencia]?.[1] ?? 3) - (PRIORITIES[b.urgencia]?.[1] ?? 3)
      const age = (openDays(b.fecha_apertura) ?? -Infinity) - (openDays(a.fecha_apertura) ?? -Infinity)
      return (order === 'priority' ? priority || age : age || priority) || String(a.id).localeCompare(String(b.id))
    })
  return <section className="glass p-3 space-y-3" aria-label="Solicitudes activas">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-title font-bold" style={{ color: 'var(--phosphor)' }}>Solicitudes activas <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>({rows.length} de {solicitudes.length})</span></h3>
      <label className="text-xs">Ordenar por <select className="input-dark ml-2" value={order} onChange={e => setOrder(e.target.value)}><option value="priority">Urgencia y antigüedad</option><option value="age">Más antiguas</option></select></label>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
      <input aria-label="Buscar solicitud" className="input-dark w-full" placeholder="Buscar puesto o responsable…" value={query} onChange={e => setQuery(e.target.value)} />
      <select aria-label="Filtrar sede" className="input-dark w-full" value={sede} onChange={e => setSede(e.target.value)}><option value="">Todas las sedes</option>{sedes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <select aria-label="Filtrar estado" className="input-dark w-full" value={estado} onChange={e => setEstado(e.target.value)}><option value="">Todos los estados</option>{Object.entries(STATES).map(([id, [label]]) => <option key={id} value={id}>{label}</option>)}</select>
      <select aria-label="Filtrar urgencia" className="input-dark w-full" value={urgencia} onChange={e => setUrgencia(e.target.value)}><option value="">Todas las urgencias</option>{Object.keys(PRIORITIES).map(p => <option key={p}>{p}</option>)}</select>
    </div>
    <p className="text-xs" style={{ color: 'var(--text-dim)' }}>La franja indica urgencia; la etiqueta indica la etapa. Los días se cuentan desde la apertura.</p>
    <div className="space-y-2">
      {rows.map(s => {
        const [label, color, next] = STATES[s.estado] || [s.estado || 'Sin estado', '#94a3b8', 'Revisar seguimiento']
        const priorityColor = PRIORITIES[s.urgencia]?.[0] || '#94a3b8'
        const days = openDays(s.fecha_apertura)
        const candidates = candidatesForRequest(s.id, candidatos, linksByCandidate)
        const count = state => candidates.filter(c => c.estado === state).length
        return <article key={s.id} className="p-3 grid grid-cols-1 xl:grid-cols-3 gap-3" style={{ border: '1px solid var(--border, #34343b)', borderLeft: `4px solid ${priorityColor}`, background: selectedId === s.id ? 'rgba(57,255,20,0.04)' : 'rgba(255,255,255,0.02)' }}>
          <div className="min-w-0">
            <h4 className="font-title font-bold break-words" style={{ color: 'var(--text)' }}>{s.puesto}</h4>
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>{s.sede_nombre || 'Sin sede'}</p>
            <div className="flex flex-wrap gap-2 mt-2"><span style={badge(priorityColor)}>Urgencia {s.urgencia || 'sin definir'}</span><span style={badge(color)}>{label}</span></div>
          </div>
          <div className="text-sm space-y-1" style={{ color: 'var(--text-dim)' }}>
            <p style={{ color: 'var(--text)', fontWeight: 700 }}>{days === null ? 'Sin fecha de apertura' : days < 0 ? 'Apertura futura' : `${days} ${days === 1 ? 'día abierta' : 'días abierta'}`}</p>
            <p>Responsable: {s.responsable || 'Sin asignar'}</p>
            <p>Próximo paso sugerido: {next}</p>
          </div>
          <div className="text-xs space-y-2" style={{ color: 'var(--text-dim)' }}>
            <p>{candidates.length} candidatos vinculados · {count('cv_recibido')} CV recibidos · {count('entrevista')} entrevistas · {count('preocupacional')} preocupacionales</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => onFollow(s.id)} aria-pressed={selectedId === s.id}>Ver seguimiento</button>
              {canManage && <><button className="btn-primary" onClick={() => onAdd(s)}>+ Candidato / CV</button><button className="btn-ghost" onClick={() => onEdit(s)}>Editar</button></>}
            </div>
          </div>
        </article>
      })}
      {!rows.length && <p className="text-sm" style={{ color: 'var(--text-dim)' }}>{loading ? 'Cargando solicitudes…' : solicitudes.length ? 'No hay solicitudes que coincidan con los filtros.' : 'No hay solicitudes abiertas.'}</p>}
    </div>
  </section>
}
