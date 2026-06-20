import { useState, useEffect, useCallback } from 'react'
import { getAuditoria } from '../../lib/queries'
import { fmtFecha } from '../../lib/dateUtils'
import { Shield, RefreshCw, Filter, Download, User, Database, Clock, ChevronRight, Search } from 'lucide-react'

const TABLAS = [
  { value:'', label:'Todas las tablas' },
  { value:'mantenimiento.tickets',    label:'Tickets' },
  { value:'mantenimiento.activos',    label:'Activos' },
  { value:'mantenimiento.matafuegos', label:'Matafuegos' },
  { value:'bitacora.registros',       label:'Registros (Bitácora)' },
  { value:'bitacora.tareas',          label:'Tareas' },
  { value:'bitacora.perfiles',        label:'Usuarios/Perfiles' },
]

const ACCIONES = [
  { value:'', label:'Todas las acciones' },
  { value:'INSERT',  label:'Creación', color:'#39ff14' },
  { value:'UPDATE',  label:'Edición',  color:'#50b4ff' },
  { value:'EDIT',    label:'Edición manual', color:'#50b4ff' },
  { value:'DELETE',  label:'Eliminación', color:'#ff5050' },
  { value:'ASSIGN',  label:'Asignación', color:'#ffb400' },
  { value:'RESOLVE', label:'Resolución', color:'#39ff14' },
]

const ACCION_COLOR = {
  INSERT:'#39ff14', UPDATE:'#50b4ff', EDIT:'#50b4ff',
  DELETE:'#ff5050', ASSIGN:'#ffb400', RESOLVE:'#39ff14', LOGIN:'#c084fc',
}

const TABLA_LABEL = {
  'mantenimiento.tickets':    'Tickets',
  'mantenimiento.activos':    'Activos',
  'mantenimiento.matafuegos': 'Matafuegos',
  'bitacora.registros':       'Bitácora',
  'bitacora.tareas':          'Tareas',
  'bitacora.perfiles':        'Usuarios',
}

function tiempoTranscurrido(fecha) {
  if (!fecha) return ''
  const ms = Date.now() - new Date(fecha).getTime()
  const h = Math.floor(ms / 3600000)
  if (h < 1)   return 'Hace < 1h'
  if (h < 24)  return `Hace ${h}h`
  const d = Math.floor(h / 24)
  if (d < 30)  return `Hace ${d}d`
  return `Hace ${Math.floor(d/30)}m`
}

