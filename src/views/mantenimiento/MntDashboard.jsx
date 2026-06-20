import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../lib/auth'
import { getKPIsMantenimiento, getTickets, getSedes } from '../../lib/queries'

const ESTADO_COLOR = { abierto:'#F97316', en_progreso:'#3B82F6', aprobado:'#F59E0B', resuelto:'#39FF14', rechazado:'#6B7280' }
const PRIORIDAD_COLOR = { critica:'#FF2A2A', alta:'#F97316', media:'#F59E0B', baja:'#39FF14' }

function KPI({ label, value, sub, color, small }) {
  return (
    <div style={{ background:'var(--surface)', borderRadius:3, padding:'1rem 1.2rem', flex:1, minWidth:120 }}>
      <p style={{ color:'var(--text-dim)', fontSize:'0.58rem', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.35rem' }}>{label}</p>
      <p style={{ color:color||'var(--text)', fontWeight:800, fontSize:small?'1.5rem':'2rem', lineHeight:1 }}>{value??'—'}</p>
      {sub && <p style={{ color:'var(--text-dim)', fontSize:'0.65rem', marginTop:3 }}>{sub}</p>}
    </div>
  )
}
function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.max(2, (value/max)*100) : 0
  return (
    <div style={{ background:'rgba(255,255,255,0.05)', borderRadius:4, height:6, flex:1 }}>
      <div style={{ width:`${pct}%`, height:'100%', borderRadius:4, background:color||'var(--phosphor)', transition:'width 0.5s' }} />
    </div>
  )
}

function calcMTTR(tickets) {
  const horas = tickets
    .filter(t => t.estado==='resuelto' && t.fecha_cierre && t.created_at)
    .map(t => (new Date(t.fecha_cierre)-new Date(t.created_at))/3600000)
    .filter(h => h > 0)
  return horas.length ? horas.reduce((a,b)=>a+b,0)/horas.length : null
}
function fmtMTTR(h) {
  if (!h) return '—'
  if (h < 24) return `${Math.round(h)}h`
  return `${(h/24).toFixed(1)}d`
}

const SEL = { background:'#1a1a2e', border:'1px solid rgba(57,255,20,0.15)', color:'#e2e8f0', borderRadius:2, padding:'0.4rem 0.8rem', fontSize:'0.72rem', fontFamily:'inherit', cursor:'pointer' }
const tabStyle = active => ({
  background: active ? 'rgba(57,255,20,0.12)' : 'transparent',
  color: active ? 'var(--phosphor)' : 'var(--text-dim)',
  border: active ? '1px solid rgba(57,255,20,0.3)' : '1px solid rgba(57,255,20,0.07)',
  borderRadius:2, padding:'0.3rem 0.7rem', fontSize:'0.7rem', fontWeight:600, cursor:'pointer',
})

export default function MntDashboard({ onNavigate }) {
  const { allowedSedeIds } = useAuth()
  const [kpis, setKpis]       = useState(null)
  const [tickets, setTickets] = useState([])
  const [sedes, setSedes]     = useState([])
  const [sedeId, setSedeId]   = useState('')
  const [loading, setLoading] = useState(true)
  const [tabla, setTabla]     = useState('responsable')

  useEffect(() => { getSedes().then(setSedes) }, [])

  useEffect(() => {
    setLoading(true)
    const sid = sedeId ? Number(sedeId) : null
    Promise.all([
      getKPIsMantenimiento(sid, allowedSedeIds),
      getTickets(sid ? { sede_id: sid } : { sedeIds: allowedSedeIds || undefined }),
    ]).then(([k,t]) => { setKpis(k); setTickets(t) })
      .finally(() => setLoading(false))
  }, [sedeId])

  const mttr = useMemo(() => calcMTTR(tickets), [tickets])

  const porEstado = useMemo(() => {
    const map = {}
    tickets.forEach(t => { map[t.estado] = (map[t.estado]||0)+1 })
    return Object.entries(map).sort((a,b)=>b[1]-a[1])
  }, [tickets])

  const porResponsable = useMemo(() => {
    const map = {}
    tickets.forEach(t => {
      const k = t.responsable||'Sin asignar'
      if (!map[k]) map[k] = { nombre:k, total:0, resueltos:0, abiertos:0, horas:[] }
      map[k].total++
      if (t.estado==='resuelto') {
        map[k].resueltos++
        if (t.fecha_cierre && t.created_at) {
          const h = (new Date(t.fecha_cierre)-new Date(t.created_at))/3600000
          if (h>0) map[k].horas.push(h)
        }
      }
      if (['abierto','en_progreso'].includes(t.estado)) map[k].abiertos++
    })
    return Object.values(map)
      .map(r => ({ ...r, mttr: r.horas.length ? r.horas.reduce((a,b)=>a+b,0)/r.horas.length : null }))
      .sort((a,b)=>b.total-a.total).slice(0,10)
  }, [tickets])

  const porTipo = useMemo(() => {
    const map = {}
    tickets.forEach(t => {
      const k = t.tipo||'Sin tipo'
      if (!map[k]) map[k] = { nombre:k, total:0, resueltos:0 }
      map[k].total++
      if (t.estado==='resuelto') map[k].resueltos++
    })
    return Object.values(map).sort((a,b)=>b.total-a.total)
  }, [tickets])

  const porSede = useMemo(() => {
    const map = {}
    tickets.forEach(t => {
      const k = t.sede||'Sin sede'
      if (!map[k]) map[k] = { nombre:k, total:0, abiertos:0 }
      map[k].total++
      if (['abierto','en_progreso'].includes(t.estado)) map[k].abiertos++
    })
    return Object.values(map).sort((a,b)=>b.total-a.total)
  }, [tickets])

  const tendencia30 = useMemo(() => {
    const hace30 = new Date(Date.now()-30*86400000)
    return {
      abiertos:  tickets.filter(t=>new Date(t.created_at)>=hace30).length,
      resueltos: tickets.filter(t=>t.fecha_cierre&&new Date(t.fecha_cierre)>=hace30).length,
    }
  }, [tickets])

  const maxR = porResponsable[0]?.total||1
  const maxT = porTipo[0]?.total||1
  const maxS = porSede[0]?.total||1

  return (
    <div style={{ padding:'1.5rem 2rem', overflowY:'auto', height:'100%' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' }}>
        <div>
          <h1 className='font-title' style={{ color:'var(--text)', fontWeight:800, fontSize:'1.4rem' }}>Mantenimiento</h1>
          <p style={{ color:'var(--text-dim)', fontSize:'0.72rem', marginTop:2 }}>Dashboard operativo · FK</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select value={sedeId} onChange={e=>setSedeId(e.target.value)} style={SEL}>
            <option value=''>Todas las sedes</option>
            {sedes.map(s=><option key={s.id} value={s.id} style={{ background:'#1a1a2e' }}>{s.nombre}</option>)}
          </select>
          <button onClick={()=>onNavigate('mntTickets')}
            style={{ background:'var(--phosphor)', color:'#0A0A0E', border:'none', borderRadius:3, padding:'0.5rem 1rem', fontWeight:700, cursor:'pointer', fontSize:'0.82rem', whiteSpace:'nowrap' }}>
            + Nuevo Ticket
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'4rem' }}>
          <div style={{ width:28, height:28, borderRadius:'50%', border:'2px solid var(--phosphor)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
        </div>
      ) : (<>

        {/* KPIs fila 1 */}
        <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap', marginBottom:'0.6rem' }}>
          <KPI label="MTTR Global"      value={fmtMTTR(mttr)}              sub="tiempo medio resolución"           color="var(--phosphor)" />
          <KPI label="Abiertos"         value={kpis?.ticketsAbiertos}       sub={`+${tendencia30.abiertos} últimos 30d`} color="#F97316" />
          <KPI label="En progreso"      value={tickets.filter(t=>t.estado==='en_progreso').length} color="#3B82F6" />
          <KPI label="Resueltos (30d)"  value={tendencia30.resueltos}       sub="últimos 30 días"                  color="#39FF14" />
          <KPI label="Críticos activos" value={kpis?.ticketsCriticos}       color="#FF2A2A" />
        </div>

        {/* KPIs fila 2 */}
        <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap', marginBottom:'1.25rem' }}>
          <KPI label="Total tickets"          value={kpis?.totalTickets}          small color="var(--text)" />
          <KPI label="Activos en reparación"  value={kpis?.activosEnReparacion}   small color="#F59E0B" />
          <KPI label="Matafuegos vencidos"    value={kpis?.matafuegosVencidos}    small color="#FF2A2A" />
          <KPI label="Flota: doc. vencida"    value={kpis?.vehiculosDocVencida}   small color="#FF2A2A" />
          <KPI label="Total activos"          value={kpis?.totalActivos}          small color="var(--text)" />
        </div>

        {/* Distribución por estado */}
        <div style={{ background:'var(--surface)', borderRadius:3, padding:'1rem 1.2rem', marginBottom:'0.8rem' }}>
          <p style={{ color:'var(--text-dim)', fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.7rem' }}>Distribución por estado</p>
          {porEstado.length === 0 ? (
            <p style={{ color:'var(--text-dim)', fontSize:'0.8rem' }}>Sin tickets{sedeId ? ' para esta sede' : ''}</p>
          ) : (
            <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
              {porEstado.map(([estado,count]) => (
                <div key={estado} style={{ display:'flex', alignItems:'center', gap:5,
                  background:`${ESTADO_COLOR[estado]||'#555'}18`, border:`1px solid ${ESTADO_COLOR[estado]||'#555'}44`,
                  borderRadius:2, padding:'0.35rem 0.7rem' }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:ESTADO_COLOR[estado]||'#555' }} />
                  <span style={{ color:'var(--text)', fontSize:'0.78rem', fontWeight:700 }}>{count}</span>
                  <span style={{ color:'var(--text-dim)', fontSize:'0.68rem' }}>{estado}</span>
                  <span style={{ color:'var(--text-dim)', fontSize:'0.58rem' }}>({Math.round(count/tickets.length*100)}%)</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabla desglose */}
        <div style={{ background:'var(--surface)', borderRadius:3, overflow:'hidden', marginBottom:'1rem' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.85rem 1.1rem 0.55rem' }}>
            <p style={{ color:'var(--text-dim)', fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.1em' }}>Desglose</p>
            <div style={{ display:'flex', gap:5 }}>
              <button style={tabStyle(tabla==='responsable')} onClick={()=>setTabla('responsable')}>Por responsable</button>
              <button style={tabStyle(tabla==='tipo')}        onClick={()=>setTabla('tipo')}>Por tipo</button>
              {!sedeId && <button style={tabStyle(tabla==='sede')} onClick={()=>setTabla('sede')}>Por sede</button>}
            </div>
          </div>

          {tabla==='responsable' && (
            <table className="table-dark" style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.78rem' }}>
              <thead><tr style={{ borderBottom:'1px solid rgba(57,255,20,0.05)' }}>
                {['Responsable','Total','Resueltos','Abiertos','MTTR','Vol.'].map(h=>(
                  <th key={h} style={{ padding:'0.45rem 1rem', color:'var(--text-dim)', fontSize:'0.58rem', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600, textAlign:'left' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {porResponsable.map((r,i)=>(
                  <tr key={r.nombre} style={{ borderBottom:i<porResponsable.length-1?'1px solid rgba(255,255,255,0.03)':'none' }}>
                    <td style={{ padding:'0.6rem 1rem', color:'var(--text)', fontWeight:500 }}>{r.nombre}</td>
                    <td style={{ padding:'0.6rem 1rem', color:'var(--text)', fontWeight:700 }}>{r.total}</td>
                    <td style={{ padding:'0.6rem 1rem', color:'#39FF14' }}>{r.resueltos}</td>
                    <td style={{ padding:'0.6rem 1rem', color:r.abiertos>5?'#F97316':'var(--text-dim)' }}>{r.abiertos}</td>
                    <td style={{ padding:'0.6rem 1rem', color:'var(--phosphor)', fontFamily:'monospace' }}>{fmtMTTR(r.mttr)}</td>
                    <td style={{ padding:'0.6rem 1rem', width:110 }}><MiniBar value={r.total} max={maxR} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tabla==='tipo' && (
            <table className="table-dark" style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.78rem' }}>
              <thead><tr style={{ borderBottom:'1px solid rgba(57,255,20,0.05)' }}>
                {['Tipo','Total','Resueltos','% Res.','Vol.'].map(h=>(
                  <th key={h} style={{ padding:'0.45rem 1rem', color:'var(--text-dim)', fontSize:'0.58rem', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600, textAlign:'left' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {porTipo.map((r,i)=>(
                  <tr key={r.nombre} style={{ borderBottom:i<porTipo.length-1?'1px solid rgba(255,255,255,0.03)':'none' }}>
                    <td style={{ padding:'0.6rem 1rem', color:'var(--text)', fontWeight:500 }}>{r.nombre}</td>
                    <td style={{ padding:'0.6rem 1rem', color:'var(--text)', fontWeight:700 }}>{r.total}</td>
                    <td style={{ padding:'0.6rem 1rem', color:'#39FF14' }}>{r.resueltos}</td>
                    <td style={{ padding:'0.6rem 1rem', color:'var(--text-dim)' }}>{Math.round(r.resueltos/r.total*100)}%</td>
                    <td style={{ padding:'0.6rem 1rem', width:110 }}><MiniBar value={r.total} max={maxT} color='#3B82F6' /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tabla==='sede' && !sedeId && (
            <table className="table-dark" style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.78rem' }}>
              <thead><tr style={{ borderBottom:'1px solid rgba(57,255,20,0.05)' }}>
                {['Sede','Total','Pendientes','Vol.'].map(h=>(
                  <th key={h} style={{ padding:'0.45rem 1rem', color:'var(--text-dim)', fontSize:'0.58rem', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600, textAlign:'left' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {porSede.map((r,i)=>(
                  <tr key={r.nombre} style={{ borderBottom:i<porSede.length-1?'1px solid rgba(255,255,255,0.03)':'none' }}>
                    <td style={{ padding:'0.6rem 1rem', color:'var(--text)', fontWeight:500 }}>{r.nombre}</td>
                    <td style={{ padding:'0.6rem 1rem', color:'var(--text)', fontWeight:700 }}>{r.total}</td>
                    <td style={{ padding:'0.6rem 1rem', color:r.abiertos>5?'#F97316':'var(--text-dim)' }}>{r.abiertos}</td>
                    <td style={{ padding:'0.6rem 1rem', width:110 }}><MiniBar value={r.total} max={maxS} color='#F59E0B' /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Accesos rápidos */}
        <div style={{ display:'flex', gap:'0.55rem', flexWrap:'wrap' }}>
          {[
            { label:'Tickets',     nav:'mntTickets',     icon:'🎫' },
            { label:'Kanban',      nav:'mntKanban',      icon:'📌' },
            { label:'Activos',     nav:'mntActivos',     icon:'⚙' },
            { label:'Gestión Flota', nav:'flotaGestion', icon:'🚚' },
            { label:'Proveedores', nav:'mntProveedores', icon:'🏢' },
            { label:'Matafuegos',  nav:'mntMatafuegos',  icon:'🧯' },
            { label:'Insumos',     nav:'mntInsumos',     icon:'📦' },
            { label:'Planes',      nav:'mntPlanes',      icon:'📋' },
          ].map(m=>(
            <button key={m.nav} onClick={()=>onNavigate(m.nav)}
              style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.05)', borderRadius:3,
                padding:'0.75rem 1rem', cursor:'pointer', textAlign:'left', minWidth:90 }}>
              <p style={{ fontSize:'1.2rem', marginBottom:2 }}>{m.icon}</p>
              <p style={{ color:'var(--text)', fontWeight:600, fontSize:'0.75rem' }}>{m.label}</p>
            </button>
          ))}
        </div>

      </>)}
    </div>
  )
}
