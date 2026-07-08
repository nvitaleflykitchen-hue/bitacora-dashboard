import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search, Ticket, Wrench, FileText, CheckSquare, Package, Building2,
  AlertTriangle, ShoppingCart, ClipboardList, Contact, Flame, ShieldCheck,
  UserRound, Plane,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { canAccessView } from '../lib/access'

const RESULT_TYPES = {
  ticket:          { icon:Ticket,        color:'#f97316', label:'Ticket' },
  activo:          { icon:Wrench,        color:'#50b4ff', label:'Activo' },
  registro:        { icon:FileText,      color:'#39FF14', label:'Registro' },
  tarea:           { icon:CheckSquare,   color:'#f59e0b', label:'Tarea' },
  insumo:          { icon:Package,       color:'#c084fc', label:'Insumo' },
  sede:            { icon:Building2,     color:'#39FF14', label:'Sede' },
  escalamiento:    { icon:AlertTriangle, color:'#ff5050', label:'Escalamiento' },
  requerimiento:   { icon:ShoppingCart,  color:'#38bdf8', label:'Compra' },
  plan:            { icon:ClipboardList, color:'#22d3ee', label:'Plan' },
  documento_flota: { icon:FileText,      color:'#a78bfa', label:'Documento' },
  proveedor:       { icon:Contact,       color:'#fbbf24', label:'Proveedor' },
  matafuego:       { icon:Flame,         color:'#fb7185', label:'Matafuego' },
  no_conformidad:  { icon:ShieldCheck,   color:'#ef4444', label:'No conformidad' },
  capa:            { icon:ShieldCheck,   color:'#f97316', label:'CAPA' },
  persona:         { icon:UserRound,     color:'#60a5fa', label:'Persona' },
  candidato:       { icon:UserRound,     color:'#a78bfa', label:'Candidato' },
  responsable:     { icon:Contact,       color:'#2dd4bf', label:'Responsable' },
  vuelo:           { icon:Plane,         color:'#818cf8', label:'Vuelo' },
}

const QUICK_LINKS = [
  { label:'Tickets de mantenimiento', nav:'mntTickets', color:'#f97316' },
  { label:'Tablero Kanban', nav:'mntKanban', color:'#50b4ff' },
  { label:'Planes preventivos', nav:'mntPlanes', color:'#39FF14' },
  { label:'No Conformidades', nav:'noConformidades', color:'#ff5050' },
  { label:'Selección de personal', nav:'equipo', color:'#a78bfa', target:{ type:'reclutamiento' }, desktopOnly:true },
]

async function buscarTodo(query) {
  if (!query || query.length < 2) return []
  const { data, error } = await supabase.rpc('buscar_global', { p_query:query, p_limit:30 })
  if (error) throw error
  return (data || []).map(result => ({
    tipo: result.tipo,
    id: result.id,
    titulo: result.titulo,
    sub: result.subtitulo,
    estado: result.estado,
    nav: result.vista === 'flotaGestion' ? 'flotaHub' : result.vista,
    sedeId: result.sede_id,
  }))
}

