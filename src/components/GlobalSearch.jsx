import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X, Ticket, Wrench, FileText, CheckSquare, Package } from 'lucide-react'
import { supabase, db } from '../lib/supabase'

const RESULT_TYPES = {
  ticket:    { icon: Ticket,     color: '#f97316', label: 'Ticket' },
  activo:    { icon: Wrench,     color: '#50b4ff', label: 'Activo' },
  registro:  { icon: FileText,   color: '#39FF14', label: 'Registro' },
  tarea:     { icon: CheckSquare,color: '#f59e0b', label: 'Tarea' },
  insumo:    { icon: Package,    color: '#c084fc', label: 'Insumo' },
}

async function buscarTodo(q) {
  if (!q || q.length < 2) return []
  const like = `%${q}%`
  const [tickets, activos, tareas, insumos] = await Promise.all([
    supabase.from('mnt_tickets').select('id,numero,descripcion,estado,sede').or(`descripcion.ilike.${like},activo_nombre.ilike.${like}`).limit(5),
    supabase.from('mnt_activos').select('id,nombre,tipo,sede').or(`nombre.ilike.${like},codigo_interno.ilike.${like}`).limit(5),
    db().from('tareas').select('id,titulo,estado,sede_nombre').ilike('titulo', like).limit(5),
    supabase.from('mnt_insumos').select('id,nombre,categoria,unidad').ilike('nombre', like).limit(5),
  ])
  const results = []
  ;(tickets.data || []).forEach(r => results.push({ tipo: 'ticket', id: r.id, titulo: `#${r.numero} ${r.descripcion}`, sub: r.sede, estado: r.estado, nav: 'mntTickets' }))
  ;(activos.data  || []).forEach(r => results.push({ tipo: 'activo', id: r.id, titulo: r.nombre, sub: `${r.tipo} · ${r.sede || ''}`, nav: 'mntActivos' }))
  ;(tareas.data   || []).forEach(r => results.push({ tipo: 'tarea', id: r.id, titulo: r.titulo, sub: r.sede_nombre, estado: r.estado, nav: 'tareas' }))
  ;(insumos.data  || []).forEach(r => results.push({ tipo: 'insumo', id: r.id, titulo: r.nombre, sub: `${r.categoria || ''} · ${r.unidad || ''}`, nav: 'mntInsumos' }))
  return results
}

export default function GlobalSearch({ onNavigate, onClose }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const debounce = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const search = useCallback((q) => {
    clearTimeout(debounce.current)
    if (!q || q.length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    debounce.current = setTimeout(async () => {
      const r = await buscarTodo(q)
      setResults(r)
      setSelected(0)
      setLoading(false)
    }, 280)
  }, [])

  useEffect(() => { search(query) }, [query, search])

  const handleKey = (e) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { setSelected(s => Math.min(s + 1, results.length - 1)); e.preventDefault() }
    if (e.key === 'ArrowUp')   { setSelected(s => Math.max(s - 1, 0)); e.preventDefault() }
    if (e.key === 'Enter' && results[selected]) { onNavigate(results[selected].nav); onClose() }
  }

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:100, paddingTop:'12vh' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width:'100%', maxWidth:580, background:'var(--surface)', borderRadius:10, overflow:'hidden', border:'1px solid rgba(57,255,20,0.15)', boxShadow:'0 20px 60px rgba(0,0,0,0.6)' }}>

        {/* Input */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0.85rem 1rem', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <Search size={16} style={{ color:'var(--phosphor)', flexShrink:0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Buscar tickets, activos, tareas, insumos..."
            style={{ flex:1, background:'none', border:'none', outline:'none', color:'var(--text)', fontSize:'0.9rem', fontFamily:'inherit' }}
          />
          {loading && (
            <div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid var(--phosphor)', borderTopColor:'transparent', animation:'spin 0.7s linear infinite', flexShrink:0 }} />
          )}
          <button onClick={onClose} style={{ background:'none', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, padding:'2px 6px', cursor:'pointer', color:'var(--text-dim)', fontSize:'0.62rem', fontFamily:'monospace' }}>
            ESC
          </button>
        </div>

        {/* Results */}
        <div style={{ maxHeight:380, overflowY:'auto' }}>
          {results.length === 0 && query.length >= 2 && !loading && (
            <div style={{ padding:'2rem', textAlign:'center', color:'var(--text-dim)', fontSize:'0.8rem' }}>
              Sin resultados para "{query}"
            </div>
          )}
          {results.length === 0 && query.length < 2 && (
            <div style={{ padding:'1.5rem 1rem' }}>
              <p style={{ fontSize:'0.62rem', color:'rgba(57,255,20,0.4)', fontFamily:'monospace', letterSpacing:'0.1em', marginBottom:8 }}>ACCESOS RÁPIDOS</p>
              {[
                { label:'Tickets de mantenimiento', nav:'mntTickets', color:'#f97316' },
                { label:'Tablero Kanban', nav:'mntKanban', color:'#50b4ff' },
                { label:'Planes preventivos', nav:'mntPlanes', color:'#39FF14' },
                { label:'No Conformidades', nav:'noConformidades', color:'#ff5050' },
              ].map(r => (
                <button key={r.nav} onClick={() => { onNavigate(r.nav); onClose() }}
                  style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'0.5rem 0.75rem', background:'rgba(255,255,255,0.02)', border:'none', cursor:'pointer', borderRadius:5, marginBottom:4, color:'var(--text)', fontSize:'0.8rem', textAlign:'left' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(57,255,20,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                >
                  <span style={{ width:6, height:6, borderRadius:'50%', background:r.color, flexShrink:0 }} />
                  {r.label}
                </button>
              ))}
            </div>
          )}
          {results.map((r, i) => {
            const TypeInfo = RESULT_TYPES[r.tipo] || RESULT_TYPES.ticket
            const Icon = TypeInfo.icon
            return (
              <button
                key={r.id}
                onClick={() => { onNavigate(r.nav); onClose() }}
                onMouseEnter={() => setSelected(i)}
                style={{
                  display:'flex', alignItems:'center', gap:10, width:'100%',
                  padding:'0.65rem 1rem', background: i === selected ? 'rgba(57,255,20,0.06)' : 'transparent',
                  border:'none', borderLeft: i === selected ? '2px solid var(--phosphor)' : '2px solid transparent',
                  cursor:'pointer', textAlign:'left', transition:'all 0.1s',
                }}
              >
                <Icon size={14} style={{ color:TypeInfo.color, flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:'0.82rem', color:'var(--text)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {r.titulo}
                  </p>
                  {r.sub && <p style={{ fontSize:'0.65rem', color:'var(--text-dim)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.sub}</p>}
                </div>
                <span style={{ fontSize:'0.58rem', padding:'2px 6px', borderRadius:3, background:`${TypeInfo.color}18`, color:TypeInfo.color, fontFamily:'monospace', flexShrink:0 }}>
                  {TypeInfo.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding:'0.4rem 1rem', borderTop:'1px solid rgba(255,255,255,0.04)', display:'flex', gap:12, alignItems:'center' }}>
          {[['↑↓','Navegar'],['↵','Ir'],['Esc','Cerrar']].map(([k,l]) => (
            <span key={k} style={{ fontSize:'0.58rem', color:'var(--text-dim)', display:'flex', gap:4, alignItems:'center' }}>
              <kbd style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:3, padding:'1px 5px', fontFamily:'monospace', fontSize:'0.6rem' }}>{k}</kbd>
              {l}
            </span>
          ))}
        </div>
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}
