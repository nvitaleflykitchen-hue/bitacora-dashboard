import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, BatteryMedium, CheckCircle2, Clock3, RefreshCw, UserRoundCheck } from 'lucide-react'
import { getCapa, getTareas } from '../lib/queries'
import { isGestionProjectAction } from '../lib/gestionProjects'
import { useAuth } from '../lib/auth'
import { isOwnTask } from '../lib/access'
import { fmtFecha } from '../lib/dateUtils'

const PRIORIDAD = { Alta: 30, Media: 20, Baja: 10 }
const ABIERTAS = new Set(['Pendiente', 'En proceso'])

function ordenar(a, b) {
  const prioridad = (PRIORIDAD[b.prioridad] || 0) - (PRIORIDAD[a.prioridad] || 0)
  if (prioridad) return prioridad
  if (!a.fecha_limite) return 1
  if (!b.fecha_limite) return -1
  return String(a.fecha_limite).localeCompare(String(b.fecha_limite))
}

function TareaBreve({ tarea, accent = 'var(--phosphor)', onOpen }) {
  if (!tarea) return <p style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>Sin asuntos pendientes.</p>
  const vencida = tarea.fecha_limite && new Date(tarea.fecha_limite) < new Date(new Date().toDateString())
  return (
    <button type="button" onClick={onOpen} className="w-full text-left" style={{ background:'none', border:'none', padding:0 }}>
      <p style={{ color:'var(--text)', fontWeight:700, fontSize:'0.8rem' }}>{tarea._module && <span style={{ color:accent, marginRight:5 }}>{tarea._module} ·</span>}{tarea.titulo}</p>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <span className="font-metric" style={{ color:accent, fontSize:'0.6rem' }}>{tarea.prioridad || 'Media'}</span>
        {tarea.fecha_limite && <span style={{ color:vencida ? '#ff5555' : 'var(--text-dim)', fontSize:'0.65rem' }}>{vencida ? 'Vencida · ' : ''}{fmtFecha(tarea.fecha_limite)}</span>}
        {(tarea.perfiles?.nombre || tarea.responsable) && <span style={{ color:'var(--text-dim)', fontSize:'0.65rem' }}>· {tarea.perfiles?.nombre || tarea.responsable}</span>}
      </div>
    </button>
  )
}