export default function GlobalSearch({ onNavigate, onClose, mobile = false }) {
  const { rol, perfil } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const debounce = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const search = useCallback((value) => {
    clearTimeout(debounce.current)
    setError('')
    if (!value || value.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounce.current = setTimeout(async () => {
      try {
        const nextResults = await buscarTodo(value)
        setResults(nextResults.filter(result =>
          canAccessView(rol, result.nav, perfil) && (!mobile || result.tipo !== 'candidato')
        ))
        setSelected(0)
      } catch (err) {
        console.error(err)
        setResults([])
        setError('No se pudo completar la búsqueda. Reintentá.')
      } finally {
        setLoading(false)
      }
    }, 280)
  }, [rol, perfil, mobile])

  useEffect(() => { search(query) }, [query, search])
  useEffect(() => () => clearTimeout(debounce.current), [])

  const openResult = (result) => {
    const target = result.target || (result.id
      ? { type:result.tipo, id:result.id, sedeId:result.sedeId }
      : null)
    onNavigate(result.nav, target)
    onClose()
  }

  const handleKey = (event) => {
    if (event.key === 'Escape') { onClose(); return }
    if (event.key === 'ArrowDown') {
      setSelected(value => Math.min(value + 1, results.length - 1))
      event.preventDefault()
    }
    if (event.key === 'ArrowUp') {
      setSelected(value => Math.max(value - 1, 0))
      event.preventDefault()
    }
    if (event.key === 'Enter' && results[selected]) openResult(results[selected])
  }

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:100, paddingTop:'12vh' }}
      onClick={event => event.target === event.currentTarget && onClose()}
    >
      <div style={{ width:'100%', maxWidth:580, background:'var(--surface)', borderRadius:10, overflow:'hidden', border:'1px solid rgba(57,255,20,0.15)', boxShadow:'0 20px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0.85rem 1rem', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <Search size={16} style={{ color:'var(--phosphor)', flexShrink:0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={handleKey}
            placeholder="Buscar en toda la aplicación..."
            style={{ flex:1, background:'none', border:'none', outline:'none', color:'var(--text)', fontSize:'0.9rem', fontFamily:'inherit' }}
          />
          {loading && (
            <div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid var(--phosphor)', borderTopColor:'transparent', animation:'spin 0.7s linear infinite', flexShrink:0 }} />
          )}
          <button onClick={onClose} style={{ background:'none', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, padding:'2px 6px', cursor:'pointer', color:'var(--text-dim)', fontSize:'0.62rem', fontFamily:'monospace' }}>
            ESC
          </button>
        </div>

        <div style={{ maxHeight:380, overflowY:'auto' }}>
          {error && !loading && (
            <div style={{ padding:'1rem', textAlign:'center', color:'var(--alert)', fontSize:'0.8rem' }}>{error}</div>
          )}
          {!error && results.length === 0 && query.length >= 2 && !loading && (
            <div style={{ padding:'2rem', textAlign:'center', color:'var(--text-dim)', fontSize:'0.8rem' }}>
              Sin resultados para &quot;{query}&quot;
            </div>
          )}
          {results.length === 0 && query.length < 2 && (
            <div style={{ padding:'1.5rem 1rem' }}>
              <p style={{ fontSize:'0.62rem', color:'rgba(57,255,20,0.4)', fontFamily:'monospace', letterSpacing:'0.1em', marginBottom:8 }}>ACCESOS RÁPIDOS</p>
              {QUICK_LINKS.filter(link =>
                canAccessView(rol, link.nav, perfil) && (!link.desktopOnly || !mobile)
              ).map(link => (
                <button key={link.nav} onClick={() => openResult(link)}
                  style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'0.5rem 0.75rem', background:'rgba(255,255,255,0.02)', border:'none', cursor:'pointer', borderRadius:5, marginBottom:4, color:'var(--text)', fontSize:'0.8rem', textAlign:'left' }}
                  onMouseEnter={event => { event.currentTarget.style.background = 'rgba(57,255,20,0.05)' }}
                  onMouseLeave={event => { event.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                >
                  <span style={{ width:6, height:6, borderRadius:'50%', background:link.color, flexShrink:0 }} />
                  {link.label}
                </button>
              ))}
            </div>
          )}
          {results.map((result, index) => {
            const typeInfo = RESULT_TYPES[result.tipo] || RESULT_TYPES.registro
            const Icon = typeInfo.icon
            return (
              <button
                key={`${result.tipo}:${result.id}`}
                onClick={() => openResult(result)}
                onMouseEnter={() => setSelected(index)}
                style={{
                  display:'flex', alignItems:'center', gap:10, width:'100%',
                  padding:'0.65rem 1rem', background:index === selected ? 'rgba(57,255,20,0.06)' : 'transparent',
                  border:'none', borderLeft:index === selected ? '2px solid var(--phosphor)' : '2px solid transparent',
                  cursor:'pointer', textAlign:'left', transition:'all 0.1s',
                }}
              >
                <Icon size={14} style={{ color:typeInfo.color, flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:'0.82rem', color:'var(--text)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {result.titulo}
                  </p>
                  {result.sub && <p style={{ fontSize:'0.65rem', color:'var(--text-dim)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{result.sub}</p>}
                </div>
                <span style={{ fontSize:'0.58rem', padding:'2px 6px', borderRadius:3, background:`${typeInfo.color}18`, color:typeInfo.color, fontFamily:'monospace', flexShrink:0 }}>
                  {typeInfo.label}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ padding:'0.4rem 1rem', borderTop:'1px solid rgba(255,255,255,0.04)', display:'flex', gap:12, alignItems:'center' }}>
          {[['↑↓','Navegar'],['↵','Ir'],['Esc','Cerrar']].map(([key, label]) => (
            <span key={key} style={{ fontSize:'0.58rem', color:'var(--text-dim)', display:'flex', gap:4, alignItems:'center' }}>
              <kbd style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:3, padding:'1px 5px', fontFamily:'monospace', fontSize:'0.6rem' }}>{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}