function AuditoriaRow({ row, expanded, onToggle }) {
  const color = ACCION_COLOR[row.accion] || '#aaa'
  const tablaLabel = TABLA_LABEL[row.tabla] || row.tabla

  return (
    <div style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
      <div
        onClick={onToggle}
        style={{
          display:'grid', gridTemplateColumns:'90px 90px 1fr 130px 90px 20px',
          gap:8, padding:'10px 14px', cursor:'pointer', transition:'background 0.1s',
          background: expanded ? 'rgba(255,255,255,0.03)' : 'transparent',
        }}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}
        onMouseLeave={e=>e.currentTarget.style.background=expanded?'rgba(255,255,255,0.03)':'transparent'}
      >
        {/* Acción */}
        <span style={{ fontSize:'0.58rem', padding:'2px 7px', borderRadius:3, background:`${color}18`, color, border:`1px solid ${color}33`, fontWeight:700, fontFamily:'monospace', alignSelf:'center', textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {row.accion}
        </span>

        {/* Tabla */}
        <span style={{ fontSize:'0.62rem', color:'rgba(255,255,255,0.4)', alignSelf:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {tablaLabel}
        </span>

        {/* Descripción */}
        <span style={{ fontSize:'0.68rem', color:'var(--text)', alignSelf:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {row.descripcion}
        </span>

        {/* Usuario */}
        <div style={{ display:'flex', alignItems:'center', gap:5, overflow:'hidden' }}>
          <User size={10} style={{ color:'rgba(255,255,255,0.3)', flexShrink:0 }}/>
          <span style={{ fontSize:'0.62rem', color:'rgba(255,255,255,0.55)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {row.usuario_nombre || row.usuario_email || 'Sistema'}
          </span>
        </div>

        {/* Tiempo */}
        <span style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.25)', alignSelf:'center', textAlign:'right' }}>
          {tiempoTranscurrido(row.created_at)}
        </span>

        {/* Expand */}
        <ChevronRight size={12} style={{ color:'rgba(255,255,255,0.25)', alignSelf:'center', transition:'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}/>
      </div>

      {expanded && (
        <div style={{ padding:'8px 14px 14px 20px', background:'rgba(255,255,255,0.02)', borderLeft:'2px solid rgba(57,255,20,0.05)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:10, marginBottom: row.campo ? 10 : 0 }}>
            <div>
              <p style={{ fontSize:'0.55rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', marginBottom:3 }}>TIMESTAMP</p>
              <p style={{ fontSize:'0.65rem', color:'var(--text)' }}>{row.created_at ? new Date(row.created_at).toLocaleString('es-AR') : '—'}</p>
            </div>
            <div>
              <p style={{ fontSize:'0.55rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', marginBottom:3 }}>USUARIO</p>
              <p style={{ fontSize:'0.65rem', color:'var(--text)' }}>{row.usuario_nombre || '—'}</p>
              <p style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)' }}>{row.usuario_email || ''}</p>
            </div>
            <div>
              <p style={{ fontSize:'0.55rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', marginBottom:3 }}>TABLA · ID</p>
              <p style={{ fontSize:'0.65rem', color:'var(--text)' }}>{row.tabla}</p>
              <p style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace' }}>{row.registro_id || '—'}</p>
            </div>
            {row.sede_nombre && (
              <div>
                <p style={{ fontSize:'0.55rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', marginBottom:3 }}>SEDE</p>
                <p style={{ fontSize:'0.65rem', color:'var(--text)' }}>{row.sede_nombre}</p>
              </div>
            )}
          </div>

          {row.campo && (
            <div style={{ background:'rgba(0,0,0,0.2)', borderRadius:2, padding:'8px 12px', fontSize:'0.65rem', fontFamily:'monospace' }}>
              <span style={{ color:'rgba(255,255,255,0.4)' }}>campo </span>
              <span style={{ color:'#c084fc' }}>{row.campo}</span>
              <span style={{ color:'rgba(255,255,255,0.3)' }}>: </span>
              <span style={{ color:'rgba(255,80,80,0.7)', textDecoration:'line-through' }}>{row.valor_antes || 'null'}</span>
              <span style={{ color:'rgba(255,255,255,0.3)' }}> → </span>
              <span style={{ color:'rgba(57,255,20,0.8)' }}>{row.valor_nuevo || 'null'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AuditoriaView() {
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState(null)
  const [filtros, setFiltros]     = useState({
    tabla:'', accion:'', buscar:'',
    desde: new Date(Date.now() - 7*24*3600000).toISOString().split('T')[0],
    hasta: new Date().toISOString().split('T')[0],
    limit: 200,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setExpanded(null)
    try {
      const data = await getAuditoria({
        tabla:  filtros.tabla  || undefined,
        accion: filtros.accion || undefined,
        buscar: filtros.buscar || undefined,
        desde:  filtros.desde  ? new Date(filtros.desde).toISOString() : undefined,
        hasta:  filtros.hasta  ? new Date(filtros.hasta + 'T23:59:59').toISOString() : undefined,
        limit:  filtros.limit,
      })
      setRows(data)
    } catch(e) {
      console.error('Error cargando auditoría:', e)
    } finally {
      setLoading(false)
    }
  }, [filtros])

  useEffect(() => { load() }, [load])

  const exportCSV = () => {
    const headers = ['Timestamp','Acción','Tabla','Descripción','Campo','Antes','Después','Usuario','Email','Sede','ID Registro']
    const lines = [
      headers.join(','),
      ...rows.map(r => [
        r.created_at, r.accion, r.tabla,
        '"' + (r.descripcion||'').replace(/"/g,'""') + '"',
        r.campo||'', r.valor_antes||'', r.valor_nuevo||'',
        r.usuario_nombre||'', r.usuario_email||'',
        r.sede_nombre||'', r.registro_id||''
      ].join(','))
    ].join('\n')
    const blob = new Blob([lines], { type:'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'auditoria_' + new Date().toISOString().split('T')[0] + '.csv'
    a.click()
  }

  const INP = { background:'#1a1a22', border:'1px solid rgba(57,255,20,0.1)', color:'var(--text)', borderRadius:2, padding:'6px 10px', fontSize:'0.65rem', fontFamily:'inherit' }

  // Stats
  const totalPorAccion = ACCIONES.slice(1).map(a => ({
    ...a,
    count: rows.filter(r => r.accion === a.value).length
  })).filter(a => a.count > 0)

  const usuariosUnicos = [...new Set(rows.map(r => r.usuario_email).filter(Boolean))]

  return (
    <div style={{ padding:'1.5rem 2rem', height:'100%', display:'flex', flexDirection:'column', gap:16, overflow:'hidden' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexShrink:0 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <Shield size={20} style={{ color:'var(--phosphor)' }}/>
            <h1 className='font-title' style={{ color:'var(--text)', fontWeight:800, fontSize:'1.4rem' }}>Trazabilidad</h1>
          </div>
          <p style={{ fontSize:'0.62rem', color:'rgba(57,255,20,0.5)', letterSpacing:'0.1em', fontFamily:'monospace' }}>
            AUDIT TRAIL · TODAS LAS ACCIONES · NADIE HACE NADA EN LAS SOMBRAS
          </p>
        </div>
        <button
          onClick={exportCSV}
          style={{ ...INP, cursor:'pointer', display:'flex', alignItems:'center', gap:6, padding:'7px 14px', border:'1px solid rgba(57,255,20,0.3)', color:'#39ff14' }}
        >
          <Download size={12}/>Exportar CSV
        </button>
      </div>

      {/* Stats rápidas */}
      {rows.length > 0 && (
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', flexShrink:0 }}>
          <div style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.07)', borderRadius:3, padding:'8px 16px' }}>
            <p style={{ fontSize:'0.55rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', marginBottom:2 }}>EVENTOS</p>
            <p style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--text)' }}>{rows.length}</p>
          </div>
          <div style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,0.07)', borderRadius:3, padding:'8px 16px' }}>
            <p style={{ fontSize:'0.55rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', marginBottom:2 }}>USUARIOS ACTIVOS</p>
            <p style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--text)' }}>{usuariosUnicos.length}</p>
          </div>
          {totalPorAccion.map(a => (
            <div key={a.value} style={{ background:`${a.color}0c`, border:`1px solid ${a.color}22`, borderRadius:3, padding:'8px 16px' }}>
              <p style={{ fontSize:'0.55rem', color:`${a.color}99`, fontFamily:'monospace', marginBottom:2 }}>{a.label.toUpperCase()}</p>
              <p style={{ fontSize:'1.1rem', fontWeight:700, color:a.color }}>{a.count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, flexWrap:'wrap' }}>
        <Filter size={13} style={{ color:'rgba(255,255,255,0.3)' }}/>

        <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
          <Search size={11} style={{ position:'absolute', left:8, color:'rgba(255,255,255,0.3)', pointerEvents:'none' }}/>
          <input
            type="text" placeholder="Buscar..." value={filtros.buscar}
            onChange={e=>setFiltros(f=>({...f,buscar:e.target.value}))}
            style={{ ...INP, paddingLeft:26, width:160 }}
          />
        </div>

        <select style={INP} value={filtros.tabla} onChange={e=>setFiltros(f=>({...f,tabla:e.target.value}))}>
          {TABLAS.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <select style={INP} value={filtros.accion} onChange={e=>setFiltros(f=>({...f,accion:e.target.value}))}>
          {ACCIONES.map(a=><option key={a.value} value={a.value}>{a.label}</option>)}
        </select>

        <input type="date" value={filtros.desde} onChange={e=>setFiltros(f=>({...f,desde:e.target.value}))} style={{ ...INP, colorScheme:'dark' }}/>
        <span style={{ color:'rgba(255,255,255,0.3)', fontSize:'0.65rem' }}>→</span>
        <input type="date" value={filtros.hasta} onChange={e=>setFiltros(f=>({...f,hasta:e.target.value}))} style={{ ...INP, colorScheme:'dark' }}/>

        <button onClick={load} style={{ ...INP, cursor:'pointer', display:'flex', alignItems:'center', gap:5, marginLeft:'auto' }}>
          <RefreshCw size={11}/>Actualizar
        </button>
      </div>

      {/* Tabla header */}
      <div style={{
        display:'grid', gridTemplateColumns:'90px 90px 1fr 130px 90px 20px',
        gap:8, padding:'6px 14px', flexShrink:0,
        borderBottom:'1px solid rgba(57,255,20,0.07)',
      }}>
        {['Acción','Tabla','Descripción','Usuario','Tiempo',''].map(h=>(
          <span key={h} style={{ fontSize:'0.55rem', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', letterSpacing:'0.1em' }}>{h}</span>
        ))}
      </div>

      {/* Lista */}
      <div style={{ flex:1, overflowY:'auto', minHeight:0 }}>
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, gap:10, color:'rgba(255,255,255,0.3)', fontSize:'0.72rem' }}>
            <Clock size={16} style={{ opacity:0.5 }}/> Cargando registros...
          </div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, color:'rgba(255,255,255,0.2)' }}>
            <Shield size={40} style={{ marginBottom:16, opacity:0.2 }}/>
            <p style={{ fontSize:'0.72rem' }}>Sin registros para los filtros seleccionados.</p>
          </div>
        ) : (
          rows.map(row => (
            <AuditoriaRow
              key={row.id}
              row={row}
              expanded={expanded === row.id}
              onToggle={() => setExpanded(expanded === row.id ? null : row.id)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {rows.length > 0 && (
        <div style={{ flexShrink:0, paddingTop:8, borderTop:'1px solid rgba(57,255,20,0.05)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.25)', fontFamily:'monospace' }}>
            {rows.length} registros · mostrando últimos {filtros.limit}
          </span>
          {rows.length >= filtros.limit && (
            <button
              onClick={()=>setFiltros(f=>({...f,limit:f.limit+200}))}
              style={{ fontSize:'0.62rem', color:'#50b4ff', background:'rgba(80,180,255,0.08)', border:'1px solid rgba(80,180,255,0.2)', borderRadius:4, padding:'3px 10px', cursor:'pointer' }}
            >
              Cargar más
            </button>
          )}
        </div>
      )}
    </div>
  )
}
