import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Clock, Download, RefreshCw, Search, ShieldCheck, UserX, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

const dayMs = 24 * 60 * 60 * 1000

function fechaInput(date) {
  return date.toISOString().slice(0, 10)
}

function frecuencia(row) {
  const count = Number(row.ingresos_30_dias || 0)
  if (!row.ultimo_ingreso) return { label:'Nunca ingresó', color:'#ff5050' }
  if (count >= 20) return { label:'Frecuente', color:'#39ff14' }
  if (count >= 4) return { label:'Semanal', color:'#50b4ff' }
  return { label:'Ocasional', color:'#ffb400' }
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export default function AccesosAppReport() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [desde, setDesde] = useState(fechaInput(new Date(Date.now() - 30 * dayMs)))
  const [hasta, setHasta] = useState(fechaInput(new Date()))

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('reporte_accesos_app', {
      p_desde: new Date(`${desde}T00:00:00`).toISOString(),
      p_hasta: new Date(`${hasta}T23:59:59.999`).toISOString(),
    })
    if (rpcError) setError(rpcError.message || 'No se pudo cargar el reporte.')
    else setRows(data || [])
    setLoading(false)
  }, [desde, hasta])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('es')
    const visibles = q
      ? rows.filter(row => [row.nombre, row.email, row.rol]
        .some(value => String(value || '').toLocaleLowerCase('es').includes(q)))
      : rows
    return [...visibles].sort((a, b) => {
      if (Boolean(a.activo) !== Boolean(b.activo)) return a.activo ? -1 : 1
      const actividadA = Number(a.ingresos_30_dias || 0)
      const actividadB = Number(b.ingresos_30_dias || 0)
      if (actividadA !== actividadB) return actividadB - actividadA
      const semanaA = Number(a.ingresos_7_dias || 0)
      const semanaB = Number(b.ingresos_7_dias || 0)
      if (semanaA !== semanaB) return semanaB - semanaA
      const ultimoA = a.ultimo_ingreso ? new Date(a.ultimo_ingreso).getTime() : 0
      const ultimoB = b.ultimo_ingreso ? new Date(b.ultimo_ingreso).getTime() : 0
      if (ultimoA !== ultimoB) return ultimoB - ultimoA
      return String(a.nombre || a.email || '').localeCompare(String(b.nombre || b.email || ''), 'es')
    })
  }, [rows, search])

  const stats = useMemo(() => ({
    total: rows.length,
    activos7: rows.filter(row => Number(row.ingresos_7_dias) > 0).length,
    activos30: rows.filter(row => Number(row.ingresos_30_dias) > 0).length,
    nunca: rows.filter(row => !row.ultimo_ingreso).length,
  }), [rows])

  const exportCSV = () => {
    const headers = ['Nombre','Email','Rol','Estado','Último ingreso','Ingresos período','Ingresos 7 días','Ingresos 30 días','Frecuencia']
    const content = [headers.map(csvCell).join(','), ...filtered.map(row => [
      row.nombre, row.email, row.rol, row.activo ? 'Activo' : 'Inactivo',
      row.ultimo_ingreso ? new Date(row.ultimo_ingreso).toLocaleString('es-AR') : 'Nunca',
      row.ingresos_periodo, row.ingresos_7_dias, row.ingresos_30_dias, frecuencia(row).label,
    ].map(csvCell).join(','))].join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob(['\ufeff' + content], { type:'text/csv;charset=utf-8' }))
    link.download = `reporte_accesos_${fechaInput(new Date())}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const inputStyle = { background:'#1a1a22', border:'1px solid rgba(57,255,20,.14)', color:'var(--text)', borderRadius:4, padding:'7px 10px', fontSize:'.68rem' }
  const cards = [
    { label:'USUARIOS', value:stats.total, icon:Users, color:'#e6e6e6' },
    { label:'ACTIVOS 7 DÍAS', value:stats.activos7, icon:Activity, color:'#39ff14' },
    { label:'ACTIVOS 30 DÍAS', value:stats.activos30, icon:Clock, color:'#50b4ff' },
    { label:'NUNCA INGRESARON', value:stats.nunca, icon:UserX, color:'#ff5050' },
  ]

  return (
    <div style={{ padding:'1.5rem 2rem', height:'100%', display:'flex', flexDirection:'column', gap:16, overflow:'hidden' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, flexWrap:'wrap' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <ShieldCheck size={21} color="var(--phosphor)" />
            <h1 className="font-title" style={{ fontSize:'1.4rem', fontWeight:800 }}>Reporte de accesos</h1>
          </div>
          <p style={{ marginTop:5, color:'rgba(57,255,20,.5)', fontFamily:'monospace', fontSize:'.62rem', letterSpacing:'.08em' }}>
            INFORMACIÓN CONFIDENCIAL · EXCLUSIVA PARA ADMINISTRADORES
          </p>
        </div>
        <button onClick={exportCSV} disabled={!filtered.length} style={{ ...inputStyle, color:'#39ff14', cursor:'pointer', display:'flex', gap:6, alignItems:'center' }}>
          <Download size={13} /> Exportar CSV
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10 }}>
        {cards.map(card => <div key={card.label} style={{ background:'var(--surface)', border:`1px solid ${card.color}22`, borderRadius:5, padding:'11px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div><p style={{ fontSize:'.58rem', color:`${card.color}99`, fontFamily:'monospace' }}>{card.label}</p><p style={{ fontSize:'1.25rem', fontWeight:800, color:card.color }}>{card.value}</p></div>
          <card.icon size={20} color={card.color} style={{ opacity:.65 }} />
        </div>)}
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <div style={{ position:'relative' }}><Search size={12} style={{ position:'absolute', left:9, top:10, opacity:.45 }} /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Usuario, email o rol" style={{ ...inputStyle, paddingLeft:28, width:210 }} /></div>
        <input type="date" value={desde} onChange={e=>setDesde(e.target.value)} style={{ ...inputStyle, colorScheme:'dark' }} />
        <span style={{ opacity:.4 }}>→</span>
        <input type="date" value={hasta} onChange={e=>setHasta(e.target.value)} style={{ ...inputStyle, colorScheme:'dark' }} />
        <button onClick={load} style={{ ...inputStyle, marginLeft:'auto', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}><RefreshCw size={12} /> Actualizar</button>
      </div>

      {error && <div style={{ padding:12, color:'#ff7070', background:'rgba(255,80,80,.08)', border:'1px solid rgba(255,80,80,.2)' }}>{error}</div>}

      <div style={{ flex:1, minHeight:0, overflow:'auto', border:'1px solid rgba(57,255,20,.08)', borderRadius:5 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:850 }}>
          <thead style={{ position:'sticky', top:0, background:'#111117', zIndex:1 }}><tr>{['Usuario','Rol','Último ingreso','Período','7 días','30 días','Frecuencia'].map(label => <th key={label} style={{ textAlign:'left', padding:'9px 12px', fontSize:'.58rem', fontFamily:'monospace', color:'rgba(255,255,255,.35)', borderBottom:'1px solid rgba(57,255,20,.1)' }}>{label}</th>)}</tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="7" style={{ textAlign:'center', padding:50, opacity:.4 }}>Cargando accesos...</td></tr> : filtered.length === 0 ? <tr><td colSpan="7" style={{ textAlign:'center', padding:50, opacity:.4 }}>Sin usuarios para los filtros seleccionados.</td></tr> : filtered.map(row => {
              const freq = frecuencia(row)
              return <tr key={row.usuario_id} style={{ borderBottom:'1px solid rgba(255,255,255,.035)' }}>
                <td style={{ padding:'10px 12px' }}><div style={{ fontSize:'.72rem', fontWeight:700, opacity:row.activo ? 1 : .45 }}>{row.nombre || 'Sin nombre'}</div><div style={{ fontSize:'.61rem', opacity:.38 }}>{row.email}</div></td>
                <td style={{ padding:'10px 12px', fontSize:'.65rem', opacity:.65 }}>{row.rol}{!row.activo && ' · inactivo'}</td>
                <td style={{ padding:'10px 12px', fontSize:'.65rem' }}>{row.ultimo_ingreso ? new Date(row.ultimo_ingreso).toLocaleString('es-AR') : 'Nunca'}</td>
                <td style={{ padding:'10px 12px', fontWeight:800 }}>{row.ingresos_periodo}</td>
                <td style={{ padding:'10px 12px' }}>{row.ingresos_7_dias}</td>
                <td style={{ padding:'10px 12px' }}>{row.ingresos_30_dias}</td>
                <td style={{ padding:'10px 12px' }}><span style={{ color:freq.color, background:`${freq.color}14`, border:`1px solid ${freq.color}35`, borderRadius:3, padding:'3px 7px', fontSize:'.6rem', fontWeight:700 }}>{freq.label}</span></td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize:'.58rem', opacity:.3 }}>Cada apertura de una nueva sesión de la aplicación se contabiliza una sola vez. El seguimiento comienza desde la activación de este reporte.</p>
    </div>
  )
}
