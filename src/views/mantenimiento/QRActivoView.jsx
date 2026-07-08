import { useState, useEffect } from 'react'
import { getActivoById, getTickets, createTicket, getSedes, TICKET_TIPOS_VALIDOS } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import AdjuntosPanel from '../../components/AdjuntosPanel'
import { useAuth } from '../../lib/auth'
import { toast } from '../../lib/feedback'
import { mensajeError } from '../../lib/errores'

const ESTADO_COLOR  = { operativo:'#39FF14', en_reparacion:'#F59E0B', baja:'#FF2A2A' }
const TICKET_COLOR  = { abierto:'#F97316', en_progreso:'#3B82F6', aprobado:'#F59E0B', resuelto:'#39FF14', rechazado:'#6B7280' }
const PRIORIDADES   = ['baja','media','alta','critica']
const TIPOS_VISITA  = ['inspeccion','mantenimiento','reparacion','entrega','otro']

function fmtFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCFullYear()).slice(-2)}`
}
function fmtHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function QRActivoView({ activoId, onNavigate }) {
  const { can } = useAuth()
  const canManage = can('mantenimiento', 'manage')
  const canReport = canManage || can('mantenimiento', 'report')
  const [activo, setActivo]   = useState(null)
  const [tickets, setTickets] = useState([])
  const [visitas, setVisitas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showVisitaForm, setShowVisitaForm] = useState(false)
  const [form, setForm] = useState({ tipo:'correctivo', prioridad:'media', descripcion:'' })
  const [visitaForm, setVisitaForm] = useState({ tipo_visita:'inspeccion', visitante:'', observacion:'' })
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [visitando, setVisitando] = useState(false)
  const [visitaOk, setVisitaOk]   = useState(false)
  const set  = (k,v) => setForm(f=>({...f,[k]:v}))
  const setV = (k,v) => setVisitaForm(f=>({...f,[k]:v}))

  useEffect(() => {
    if (!activoId) return
    Promise.all([
      getActivoById(activoId),
      getTickets({ activo_id: activoId }),
      supabase.from('mnt_visitas')
        .select('id,fecha,visitante,tipo_visita,observacion')
        .eq('activo_id', activoId)
        .order('fecha', { ascending: false })
        .limit(5),
    ]).then(([a, t, {data:v}]) => {
      setActivo(a)
      setTickets(t.slice(0, 8))
      setVisitas(v || [])
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [activoId])

  const handleCrearTicket = async () => {
    if (!canReport) return
    if (!form.descripcion.trim()) return
    setSaving(true)
    try {
      await createTicket({
        ...form,
        activo_id:   activo.id,
        sede_id:     activo.sede_id,
        sede:        activo.sede_nombre || activo.sede,
      })
      setSaved(true)
      setShowForm(false)
      getTickets({ activo_id: activo.id }).then(t => setTickets(t.slice(0,8)))
    } catch(e) { toast.error('Error: ' + mensajeError(e)) }
    finally { setSaving(false) }
  }

  const handleRegistrarVisita = async () => {
    if (!canManage) return
    setVisitando(true)
    try {
      const { data, error: err } = await supabase
        .schema('mantenimiento')
        .from('visitas_activo')
        .insert({
          activo_id:   activoId,
          tipo_visita: visitaForm.tipo_visita,
          visitante:   visitaForm.visitante.trim() || null,
          observacion: visitaForm.observacion.trim() || null,
        })
        .select()
        .single()
      if (err) throw err
      setVisitas(v => [data, ...v].slice(0, 5))
      setShowVisitaForm(false)
      setVisitaForm({ tipo_visita:'inspeccion', visitante:'', observacion:'' })
      setVisitaOk(true)
      setTimeout(() => setVisitaOk(false), 3000)
    } catch(e) { toast.error('Error al registrar visita: ' + mensajeError(e)) }
    finally { setVisitando(false) }
  }

  const INPUT = { width:'100%', padding:'0.8rem 1rem', borderRadius:3, background:'#1a1a2e', border:'1px solid rgba(57,255,20,0.1)', color:'#e2e8f0', fontSize:'0.92rem', fontFamily:'monospace', boxSizing:'border-box' }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0A0A0E', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, borderRadius:'50%', border:'2px solid #39FF14', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
    </div>
  )

  if (error || !activo) return (
    <div style={{ minHeight:'100vh', background:'#0A0A0E', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
      <p style={{ color:'#FF2A2A', fontSize:'1rem', marginBottom:'1rem' }}>Activo no encontrado</p>
      <button onClick={()=>onNavigate('mntActivos')} style={{ color:'#39FF14', background:'none', border:'1px solid #39FF14', borderRadius:3, padding:'0.6rem 1.2rem', cursor:'pointer', fontFamily:'monospace' }}>
        ← Volver
      </button>
    </div>
  )

  const estadoColor = ESTADO_COLOR[activo.estado] || '#888'

  return (
    <div style={{ height:'100dvh', overflowY:'auto', WebkitOverflowScrolling:'touch', overscrollBehavior:'contain', background:'#0A0A0E', color:'#e2e8f0', fontFamily:'monospace', padding:'0', width:'100%', maxWidth:480, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ background:'#111118', borderBottom:'1px solid rgba(57,255,20,0.15)', padding:'1rem 1.25rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
        <button onClick={()=>onNavigate('mntActivos')}
          style={{ background:'none', border:'none', color:'#39FF14', cursor:'pointer', fontSize:'1.1rem', padding:0 }}>←</button>
        <div>
          <p style={{ color:'rgba(57,255,20,0.5)', fontSize:'0.55rem', letterSpacing:'0.12em', textTransform:'uppercase' }}>BITÁCORA IN SITU · FK</p>
          <p style={{ color:'#e2e8f0', fontWeight:700, fontSize:'0.9rem' }}>Detalle de Activo</p>
        </div>
      </div>

      {/* Card activo */}
      <div style={{ margin:'1rem', background:'#151520', borderRadius:3, border:'1px solid rgba(57,255,20,0.06)', padding:'1.25rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.75rem' }}>
          <div>
            <p style={{ color:'#e2e8f0', fontWeight:800, fontSize:'1.15rem', lineHeight:1.2 }}>{activo.nombre}</p>
            {activo.codigo_interno && <p style={{ color:'rgba(57,255,20,0.6)', fontSize:'0.68rem', marginTop:3 }}>#{activo.codigo_interno}</p>}
          </div>
          <span style={{ fontSize:'0.65rem', fontWeight:700, padding:'0.25rem 0.6rem', borderRadius:5,
            background:`${estadoColor}22`, color:estadoColor, border:`1px solid ${estadoColor}44`, whiteSpace:'nowrap' }}>
            {activo.estado?.replace('_',' ')}
          </span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
          {[
            ['Tipo',       activo.tipo],
            ['Categoría',  activo.categoria || '—'],
            ['Sede',       activo.sede_nombre || activo.sede || '—'],
            ['Responsable',activo.responsable || '—'],
            ['Marca',      [activo.marca, activo.modelo].filter(Boolean).join(' ') || '—'],
            ['N° Serie',   activo.numero_serie || '—'],
          ].map(([k,v]) => (
            <div key={k}>
              <p style={{ color:'rgba(255,255,255,0.35)', fontSize:'0.55rem', textTransform:'uppercase', letterSpacing:'0.08em' }}>{k}</p>
              <p style={{ color:'#e2e8f0', fontSize:'0.8rem', marginTop:1 }}>{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Feedbacks */}
      {saved && (
        <div style={{ margin:'0 1rem 0.75rem', background:'rgba(57,255,20,0.08)', border:'1px solid rgba(57,255,20,0.3)', borderRadius:3, padding:'0.75rem 1rem' }}>
          <span style={{ color:'#39FF14', fontSize:'0.85rem' }}>✓ Ticket creado correctamente</span>
        </div>
      )}
      {visitaOk && (
        <div style={{ margin:'0 1rem 0.75rem', background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:3, padding:'0.75rem 1rem' }}>
          <span style={{ color:'#3B82F6', fontSize:'0.85rem' }}>✓ Visita registrada</span>
        </div>
      )}

      {/* Botones principales */}
      {!showForm && !showVisitaForm && (
        <div style={{ margin:'0 1rem 1rem', display:'flex', flexDirection:'column', gap:'0.6rem' }}>
          <div style={{ display:'flex', gap:'0.6rem' }}>
            {canManage && <button onClick={()=>{ setShowVisitaForm(true); setSaved(false); setVisitaOk(false) }}
              style={{ flex:1, background:'#3B82F6', color:'#fff', border:'none', borderRadius:3, padding:'0.85rem', fontWeight:800, fontSize:'0.9rem', cursor:'pointer', fontFamily:'monospace' }}>
              📋 Registrar Visita
            </button>}
            {canReport && <button onClick={()=>{ setShowForm(true); setSaved(false) }}
              style={{ flex:1, background:'#39FF14', color:'#0A0A0E', border:'none', borderRadius:3, padding:'0.85rem', fontWeight:800, fontSize:'0.9rem', cursor:'pointer', fontFamily:'monospace' }}>
              + Nuevo Ticket
            </button>}
          </div>
          <button onClick={()=>onNavigate('mntTickets')}
            style={{ background:'#151520', color:'#e2e8f0', border:'1px solid rgba(57,255,20,0.08)', borderRadius:3, padding:'0.75rem', fontWeight:600, fontSize:'0.85rem', cursor:'pointer', fontFamily:'monospace' }}>
            Ver todos los tickets
          </button>
        </div>
      )}

      {/* Manuales y documentos del activo */}
      <div style={{ margin:'0 1rem 1rem', background:'#151520', borderRadius:3, border:'1px solid rgba(96,165,250,0.12)', padding:'1rem' }}>
        <p style={{ color:'#60A5FA', fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.65rem' }}>Manuales y documentos</p>
        {activo.manual_url && (
          <a href={activo.manual_url} target="_blank" rel="noreferrer"
            style={{ display:'block', color:'#60A5FA', fontSize:'0.8rem', marginBottom:'0.7rem', textDecoration:'none' }}>
            ↗ Abrir manual principal
          </a>
        )}
        <AdjuntosPanel entityType="activo" entityId={activo.id} compact readOnly={!canManage} />
      </div>

      {/* Formulario registrar visita */}
      {canManage && showVisitaForm && (
        <div style={{ margin:'0 1rem 1rem', background:'#151520', borderRadius:3, border:'1px solid rgba(59,130,246,0.2)', padding:'1.25rem' }}>
          <p style={{ color:'#3B82F6', fontWeight:700, marginBottom:'1rem', fontSize:'0.9rem' }}>📋 Registrar Visita — {activo.nombre}</p>
          <div style={{ marginBottom:'0.85rem' }}>
            <label style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.58rem', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.4rem' }}>Tipo de visita</label>
            <select value={visitaForm.tipo_visita} onChange={e=>setV('tipo_visita',e.target.value)} style={INPUT}>
              {TIPOS_VISITA.map(t=><option key={t} value={t} style={{ background:'#1a1a2e' }}>{t}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:'0.85rem' }}>
            <label style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.58rem', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.4rem' }}>Tu nombre (opcional)</label>
            <input value={visitaForm.visitante} onChange={e=>setV('visitante',e.target.value)}
              placeholder="Nombre del visitante..." style={INPUT} />
          </div>
          <div style={{ marginBottom:'1rem' }}>
            <label style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.58rem', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.4rem' }}>Observación (opcional)</label>
            <textarea value={visitaForm.observacion} onChange={e=>setV('observacion',e.target.value)}
              rows={3} placeholder="Notas de la visita..."
              style={{ ...INPUT, resize:'none' }} />
          </div>
          <div style={{ display:'flex', gap:'0.6rem' }}>
            <button onClick={()=>setShowVisitaForm(false)}
              style={{ flex:1, background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.5)', border:'1px solid rgba(57,255,20,0.07)', borderRadius:3, padding:'0.75rem', cursor:'pointer', fontFamily:'monospace' }}>
              Cancelar
            </button>
            <button onClick={handleRegistrarVisita} disabled={visitando}
              style={{ flex:2, background: visitando ? 'rgba(59,130,246,0.3)' : '#3B82F6', color:'#fff', border:'none', borderRadius:3, padding:'0.75rem', fontWeight:800, cursor:'pointer', fontFamily:'monospace' }}>
              {visitando ? 'Registrando...' : 'Confirmar Visita'}
            </button>
          </div>
        </div>
      )}

      {/* Formulario nuevo ticket */}
      {canReport && showForm && (
        <div style={{ margin:'0 1rem 1rem', background:'#151520', borderRadius:3, border:'1px solid rgba(57,255,20,0.06)', padding:'1.25rem' }}>
          <p style={{ color:'#e2e8f0', fontWeight:700, marginBottom:'1rem' }}>Nuevo Ticket — {activo.nombre}</p>
          <div style={{ marginBottom:'0.85rem' }}>
            <label style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.58rem', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.4rem' }}>Tipo</label>
            <select value={form.tipo} onChange={e=>set('tipo',e.target.value)} style={INPUT}>
              {TICKET_TIPOS_VALIDOS.map(t=><option key={t} value={t} style={{ background:'#1a1a2e' }}>{t}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:'0.85rem' }}>
            <label style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.58rem', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.4rem' }}>Prioridad</label>
            <select value={form.prioridad} onChange={e=>set('prioridad',e.target.value)} style={INPUT}>
              {PRIORIDADES.map(p=><option key={p} value={p} style={{ background:'#1a1a2e' }}>{p}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:'1rem' }}>
            <label style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.58rem', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:'0.4rem' }}>Descripción del problema *</label>
            <textarea value={form.descripcion} onChange={e=>set('descripcion',e.target.value)}
              rows={4} placeholder="Ej: La heladera no enfría correctamente"
              style={{ ...INPUT, resize:'none' }} required />
          </div>
          <div style={{ display:'flex', gap:'0.6rem' }}>
            <button onClick={()=>setShowForm(false)}
              style={{ flex:1, background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.5)', border:'1px solid rgba(57,255,20,0.07)', borderRadius:3, padding:'0.75rem', cursor:'pointer', fontFamily:'monospace' }}>
              Cancelar
            </button>
            <button onClick={handleCrearTicket} disabled={saving || !form.descripcion.trim()}
              style={{ flex:2, background: saving||!form.descripcion.trim() ? 'rgba(57,255,20,0.3)' : '#39FF14', color:'#0A0A0E', border:'none', borderRadius:3, padding:'0.75rem', fontWeight:800, cursor:'pointer', fontFamily:'monospace' }}>
              {saving ? 'Guardando...' : 'Crear Ticket'}
            </button>
          </div>
        </div>
      )}

      {/* Últimas visitas */}
      {visitas.length > 0 && (
        <div style={{ margin:'0 1rem 1rem' }}>
          <p style={{ color:'rgba(59,130,246,0.6)', fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.6rem' }}>
            Últimas visitas ({visitas.length})
          </p>
          {visitas.map(v => (
            <div key={v.id} style={{ background:'rgba(59,130,246,0.04)', borderRadius:3, padding:'0.7rem 0.85rem', marginBottom:'0.4rem', border:'1px solid rgba(59,130,246,0.1)', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <p style={{ color:'#e2e8f0', fontSize:'0.78rem', fontWeight:600 }}>{v.tipo_visita}</p>
                {v.visitante && <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.65rem', marginTop:2 }}>{v.visitante}</p>}
                {v.observacion && <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'0.62rem', marginTop:2, fontStyle:'italic' }}>{v.observacion.slice(0,60)}</p>}
              </div>
              <div style={{ textAlign:'right', flexShrink:0, marginLeft:8 }}>
                <p style={{ color:'rgba(59,130,246,0.7)', fontSize:'0.62rem' }}>{fmtFecha(v.fecha)}</p>
                <p style={{ color:'rgba(59,130,246,0.4)', fontSize:'0.58rem' }}>{fmtHora(v.fecha)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Historial de tickets */}
      <div style={{ margin:'0 1rem 2rem' }}>
        <p style={{ color:'rgba(255,255,255,0.35)', fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.6rem' }}>
          Historial de tickets ({tickets.length})
        </p>
        {tickets.length === 0 ? (
          <p style={{ color:'rgba(255,255,255,0.25)', fontSize:'0.8rem', textAlign:'center', padding:'1.5rem' }}>Sin tickets registrados</p>
        ) : tickets.map(t => (
          <div key={t.id} style={{ background:'#151520', borderRadius:3, padding:'0.85rem', marginBottom:'0.5rem', border:'1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.3rem' }}>
              <p style={{ color:'#e2e8f0', fontSize:'0.82rem', fontWeight:600, flex:1, marginRight:8 }}>{t.titulo||t.descripcion?.slice(0,50)||'Sin título'}</p>
              <span style={{ fontSize:'0.6rem', fontWeight:700, padding:'0.15rem 0.4rem', borderRadius:4, whiteSpace:'nowrap',
                background:`${TICKET_COLOR[t.estado]||'#555'}22`, color:TICKET_COLOR[t.estado]||'#555' }}>
                {t.estado}
              </span>
            </div>
            <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'0.65rem' }}>{fmtFecha(t.created_at)} · {t.tipo} · {t.prioridad}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