export default function MiGestionPanel({ onNavigate }) {
  const { user, perfil, allowedSedeIds, rol } = useAuth()
  const [tareas, setTareas] = useState([])
  const [loading, setLoading] = useState(true)
  const [energy, setEnergy] = useState(() => Number(localStorage.getItem(`mi-gestion-energy-${user?.id}`)) || 0)

  const visible = ['admin','editor','grupo','encargado'].includes(rol)

  const load = async () => {
    setLoading(true)
    try {
      const [tareasData, capasData] = await Promise.all([
        getTareas({ sedeIds: allowedSedeIds || undefined, incluirResueltas:true }),
        getCapa({ sedeIds: allowedSedeIds || undefined }),
      ])
      const capasComoTareas = (capasData || []).map(c => ({
        ...c,
        titulo:c.descripcion,
        responsable:c.perfiles?.nombre || c.responsable,
        prioridad:c.prioridad || 'Media',
        estado:['Completada','Verificada'].includes(c.estado) ? 'Resuelto' : (c.estado === 'En ejecución' ? 'En proceso' : c.estado),
        _module:isGestionProjectAction(c) ? 'PROYECTO' : 'CAPA',
        _target:isGestionProjectAction(c) ? 'proyectosGestion' : 'capa',
      }))
      setTareas([...(tareasData || []), ...capasComoTareas])
    } catch (error) {
      console.error('Mi Gestión:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (visible) load() }, [visible, allowedSedeIds])
  useEffect(() => {
    if (!user?.id) return
    setEnergy(Number(localStorage.getItem(`mi-gestion-energy-${user.id}`)) || 0)
  }, [user?.id])

  const data = useMemo(() => {
    const abiertas = tareas.filter(t => ABIERTAS.has(t.estado))
    const propias = abiertas.filter(t => isOwnTask(t, perfil)).sort(ordenar)
    const creadas = abiertas.filter(t => t.creado_por === user?.id && !isOwnTask(t, perfil))
    const esperando = creadas.filter(t => t.contacto_id).sort(ordenar)
    const delegadas = creadas.filter(t => !t.contacto_id).sort(ordenar)
    const sinResponsable = abiertas.filter(t => !t.responsable_id && !t.responsable).sort(ordenar)
    const hoy = new Date()
    const hace7 = new Date(hoy); hace7.setDate(hoy.getDate() - 7)
    const cerradasSemana = tareas.filter(t => t.estado === 'Resuelto' && new Date(t.updated_at || t.created_at) >= hace7).length
    const vencidas = abiertas.filter(t => t.fecha_limite && new Date(t.fecha_limite) < new Date(new Date().toDateString())).length
    return {
      critica: propias[0],
      importantes: propias.slice(1, 3),
      paraDelegar: sinResponsable[0],
      propias, delegadas, esperando, cerradasSemana, vencidas,
    }
  }, [tareas, perfil, user?.id])

  if (!visible) return null
  const open = item => onNavigate(item?._target || 'tareas')
  const setEnergia = value => {
    setEnergy(value)
    localStorage.setItem(`mi-gestion-energy-${user?.id}`, String(value))
  }

  return (
    <section className="px-4 md:px-6 pb-5">
      <div className="glass rounded p-4" style={{ border:'1px solid rgba(57,255,20,0.16)' }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="font-metric" style={{ color:'var(--phosphor)', fontSize:'0.68rem', letterSpacing:'0.08em' }}>MI GESTIÓN · NICOLÁS 2.0</p>
            <h2 className="font-title font-bold mt-1" style={{ color:'var(--text)', fontSize:'1.05rem' }}>Sala de control de hoy</h2>
            <p style={{ color:'var(--text-dim)', fontSize:'0.72rem', marginTop:3 }}>Claridad sobre urgencia · delegación sobre absorción</p>
          </div>
          <button type="button" className="btn-ghost flex items-center gap-1" onClick={load} disabled={loading}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 mt-4">
          <div className="p-3 rounded" style={{ background:'rgba(255,70,70,0.06)', border:'1px solid rgba(255,70,70,0.15)' }}>
            <div className="flex items-center gap-2 mb-2"><AlertTriangle size={14} color="#ff5555" /><span className="font-metric" style={{ fontSize:'0.62rem', color:'#ff7777' }}>1 CRÍTICA</span></div>
            <TareaBreve tarea={data.critica} accent="#ff7777" onOpen={()=>open(data.critica)} />
          </div>
          <div className="p-3 rounded" style={{ background:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.15)' }}>
            <div className="flex items-center gap-2 mb-2"><Clock3 size={14} color="#f59e0b" /><span className="font-metric" style={{ fontSize:'0.62rem', color:'#f59e0b' }}>2 IMPORTANTES</span></div>
            <div className="space-y-2">{data.importantes.length ? data.importantes.map(t => <TareaBreve key={`${t._module||'Tarea'}-${t.id}`} tarea={t} accent="#f59e0b" onOpen={()=>open(t)} />) : <TareaBreve />}</div>
          </div>
          <div className="p-3 rounded" style={{ background:'rgba(80,180,255,0.05)', border:'1px solid rgba(80,180,255,0.15)' }}>
            <div className="flex items-center gap-2 mb-2"><UserRoundCheck size={14} color="#50b4ff" /><span className="font-metric" style={{ fontSize:'0.62rem', color:'#50b4ff' }}>NO RESOLVER VOS</span></div>
            <TareaBreve tarea={data.paraDelegar} accent="#50b4ff" onOpen={()=>open(data.paraDelegar)} />
          </div>
          <div className="p-3 rounded" style={{ background:'rgba(57,255,20,0.04)', border:'1px solid rgba(57,255,20,0.13)' }}>
            <div className="flex items-center gap-2 mb-2"><BatteryMedium size={14} color="var(--phosphor)" /><span className="font-metric" style={{ fontSize:'0.62rem', color:'var(--phosphor)' }}>ENERGÍA HOY · PRIVADO</span></div>
            <div className="flex gap-1 flex-wrap">
              {[1,2,3,4,5,6,7,8,9,10].map(n => <button key={n} type="button" onClick={() => setEnergia(n)} style={{ width:25, height:25, borderRadius:4, border:'1px solid rgba(57,255,20,0.18)', background:energy === n ? 'var(--phosphor)' : 'transparent', color:energy === n ? '#071007' : 'var(--text-dim)', fontSize:'0.65rem' }}>{n}</button>)}
            </div>
            <p style={{ color:'var(--text-dim)', fontSize:'0.62rem', marginTop:7 }}>Guardado únicamente en este dispositivo.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
          {[
            ['ACCIÓN', data.propias.length, 'Lo que depende de vos'],
            ['DELEGADO', data.delegadas.length, 'Con responsable y plazo'],
            ['ESPERANDO', data.esperando.length, 'Respuesta externa'],
            ['VENCIDOS', data.vencidas, 'Requieren revisión'],
          ].map(([label,value,help]) => (
            <button key={label} type="button" onClick={open} className="p-3 text-left rounded" style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.06)' }}>
              <p className="font-title font-bold" style={{ color:value ? 'var(--phosphor)' : 'var(--text-dim)', fontSize:'1.05rem' }}>{value}</p>
              <p className="font-metric" style={{ color:'var(--text)', fontSize:'0.6rem' }}>{label}</p>
              <p style={{ color:'var(--text-dim)', fontSize:'0.62rem', marginTop:2 }}>{help}</p>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 flex-wrap gap-2" style={{ borderTop:'1px solid rgba(57,255,20,0.08)' }}>
          <div className="flex items-center gap-4">
            <span style={{ color:'var(--text-dim)', fontSize:'0.7rem' }}><CheckCircle2 size={13} style={{ display:'inline', marginRight:5, color:'var(--phosphor)' }} />{data.cerradasSemana} cerradas en 7 días</span>
            <span style={{ color:'var(--text-dim)', fontSize:'0.7rem' }}>{data.delegadas.length} resultados distribuidos</span>
          </div>
          <button type="button" onClick={open} className="btn-primary flex items-center gap-1">Delegar y seguir <ArrowRight size={13} /></button>
        </div>
      </div>
    </section>
  )
}
